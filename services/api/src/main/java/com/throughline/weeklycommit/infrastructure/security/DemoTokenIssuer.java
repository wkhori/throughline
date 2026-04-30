package com.throughline.weeklycommit.infrastructure.security;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Mints short-lived HS256 JWTs for the three demo personas. Replaces the literal {@code
 * mock.ic.token} string with real signed JWTs that the resource server verifies via {@link
 * DemoJwtDecoder}.
 *
 * <p>Issuer claim {@code throughline-demo} is the discriminator that {@link DelegatingJwtDecoder}
 * uses to route incoming tokens to this decoder vs. the Auth0 JWKS decoder. Audience matches the
 * Auth0 audience so downstream code (JwtAuthConverter, CurrentUserResolver) is identical.
 */
@Component
public class DemoTokenIssuer {

  public static final String ISSUER = "throughline-demo";
  private static final Duration TTL = Duration.ofHours(8);

  private final String secret;
  private final String audience;
  private final Clock clock;

  public DemoTokenIssuer(
      @Value("${throughline.demo.jwt-secret:}") String secret,
      @Value("${throughline.auth0.audience}") String audience,
      Clock clock) {
    this.secret = secret;
    this.audience = audience;
    this.clock = clock;
  }

  public boolean isConfigured() {
    return secret != null && !secret.isBlank() && secret.length() >= 32;
  }

  String secret() {
    return secret;
  }

  public TokenResponse mint(Persona persona) {
    if (!isConfigured()) {
      throw new IllegalStateException(
          "throughline.demo.jwt-secret not configured (must be ≥32 chars).");
    }
    Instant now = Instant.now(clock);
    Instant exp = now.plus(TTL);
    JWTClaimsSet claims =
        new JWTClaimsSet.Builder()
            .issuer(ISSUER)
            .subject(persona.sub())
            .audience(audience)
            .issueTime(Date.from(now))
            .expirationTime(Date.from(exp))
            .claim("email", persona.email())
            .claim("name", persona.name())
            .claim("permissions", List.of(persona.role()))
            .build();
    SignedJWT jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), claims);
    try {
      jwt.sign(new MACSigner(secret.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
    } catch (JOSEException e) {
      throw new IllegalStateException("Failed to sign demo JWT", e);
    }
    return new TokenResponse(jwt.serialize(), TTL.toSeconds());
  }

  public Persona personaFor(String name) {
    return switch (name == null ? "" : name.toLowerCase(java.util.Locale.ROOT)) {
      case "ic" ->
          new Persona(
              env("AUTH0_SUB_IC", "auth0|mock-ic"), "ic@demo.throughline.app", "Demo IC", "IC");
      case "manager" ->
          new Persona(
              env("AUTH0_SUB_MANAGER", "auth0|mock-manager"),
              "manager@demo.throughline.app",
              "Demo Manager",
              "MANAGER");
      case "admin" ->
          new Persona(
              env("AUTH0_SUB_ADMIN", "auth0|mock-admin"),
              "admin@demo.throughline.app",
              "Demo Admin",
              "ADMIN");
      default ->
          throw new IllegalArgumentException(
              "persona must be one of ic|manager|admin; got: " + name);
    };
  }

  private static String env(String key, String fallback) {
    String v = System.getenv(key);
    return v == null || v.isBlank() ? fallback : v;
  }

  public record Persona(String sub, String email, String name, String role) {}

  public record TokenResponse(String accessToken, long expiresIn) {}
}
