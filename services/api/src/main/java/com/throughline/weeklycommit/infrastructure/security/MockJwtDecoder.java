package com.throughline.weeklycommit.infrastructure.security;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;

/**
 * Continue-and-defer rule (orchestration §pre-flight): when {@code AUTH0_ISSUER_URI} is unset, this
 * decoder is wired in place of the real Auth0 JWKS decoder. It accepts three deterministic
 * synthetic tokens — {@code mock.ic.token}, {@code mock.manager.token}, {@code mock.admin.token} —
 * that mirror the demo personas in {@code apps/host/src/auth.ts}. Real Auth0 takes over
 * automatically once the issuer URI lands in {@code .env.local}.
 */
public class MockJwtDecoder implements JwtDecoder {

  private static final String AUDIENCE = "https://api.throughline.app";

  @Override
  public Jwt decode(String token) throws JwtException {
    PersonaSpec spec = personaFor(token);
    Instant now = Instant.now();
    Map<String, Object> claims =
        Map.of(
            "sub", spec.sub(),
            "email", spec.email(),
            "name", spec.name(),
            "permissions", List.of(spec.role()),
            "aud", List.of(AUDIENCE),
            "iss", "stub://throughline-mock");
    return Jwt.withTokenValue(token)
        .header("alg", "none")
        .header("typ", "JWT")
        .issuedAt(now)
        .expiresAt(now.plusSeconds(3600))
        .audience(List.of(AUDIENCE))
        .claims(c -> c.putAll(claims))
        .build();
  }

  private PersonaSpec personaFor(String token) {
    return switch (token) {
      case "mock.ic.token" ->
          new PersonaSpec("auth0|mock-ic", "ic@demo.throughline.app", "Demo IC", "IC");
      case "mock.manager.token" ->
          new PersonaSpec(
              "auth0|mock-manager", "manager@demo.throughline.app", "Demo Manager", "MANAGER");
      case "mock.admin.token" ->
          new PersonaSpec("auth0|mock-admin", "admin@demo.throughline.app", "Demo Admin", "ADMIN");
      default -> throw new JwtException("MockJwtDecoder rejects token: " + token);
    };
  }

  private record PersonaSpec(String sub, String email, String name, String role) {}
}
