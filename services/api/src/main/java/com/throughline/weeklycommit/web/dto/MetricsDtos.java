package com.throughline.weeklycommit.web.dto;

/** DTOs for the Phase 7 metrics endpoint. */
public final class MetricsDtos {
  private MetricsDtos() {}

  /**
   * The four impact metrics from PRD §10.5 (P1) plus the derived planning-session P50 (the brief's
   * "time-to-plan" signal). Rates are 0.0–1.0; minutes are simple averages or P50.
   */
  public record OrgMetrics(
      double planningCompletionRate,
      double reconciliationStrictPct,
      double reconciliationWeightedPct,
      double avgManagerDigestViewMinutesAfterDeliver,
      long planningSessionMinutesP50) {}
}
