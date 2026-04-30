package com.throughline.weeklycommit.domain.exception;

/**
 * A genuine state-machine / lifecycle conflict — the requested transition or mutation is illegal in
 * the entity's current state. Mapped to HTTP 409 by {@code GlobalExceptionHandler}.
 *
 * <p>Distinguishes "this transition is illegal in this lifecycle state" from a generic {@link
 * IllegalStateException}, which previously absorbed plumbing failures (Jackson serialization,
 * SHA-256 unavailable, etc.) and incorrectly mapped them to 409 instead of 500.
 */
public class LifecycleConflictException extends RuntimeException {

  public LifecycleConflictException(String message) {
    super(message);
  }

  public LifecycleConflictException(String message, Throwable cause) {
    super(message, cause);
  }
}
