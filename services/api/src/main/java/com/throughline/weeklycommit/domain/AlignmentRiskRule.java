package com.throughline.weeklycommit.domain;

/** Rule that fired the {@link AlignmentRisk} (PRD §6 T6). */
public enum AlignmentRiskRule {
  LONG_CARRY_FORWARD,
  STARVED_OUTCOME,
  SINGLE_OUTCOME_CONCENTRATION;
}
