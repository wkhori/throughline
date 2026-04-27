package com.throughline.weeklycommit.application.week;

import com.throughline.weeklycommit.application.lifecycle.WeekStateMachine;
import com.throughline.weeklycommit.domain.Commit;
import com.throughline.weeklycommit.domain.Org;
import com.throughline.weeklycommit.domain.User;
import com.throughline.weeklycommit.domain.Week;
import com.throughline.weeklycommit.domain.repo.CommitRepository;
import com.throughline.weeklycommit.domain.repo.OrgRepository;
import com.throughline.weeklycommit.domain.repo.WeekRepository;
import com.throughline.weeklycommit.web.dto.WeekDtos;
import com.throughline.weeklycommit.web.error.NotFoundException;
import java.time.LocalDate;
import java.util.List;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WeekService {

  private final WeekRepository weekRepo;
  private final CommitRepository commitRepo;
  private final OrgRepository orgRepo;
  private final WeekStateMachine stateMachine;

  public WeekService(
      WeekRepository weekRepo,
      CommitRepository commitRepo,
      OrgRepository orgRepo,
      WeekStateMachine stateMachine) {
    this.weekRepo = weekRepo;
    this.commitRepo = commitRepo;
    this.orgRepo = orgRepo;
    this.stateMachine = stateMachine;
  }

  /**
   * Resolves the current week for {@code user} in their org's timezone, creating a DRAFT row on
   * first visit. Idempotent — repeat calls within the same week return the same row.
   */
  @Transactional
  public WeekDtos.WeekDto getOrCreateCurrentWeek(User user) {
    Org org =
        orgRepo
            .findById(user.getOrgId())
            .orElseThrow(() -> new NotFoundException("Org", user.getOrgId()));
    LocalDate weekStart = stateMachine.currentWeekStart(org);
    Week week =
        weekRepo
            .findByUserIdAndWeekStart(user.getId(), weekStart)
            .orElseGet(() -> weekRepo.save(new Week(user.getId(), user.getOrgId(), weekStart)));
    return toDto(week);
  }

  @Transactional(readOnly = true)
  public WeekDtos.WeekDto getWeek(String weekId, User user) {
    Week week = weekRepo.findById(weekId).orElseThrow(() -> new NotFoundException("Week", weekId));
    requireOwner(week, user);
    return toDto(week);
  }

  @Transactional
  public WeekDtos.LockResponse lock(String weekId, User user) {
    Week week = weekRepo.findById(weekId).orElseThrow(() -> new NotFoundException("Week", weekId));
    requireOwner(week, user);
    stateMachine.lock(week);
    Week saved = weekRepo.save(week);
    // T3 Portfolio Review (Sonnet) is wired in Phase 5b. Until then, the lock contract returns
    // portfolioReview=null per the orchestration plan continue-and-defer rule.
    return new WeekDtos.LockResponse(toDto(saved), null);
  }

  WeekDtos.WeekDto toDto(Week week) {
    List<Commit> commits = commitRepo.findAllByWeekIdOrderByDisplayOrderAsc(week.getId());
    return new WeekDtos.WeekDto(
        week.getId(),
        week.getUserId(),
        week.getOrgId(),
        week.getWeekStart(),
        week.getState().name(),
        week.getLockedAt(),
        week.getReconciledAt(),
        commits.stream().map(WeekService::toCommitDto).toList());
  }

  public static WeekDtos.CommitDto toCommitDto(Commit c) {
    return new WeekDtos.CommitDto(
        c.getId(),
        c.getWeekId(),
        c.getText(),
        c.getSupportingOutcomeId(),
        c.getCategory().name(),
        c.getPriority().name(),
        c.getDisplayOrder(),
        c.getState().name(),
        c.getParentCommitId(),
        c.getReconciliationOutcome() == null ? null : c.getReconciliationOutcome().name(),
        c.getReconciliationNote(),
        c.getCarryForwardWeeks());
  }

  static void requireOwner(Week week, User user) {
    if (!week.getUserId().equals(user.getId())) {
      throw new AccessDeniedException("Week is not owned by current user");
    }
  }
}
