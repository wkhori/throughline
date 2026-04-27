package com.throughline.weeklycommit.infrastructure.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.JwtException;

class MockJwtDecoderTest {

  MockJwtDecoder decoder = new MockJwtDecoder();

  @Test
  void decodes_ic_persona() {
    var jwt = decoder.decode("mock.ic.token");
    assertThat(jwt.getSubject()).isEqualTo("auth0|mock-ic");
    assertThat(jwt.getClaimAsStringList("permissions")).containsExactly("IC");
    assertThat(jwt.getAudience()).contains("https://api.throughline.app");
  }

  @Test
  void decodes_manager_persona() {
    var jwt = decoder.decode("mock.manager.token");
    assertThat(jwt.getSubject()).isEqualTo("auth0|mock-manager");
    assertThat(jwt.getClaimAsStringList("permissions")).containsExactly("MANAGER");
  }

  @Test
  void decodes_admin_persona() {
    var jwt = decoder.decode("mock.admin.token");
    assertThat(jwt.getSubject()).isEqualTo("auth0|mock-admin");
    assertThat(jwt.getClaimAsStringList("permissions")).containsExactly("ADMIN");
  }

  @Test
  void rejects_unknown_token() {
    assertThatThrownBy(() -> decoder.decode("garbage")).isInstanceOf(JwtException.class);
  }
}
