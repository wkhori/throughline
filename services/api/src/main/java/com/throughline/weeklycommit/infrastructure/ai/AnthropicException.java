package com.throughline.weeklycommit.infrastructure.ai;

/** Transport / non-2xx response from Anthropic after retries exhausted. */
public class AnthropicException extends RuntimeException {

  private final int statusCode;

  public AnthropicException(int statusCode, String message) {
    super(message);
    this.statusCode = statusCode;
  }

  public AnthropicException(int statusCode, String message, Throwable cause) {
    super(message, cause);
    this.statusCode = statusCode;
  }

  public int getStatusCode() {
    return statusCode;
  }
}
