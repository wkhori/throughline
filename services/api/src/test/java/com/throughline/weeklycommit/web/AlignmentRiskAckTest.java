package com.throughline.weeklycommit.web;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.throughline.weeklycommit.PostgresIntegrationTestBase;
import com.throughline.weeklycommit.TestDatabaseCleaner;
import com.throughline.weeklycommit.domain.AlignmentRisk;
import com.throughline.weeklycommit.domain.AlignmentRiskRule;
import com.throughline.weeklycommit.domain.AlignmentRiskSeverity;
import com.throughline.weeklycommit.domain.Org;
import com.throughline.weeklycommit.domain.Role;
import com.throughline.weeklycommit.domain.User;
import com.throughline.weeklycommit.domain.repo.AlignmentRiskRepository;
import com.throughline.weeklycommit.domain.repo.OrgRepository;
import com.throughline.weeklycommit.domain.repo.UserRepository;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc
class AlignmentRiskAckTest extends PostgresIntegrationTestBase {

  @Autowired MockMvc mvc;
  @Autowired OrgRepository orgRepo;
  @Autowired UserRepository userRepo;
  @Autowired AlignmentRiskRepository riskRepo;
  @Autowired TestDatabaseCleaner cleaner;

  String orgId;
  String managerSub = "auth0|mgr";
  String otherOrgManagerSub = "auth0|other-mgr";
  String riskId;

  @BeforeEach
  void seed() {
    cleaner.clean();
    Org org = orgRepo.save(new Org("AckOrg"));
    orgId = org.getId();
    Org otherOrg = orgRepo.save(new Org("OtherOrg"));
    userRepo.save(new User(orgId, managerSub, "m@x", "Mgr", Role.MANAGER));
    userRepo.save(new User(otherOrg.getId(), otherOrgManagerSub, "om@x", "OtherMgr", Role.MANAGER));
    AlignmentRisk r =
        new AlignmentRisk(
            orgId,
            AlignmentRiskRule.LONG_CARRY_FORWARD,
            AlignmentRiskSeverity.HIGH,
            "commit",
            "01HXCOMMIT0000000000000001",
            LocalDate.of(2026, 4, 20),
            "dedupe-key-test");
    riskRepo.save(r);
    riskId = r.getId();
  }

  @Test
  void ack_manager_in_org_returns_204() throws Exception {
    mvc.perform(
            post("/api/v1/manager/alignment-risks/" + riskId + "/ack")
                .with(jwtFor(managerSub, "MANAGER")))
        .andExpect(status().isNoContent());
  }

  @Test
  void ack_manager_other_org_returns_403() throws Exception {
    mvc.perform(
            post("/api/v1/manager/alignment-risks/" + riskId + "/ack")
                .with(jwtFor(otherOrgManagerSub, "MANAGER")))
        .andExpect(status().isForbidden());
  }

  @Test
  void ack_unauthenticated_returns_401() throws Exception {
    mvc.perform(post("/api/v1/manager/alignment-risks/" + riskId + "/ack"))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void ack_unknown_id_returns_404() throws Exception {
    mvc.perform(
            post("/api/v1/manager/alignment-risks/01HXMISSING0000000000000001/ack")
                .with(jwtFor(managerSub, "MANAGER")))
        .andExpect(status().isNotFound());
  }

  private static SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor jwtFor(
      String sub, String role) {
    return SecurityMockMvcRequestPostProcessors.jwt()
        .jwt(j -> j.subject(sub).claim("permissions", List.of(role)))
        .authorities(new SimpleGrantedAuthority("ROLE_" + role));
  }
}
