package com.throughline.weeklycommit.infrastructure.ai;

/**
 * Model selector. Per docs/ai-copilot-spec.md: Haiku for high-volume cheap tasks (T1/T2/T6/T7);
 * Sonnet for analytical work (T3/T4/T5).
 */
public enum AnthropicModel {
  HAIKU,
  SONNET;
}
