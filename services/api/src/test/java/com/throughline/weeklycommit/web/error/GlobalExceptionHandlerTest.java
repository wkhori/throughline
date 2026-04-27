package com.throughline.weeklycommit.web.error;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;

class GlobalExceptionHandlerTest {

  GlobalExceptionHandler handler = new GlobalExceptionHandler();

  @Test
  void illegalState_maps_to_409_ILLEGAL_STATE() {
    var resp = handler.illegalState(new IllegalStateException("nope"));
    assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    assertThat(resp.getBody().getTitle()).isEqualTo("ILLEGAL_STATE");
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
