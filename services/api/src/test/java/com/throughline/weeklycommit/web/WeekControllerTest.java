package com.throughline.weeklycommit.web;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.throughline.weeklycommit.PostgresIntegrationTestBase;
import com.throughline.weeklycommit.TestDatabaseCleaner;
import com.throughline.weeklycommit.domain.DefiningObjective;
import com.throughline.weeklycommit.domain.Org;
import com.throughline.weeklycommit.domain.Outcome;
import com.throughline.weeklycommit.domain.RallyCry;
import com.throughline.weeklycommit.domain.Role;
import com.throughline.weeklycommit.domain.SupportingOutcome;
import com.throughline.weeklycommit.domain.User;
import com.throughline.weeklycommit.domain.repo.DefiningObjectiveRepository;
import com.throughline.weeklycommit.domain.repo.OrgRepository;
import com.throughline.weeklycommit.domain.repo.OutcomeRepository;
import com.throughline.weeklycommit.domain.repo.RallyCryRepository;
import com.throughline.weeklycommit.domain.repo.SupportingOutcomeRepository;
import com.throughline.weeklycommit.domain.repo.UserRepository;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * Phase-2 contract test for {@link WeekController}. Covers the full /weeks surface: GET
 * /weeks/current (DRAFT auto-creation + idempotent re-fetch), GET /weeks/{id}, POST
 * /weeks/{id}/lock (happy 200, validation 400, illegal-state 409, idempotent replay 200, non-owner
 * 403). The lock contract is shaped per PRD §4.2 — body returns {@code { week, portfolioReview }}
 * with {@code portfolioReview} always {@code null} in Phase 2 (T3 wires in Phase 5b).
 */
@AutoConfigureMockMvc
class WeekControllerTest extends PostgresIntegrationTestBase {

  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired OrgRepository orgRepo;
  @Autowired UserRepository userRepo;
  @Autowired RallyCryRepository rcRepo;
  @Autowired DefiningObjectiveRepository doRepo;
  @Autowired OutcomeRepository outcomeRepo;
  @Autowired SupportingOutcomeRepository soRepo;
  @Autowired TestDatabaseCleaner cleaner;

  private String orgId;
  private String icSub;
  private String otherIcSub;
  private String supportingOutcomeId;

  @BeforeEach
  void seed() {
    cleaner.clean();
    Org org = orgRepo.save(new Org("WeekOrg"));
    orgId = org.getId();
    icSub = "auth0|week-ic";
    otherIcSub = "auth0|other-ic";
    userRepo.save(new User(orgId, icSub, "ic@x.com", "IC", Role.IC));
    userRepo.save(new User(orgId, otherIcSub, "other@x.com", "Other IC", Role.IC));
    RallyCry rc = rcRepo.save(new RallyCry(orgId, "Test RC"));
    DefiningObjective defo = doRepo.save(new DefiningObjective(rc.getId(), "Test DO"));
    Outcome o = outcomeRepo.save(new Outcome(defo.getId(), "Test O"));
    supportingOutcomeId = soRepo.save(new SupportingOutcome(o.getId(), "Test SO")).getId();
  }

  private MockHttpServletRequestBuilder asIc(MockHttpServletRequestBuilder b, String sub) {
    return b.with(
        SecurityMockMvcRequestPostProcessors.jwt()
            .jwt(j -> j.subject(sub).claim("permissions", List.of("IC")))
            .authorities(new SimpleGrantedAuthority("ROLE_IC")));
  }

  // --- GET /weeks/current ---------------------------------------------------

  @Test
  void getCurrentWeek_first_visit_creates_draft_returns_200() throws Exception {
    mvc.perform(asIc(get("/api/v1/weeks/current"), icSub))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").exists())
        .andExpect(jsonPath("$.state").value("DRAFT"))
        .andExpect(jsonPath("$.weekStart").exists())
        .andExpect(jsonPath("$.commits").isArray())
        .andExpect(jsonPath("$.commits.length()").value(0));
  }

  @Test
  void getCurrentWeek_repeat_visit_is_idempotent_same_week_id() throws Exception {
    String first =
        mvc.perform(asIc(get("/api/v1/weeks/current"), icSub))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    String second =
        mvc.perform(asIc(get("/api/v1/weeks/current"), icSub))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    String firstId = json.readTree(first).get("id").asText();
    String secondId = json.readTree(second).get("id").asText();
    org.assertj.core.api.Assertions.assertThat(firstId).isEqualTo(secondId);
  }

  @Test
  void getCurrentWeek_unauthenticated_returns_401() throws Exception {
    mvc.perform(get("/api/v1/weeks/current")).andExpect(status().isUnauthorized());
  }

  // --- GET /weeks/{id} ------------------------------------------------------

  @Test
  void getWeekById_owner_returns_200() throws Exception {
    String weekId = createDraftWeek();
    mvc.perform(asIc(get("/api/v1/weeks/" + weekId), icSub))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(weekId));
  }

  @Test
  void getWeekById_non_owner_returns_403() throws Exception {
    String weekId = createDraftWeek();
    mvc.perform(asIc(get("/api/v1/weeks/" + weekId), otherIcSub)).andExpect(status().isForbidden());
  }

  @Test
  void getWeekById_unknown_returns_404() throws Exception {
    mvc.perform(asIc(get("/api/v1/weeks/01HZZZZZZZZZZZZZZZZZZZZZZZ"), icSub))
        .andExpect(status().isNotFound());
  }

  // --- POST /weeks/{id}/lock ------------------------------------------------

  @Test
  void lockWeek_zero_commits_returns_400() throws Exception {
    String weekId = createDraftWeek();
    mvc.perform(asIc(post("/api/v1/weeks/" + weekId + "/lock"), icSub))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.title").value("VALIDATION_ERROR"));
  }

  @Test
  void lockWeek_happy_path_returns_200_with_null_portfolioReview() throws Exception {
    String weekId = createDraftWeek();
    addCommitWithSO(weekId);
    mvc.perform(asIc(post("/api/v1/weeks/" + weekId + "/lock"), icSub))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.week.state").value("LOCKED"))
        .andExpect(jsonPath("$.week.lockedAt").exists())
        .andExpect(jsonPath("$.portfolioReview").doesNotExist());
  }

  @Test
  void lockWeek_idempotent_replay_returns_200_with_unchanged_lockedAt() throws Exception {
    String weekId = createDraftWeek();
    addCommitWithSO(weekId);
    String first =
        mvc.perform(asIc(post("/api/v1/weeks/" + weekId + "/lock"), icSub))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    String firstLockedAt = json.readTree(first).get("week").get("lockedAt").asText();
    String second =
        mvc.perform(asIc(post("/api/v1/weeks/" + weekId + "/lock"), icSub))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    String secondLockedAt = json.readTree(second).get("week").get("lockedAt").asText();
    org.assertj.core.api.Assertions.assertThat(secondLockedAt).isEqualTo(firstLockedAt);
  }

  @Test
  void lockWeek_missing_so_on_any_commit_returns_400() throws Exception {
    String weekId = createDraftWeek();
    addCommitWithSO(weekId);
    addCommitWithoutSO(weekId);
    mvc.perform(asIc(post("/api/v1/weeks/" + weekId + "/lock"), icSub))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.title").value("VALIDATION_ERROR"));
  }

  @Test
  void lockWeek_non_owner_returns_403() throws Exception {
    String weekId = createDraftWeek();
    addCommitWithSO(weekId);
    mvc.perform(asIc(post("/api/v1/weeks/" + weekId + "/lock"), otherIcSub))
        .andExpect(status().isForbidden());
  }

  // --- helpers --------------------------------------------------------------

  private String createDraftWeek() throws Exception {
    String body =
        mvc.perform(asIc(get("/api/v1/weeks/current"), icSub))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return json.readTree(body).get("id").asText();
  }

  private void addCommitWithSO(String weekId) throws Exception {
    String body =
        """
{"weekId":"%s","text":"Ship something useful","supportingOutcomeId":"%s","category":"OPERATIONAL","priority":"SHOULD"}
"""
            .formatted(weekId, supportingOutcomeId);
    mvc.perform(
            asIc(post("/api/v1/commits"), icSub)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isCreated());
  }

  private void addCommitWithoutSO(String weekId) throws Exception {
    String body =
        """
        {"weekId":"%s","text":"Tentative scope item","category":"REACTIVE","priority":"COULD"}
        """
            .formatted(weekId);
    mvc.perform(
            asIc(post("/api/v1/commits"), icSub)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isCreated());
  }
}
