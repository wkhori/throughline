package com.throughline.weeklycommit.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.throughline.weeklycommit.PostgresIntegrationTestBase;
import com.throughline.weeklycommit.TestDatabaseCleaner;
import com.throughline.weeklycommit.domain.Org;
import com.throughline.weeklycommit.domain.Role;
import com.throughline.weeklycommit.domain.User;
import com.throughline.weeklycommit.domain.repo.OrgRepository;
import com.throughline.weeklycommit.domain.repo.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.security.test.context.support.WithAnonymousUser;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc
class AuthControllerTest extends PostgresIntegrationTestBase {

  @Autowired MockMvc mvc;
  @Autowired OrgRepository orgRepo;
  @Autowired UserRepository userRepo;
  @Autowired TestDatabaseCleaner cleaner;

  String orgId;
  String icId;

  @BeforeEach
  void seed() {
    cleaner.clean();
    Org org = orgRepo.save(new Org("ACME"));
    orgId = org.getId();
    User ic = new User(orgId, "auth0|mock-ic", "ic@x.com", "IC One", Role.IC);
    userRepo.save(ic);
    icId = ic.getId();
  }

  @Test
  void me_returns_200_with_role_when_authenticated_as_IC() throws Exception {
    mvc.perform(
            get("/api/v1/me")
                .with(
                    SecurityMockMvcRequestPostProcessors.jwt()
                        .jwt(
                            j ->
                                j.subject("auth0|mock-ic")
                                    .claim("permissions", java.util.List.of("IC")))
                        .authorities(
                            new org.springframework.security.core.authority.SimpleGrantedAuthority(
                                "ROLE_IC"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.email").value("ic@x.com"))
        .andExpect(jsonPath("$.role").value("IC"));
    assertThat(userRepo.findByAuth0Sub("auth0|mock-ic")).isPresent();
  }

  @Test
  @WithAnonymousUser
  void me_returns_401_when_unauthenticated() throws Exception {
    mvc.perform(get("/api/v1/me")).andExpect(status().isUnauthorized());
  }
}
