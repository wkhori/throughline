package com.throughline.weeklycommit.infrastructure.ai;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Translates Anthropic token usage into US cents.
 *
 * <p>Pricing (April 2026 — docs/ai-copilot-spec.md): Haiku $1 / $5 per 1M in/out, Sonnet $3 / $15.
 * Cache reads are billed at 0.10× base input.
 */
public final class CostCalculator {

  private static final BigDecimal MILLION = new BigDecimal("1000000");
  private static final BigDecimal CENTS_PER_DOLLAR = new BigDecimal("100");

  // Per-1M token rates in USD.
  private static final BigDecimal HAIKU_INPUT = new BigDecimal("1");
  private static final BigDecimal HAIKU_OUTPUT = new BigDecimal("5");
  private static final BigDecimal SONNET_INPUT = new BigDecimal("3");
  private static final BigDecimal SONNET_OUTPUT = new BigDecimal("15");
  private static final BigDecimal CACHE_READ_FACTOR = new BigDecimal("0.10");

  private CostCalculator() {}

  /** Returns cents (4 decimal precision) for the given token usage. */
  public static BigDecimal cents(
      AnthropicModel model, int tokensInput, int tokensOutput, int tokensCacheRead) {
    BigDecimal inRate = model == AnthropicModel.HAIKU ? HAIKU_INPUT : SONNET_INPUT;
    BigDecimal outRate = model == AnthropicModel.HAIKU ? HAIKU_OUTPUT : SONNET_OUTPUT;
    BigDecimal usd =
        ratio(tokensInput, inRate)
            .add(ratio(tokensOutput, outRate))
            .add(ratio(tokensCacheRead, inRate.multiply(CACHE_READ_FACTOR)));
    return usd.multiply(CENTS_PER_DOLLAR).setScale(4, RoundingMode.HALF_UP);
  }

  private static BigDecimal ratio(int tokens, BigDecimal pricePerMillionUsd) {
    return BigDecimal.valueOf(tokens)
        .multiply(pricePerMillionUsd)
        .divide(MILLION, 8, RoundingMode.HALF_UP);
  }
}
