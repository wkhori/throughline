package com.throughline.weeklycommit.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.throughline.weeklycommit.PostgresIntegrationTestBase;
import com.throughline.weeklycommit.TestDatabaseCleaner;
import com.throughline.weeklycommit.domain.AIInsightKind;
import com.throughline.weeklycommit.domain.Org;
import com.throughline.weeklycommit.domain.Role;
import com.throughline.weeklycommit.domain.User;
import com.throughline.weeklycommit.domain.repo.AIInsightRepository;
import com.throughline.weeklycommit.domain.repo.OrgRepository;
import com.throughline.weeklycommit.domain.repo.UserRepository;
import com.throughline.weeklycommit.infrastructure.ai.StubAnthropicClient;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc
@Import(StubAnthropicClient.class)
class AiCopilotControllerTest extends PostgresIntegrationTestBase {

  @Autowired MockMvc mvc;
  @Autowired OrgRepository orgRepo;
  @Autowired UserRepository userRepo;
  @Autowired AIInsightRepository insightRepo;
  @Autowired TestDatabaseCleaner cleaner;

  String orgId;
  String icSub = "auth0|mock-ic-ai";

  @BeforeEach
  void seed() {
    cleaner.clean();
    StubAnthropicClient.reset();
    Org org = orgRepo.save(new Org("ACME"));
    orgId = org.getId();
    User ic = new User(orgId, icSub, "ic@x.com", "IC One", Role.IC);
    userRepo.save(ic);
  }

  @AfterEach
  void resetStub() {
    StubAnthropicClient.reset();
  }

  @Test
  void suggestOutcome_returns_200_persists_insight_under_T1() throws Exception {
    StubAnthropicClient.register(
        "T1",
        "{\"supportingOutcomeId\":\"01HXYZSO\",\"confidence\":0.91,\"rationale\":\"matches"
            + " churn outcome by verb+object\",\"reasoning\":\"clear semantic linkage\","
            + "\"model\":\"claude-haiku-4-5-20251001\"}");

    String body =
        "{\"draftCommitText\":\"Ship the new onboarding email sequence to reduce day-7 churn\","
            + "\"candidates\":["
            + "{\"supportingOutcomeId\":\"01HXYZSO\",\"title\":\"Reduce 30-day churn\","
            + "\"parentOutcomeTitle\":\"Churn down 15%\",\"parentDOTitle\":\"Retention\","
            + "\"parentRallyCryTitle\":\"Win the SMB segment\"}]}";

    mvc.perform(
            post("/api/v1/ai/suggest-outcome")
                .with(jwtFor(icSub, "IC"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.kind").value("T1_SUGGESTION"))
        .andExpect(jsonPath("$.payload.supportingOutcomeId").value("01HXYZSO"))
        .andExpect(jsonPath("$.payload.confidence").value(0.91));

    assertThat(insightRepo.findAll())
        .anyMatch(i -> i.getKind() == AIInsightKind.T1_SUGGESTION && i.getOrgId().equals(orgId));
  }

  @Test
  void suggestOutcome_returns_400_when_draft_text_too_short() throws Exception {
    String body =
        "{\"draftCommitText\":\"too short\","
            + "\"candidates\":[{\"supportingOutcomeId\":\"01HXYZSO\",\"title\":\"x\","
            + "\"parentOutcomeTitle\":\"x\",\"parentDOTitle\":\"x\","
            + "\"parentRallyCryTitle\":\"x\"}]}";
    mvc.perform(
            post("/api/v1/ai/suggest-outcome")
                .with(jwtFor(icSub, "IC"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isBadRequest());
  }

  @Test
  void driftCheck_returns_200_with_aligned_verdict_from_stub() throws Exception {
    String body =
        "{\"commitId\":\"01HXCOMMIT0000000000000001\","
            + "\"commitText\":\"Refactor billing service test suite\","
            + "\"linkedOutcome\":{\"supportingOutcomeId\":\"01HXYZSO\",\"title\":\"x\","
            + "\"parentOutcomeTitle\":\"y\",\"parentDOTitle\":\"z\"},"
            + "\"alternativeOutcomes\":[]}";
    mvc.perform(
            post("/api/v1/ai/drift-check")
                .with(jwtFor(icSub, "IC"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.kind").value("T2_DRIFT"))
        .andExpect(jsonPath("$.payload.alignmentVerdict").value("aligned"));
  }

  @Test
  void qualityLint_returns_200_with_no_issues_for_healthy_commit() throws Exception {
    String body =
        "{\"commitId\":\"01HXCOMMIT0000000000000002\","
            + "\"commitText\":\"Ship onboarding email v2\",\"category\":\"OPERATIONAL\","
            + "\"priority\":\"SHOULD\",\"supportingOutcomeTitle\":\"Reduce churn\"}";
    mvc.perform(
            post("/api/v1/ai/quality-lint")
                .with(jwtFor(icSub, "IC"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.kind").value("T7_QUALITY"))
        .andExpect(jsonPath("$.payload.severity").value("low"));
  }

  @Test
  void qualityLint_sets_X_Cache_MISS_first_then_HIT_on_replay() throws Exception {
    String body =
        "{\"commitId\":\"01HXCOMMIT0000000000000003\","
            + "\"commitText\":\"Ship onboarding email v2\",\"category\":\"OPERATIONAL\","
            + "\"priority\":\"SHOULD\",\"supportingOutcomeTitle\":\"Reduce churn\"}";
    mvc.perform(
            post("/api/v1/ai/quality-lint")
                .with(jwtFor(icSub, "IC"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isOk())
        .andExpect(
            org.springframework.test.web.servlet.result.MockMvcResultMatchers.header()
                .string("X-Cache", "MISS"));
    mvc.perform(
            post("/api/v1/ai/quality-lint")
                .with(jwtFor(icSub, "IC"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isOk())
        .andExpect(
            org.springframework.test.web.servlet.result.MockMvcResultMatchers.header()
                .string("X-Cache", "HIT"));
  }

  @Test
  void batchInsights_returns_latest_insight_per_commit() throws Exception {
    String a = "01HXCOMMIT0000000000000010";
    String b = "01HXCOMMIT0000000000000011";
    String aBody =
        "{\"commitId\":\""
            + a
            + "\",\"commitText\":\"Ship onboarding email v2\",\"category\":\"OPERATIONAL\","
            + "\"priority\":\"SHOULD\",\"supportingOutcomeTitle\":\"Reduce churn\"}";
    String bBody =
        "{\"commitId\":\""
            + b
            + "\",\"commitText\":\"Refactor billing tests\",\"category\":\"OPERATIONAL\","
            + "\"priority\":\"SHOULD\",\"supportingOutcomeTitle\":\"Reduce churn\"}";
    mvc.perform(
            post("/api/v1/ai/quality-lint")
                .with(jwtFor(icSub, "IC"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(aBody))
        .andExpect(status().isOk());
    mvc.perform(
            post("/api/v1/ai/quality-lint")
                .with(jwtFor(icSub, "IC"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(bBody))
        .andExpect(status().isOk());

    String batch = "{\"commitIds\":[\"" + a + "\",\"" + b + "\"],\"kind\":\"T7_QUALITY\"}";
    mvc.perform(
            post("/api/v1/ai/insights/batch")
                .with(jwtFor(icSub, "IC"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(batch))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.insights").isArray())
        .andExpect(jsonPath("$.insights.length()").value(2));
  }

  @Test
  void batchInsights_rejects_unknown_kind_with_400() throws Exception {
    mvc.perform(
            post("/api/v1/ai/insights/batch")
                .with(jwtFor(icSub, "IC"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"commitIds\":[\"01HXCOMMIT0000000000000010\"],\"kind\":\"NOT_A_KIND\"}"))
        .andExpect(status().isBadRequest());
  }

  @Test
  void aiEndpoints_return_401_when_unauthenticated() throws Exception {
    mvc.perform(
            post("/api/v1/ai/suggest-outcome")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void suggestOutcome_returns_429_when_per_user_hour_cap_exceeded() throws Exception {
    // Per-kind hour cap for T1 is 30 (P23). Fire 31 calls; the 31st should 429.
    StubAnthropicClient.register(
        "T1",
        "{\"supportingOutcomeId\":null,\"confidence\":0,"
            + "\"rationale\":\"x\",\"reasoning\":\"x\",\"model\":\"claude-haiku-4-5-20251001\"}");
    String body =
        """
        {"draftCommitText":"Drive onboarding completion above 80% by improving step copy",
         "candidates":[{"supportingOutcomeId":"01HXYZSO","title":"x",
                        "parentOutcomeTitle":"y","parentDOTitle":"z",
                        "parentRallyCryTitle":"w"}]}""";
    for (int i = 0; i < 30; i++) {
      mvc.perform(
              post("/api/v1/ai/suggest-outcome")
                  .with(jwtFor(icSub, "IC"))
                  .contentType(MediaType.APPLICATION_JSON)
                  .content(body))
          .andExpect(status().isOk());
    }
    mvc.perform(
            post("/api/v1/ai/suggest-outcome")
                .with(jwtFor(icSub, "IC"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isTooManyRequests())
        .andExpect(jsonPath("$.title").value("BUDGET_EXHAUSTED"))
        .andExpect(jsonPath("$.reason").value("USER_HOUR_CAP"));
  }

  private static SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor jwtFor(
      String sub, String role) {
    return SecurityMockMvcRequestPostProcessors.jwt()
        .jwt(j -> j.subject(sub).claim("permissions", List.of(role)))
        .authorities(new SimpleGrantedAuthority("ROLE_" + role));
  }
}
