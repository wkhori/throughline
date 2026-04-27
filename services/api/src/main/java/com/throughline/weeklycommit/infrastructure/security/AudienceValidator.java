package com.throughline.weeklycommit.infrastructure.security;

import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;

/**
 * Spring does not validate the {@code aud} claim by default. PRD §7.6 calls out this gotcha — we
 * add this validator into the {@link
 * org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator} chain so a JWT minted
 * for a different audience cannot reach our protected endpoints.
 */
public class AudienceValidator implements OAuth2TokenValidator<Jwt> {

  private final String expectedAudience;

  public AudienceValidator(String expectedAudience) {
    this.expectedAudience = expectedAudience;
  }

  @Override
  public OAuth2TokenValidatorResult validate(Jwt jwt) {
    if (jwt.getAudience() != null && jwt.getAudience().contains(expectedAudience)) {
      return OAuth2TokenValidatorResult.success();
    }
    return OAuth2TokenValidatorResult.failure(
        new OAuth2Error(
            "invalid_aud",
            "JWT aud claim does not match expected audience '" + expectedAudience + "'",
            null));
  }
}
