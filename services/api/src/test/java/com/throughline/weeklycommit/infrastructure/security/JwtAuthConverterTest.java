package com.throughline.weeklycommit.infrastructure.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;

class JwtAuthConverterTest {

  JwtAuthConverter converter = new JwtAuthConverter();

  @Test
  void maps_permissions_array_to_authorities() {
    Jwt jwt =
        Jwt.withTokenValue("t")
            .header("alg", "none")
            .subject("auth0|x")
            .claim("permissions", List.of("MANAGER"))
            .build();
    var auth = converter.convert(jwt);
    assertThat(auth).isNotNull();
    assertThat(auth.getAuthorities()).extracting(a -> a.getAuthority()).contains("ROLE_MANAGER");
    assertThat(auth.getName()).isEqualTo("auth0|x");
  }

  @Test
  void maps_string_permission() {
    Jwt jwt =
        Jwt.withTokenValue("t")
            .header("alg", "none")
            .subject("u")
            .claim("permissions", "ADMIN")
            .build();
    var auth = converter.convert(jwt);
    assertThat(auth).isNotNull();
    assertThat(auth.getAuthorities()).extracting(a -> a.getAuthority()).contains("ROLE_ADMIN");
  }

  @Test
  void no_permissions_yields_empty_authorities() {
    Jwt jwt = Jwt.withTokenValue("t").header("alg", "none").subject("u").build();
    var auth = converter.convert(jwt);
    assertThat(auth).isNotNull();
    assertThat(auth.getAuthorities()).isEmpty();
  }
}
