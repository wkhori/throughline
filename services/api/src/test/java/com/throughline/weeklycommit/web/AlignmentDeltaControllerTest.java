package com.throughline.weeklycommit.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.throughline.weeklycommit.PostgresIntegrationTestBase;
import com.throughline.weeklycommit.TestDatabaseCleaner;
import com.throughline.weeklycommit.application.ai.AlignmentDeltaService;
import com.throughline.weeklycommit.domain.AIInsightKind;
import com.throughline.weeklycommit.domain.Commit;
import com.throughline.weeklycommit.domain.Org;
import com.throughline.weeklycommit.domain.ReconciliationOutcome;
import com.throughline.weeklycommit.domain.Role;
import com.throughline.weeklycommit.domain.User;
import com.throughline.weeklycommit.domain.Week;
import com.throughline.weeklycommit.domain.WeekState;
import com.throughline.weeklycommit.domain.repo.AIInsightRepository;
import com.throughline.weeklycommit.domain.repo.CommitRepository;
import com.throughline.weeklycommit.domain.repo.OrgRepository;
import com.throughline.weeklycommit.domain.repo.UserRepository;
import com.throughline.weeklycommit.domain.repo.WeekRepository;
import com.throughline.weeklycommit.infrastructure.ai.StubAnthropicClient;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc
@Import(StubAnthropicClient.class)
class AlignmentDeltaControllerTest extends PostgresIntegrationTestBase {

  @Autowired MockMvc mvc;
  @Autowired OrgRepository orgRepo;
  @Autowired UserRepository userRepo;
  @Autowired WeekRepository weekRepo;
  @Autowired CommitRepository commitRepo;
  @Autowired AIInsightRepository insightRepo;
  @Autowired AlignmentDeltaService alignmentDeltaService;
  @Autowired TestDatabaseCleaner cleaner;

  String orgId;
  String icSub = "auth0|mock-ic-t4";
  String icId;
  String weekId;

  @BeforeEach
  void seed() {
    cleaner.clean();
    StubAnthropicClient.reset();
    Org org = orgRepo.save(new Org("ACME"));
    orgId = org.getId();
    User ic = new User(orgId, icSub, "ic@x.com", "IC", Role.IC);
    userRepo.save(ic);
    icId = ic.getId();
    Week w = new Week(icId, orgId, LocalDate.of(2026, 4, 20));
    w.setState(WeekState.RECONCILED);
    weekRepo.save(w);
    weekId = w.getId();

    Commit c1 = new Commit(weekId, "Ship onboarding emails v2");
    c1.setReconciliationOutcome(ReconciliationOutcome.DONE);
    commitRepo.save(c1);
    Commit c2 = new Commit(weekId, "Fix billing test suite");
    c2.setReconciliationOutcome(ReconciliationOutcome.NOT_DONE);
    c2.setCarryForwardWeeks(2);
    commitRepo.save(c2);
  }

  @AfterEach
  void resetStub() {
    StubAnthropicClient.reset();
  }

  @Test
  void getAlignmentDelta_returns_204_when_no_insight_yet() throws Exception {
    mvc.perform(get("/api/v1/ai/alignment-delta/" + weekId).with(jwtFor(icSub, "IC")))
        .andExpect(status().isNoContent());
  }

  @Test
  void postAlignmentDelta_runs_T4_and_persists_insight_with_priorCarryForwardWeeks_passed()
      throws Exception {
    StubAnthropicClient.register(
        "T4",
        "{\"summary\":\"2 commits — 1 done, 0 partial, 1 not done.\",\"shipped\":[],\"slipped\":[],"
            + "\"carryForwardRecommendations\":[],\"outcomeTractionDelta\":[],"
            + "\"reasoning\":\"r\",\"model\":\"claude-sonnet-4-6\"}");
    mvc.perform(post("/api/v1/ai/alignment-delta/" + weekId).with(jwtFor(icSub, "IC")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.kind").value("T4_DELTA"));
    assertThat(insightRepo.findAll())
        .anyMatch(i -> i.getKind() == AIInsightKind.T4_DELTA && i.getEntityId().equals(weekId));
  }

  @Test
  void deterministic_fallback_uses_carryForward_heuristic() {
    StubAnthropicClient.register("T4", "not json");
    var insight = alignmentDeltaService.runDelta(weekId, icId, orgId);
    assertThat(insight.getModel()).isEqualTo("deterministic");
    // commit c2 has carryForwardWeeks=2 and NOT_DONE → recommend "drop"
    assertThat(insight.getPayloadJson()).contains("\"action\":\"drop\"");
  }

  private static SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor jwtFor(
      String sub, String role) {
    return SecurityMockMvcRequestPostProcessors.jwt()
        .jwt(j -> j.subject(sub).claim("permissions", List.of(role)))
        .authorities(new SimpleGrantedAuthority("ROLE_" + role));
  }
}
