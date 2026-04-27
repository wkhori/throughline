package com.throughline.weeklycommit.web.error;

import java.util.List;

/**
 * Server-side equivalent of a Bean Validation failure — used when validation depends on persisted
 * state (e.g. lock requires every commit to have an SO). Mapped to 400 with the same
 * VALIDATION_ERROR shape as Bean Validation by {@link GlobalExceptionHandler}.
 */
public class ValidationException extends RuntimeException {
  private final List<ProblemDetails.FieldError> errors;

  public ValidationException(List<ProblemDetails.FieldError> errors) {
    super("Validation failed");
    this.errors = errors;
  }

  public List<ProblemDetails.FieldError> errors() {
    return errors;
  }
}
