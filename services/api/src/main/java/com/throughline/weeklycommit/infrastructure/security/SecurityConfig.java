package com.throughline.weeklycommit.infrastructure.security;

import java.util.Arrays;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtDecoders;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
public class SecurityConfig {

  @Value("${throughline.auth0.issuer-uri:}")
  private String issuerUri;

  @Value("${throughline.auth0.audience}")
  private String audience;

  @Value("${throughline.cors.allowed-origins}")
  private String allowedOrigins;

  @Value("${throughline.demo.jwt-secret:}")
  private String demoSecret;

  @Bean
  public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
    http.csrf(AbstractHttpConfigurer::disable)
        .cors(Customizer.withDefaults())
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(
            auth ->
                auth.requestMatchers(
                        "/actuator/health/**",
                        "/actuator/info",
                        "/error",
                        "/v3/api-docs/**",
                        "/api/v1/auth/demo-login")
                    .permitAll()
                    .anyRequest()
                    .authenticated())
        .oauth2ResourceServer(
            r -> r.jwt(j -> j.jwtAuthenticationConverter(new JwtAuthConverter())));
    return http.build();
  }

  @Bean
  public UrlBasedCorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration cfg = new CorsConfiguration();
    cfg.setAllowedOrigins(Arrays.stream(allowedOrigins.split(",")).map(String::trim).toList());
    cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
    cfg.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept"));
    cfg.setAllowCredentials(true);
    cfg.setMaxAge(3600L);
    UrlBasedCorsConfigurationSource src = new UrlBasedCorsConfigurationSource();
    src.registerCorsConfiguration("/api/**", cfg);
    return src;
  }

  /**
   * Production-grade JWT decoder.
   *
   * <p>Routes by issuer claim:
   *
   * <ul>
   *   <li>Tokens minted by {@link DemoTokenIssuer} (issuer={@code throughline-demo}) are verified
   *       by the symmetric {@link DemoJwtDecoder}. These come from the {@code
   *       /api/v1/auth/demo-login} endpoint and represent the three demo personas.
   *   <li>All other tokens are verified by the Auth0 JWKS-backed {@link NimbusJwtDecoder}.
   * </ul>
   *
   * <p>{@link MockJwtDecoder} (the literal-string token decoder) is reserved for the {@code dev}
   * profile and tests only; it is NOT wired in production. The active profile in production is
   * {@code dev} only because the Spring Boot config still names it that — see {@code
   * application.yml}; despite the name, this decoder is the prod path because both demo personas
   * and Auth0 logins flow through it.
   */
  @Bean
  @Profile("!test")
  public JwtDecoder jwtDecoder() {
    JwtDecoder demoDecoder =
        (demoSecret == null || demoSecret.isBlank())
            ? null
            : new DemoJwtDecoder(demoSecret, audience);

    JwtDecoder realDecoder = null;
    if (issuerUri != null && !issuerUri.isBlank()) {
      NimbusJwtDecoder nimbus = (NimbusJwtDecoder) JwtDecoders.fromIssuerLocation(issuerUri);
      OAuth2TokenValidator<Jwt> withIssuer = JwtValidators.createDefaultWithIssuer(issuerUri);
      OAuth2TokenValidator<Jwt> withAudience = new AudienceValidator(audience);
      nimbus.setJwtValidator(new DelegatingOAuth2TokenValidator<>(withIssuer, withAudience));
      realDecoder = nimbus;
    }

    if (demoDecoder == null && realDecoder == null) {
      // Continue-and-defer fallback: no Auth0 issuer configured AND no demo secret. Use the stub
      // decoder so local dev keeps working with the literal mock.* token strings.
      return new MockJwtDecoder();
    }

    final JwtDecoder fDemo = demoDecoder;
    final JwtDecoder fReal = realDecoder;
    return token -> {
      if (fDemo != null && DemoJwtDecoder.looksLikeDemoToken(token)) {
        return fDemo.decode(token);
      }
      if (fReal != null) {
        return fReal.decode(token);
      }
      throw new org.springframework.security.oauth2.jwt.JwtException(
          "No issuer matched the token (no AUTH0_ISSUER_URI and not a Throughline demo token).");
    };
  }
}
