package com.throughline.weeklycommit.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.throughline.weeklycommit.PostgresIntegrationTestBase;
import com.throughline.weeklycommit.TestDatabaseCleaner;
import com.throughline.weeklycommit.application.ai.PortfolioReviewService;
import com.throughline.weeklycommit.domain.AIInsightKind;
import com.throughline.weeklycommit.domain.Org;
import com.throughline.weeklycommit.domain.Role;
import com.throughline.weeklycommit.domain.User;
import com.throughline.weeklycommit.domain.Week;
import com.throughline.weeklycommit.domain.WeekState;
import com.throughline.weeklycommit.domain.repo.AIInsightRepository;
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
class PortfolioReviewControllerTest extends PostgresIntegrationTestBase {

  @Autowired MockMvc mvc;
  @Autowired OrgRepository orgRepo;
  @Autowired UserRepository userRepo;
  @Autowired WeekRepository weekRepo;
  @Autowired AIInsightRepository insightRepo;
  @Autowired PortfolioReviewService portfolioReviewService;
  @Autowired TestDatabaseCleaner cleaner;

  String orgId;
  String icSub = "auth0|mock-ic-t3";
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
    w.setState(WeekState.LOCKED);
    weekRepo.save(w);
    weekId = w.getId();
  }

  @AfterEach
  void resetStub() {
    StubAnthropicClient.reset();
  }

  @Test
  void getPortfolioReview_returns_204_when_no_insight_yet() throws Exception {
    mvc.perform(get("/api/v1/ai/portfolio-review/" + weekId).with(jwtFor(icSub, "IC")))
        .andExpect(status().isNoContent());
  }

  @Test
  void postPortfolioReview_runs_synchronously_and_persists_T3_insight() throws Exception {
    StubAnthropicClient.register(
        "T3",
        "{\"headline\":\"Locked 0 commits\",\"overallSeverity\":\"info\",\"findings\":[],"
            + "\"chessGridSummary\":{\"strategicShare\":0,\"operationalShare\":0,"
            + "\"reactiveShare\":0,\"mustCount\":0,\"shouldCount\":0,\"couldCount\":0},"
            + "\"reasoning\":\"r\",\"model\":\"claude-sonnet-4-6\"}");
    mvc.perform(post("/api/v1/ai/portfolio-review/" + weekId).with(jwtFor(icSub, "IC")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.kind").value("T3_PORTFOLIO"))
        .andExpect(jsonPath("$.payload.headline").value("Locked 0 commits"));
    assertThat(insightRepo.findAll())
        .anyMatch(i -> i.getKind() == AIInsightKind.T3_PORTFOLIO && i.getEntityId().equals(weekId));
  }

  @Test
  void getPortfolioReview_returns_403_for_unrelated_user() throws Exception {
    User other = new User(orgId, "auth0|other", "o@x.com", "Other", Role.IC);
    userRepo.save(other);
    mvc.perform(get("/api/v1/ai/portfolio-review/" + weekId).with(jwtFor("auth0|other", "IC")))
        .andExpect(status().isForbidden());
  }

  @Test
  void deterministic_fallback_persists_when_anthropic_returns_invalid_json() throws Exception {
    StubAnthropicClient.register("T3", "not json at all");
    var insight = portfolioReviewService.runReview(weekId, icId, orgId);
    assertThat(insight.getModel()).isEqualTo("deterministic");
    assertThat(insight.getPayloadJson()).contains("\"reasoning\":\"Counts-only fallback");
  }

  private static SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor jwtFor(
      String sub, String role) {
    return SecurityMockMvcRequestPostProcessors.jwt()
        .jwt(j -> j.subject(sub).claim("permissions", List.of(role)))
        .authorities(new SimpleGrantedAuthority("ROLE_" + role));
  }
}
