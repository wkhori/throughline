package com.throughline.weeklycommit.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class WeekDtos {
  private WeekDtos() {}

  public record WeekDto(
      String id,
      String userId,
      String orgId,
      LocalDate weekStart,
      String state,
      Instant lockedAt,
      Instant reconciledAt,
      List<CommitDto> commits) {}

  public record CommitDto(
      String id,
      String weekId,
      String text,
      String supportingOutcomeId,
      String category,
      String priority,
      int displayOrder,
      String state,
      String parentCommitId,
      String reconciliationOutcome,
      String reconciliationNote,
      int carryForwardWeeks) {}

  public record LockResponse(WeekDto week, Object portfolioReview) {}

  public record CreateCommitRequest(
      @NotBlank String weekId,
      @NotBlank @Size(min = 5, max = 280) String text,
      String supportingOutcomeId,
      @NotNull String category,
      @NotNull String priority) {}

  public record UpdateCommitRequest(
      @NotBlank @Size(min = 5, max = 280) String text,
      String supportingOutcomeId,
      @NotNull String category,
      @NotNull String priority) {}

  public record ReconcileItem(
      @NotBlank String commitId,
      @NotNull String outcome,
      @Size(max = 1000) String note,
      boolean carryForward) {}

  public record ReconcileRequest(@NotNull java.util.List<ReconcileItem> items) {}

  public record ReconcileResponse(WeekDto week, Object alignmentDelta) {}
}
