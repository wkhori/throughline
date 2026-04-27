package com.throughline.weeklycommit.infrastructure.security;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;

/**
 * <strong>Dev/test fallback only — not wired in production.</strong> When neither {@code
 * AUTH0_ISSUER_URI} nor {@code throughline.demo.jwt-secret} is configured, {@link SecurityConfig}
 * falls back to this decoder so local dev keeps working with the literal {@code mock.ic.token}
 * strings checked into {@code apps/host/src/auth.ts}. In production, the deployed pipeline is
 * Auth0 (real users) plus {@link DemoJwtDecoder} (demo personas via {@code
 * /api/v1/auth/demo-login}); MockJwtDecoder is never instantiated.
 */
public class MockJwtDecoder implements JwtDecoder {

  private static final String AUDIENCE = "https://api.throughline.app";

  /** Whether the supplied token is one of the three demo persona stubs. */
  public static boolean isMockToken(String token) {
    return "mock.ic.token".equals(token)
        || "mock.manager.token".equals(token)
        || "mock.admin.token".equals(token);
  }

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
          new PersonaSpec(
              resolveSub("AUTH0_SUB_IC", "auth0|mock-ic"),
              "ic@demo.throughline.app",
              "Demo IC",
              "IC");
      case "mock.manager.token" ->
          new PersonaSpec(
              resolveSub("AUTH0_SUB_MANAGER", "auth0|mock-manager"),
              "manager@demo.throughline.app",
              "Demo Manager",
              "MANAGER");
      case "mock.admin.token" ->
          new PersonaSpec(
              resolveSub("AUTH0_SUB_ADMIN", "auth0|mock-admin"),
              "admin@demo.throughline.app",
              "Demo Admin",
              "ADMIN");
      default -> throw new JwtException("MockJwtDecoder rejects token: " + token);
    };
  }

  /**
   * Mirrors {@code DemoSeeder.resolveSub}: when the env var is set (production has the real Auth0
   * subs from scripts/auth0-provision.mjs), use it so the decoded sub matches the seeded user
   * row. Falls back to the deterministic stub sub used by Phase-1 dev/test.
   */
  private static String resolveSub(String envVar, String fallback) {
    String value = System.getenv(envVar);
    return value == null || value.isBlank() ? fallback : value;
  }

  private record PersonaSpec(String sub, String email, String name, String role) {}
}
