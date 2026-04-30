package com.throughline.weeklycommit.web.error;

import com.throughline.weeklycommit.application.manager.ManagerService;
import com.throughline.weeklycommit.domain.exception.LifecycleConflictException;
import com.throughline.weeklycommit.infrastructure.ai.AnthropicException;
import com.throughline.weeklycommit.infrastructure.ai.AnthropicInvalidJsonException;
import com.throughline.weeklycommit.infrastructure.ai.BudgetExhaustedException;
import jakarta.validation.ConstraintViolationException;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Global mapping from typed exceptions to HTTP responses.
 *
 * <p>Lifecycle conflicts are mapped via the dedicated {@link LifecycleConflictException}, not via a
 * generic {@link IllegalStateException} catch-all — the previous sledgehammer mapped plumbing
 * failures (Jackson serialize errors, missing SHA-256 provider, etc.) to 409 instead of 500.
 *
 * <p>Anthropic touchpoint failures (transport / non-2xx after retries, invalid JSON body)
 * silent-degrade to HTTP 200 with the per-touchpoint fallback DTO documented in {@code
 * docs/ai-copilot-spec.md} so the FE renders a benign empty state rather than an error banner.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

  private static final Logger LOG = LoggerFactory.getLogger(GlobalExceptionHandler.class);

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

  /**
   * Genuine state-machine conflict — replaces the previous blanket {@code IllegalStateException} →
   * 409 mapping. Title stays {@code ILLEGAL_STATE} for FE/contract continuity.
   */
  @ExceptionHandler(LifecycleConflictException.class)
  public ResponseEntity<ProblemDetail> lifecycleConflict(LifecycleConflictException ex) {
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

  /**
   * Anthropic transport / non-2xx after retries exhausted. Per docs/ai-copilot-spec.md, each
   * touchpoint is meant to silent-degrade — we return 200 with the per-touchpoint fallback body so
   * the FE renders a benign empty state. The path the exception bubbles through carries the URI
   * that lets us pick the right fallback (T1 / T2 / T7).
   */
  @ExceptionHandler(AnthropicException.class)
  public ResponseEntity<Object> anthropic(
      AnthropicException ex, jakarta.servlet.http.HttpServletRequest req) {
    LOG.warn(
        "anthropic_call_failed_silent_degrade status={} path={} msg={}",
        ex.getStatusCode(),
        req.getRequestURI(),
        ex.getMessage());
    return fallbackFor(req.getRequestURI());
  }

  @ExceptionHandler(AnthropicInvalidJsonException.class)
  public ResponseEntity<Object> anthropicInvalidJson(
      AnthropicInvalidJsonException ex, jakarta.servlet.http.HttpServletRequest req) {
    LOG.warn(
        "anthropic_invalid_json_silent_degrade path={} bodyHead={}",
        req.getRequestURI(),
        ex.getRawBody() == null ? "" : ex.getRawBody());
    return fallbackFor(req.getRequestURI());
  }

  /**
   * Returns the per-touchpoint fallback body for the given request URI. Shapes match the "fallback"
   * sections of {@code docs/ai-copilot-spec.md} for T1 / T2 / T7. Unknown URIs receive a 200 with
   * an empty payload so the FE never sees a 5xx for an Anthropic-side failure.
   */
  private static ResponseEntity<Object> fallbackFor(String uri) {
    String path = uri == null ? "" : uri;
    if (path.contains("/ai/suggest-outcome")) {
      java.util.LinkedHashMap<String, Object> payload = new java.util.LinkedHashMap<>();
      payload.put("supportingOutcomeId", null);
      payload.put("confidence", 0);
      payload.put("rationale", "no_credible_match");
      payload.put("reasoning", "ai_unavailable");
      return fallbackOk("T1_SUGGESTION", payload);
    }
    if (path.contains("/ai/drift-check")) {
      java.util.LinkedHashMap<String, Object> payload = new java.util.LinkedHashMap<>();
      payload.put("driftScore", 0);
      payload.put("alignmentVerdict", "aligned");
      payload.put("fixSuggestion", null);
      payload.put("suggestedRelink", null);
      payload.put("reasoning", "ai_unavailable");
      return fallbackOk("T2_DRIFT", payload);
    }
    if (path.contains("/ai/quality-lint")) {
      java.util.LinkedHashMap<String, Object> payload = new java.util.LinkedHashMap<>();
      payload.put("issues", java.util.List.of());
      payload.put("severity", "low");
      payload.put("reasoning", "ai_unavailable");
      return fallbackOk("T7_QUALITY", payload);
    }
    java.util.LinkedHashMap<String, Object> body = new java.util.LinkedHashMap<>();
    body.put("model", "fallback");
    body.put("payload", java.util.Map.of());
    return ResponseEntity.status(HttpStatus.OK).header("X-AI-Fallback", "true").body(body);
  }

  private static ResponseEntity<Object> fallbackOk(
      String kind, java.util.Map<String, Object> payload) {
    java.util.LinkedHashMap<String, Object> body = new java.util.LinkedHashMap<>();
    body.put("kind", kind);
    body.put("model", "fallback");
    body.put("payload", payload);
    return ResponseEntity.status(HttpStatus.OK)
        .header("X-Cache", "MISS")
        .header("X-AI-Fallback", "true")
        .body(body);
  }
}
