package com.throughline.weeklycommit.web.error;

import static org.assertj.core.api.Assertions.assertThat;

import com.throughline.weeklycommit.domain.exception.LifecycleConflictException;
import com.throughline.weeklycommit.infrastructure.ai.AnthropicException;
import com.throughline.weeklycommit.infrastructure.ai.AnthropicInvalidJsonException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;

class GlobalExceptionHandlerTest {

  GlobalExceptionHandler handler = new GlobalExceptionHandler();

  @Test
  void lifecycleConflict_maps_to_409_ILLEGAL_STATE() {
    var resp = handler.lifecycleConflict(new LifecycleConflictException("not allowed in DRAFT"));
    assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    assertThat(resp.getBody().getTitle()).isEqualTo("ILLEGAL_STATE");
    assertThat(resp.getBody().getDetail()).isEqualTo("not allowed in DRAFT");
  }

  @Test
  void anthropicException_silentDegrades_to_200_with_T1_fallback() {
    HttpServletRequest req = Mockito.mock(HttpServletRequest.class);
    Mockito.when(req.getRequestURI()).thenReturn("/api/v1/ai/suggest-outcome");
    var resp = handler.anthropic(new AnthropicException(429, "rate-limited"), req);
    assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
    assertThat(resp.getHeaders().getFirst("X-AI-Fallback")).isEqualTo("true");
    @SuppressWarnings("unchecked")
    Map<String, Object> body = (Map<String, Object>) resp.getBody();
    assertThat(body).containsEntry("kind", "T1_SUGGESTION").containsEntry("model", "fallback");
    @SuppressWarnings("unchecked")
    Map<String, Object> payload = (Map<String, Object>) body.get("payload");
    assertThat(payload)
        .containsEntry("supportingOutcomeId", null)
        .containsEntry("rationale", "no_credible_match");
  }

  @Test
  void anthropicInvalidJson_silentDegrades_to_200_with_T7_fallback() {
    HttpServletRequest req = Mockito.mock(HttpServletRequest.class);
    Mockito.when(req.getRequestURI()).thenReturn("/api/v1/ai/quality-lint");
    var resp =
        handler.anthropicInvalidJson(
            new AnthropicInvalidJsonException("not json", "<<garbage>>"), req);
    assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
    assertThat(resp.getHeaders().getFirst("X-AI-Fallback")).isEqualTo("true");
    @SuppressWarnings("unchecked")
    Map<String, Object> body = (Map<String, Object>) resp.getBody();
    assertThat(body).containsEntry("kind", "T7_QUALITY");
    @SuppressWarnings("unchecked")
    Map<String, Object> payload = (Map<String, Object>) body.get("payload");
    assertThat(payload).containsEntry("severity", "low");
  }

  @Test
  void anthropicException_for_drift_returns_T2_fallback() {
    HttpServletRequest req = Mockito.mock(HttpServletRequest.class);
    Mockito.when(req.getRequestURI()).thenReturn("/api/v1/ai/drift-check");
    var resp = handler.anthropic(new AnthropicException(502, "upstream"), req);
    assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
    @SuppressWarnings("unchecked")
    Map<String, Object> body = (Map<String, Object>) resp.getBody();
    assertThat(body).containsEntry("kind", "T2_DRIFT");
  }

  @Test
  void illegalArg_maps_to_400_BAD_REQUEST() {
    var resp = handler.illegalArg(new IllegalArgumentException("bad"));
    assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    assertThat(resp.getBody().getTitle()).isEqualTo("BAD_REQUEST");
  }

  @Test
  void dataIntegrity_maps_to_409_CONFLICT() {
    var resp = handler.conflict(new DataIntegrityViolationException("db"));
    assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    assertThat(resp.getBody().getTitle()).isEqualTo("CONFLICT");
  }

  @Test
  void accessDenied_maps_to_403_FORBIDDEN() {
    var resp = handler.denied(new AccessDeniedException("nope"));
    assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    assertThat(resp.getBody().getTitle()).isEqualTo("FORBIDDEN");
  }

  @Test
  void notFound_maps_to_404() {
    var resp = handler.notFound(new NotFoundException("Thing", "abc"));
    assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    assertThat(resp.getBody().getTitle()).isEqualTo("NOT_FOUND");
  }

  @Test
  void constraintViolation_maps_to_400_with_field_errors() {
    @SuppressWarnings("unchecked")
    ConstraintViolation<Object> cv = Mockito.mock(ConstraintViolation.class);
    jakarta.validation.Path path = Mockito.mock(jakarta.validation.Path.class);
    Mockito.when(path.toString()).thenReturn("title");
    Mockito.when(cv.getPropertyPath()).thenReturn(path);
    Mockito.when(cv.getMessage()).thenReturn("must not be blank");
    var resp = handler.constraint(new ConstraintViolationException(Set.of(cv)));
    assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    assertThat(resp.getBody().getTitle()).isEqualTo("VALIDATION_ERROR");
  }
}
