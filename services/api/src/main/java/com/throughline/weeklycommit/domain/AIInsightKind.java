package com.throughline.weeklycommit.domain;

/**
 * Kind of AI touchpoint that produced an {@link AIInsight} row. Mirrors the T1–T7 surface from
 * {@code docs/ai-copilot-spec.md}.
 */
public enum AIInsightKind {
  T1_SUGGESTION,
  T2_DRIFT,
  T3_PORTFOLIO,
  T4_DELTA,
  T5_DIGEST,
  T6_ALERT,
  T7_QUALITY;
}
