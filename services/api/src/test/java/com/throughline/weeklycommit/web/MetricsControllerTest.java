package com.throughline.weeklycommit.web;

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
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;

/** Phase 7 — contract test for {@code GET /api/v1/metrics/org} (PRD §10.5). */
@AutoConfigureMockMvc
class MetricsControllerTest extends PostgresIntegrationTestBase {

  @Autowired MockMvc mvc;
  @Autowired OrgRepository orgRepo;
  @Autowired UserRepository userRepo;
  @Autowired TestDatabaseCleaner cleaner;

  String adminSub = "auth0|metrics-admin";
  String managerSub = "auth0|metrics-mgr";

  @BeforeEach
  void seed() {
    cleaner.clean();
    Org org = orgRepo.save(new Org("MetricsOrg"));
    userRepo.save(new User(org.getId(), adminSub, "a@x", "Admin", Role.ADMIN));
    userRepo.save(new User(org.getId(), managerSub, "m@x", "Mgr", Role.MANAGER));
  }

  @Test
  void admin_can_read_org_metrics() throws Exception {
    mvc.perform(get("/api/v1/metrics/org").with(jwtFor(adminSub, "ADMIN")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.planningCompletionRate").exists())
        .andExpect(jsonPath("$.reconciliationStrictPct").exists())
        .andExpect(jsonPath("$.reconciliationWeightedPct").exists())
        .andExpect(jsonPath("$.avgManagerDigestViewMinutesAfterDeliver").exists())
        .andExpect(jsonPath("$.planningSessionMinutesP50").exists());
  }

  @Test
  void manager_is_forbidden_from_org_metrics() throws Exception {
    mvc.perform(get("/api/v1/metrics/org").with(jwtFor(managerSub, "MANAGER")))
        .andExpect(status().isForbidden());
  }

  @Test
  void unauthenticated_returns_401() throws Exception {
    mvc.perform(get("/api/v1/metrics/org")).andExpect(status().isUnauthorized());
  }

  private static SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor jwtFor(
      String sub, String role) {
    return SecurityMockMvcRequestPostProcessors.jwt()
        .jwt(j -> j.subject(sub).claim("permissions", List.of(role)))
        .authorities(new SimpleGrantedAuthority("ROLE_" + role));
  }
}
