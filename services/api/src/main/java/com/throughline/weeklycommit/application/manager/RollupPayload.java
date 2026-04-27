package com.throughline.weeklycommit.application.manager;

import java.time.LocalDate;
import java.util.List;

/**
 * Materialized payload stored in {@code team_rollup_cache.payload_json} (PRD §3.3 V5 schema
 * comment). Computed by {@code MaterializedRollupJob.computePayload}; consumed by {@code
 * /manager/team-rollup}.
 *
 * <p>All numeric shares are floats in [0, 1]. {@code commitsByOutcome} is sorted by share desc.
 */
public record RollupPayload(
    String teamId,
    String teamName,
    LocalDate weekStart,
    int memberCount,
    int lockedCount,
    int reconciledCount,
    int doneCount,
    int partialCount,
    int notDoneCount,
    int carryForwardCount,
    List<OutcomeShare> commitsByOutcome,
    List<StarvedOutcome> starvedOutcomes,
    List<PriorityDrift> driftExceptions,
    List<RibbonEntry> exceptionRibbon) {

  public record OutcomeShare(String outcomeId, String outcomeTitle, double share) {}

  public record StarvedOutcome(String outcomeId, String outcomeTitle, int weeksStarved) {}

  public record PriorityDrift(
      String rallyCryId,
      String rallyCryTitle,
      double observedShare,
      double expectedLow,
      double expectedHigh) {}

  public record RibbonEntry(
      String kind, String severity, String label, String entityType, String entityId) {}
}
