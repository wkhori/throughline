package com.throughline.weeklycommit.web;

import com.throughline.weeklycommit.infrastructure.security.DemoTokenIssuer;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Demo-login endpoint. Mints a real signed (HS256) JWT for one of the three Throughline demo
 * personas — {@code ic}, {@code manager}, {@code admin}. Every other endpoint then verifies the
 * token through the same JwtDecoder pipeline as Auth0 tokens. Permitted without auth in {@link
 * com.throughline.weeklycommit.infrastructure.security.SecurityConfig}; rate-limiting is
 * intentionally absent because the demo audience is the hiring partner, not the open internet.
 */
@RestController
@RequestMapping("/api/v1/auth")
public class AuthDemoController {

  private final DemoTokenIssuer issuer;

  public AuthDemoController(DemoTokenIssuer issuer) {
    this.issuer = issuer;
  }

  @PostMapping("/demo-login")
  public ResponseEntity<DemoTokenIssuer.TokenResponse> demoLogin(
      @RequestBody DemoLoginRequest body) {
    if (!issuer.isConfigured()) {
      return ResponseEntity.status(503).build();
    }
    DemoTokenIssuer.Persona persona = issuer.personaFor(body.persona());
    return ResponseEntity.ok(issuer.mint(persona));
  }

  public record DemoLoginRequest(@NotBlank String persona) {}
}
