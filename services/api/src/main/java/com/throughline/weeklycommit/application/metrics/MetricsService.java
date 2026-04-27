package com.throughline.weeklycommit.application.metrics;

import com.throughline.weeklycommit.application.lifecycle.WeekStateMachine;
import com.throughline.weeklycommit.domain.Commit;
import com.throughline.weeklycommit.domain.NotificationEvent;
import com.throughline.weeklycommit.domain.Org;
import com.throughline.weeklycommit.domain.ReconciliationOutcome;
import com.throughline.weeklycommit.domain.Role;
import com.throughline.weeklycommit.domain.User;
import com.throughline.weeklycommit.domain.Week;
import com.throughline.weeklycommit.domain.WeekState;
import com.throughline.weeklycommit.domain.repo.CommitRepository;
import com.throughline.weeklycommit.domain.repo.NotificationEventRepository;
import com.throughline.weeklycommit.domain.repo.OrgRepository;
import com.throughline.weeklycommit.domain.repo.UserRepository;
import com.throughline.weeklycommit.domain.repo.WeekRepository;
import com.throughline.weeklycommit.web.dto.MetricsDtos;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Phase 7 — read-only aggregator for the four impact metrics in PRD §10.5 (P1):
 *
 * <ul>
 *   <li>{@code planningCompletionRate} — share of org ICs whose current-week is locked.
 *   <li>{@code reconciliationStrictPct} — DONE commits / reconciled commits over last 4 weeks.
 *   <li>{@code reconciliationWeightedPct} — same window, DONE=1 + PARTIAL=0.5.
 *   <li>{@code avgManagerDigestViewMinutesAfterDeliver} — avg minutes between digest sentAt and
 *       first viewedAt.
 *   <li>{@code planningSessionMinutesP50} — P50 minutes between week createdAt and lockedAt.
 * </ul>
 *
 * <p>All metrics aggregate at read time — no precompute job; demo-scale row counts make this fine.
 */
@Service
public class MetricsService {

  private static final int RECONCILIATION_WINDOW_WEEKS = 4;

  private final OrgRepository orgRepo;
  private final UserRepository userRepo;
  private final WeekRepository weekRepo;
  private final CommitRepository commitRepo;
  private final NotificationEventRepository notificationRepo;
  private final WeekStateMachine stateMachine;
  private final Clock clock;

  public MetricsService(
      OrgRepository orgRepo,
      UserRepository userRepo,
      WeekRepository weekRepo,
      CommitRepository commitRepo,
      NotificationEventRepository notificationRepo,
      WeekStateMachine stateMachine,
      Clock clock) {
    this.orgRepo = orgRepo;
    this.userRepo = userRepo;
    this.weekRepo = weekRepo;
    this.commitRepo = commitRepo;
    this.notificationRepo = notificationRepo;
    this.stateMachine = stateMachine;
    this.clock = clock;
  }

  @Transactional(readOnly = true)
  public MetricsDtos.OrgMetrics computeForOrg(String orgId) {
    Org org = orgRepo.findById(orgId).orElseThrow();
    List<User> orgIcs =
        userRepo.findAll().stream()
            .filter(u -> orgId.equals(u.getOrgId()))
            .filter(u -> u.getRole() == Role.IC)
            .toList();
    LocalDate currentWeekStart = stateMachine.currentWeekStart(org);

    return new MetricsDtos.OrgMetrics(
        planningCompletionRate(orgIcs, currentWeekStart),
        reconciliationStrictPct(orgIcs, currentWeekStart),
        reconciliationWeightedPct(orgIcs, currentWeekStart),
        avgManagerDigestViewMinutesAfterDeliver(orgId),
        planningSessionMinutesP50(orgIcs));
  }

  // ---------------------------------------------------------------------------------------------

  /** Share of ICs whose current-week is in LOCKED, RECONCILING, or RECONCILED. */
  double planningCompletionRate(List<User> orgIcs, LocalDate weekStart) {
    if (orgIcs.isEmpty()) return 0.0;
    long locked = 0;
    for (User u : orgIcs) {
      Week w = weekRepo.findByUserIdAndWeekStart(u.getId(), weekStart).orElse(null);
      if (w != null && w.getState() != WeekState.DRAFT) locked++;
    }
    return (double) locked / orgIcs.size();
  }

  /** DONE commits ÷ reconciled commits, over the last `RECONCILIATION_WINDOW_WEEKS`. */
  double reconciliationStrictPct(List<User> orgIcs, LocalDate currentWeekStart) {
    LocalDate fromWeek = currentWeekStart.minusWeeks(RECONCILIATION_WINDOW_WEEKS);
    long done = 0;
    long reconciled = 0;
    for (User u : orgIcs) {
      for (Commit c : commitsForUserInRange(u.getId(), fromWeek, currentWeekStart)) {
        ReconciliationOutcome o = c.getReconciliationOutcome();
        if (o == null) continue;
        reconciled++;
        if (o == ReconciliationOutcome.DONE) done++;
      }
    }
    return reconciled == 0 ? 0.0 : (double) done / reconciled;
  }

  /** DONE × 1.0 + PARTIAL × 0.5 ÷ reconciled commits. */
  double reconciliationWeightedPct(List<User> orgIcs, LocalDate currentWeekStart) {
    LocalDate fromWeek = currentWeekStart.minusWeeks(RECONCILIATION_WINDOW_WEEKS);
    double weighted = 0.0;
    long reconciled = 0;
    for (User u : orgIcs) {
      for (Commit c : commitsForUserInRange(u.getId(), fromWeek, currentWeekStart)) {
        ReconciliationOutcome o = c.getReconciliationOutcome();
        if (o == null) continue;
        reconciled++;
        if (o == ReconciliationOutcome.DONE) weighted += 1.0;
        else if (o == ReconciliationOutcome.PARTIAL) weighted += 0.5;
      }
    }
    return reconciled == 0 ? 0.0 : weighted / reconciled;
  }

  /** Average gap between digest sentAt and viewedAt in minutes. Null sentAt or viewedAt skipped. */
  double avgManagerDigestViewMinutesAfterDeliver(String orgId) {
    List<NotificationEvent> digests = notificationRepo.findSentDigestsForOrg(orgId);
    long total = 0;
    long count = 0;
    for (NotificationEvent e : digests) {
      Instant sent = e.getSentAt();
      Instant viewed = e.getViewedAt();
      if (sent == null || viewed == null) continue;
      long minutes = Duration.between(sent, viewed).toMinutes();
      if (minutes < 0) continue;
      total += minutes;
      count++;
    }
    return count == 0 ? 0.0 : (double) total / count;
  }

  /** P50 minutes between Week createdAt and lockedAt for the org's ICs (current + last 4 weeks). */
  long planningSessionMinutesP50(List<User> orgIcs) {
    List<Long> samples = new ArrayList<>();
    for (User u : orgIcs) {
      for (Week w : weekRepo.findAll()) {
        if (!u.getId().equals(w.getUserId())) continue;
        if (w.getCreatedAt() == null || w.getLockedAt() == null) continue;
        long mins = Duration.between(w.getCreatedAt(), w.getLockedAt()).toMinutes();
        if (mins < 0) continue;
        samples.add(mins);
      }
    }
    if (samples.isEmpty()) return 0;
    Collections.sort(samples);
    return samples.get(samples.size() / 2);
  }

  private List<Commit> commitsForUserInRange(
      String userId, LocalDate fromWeekStart, LocalDate toWeekStart) {
    List<Commit> out = new ArrayList<>();
    for (Week w : weekRepo.findAll()) {
      if (!userId.equals(w.getUserId())) continue;
      if (w.getWeekStart().isBefore(fromWeekStart)) continue;
      if (w.getWeekStart().isAfter(toWeekStart)) continue;
      out.addAll(commitRepo.findAllByWeekIdOrderByDisplayOrderAsc(w.getId()));
    }
    return out;
  }
}
