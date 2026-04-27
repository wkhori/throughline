package com.throughline.weeklycommit.infrastructure.ai;

/**
 * Anthropic returned 2xx but the assistant body was not a single valid JSON object. Each touchpoint
 * has its own fallback policy (see {@code docs/ai-copilot-spec.md}); the caller decides whether to
 * silent-fail (T1/T2/T7), one re-prompt (T3), or compute deterministic fallback (T4/T5/T6).
 */
public class AnthropicInvalidJsonException extends RuntimeException {

  private final String rawBody;

  public AnthropicInvalidJsonException(String message, String rawBody) {
    super(message);
    this.rawBody = rawBody;
  }

  public String getRawBody() {
    return rawBody;
  }
}
