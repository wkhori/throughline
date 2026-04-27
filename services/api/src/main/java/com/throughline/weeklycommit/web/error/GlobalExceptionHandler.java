package com.throughline.weeklycommit.web.error;

import com.throughline.weeklycommit.application.manager.ManagerService;
import com.throughline.weeklycommit.infrastructure.ai.BudgetExhaustedException;
import jakarta.validation.ConstraintViolationException;
import java.util.List;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<ProblemDetail> validation(MethodArgumentNotValidException ex) {
    List<ProblemDetails.FieldError> errs =
        ex.getBindingResult().getFieldErrors().stream()
            .map(fe -> new ProblemDetails.FieldError(fe.getField(), fe.getDefaultMessage()))
            .toList();
    return ResponseEntity.badRequest().body(ProblemDetails.validation(errs));
  }

  @ExceptionHandler(ConstraintViolationException.class)
  public ResponseEntity<ProblemDetail> constraint(ConstraintViolationException ex) {
    List<ProblemDetails.FieldError> errs =
        ex.getConstraintViolations().stream()
            .map(v -> new ProblemDetails.FieldError(v.getPropertyPath().toString(), v.getMessage()))
            .toList();
    return ResponseEntity.badRequest().body(ProblemDetails.validation(errs));
  }

  @ExceptionHandler(IllegalStateException.class)
  public ResponseEntity<ProblemDetail> illegalState(IllegalStateException ex) {
    return ResponseEntity.status(HttpStatus.CONFLICT)
        .body(ProblemDetails.forStatus(HttpStatus.CONFLICT, "ILLEGAL_STATE", ex.getMessage()));
  }

  @ExceptionHandler(IllegalArgumentException.class)
  public ResponseEntity<ProblemDetail> illegalArg(IllegalArgumentException ex) {
    return ResponseEntity.badRequest()
        .body(ProblemDetails.forStatus(HttpStatus.BAD_REQUEST, "BAD_REQUEST", ex.getMessage()));
  }

  @ExceptionHandler(DataIntegrityViolationException.class)
  public ResponseEntity<ProblemDetail> conflict(DataIntegrityViolationException ex) {
    return ResponseEntity.status(HttpStatus.CONFLICT)
        .body(
            ProblemDetails.forStatus(HttpStatus.CONFLICT, "CONFLICT", "Data integrity violation"));
  }

  @ExceptionHandler(AccessDeniedException.class)
  public ResponseEntity<ProblemDetail> denied(AccessDeniedException ex) {
    return ResponseEntity.status(HttpStatus.FORBIDDEN)
        .body(ProblemDetails.forStatus(HttpStatus.FORBIDDEN, "FORBIDDEN", "Access denied"));
  }

  @ExceptionHandler(NotFoundException.class)
  public ResponseEntity<ProblemDetail> notFound(NotFoundException ex) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND)
        .body(ProblemDetails.forStatus(HttpStatus.NOT_FOUND, "NOT_FOUND", ex.getMessage()));
  }

  @ExceptionHandler(ValidationException.class)
  public ResponseEntity<ProblemDetail> validation(ValidationException ex) {
    return ResponseEntity.badRequest().body(ProblemDetails.validation(ex.errors()));
  }

  /** P12 / P23: cost guard refused — return 429 BUDGET_EXHAUSTED so frontend silent-degrades. */
  @ExceptionHandler(BudgetExhaustedException.class)
  public ResponseEntity<ProblemDetail> budgetExhausted(BudgetExhaustedException ex) {
    ProblemDetail pd =
        ProblemDetails.forStatus(HttpStatus.TOO_MANY_REQUESTS, "BUDGET_EXHAUSTED", ex.getMessage());
    pd.setProperty("reason", ex.getReason().name());
    pd.setProperty("kind", ex.getKind().name());
    return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(pd);
  }

  /** P10: stale {@code team_rollup_cache} → 503 so the dashboard can retry/back-off. */
  @ExceptionHandler(ManagerService.StaleCacheException.class)
  public ResponseEntity<ProblemDetail> staleCache(ManagerService.StaleCacheException ex) {
    return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
        .body(
            ProblemDetails.forStatus(
                HttpStatus.SERVICE_UNAVAILABLE, "ROLLUP_RECOMPUTING", ex.getMessage()));
  }
}
