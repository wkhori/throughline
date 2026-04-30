package com.throughline.weeklycommit.application.week;

import com.throughline.weeklycommit.application.commit.CommitService;
import com.throughline.weeklycommit.application.lifecycle.WeekStateMachine;
import com.throughline.weeklycommit.domain.Commit;
import com.throughline.weeklycommit.domain.CommitState;
import com.throughline.weeklycommit.domain.Org;
import com.throughline.weeklycommit.domain.ReconciliationOutcome;
import com.throughline.weeklycommit.domain.User;
import com.throughline.weeklycommit.domain.Week;
import com.throughline.weeklycommit.domain.exception.LifecycleConflictException;
import com.throughline.weeklycommit.domain.repo.CommitRepository;
import com.throughline.weeklycommit.domain.repo.OrgRepository;
import com.throughline.weeklycommit.domain.repo.WeekRepository;
import com.throughline.weeklycommit.web.dto.WeekDtos;
import com.throughline.weeklycommit.web.error.NotFoundException;
import com.throughline.weeklycommit.web.error.ProblemDetails;
import com.throughline.weeklycommit.web.error.ValidationException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Phase-3 reconcile + carry-forward orchestration. Validates each reconcile item, mutates each
 * commit, spawns CARRIED_FORWARD lineage rows in week N+1, then asks the state machine to mark the
 * week RECONCILED (which fires the AFTER_COMMIT event).
 */
@Service
public class ReconcileService {

  private final WeekRepository weekRepo;
  private final CommitRepository commitRepo;
  private final OrgRepository orgRepo;
  private final WeekStateMachine stateMachine;
  private final WeekService weekService;

  public ReconcileService(
      WeekRepository weekRepo,
      CommitRepository commitRepo,
      OrgRepository orgRepo,
      WeekStateMachine stateMachine,
      WeekService weekService) {
    this.weekRepo = weekRepo;
    this.commitRepo = commitRepo;
    this.orgRepo = orgRepo;
    this.stateMachine = stateMachine;
    this.weekService = weekService;
  }

  @Transactional
  public WeekDtos.WeekDto startReconcile(String weekId, User user) {
    Week week = weekRepo.findById(weekId).orElseThrow(() -> new NotFoundException("Week", weekId));
    requireOwner(week, user);
    Org org =
        orgRepo
            .findById(week.getOrgId())
            .orElseThrow(() -> new NotFoundException("Org", week.getOrgId()));
    stateMachine.startReconcile(week, org);
    weekRepo.save(week);
    return weekService.toDto(week);
  }

  @Transactional
  public WeekDtos.ReconcileResponse submitReconcile(
      String weekId, WeekDtos.ReconcileRequest req, User user) {
    Week week = weekRepo.findById(weekId).orElseThrow(() -> new NotFoundException("Week", weekId));
    requireOwner(week, user);
    Org org =
        orgRepo
            .findById(week.getOrgId())
            .orElseThrow(() -> new NotFoundException("Org", week.getOrgId()));

    List<Commit> commits = commitRepo.findAllByWeekIdOrderByDisplayOrderAsc(week.getId());
    Map<String, Commit> byId = new HashMap<>();
    for (Commit c : commits) byId.put(c.getId(), c);

    List<ProblemDetails.FieldError> errors = validateItems(req, byId);
    if (!errors.isEmpty()) throw new ValidationException(errors);

    // Apply outcomes + collect carry-forward items.
    List<WeekDtos.ReconcileItem> carryForwardItems = new ArrayList<>();
    for (WeekDtos.ReconcileItem item : req.items()) {
      Commit c = byId.get(item.commitId());
      c.setReconciliationOutcome(ReconciliationOutcome.valueOf(item.outcome()));
      c.setReconciliationNote(item.note());
      if (item.carryForward()) carryForwardItems.add(item);
    }

    // Spawn carry-forward chain into week N+1 (creating the week if missing).
    if (!carryForwardItems.isEmpty()) {
      LocalDate nextWeekStart = stateMachine.nextWeekStart(org, week.getWeekStart());
      Week nextWeek =
          weekRepo
              .findByUserIdAndWeekStart(user.getId(), nextWeekStart)
              .orElseGet(
                  () -> weekRepo.save(new Week(user.getId(), user.getOrgId(), nextWeekStart)));
      long existingCount = commitRepo.countByWeekId(nextWeek.getId());
      if (existingCount + carryForwardItems.size() > CommitService.MAX_COMMITS_PER_WEEK) {
        throw new LifecycleConflictException(
            "Cannot carry forward — next week is at the 7-commit cap (would exceed by "
                + (existingCount + carryForwardItems.size() - CommitService.MAX_COMMITS_PER_WEEK)
                + ")");
      }
      int order = (int) existingCount;
      for (WeekDtos.ReconcileItem item : carryForwardItems) {
        Commit original = byId.get(item.commitId());
        Commit child = new Commit(nextWeek.getId(), original.getText());
        child.setSupportingOutcomeId(original.getSupportingOutcomeId());
        child.setCategory(original.getCategory());
        child.setPriority(original.getPriority());
        child.setParentCommitId(original.getId());
        child.setCarryForwardWeeks(original.getCarryForwardWeeks() + 1);
        child.setDisplayOrder(order++);
        commitRepo.save(child);
        original.setState(CommitState.CARRIED_FORWARD);
      }
    }

    stateMachine.markReconciled(week);
    weekRepo.save(week);
    // T4 alignment delta wires in Phase 5b — return null until then.
    return new WeekDtos.ReconcileResponse(weekService.toDto(week), null);
  }

  private static List<ProblemDetails.FieldError> validateItems(
      WeekDtos.ReconcileRequest req, Map<String, Commit> byId) {
    List<ProblemDetails.FieldError> errors = new ArrayList<>();
    if (req.items() == null || req.items().isEmpty()) {
      errors.add(new ProblemDetails.FieldError("items", "must contain one entry per commit"));
      return errors;
    }
    if (req.items().size() != byId.size()) {
      errors.add(
          new ProblemDetails.FieldError(
              "items",
              "must contain exactly one entry per commit (expected "
                  + byId.size()
                  + ", got "
                  + req.items().size()
                  + ")"));
    }
    for (int i = 0; i < req.items().size(); i++) {
      WeekDtos.ReconcileItem item = req.items().get(i);
      String prefix = "items[" + i + "]";
      if (item.commitId() == null || !byId.containsKey(item.commitId())) {
        errors.add(
            new ProblemDetails.FieldError(prefix + ".commitId", "unknown commit for this week"));
        continue;
      }
      ReconciliationOutcome outcome;
      try {
        outcome = ReconciliationOutcome.valueOf(item.outcome());
      } catch (IllegalArgumentException ex) {
        errors.add(
            new ProblemDetails.FieldError(
                prefix + ".outcome", "must be one of DONE|PARTIAL|NOT_DONE"));
        continue;
      }
      if (item.carryForward() && outcome == ReconciliationOutcome.DONE) {
        errors.add(
            new ProblemDetails.FieldError(
                prefix + ".carryForward",
                "carry-forward only legal for PARTIAL or NOT_DONE outcomes"));
      }
      if (item.note() != null && item.note().length() > 1000) {
        errors.add(
            new ProblemDetails.FieldError(
                prefix + ".note", "reconciliation note must be 1000 characters or fewer"));
      }
    }
    return errors;
  }

  private static void requireOwner(Week week, User user) {
    if (!week.getUserId().equals(user.getId())) {
      throw new AccessDeniedException("Week is not owned by current user");
    }
  }
}
