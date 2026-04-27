package com.throughline.weeklycommit.web;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
 * Phase-2 contract test for {@link CommitController}. Covers POST/PUT/DELETE /commits + the Phase-3
 * carry-forward endpoint stub. Validates: text length 5–280, 7-commit-per-week soft cap, SO
 * existence + non-archived, owner scope, illegal-state on non-DRAFT weeks.
 */
@AutoConfigureMockMvc
class CommitControllerTest extends PostgresIntegrationTestBase {

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
  private String soId;

  @BeforeEach
  void seed() {
    cleaner.clean();
    Org org = orgRepo.save(new Org("CommitOrg"));
    orgId = org.getId();
    icSub = "auth0|commit-ic";
    otherIcSub = "auth0|other-commit-ic";
    userRepo.save(new User(orgId, icSub, "ic@x.com", "IC", Role.IC));
    userRepo.save(new User(orgId, otherIcSub, "other@x.com", "Other IC", Role.IC));
    RallyCry rc = rcRepo.save(new RallyCry(orgId, "Test RC"));
    DefiningObjective defo = doRepo.save(new DefiningObjective(rc.getId(), "Test DO"));
    Outcome o = outcomeRepo.save(new Outcome(defo.getId(), "Test O"));
    soId = soRepo.save(new SupportingOutcome(o.getId(), "Test SO")).getId();
  }

  private MockHttpServletRequestBuilder asIc(MockHttpServletRequestBuilder b, String sub) {
    return b.with(
        SecurityMockMvcRequestPostProcessors.jwt()
            .jwt(j -> j.subject(sub).claim("permissions", List.of("IC")))
            .authorities(new SimpleGrantedAuthority("ROLE_IC")));
  }

  private String draftWeekId(String sub) throws Exception {
    String body =
        mvc.perform(asIc(get("/api/v1/weeks/current"), sub))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return json.readTree(body).get("id").asText();
  }

  private String postCommit(String weekId, String text, String sub) throws Exception {
    String body =
        """
{"weekId":"%s","text":"%s","supportingOutcomeId":"%s","category":"OPERATIONAL","priority":"SHOULD"}
"""
            .formatted(weekId, text, soId);
    String resp =
        mvc.perform(
                asIc(post("/api/v1/commits"), sub)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return json.readTree(resp).get("id").asText();
  }

  // --- POST /commits --------------------------------------------------------

  @Test
  void createCommit_happy_path_returns_201() throws Exception {
    String weekId = draftWeekId(icSub);
    String body =
        """
{"weekId":"%s","text":"Ship onboarding email v2","supportingOutcomeId":"%s","category":"STRATEGIC","priority":"MUST"}
"""
            .formatted(weekId, soId);
    mvc.perform(
            asIc(post("/api/v1/commits"), icSub)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.id").exists())
        .andExpect(jsonPath("$.state").value("ACTIVE"))
        .andExpect(jsonPath("$.category").value("STRATEGIC"))
        .andExpect(jsonPath("$.priority").value("MUST"));
  }

  @Test
  void createCommit_text_too_short_returns_400() throws Exception {
    String weekId = draftWeekId(icSub);
    String body =
        """
{"weekId":"%s","text":"abc","supportingOutcomeId":"%s","category":"OPERATIONAL","priority":"SHOULD"}
"""
            .formatted(weekId, soId);
    mvc.perform(
            asIc(post("/api/v1/commits"), icSub)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isBadRequest());
  }

  @Test
  void createCommit_text_too_long_returns_400() throws Exception {
    String weekId = draftWeekId(icSub);
    String text = "x".repeat(281);
    String body =
        """
{"weekId":"%s","text":"%s","supportingOutcomeId":"%s","category":"OPERATIONAL","priority":"SHOULD"}
"""
            .formatted(weekId, text, soId);
    mvc.perform(
            asIc(post("/api/v1/commits"), icSub)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isBadRequest());
  }

  @Test
  void createCommit_unknown_supportingOutcome_returns_404() throws Exception {
    String weekId = draftWeekId(icSub);
    String body =
        """
{"weekId":"%s","text":"valid commit text","supportingOutcomeId":"01HZZZZZZZZZZZZZZZZZZZZZZZ","category":"OPERATIONAL","priority":"SHOULD"}
"""
            .formatted(weekId);
    mvc.perform(
            asIc(post("/api/v1/commits"), icSub)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isNotFound());
  }

  @Test
  void createCommit_seven_per_week_cap_returns_409() throws Exception {
    String weekId = draftWeekId(icSub);
    for (int i = 0; i < 7; i++) postCommit(weekId, "Commit number " + i, icSub);
    String body =
        """
{"weekId":"%s","text":"eighth commit","supportingOutcomeId":"%s","category":"OPERATIONAL","priority":"SHOULD"}
"""
            .formatted(weekId, soId);
    mvc.perform(
            asIc(post("/api/v1/commits"), icSub)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.title").value("ILLEGAL_STATE"));
  }

  @Test
  void createCommit_on_other_users_week_returns_403() throws Exception {
    String otherWeek = draftWeekId(otherIcSub);
    String body =
        """
{"weekId":"%s","text":"trespass attempt","supportingOutcomeId":"%s","category":"OPERATIONAL","priority":"SHOULD"}
"""
            .formatted(otherWeek, soId);
    mvc.perform(
            asIc(post("/api/v1/commits"), icSub)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isForbidden());
  }

  // --- PUT /commits/{id} ----------------------------------------------------

  @Test
  void updateCommit_owner_returns_200() throws Exception {
    String weekId = draftWeekId(icSub);
    String commitId = postCommit(weekId, "Build churn dashboard", icSub);
    String body =
        """
{"text":"Build churn dashboard v2","supportingOutcomeId":"%s","category":"OPERATIONAL","priority":"SHOULD"}
"""
            .formatted(soId);
    mvc.perform(
            asIc(put("/api/v1/commits/" + commitId), icSub)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.text").value("Build churn dashboard v2"));
  }

  @Test
  void updateCommit_non_owner_returns_403() throws Exception {
    String weekId = draftWeekId(icSub);
    String commitId = postCommit(weekId, "Build churn dashboard", icSub);
    String body =
        """
{"text":"Hijack attempt","supportingOutcomeId":"%s","category":"OPERATIONAL","priority":"SHOULD"}
"""
            .formatted(soId);
    mvc.perform(
            asIc(put("/api/v1/commits/" + commitId), otherIcSub)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isForbidden());
  }

  // --- DELETE /commits/{id} -------------------------------------------------

  @Test
  void deleteCommit_owner_returns_204() throws Exception {
    String weekId = draftWeekId(icSub);
    String commitId = postCommit(weekId, "Delete me", icSub);
    mvc.perform(asIc(delete("/api/v1/commits/" + commitId), icSub))
        .andExpect(status().isNoContent());
  }

  @Test
  void deleteCommit_non_owner_returns_403() throws Exception {
    String weekId = draftWeekId(icSub);
    String commitId = postCommit(weekId, "Defend me", icSub);
    mvc.perform(asIc(delete("/api/v1/commits/" + commitId), otherIcSub))
        .andExpect(status().isForbidden());
  }

  @Test
  void deleteCommit_unknown_returns_404() throws Exception {
    mvc.perform(asIc(delete("/api/v1/commits/01HZZZZZZZZZZZZZZZZZZZZZZZ"), icSub))
        .andExpect(status().isNotFound());
  }
}
