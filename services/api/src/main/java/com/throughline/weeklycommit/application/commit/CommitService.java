package com.throughline.weeklycommit.application.commit;

import com.throughline.weeklycommit.application.week.WeekService;
import com.throughline.weeklycommit.domain.Commit;
import com.throughline.weeklycommit.domain.CommitCategory;
import com.throughline.weeklycommit.domain.CommitPriority;
import com.throughline.weeklycommit.domain.CommitState;
import com.throughline.weeklycommit.domain.SupportingOutcome;
import com.throughline.weeklycommit.domain.User;
import com.throughline.weeklycommit.domain.Week;
import com.throughline.weeklycommit.domain.WeekState;
import com.throughline.weeklycommit.domain.repo.CommitRepository;
import com.throughline.weeklycommit.domain.repo.SupportingOutcomeRepository;
import com.throughline.weeklycommit.domain.repo.WeekRepository;
import com.throughline.weeklycommit.web.dto.WeekDtos;
import com.throughline.weeklycommit.web.error.NotFoundException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CommitService {

  /** Soft cap on commits per week — PRD §16 ("max commits per IC per week: 7"). */
  public static final int MAX_COMMITS_PER_WEEK = 7;

  private final CommitRepository commitRepo;
  private final WeekRepository weekRepo;
  private final SupportingOutcomeRepository soRepo;

  public CommitService(
      CommitRepository commitRepo, WeekRepository weekRepo, SupportingOutcomeRepository soRepo) {
    this.commitRepo = commitRepo;
    this.weekRepo = weekRepo;
    this.soRepo = soRepo;
  }

  @Transactional
  public WeekDtos.CommitDto create(WeekDtos.CreateCommitRequest req, User user) {
    Week week =
        weekRepo
            .findById(req.weekId())
            .orElseThrow(() -> new NotFoundException("Week", req.weekId()));
    requireOwner(week, user);
    requireDraft(week);
    if (commitRepo.countByWeekId(week.getId()) >= MAX_COMMITS_PER_WEEK) {
      throw new IllegalStateException(
          "Week is at the 7-commit cap; remove or reschedule a commit before adding another");
    }
    if (req.supportingOutcomeId() != null) {
      requireValidSO(req.supportingOutcomeId());
    }
    Commit c = new Commit(week.getId(), req.text());
    c.setSupportingOutcomeId(req.supportingOutcomeId());
    c.setCategory(parseCategory(req.category()));
    c.setPriority(parsePriority(req.priority()));
    c.setDisplayOrder((int) commitRepo.countByWeekId(week.getId()));
    commitRepo.save(c);
    return WeekService.toCommitDto(c);
  }

  @Transactional
  public WeekDtos.CommitDto update(String id, WeekDtos.UpdateCommitRequest req, User user) {
    Commit c = commitRepo.findById(id).orElseThrow(() -> new NotFoundException("Commit", id));
    Week week =
        weekRepo
            .findById(c.getWeekId())
            .orElseThrow(() -> new NotFoundException("Week", c.getWeekId()));
    requireOwner(week, user);
    requireDraft(week);
    if (req.supportingOutcomeId() != null) {
      requireValidSO(req.supportingOutcomeId());
    }
    c.setText(req.text());
    c.setSupportingOutcomeId(req.supportingOutcomeId());
    c.setCategory(parseCategory(req.category()));
    c.setPriority(parsePriority(req.priority()));
    return WeekService.toCommitDto(c);
  }

  @Transactional
  public void delete(String id, User user) {
    Commit c = commitRepo.findById(id).orElseThrow(() -> new NotFoundException("Commit", id));
    Week week =
        weekRepo
            .findById(c.getWeekId())
            .orElseThrow(() -> new NotFoundException("Week", c.getWeekId()));
    requireOwner(week, user);
    requireDraft(week);
    commitRepo.delete(c);
  }

  private void requireValidSO(String soId) {
    SupportingOutcome so =
        soRepo.findById(soId).orElseThrow(() -> new NotFoundException("SupportingOutcome", soId));
    if (so.isArchived()) {
      throw new IllegalStateException("Cannot link to an archived Supporting Outcome");
    }
  }

  private static void requireOwner(Week week, User user) {
    if (!week.getUserId().equals(user.getId())) {
      throw new AccessDeniedException("Week is not owned by current user");
    }
  }

  private static void requireDraft(Week week) {
    if (week.getState() != WeekState.DRAFT) {
      throw new IllegalStateException(
          "Cannot mutate commits while week is in state " + week.getState() + " (must be DRAFT)");
    }
  }

  private static CommitCategory parseCategory(String value) {
    try {
      return CommitCategory.valueOf(value);
    } catch (IllegalArgumentException ex) {
      throw new IllegalArgumentException(
          "category must be one of STRATEGIC|OPERATIONAL|REACTIVE; got " + value);
    }
  }

  private static CommitPriority parsePriority(String value) {
    try {
      return CommitPriority.valueOf(value);
    } catch (IllegalArgumentException ex) {
      throw new IllegalArgumentException("priority must be one of MUST|SHOULD|COULD; got " + value);
    }
  }

  /**
   * Reserved for the Phase-3 carry-forward path; lives here so all commit mutations stay in one
   * place.
   */
  public CommitState terminalCarriedForwardState() {
    return CommitState.CARRIED_FORWARD;
  }
}
