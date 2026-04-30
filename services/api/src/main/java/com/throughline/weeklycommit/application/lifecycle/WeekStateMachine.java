package com.throughline.weeklycommit.application.lifecycle;

import com.throughline.weeklycommit.domain.Commit;
import com.throughline.weeklycommit.domain.Org;
import com.throughline.weeklycommit.domain.Week;
import com.throughline.weeklycommit.domain.WeekState;
import com.throughline.weeklycommit.domain.repo.CommitRepository;
import com.throughline.weeklycommit.web.error.ProblemDetails;
import com.throughline.weeklycommit.web.error.ValidationException;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.List;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Single source of truth for week-level state transitions (PRD §5). All transitions go through this
 * service; controllers never write {@code Week.state} directly. Idempotent on terminal states —
 * replay of {@code lock} on a LOCKED week returns the existing snapshot (P8).
 */
@Service
public class WeekStateMachine {

  private final CommitRepository commitRepo;
  private final ApplicationEventPublisher events;
  private final Clock clock;

  public WeekStateMachine(
      CommitRepository commitRepo, ApplicationEventPublisher events, Clock clock) {
    this.commitRepo = commitRepo;
    this.events = events;
    this.clock = clock;
  }

  /**
   * Transition DRAFT → LOCKED. Validates ≥1 commit and every commit has a SupportingOutcome.
   * Idempotent on already-LOCKED weeks (replay returns silently — caller observes the unchanged
   * {@code lockedAt}). Rejects RECONCILING/RECONCILED with {@link IllegalStateException} (mapped to
   * 409 by {@code GlobalExceptionHandler}).
   *
   * @return whether a state transition actually occurred (false on idempotent replay)
   */
  @Transactional
  public boolean lock(Week week) {
    if (week.getState() == WeekState.LOCKED) {
      // P8: idempotent replay — no event re-fire, no AIInsight re-persist.
      return false;
    }
    if (week.getState() != WeekState.DRAFT) {
      throw new com.throughline.weeklycommit.domain.exception.LifecycleConflictException(
          "Cannot lock week in state " + week.getState() + " (expected DRAFT)");
    }
    List<Commit> commits = commitRepo.findAllByWeekIdOrderByDisplayOrderAsc(week.getId());
    List<ProblemDetails.FieldError> errors = new ArrayList<>();
    if (commits.isEmpty()) {
      errors.add(
          new ProblemDetails.FieldError("commits", "must contain at least one commit to lock"));
    }
    for (int i = 0; i < commits.size(); i++) {
      if (commits.get(i).getSupportingOutcomeId() == null) {
        errors.add(
            new ProblemDetails.FieldError(
                "commits[" + i + "].supportingOutcomeId",
                "every commit must be linked to a Supporting Outcome before lock"));
      }
    }
    if (!errors.isEmpty()) throw new ValidationException(errors);
    week.setState(WeekState.LOCKED);
    week.setLockedAt(Instant.now(clock));
    // PortfolioReviewService and NotificationLifecycleListener consume WeekLockedEvent
    // AFTER_COMMIT — T3 runs out-of-band so lock latency stays under the perf gate.
    events.publishEvent(new WeekLockedEvent(week.getId(), week.getUserId(), week.getOrgId()));
    return true;
  }

  /**
   * Compute the week-start date for a given moment in the org's timezone, honoring {@link
   * Org#getWeekStartDayOfWeek()}. DST-safe via {@code atZone(orgTz).toLocalDate()} so spring-
   * forward gaps don't throw.
   */
  public LocalDate currentWeekStart(Org org) {
    ZoneId tz = ZoneId.of(org.getTimezone());
    LocalDate localToday = ZonedDateTime.now(clock.withZone(tz)).toLocalDate();
    DayOfWeek startDay = org.getWeekStartDayOfWeek();
    return localToday.with(TemporalAdjusters.previousOrSame(startDay));
  }

  /**
   * P19: derive the week N+1 date from the current week's start using {@code atZone(orgTz)
   * .plusDays(7).truncatedTo(DAY)}. Never use {@code plusWeeks} — that does calendar math that
   * trips DST/year-boundary transitions.
   */
  public LocalDate nextWeekStart(Org org, LocalDate currentWeekStart) {
    ZoneId tz = ZoneId.of(org.getTimezone());
    return currentWeekStart.atStartOfDay(tz).plusDays(7).toLocalDate();
  }

  /**
   * Transition LOCKED → RECONCILING. P18: enforces that the org's reconcile window is open (current
   * local time is at or past {@code reconcileOpensDayOfWeek} + {@code reconcileOpensTime} for the
   * week's owner-org timezone).
   */
  @Transactional
  public void startReconcile(Week week, Org org) {
    if (week.getState() == WeekState.RECONCILING) return; // idempotent
    if (week.getState() != WeekState.LOCKED) {
      throw new com.throughline.weeklycommit.domain.exception.LifecycleConflictException(
          "Cannot start reconcile from state " + week.getState() + " (expected LOCKED)");
    }
    ZoneId tz = ZoneId.of(org.getTimezone());
    ZonedDateTime nowLocal = ZonedDateTime.now(clock.withZone(tz));
    ZonedDateTime windowOpens =
        week.getWeekStart()
            .with(TemporalAdjusters.nextOrSame(org.getReconcileOpensDayOfWeek()))
            .atTime(org.getReconcileOpensTime())
            .atZone(tz);
    if (nowLocal.isBefore(windowOpens)) {
      throw new com.throughline.weeklycommit.domain.exception.LifecycleConflictException(
          "reconcile window not yet open — opens "
              + org.getReconcileOpensDayOfWeek()
              + " at "
              + org.getReconcileOpensTime());
    }
    week.setState(WeekState.RECONCILING);
  }

  /**
   * Transition RECONCILING → RECONCILED. Caller has already validated each item; this method just
   * stamps the timestamp and fires the event AFTER_COMMIT.
   */
  @Transactional
  public void markReconciled(Week week) {
    if (week.getState() == WeekState.RECONCILED) return;
    if (week.getState() != WeekState.RECONCILING) {
      throw new com.throughline.weeklycommit.domain.exception.LifecycleConflictException(
          "Cannot reconcile from state " + week.getState() + " (expected RECONCILING)");
    }
    week.setState(WeekState.RECONCILED);
    week.setReconciledAt(Instant.now(clock));
    // AlignmentDeltaService (T4), MaterializedRollupJob, and NotificationLifecycleListener
    // consume WeekReconciledEvent AFTER_COMMIT.
    events.publishEvent(new WeekReconciledEvent(week.getId(), week.getUserId(), week.getOrgId()));
  }
}
