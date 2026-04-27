package com.throughline.weeklycommit.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;

public final class RcdoDtos {
  private RcdoDtos() {}

  public record TreeDto(List<RallyCryDto> rallyCries) {}

  public record RallyCryDto(
      String id,
      String title,
      String description,
      int displayOrder,
      Instant archivedAt,
      List<DefiningObjectiveDto> definingObjectives) {}

  public record DefiningObjectiveDto(
      String id,
      String rallyCryId,
      String title,
      String description,
      int displayOrder,
      Instant archivedAt,
      List<OutcomeDto> outcomes) {}

  public record OutcomeDto(
      String id,
      String definingObjectiveId,
      String title,
      String description,
      String metricStatement,
      int displayOrder,
      Instant archivedAt,
      List<SupportingOutcomeDto> supportingOutcomes) {}

  public record SupportingOutcomeDto(
      String id,
      String outcomeId,
      String title,
      String description,
      int displayOrder,
      Instant archivedAt) {}

  public record CreateRallyCryRequest(
      @NotBlank @Size(min = 5, max = 500) String title,
      @Size(max = 4000) String description,
      Integer displayOrder) {}

  public record UpdateRallyCryRequest(
      @NotBlank @Size(min = 5, max = 500) String title,
      @Size(max = 4000) String description,
      Integer displayOrder) {}

  public record CreateDefiningObjectiveRequest(
      @NotBlank String rallyCryId,
      @NotBlank @Size(min = 5, max = 500) String title,
      @Size(max = 4000) String description,
      Integer displayOrder) {}

  public record CreateOutcomeRequest(
      @NotBlank String definingObjectiveId,
      @NotBlank @Size(min = 5, max = 500) String title,
      @Size(max = 4000) String description,
      @Size(max = 4000) String metricStatement,
      Integer displayOrder) {}

  public record CreateSupportingOutcomeRequest(
      @NotBlank String outcomeId,
      @NotBlank @Size(min = 5, max = 500) String title,
      @Size(max = 4000) String description,
      Integer displayOrder) {}
}
