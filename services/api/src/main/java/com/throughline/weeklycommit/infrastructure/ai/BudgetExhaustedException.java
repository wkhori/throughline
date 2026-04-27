package com.throughline.weeklycommit.infrastructure.ai;

import com.throughline.weeklycommit.domain.AIInsightKind;

/**
 * Thrown when {@code AnthropicCostGuard.preflight()} refuses a call due to a per-user or org-level
 * cap. Mapped to {@code 429 BUDGET_EXHAUSTED} (PRD §6.3 / P12 / P23). Frontend's response: silent
 * UI degrade.
 */
public class BudgetExhaustedException extends RuntimeException {

  /** Reason tag for {@code Retry-After} hints and structured logs. */
  public enum Reason {
    USER_HOUR_CAP,
    USER_DAY_CAP,
    ORG_MONTH_HARD_CAP
  }

  private final Reason reason;
  private final AIInsightKind kind;

  public BudgetExhaustedException(Reason reason, AIInsightKind kind, String message) {
    super(message);
    this.reason = reason;
    this.kind = kind;
  }

  public Reason getReason() {
    return reason;
  }

  public AIInsightKind getKind() {
    return kind;
  }
}
