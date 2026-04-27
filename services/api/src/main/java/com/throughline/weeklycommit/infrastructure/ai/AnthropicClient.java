package com.throughline.weeklycommit.infrastructure.ai;

/**
 * Thin abstraction over the Anthropic Messages API. Two implementations:
 *
 * <ul>
 *   <li>{@link AnthropicClientImpl} — real HTTP, active when {@code anthropic.api-key} is set.
 *   <li>{@code StubAnthropicClient} — fixture-backed, registered as a {@code @TestConfiguration}
 *       bean (see {@code services/api/src/test/.../infrastructure/ai/StubAnthropicClient.java}).
 * </ul>
 *
 * <p>Cost-guard preflight, AI-insight persistence, and structured logging live in {@code
 * AnthropicCostGuard} / {@code AiCopilotService}. This client just transports.
 */
public interface AnthropicClient {

  /**
   * Make a single Messages API call. Implementations are expected to apply prompt-cache headers,
   * configured timeouts (Haiku 2.5s, Sonnet 25s per spec), and per-model retry/backoff. Throws
   * {@link AnthropicException} on transport failure after retries are exhausted; throws {@link
   * AnthropicInvalidJsonException} when the response body is not a single valid JSON object.
   */
  AnthropicResponse send(AnthropicRequest request);
}
