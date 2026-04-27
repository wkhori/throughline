package com.throughline.weeklycommit.domain;

/** Severity tier for {@link AlignmentRisk} (PRD §6 T6 rubric). */
public enum AlignmentRiskSeverity {
  LOW,
  MEDIUM,
  HIGH;

  /** Strict ordering used by the dedupe-suppression escalation check (PRD §8.5 / P5). */
  public boolean isHigherThan(AlignmentRiskSeverity other) {
    return this.ordinal() > other.ordinal();
  }
}
