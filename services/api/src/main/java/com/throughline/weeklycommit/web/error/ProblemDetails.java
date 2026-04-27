package com.throughline.weeklycommit.web.error;

import java.net.URI;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;

public final class ProblemDetails {
  private ProblemDetails() {}

  public static ProblemDetail forStatus(HttpStatus status, String title, String detail) {
    ProblemDetail pd = ProblemDetail.forStatusAndDetail(status, detail);
    pd.setTitle(title);
    pd.setType(URI.create("about:blank"));
    return pd;
  }

  public static ProblemDetail validation(List<FieldError> errors) {
    ProblemDetail pd = forStatus(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Validation failed");
    pd.setProperty("errors", errors);
    return pd;
  }

  public record FieldError(String field, String message) {}
}
