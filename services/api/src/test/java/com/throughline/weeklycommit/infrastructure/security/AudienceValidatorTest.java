package com.throughline.weeklycommit.infrastructure.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;

class AudienceValidatorTest {

  AudienceValidator validator = new AudienceValidator("https://api.throughline.app");

  private Jwt jwt(List<String> aud) {
    return Jwt.withTokenValue("t").header("alg", "none").subject("u").audience(aud).build();
  }

  @Test
  void accepts_when_expected_audience_present() {
    var jwt = jwt(List.of("https://api.throughline.app", "other"));
    var result = validator.validate(jwt);
    assertThat(result.hasErrors()).isFalse();
  }

  @Test
  void rejects_when_audience_missing() {
    var jwt = jwt(List.of("https://api.elsewhere.com"));
    var result = validator.validate(jwt);
    assertThat(result.hasErrors()).isTrue();
    assertThat(result.getErrors().iterator().next().getErrorCode()).isEqualTo("invalid_aud");
  }

  @Test
  void rejects_when_audience_null() {
    var jwt = Jwt.withTokenValue("t").header("alg", "none").subject("u").build();
    var result = validator.validate(jwt);
    assertThat(result.hasErrors()).isTrue();
  }
}
