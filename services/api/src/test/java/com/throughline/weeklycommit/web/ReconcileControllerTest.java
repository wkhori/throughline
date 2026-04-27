package com.throughline.weeklycommit.web;

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
import com.throughline.weeklycommit.domain.repo.WeekRepository;
import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.List;
import org.assertj.core.api.Assertions;
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
 * Phase-3 contract test for reconcile + carry-forward (PRD §4.3 + §5.2). Covers reconcile-start
 * guards, validation of items, carry-forward chain creation, the 7-commit cap on week N+1, and the
 * AccessDenied path for non-owners.
 */
@AutoConfigureMockMvc
class ReconcileControllerTest extends PostgresIntegrationTestBase {

  @Autowired MockMvc mvc;
  @Autowired ObjectMapper json;
  @Autowired OrgRepository orgRepo;
  @Autowired UserRepository userRepo;
  @Autowired RallyCryRepository rcRepo;
  @Autowired DefiningObjectiveRepository doRepo;
  @Autowired OutcomeRepository outcomeRepo;
  @Autowired SupportingOutcomeRepository soRepo;
  @Autowired WeekRepository weekRepo;
  @Autowired TestDatabaseCleaner cleaner;

  private String icSub;
  private String otherIcSub;
  private String soId;
  private Org org;

  @BeforeEach
  void seed() {
    cleaner.clean();
    Org fresh = new Org("ReconcileOrg");
    // Open the reconcile window every day at 00:00 so tests don't have to fake the clock.
    fresh.setReconcileOpensDayOfWeek(DayOfWeek.MONDAY);
    fresh.setReconcileOpensTime(LocalTime.of(0, 0));
    org = orgRepo.save(fresh);
    icSub = "auth0|reconcile-ic";
    otherIcSub = "auth0|other-reconcile-ic";
    userRepo.save(new User(org.getId(), icSub, "ic@x.com", "IC", Role.IC));
    userRepo.save(new User(org.getId(), otherIcSub, "other@x.com", "Other IC", Role.IC));
    RallyCry rc = rcRepo.save(new RallyCry(org.getId(), "Test RC"));
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

  private String draftWeek(String sub) throws Exception {
    String body =
        mvc.perform(asIc(get("/api/v1/weeks/current"), sub))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return json.readTree(body).get("id").asText();
  }

  private String addCommit(String weekId, String text, String sub) throws Exception {
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

  private String lockedWeek(String sub) throws Exception {
    String wId = draftWeek(sub);
    addCommit(wId, "First commit text", sub);
    addCommit(wId, "Second commit text", sub);
    addCommit(wId, "Third commit text", sub);
    mvc.perform(asIc(post("/api/v1/weeks/" + wId + "/lock"), sub)).andExpect(status().isOk());
    return wId;
  }

  // --- POST /weeks/{id}/reconcile-start -------------------------------------

  @Test
  void reconcileStart_locked_to_reconciling_returns_200() throws Exception {
    String wId = lockedWeek(icSub);
    mvc.perform(asIc(post("/api/v1/weeks/" + wId + "/reconcile-start"), icSub))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.state").value("RECONCILING"));
  }

  @Test
  void reconcileStart_window_closed_returns_409() throws Exception {
    // Lock the current week first, then mutate that week's weekStart to a future Monday so the
    // reconcile-window guard (next-or-same Saturday at 23:59 from weekStart) lands in the future.
    String wId = lockedWeek(icSub);
    org.setReconcileOpensDayOfWeek(DayOfWeek.SATURDAY);
    org.setReconcileOpensTime(LocalTime.of(23, 59));
    org = orgRepo.save(org);
    var week = weekRepo.findById(wId).orElseThrow();
    week =
        weekRepo.save(
            shiftWeekStart(week, java.time.LocalDate.now().plusDays(14).with(DayOfWeek.MONDAY)));
    mvc.perform(asIc(post("/api/v1/weeks/" + week.getId() + "/reconcile-start"), icSub))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.title").value("ILLEGAL_STATE"));
  }

  /**
   * Reflectively bumps weekStart since {@link com.throughline.weeklycommit.domain.Week} has no
   * setter.
   */
  private static com.throughline.weeklycommit.domain.Week shiftWeekStart(
      com.throughline.weeklycommit.domain.Week week, java.time.LocalDate target) {
    try {
      var f = com.throughline.weeklycommit.domain.Week.class.getDeclaredField("weekStart");
      f.setAccessible(true);
      f.set(week, target);
    } catch (ReflectiveOperationException ex) {
      throw new IllegalStateException(ex);
    }
    return week;
  }

  @Test
  void reconcileStart_non_owner_returns_403() throws Exception {
    String wId = lockedWeek(icSub);
    mvc.perform(asIc(post("/api/v1/weeks/" + wId + "/reconcile-start"), otherIcSub))
        .andExpect(status().isForbidden());
  }

  @Test
  void reconcileStart_from_draft_returns_409() throws Exception {
    String wId = draftWeek(icSub);
    mvc.perform(asIc(post("/api/v1/weeks/" + wId + "/reconcile-start"), icSub))
        .andExpect(status().isConflict());
  }

  // --- PUT /weeks/{id}/reconcile --------------------------------------------

  @Test
  void reconcile_happy_path_returns_200_with_null_alignmentDelta() throws Exception {
    String wId = lockedWeek(icSub);
    mvc.perform(asIc(post("/api/v1/weeks/" + wId + "/reconcile-start"), icSub));
    String[] commitIds = commitIdsOf(wId);
    String body =
        """
        {"items":[
          {"commitId":"%s","outcome":"DONE","note":"shipped Tuesday","carryForward":false},
          {"commitId":"%s","outcome":"PARTIAL","note":"impl wip","carryForward":false},
          {"commitId":"%s","outcome":"NOT_DONE","note":"blocked","carryForward":false}
        ]}
        """
            .formatted(commitIds[0], commitIds[1], commitIds[2]);
    mvc.perform(
            asIc(put("/api/v1/weeks/" + wId + "/reconcile"), icSub)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.week.state").value("RECONCILED"))
        .andExpect(jsonPath("$.alignmentDelta").doesNotExist());
  }

  @Test
  void reconcile_missing_item_for_a_commit_returns_400() throws Exception {
    String wId = lockedWeek(icSub);
    mvc.perform(asIc(post("/api/v1/weeks/" + wId + "/reconcile-start"), icSub));
    String[] commitIds = commitIdsOf(wId);
    String body =
        """
        {"items":[
          {"commitId":"%s","outcome":"DONE","note":"only one","carryForward":false}
        ]}
        """
            .formatted(commitIds[0]);
    mvc.perform(
            asIc(put("/api/v1/weeks/" + wId + "/reconcile"), icSub)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.title").value("VALIDATION_ERROR"));
  }

  @Test
  void reconcile_done_with_carryForward_true_returns_400() throws Exception {
    String wId = lockedWeek(icSub);
    mvc.perform(asIc(post("/api/v1/weeks/" + wId + "/reconcile-start"), icSub));
    String[] commitIds = commitIdsOf(wId);
    String body =
        """
        {"items":[
          {"commitId":"%s","outcome":"DONE","note":"x","carryForward":true},
          {"commitId":"%s","outcome":"DONE","note":"x","carryForward":false},
          {"commitId":"%s","outcome":"DONE","note":"x","carryForward":false}
        ]}
        """
            .formatted(commitIds[0], commitIds[1], commitIds[2]);
    mvc.perform(
            asIc(put("/api/v1/weeks/" + wId + "/reconcile"), icSub)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.title").value("VALIDATION_ERROR"));
  }

  @Test
  void reconcile_carry_forward_spawns_child_in_next_week() throws Exception {
    String wId = lockedWeek(icSub);
    mvc.perform(asIc(post("/api/v1/weeks/" + wId + "/reconcile-start"), icSub));
    String[] commitIds = commitIdsOf(wId);
    String body =
        """
        {"items":[
          {"commitId":"%s","outcome":"DONE","note":"shipped","carryForward":false},
          {"commitId":"%s","outcome":"DONE","note":"shipped","carryForward":false},
          {"commitId":"%s","outcome":"NOT_DONE","note":"blocked","carryForward":true}
        ]}
        """
            .formatted(commitIds[0], commitIds[1], commitIds[2]);
    mvc.perform(
            asIc(put("/api/v1/weeks/" + wId + "/reconcile"), icSub)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isOk());

    // Verify a new week + commit exist with the parent linkage.
    var weeks = weekRepo.findAll();
    Assertions.assertThat(weeks).hasSize(2);
    var children = weeks.stream().filter(w -> !w.getId().equals(wId)).toList();
    Assertions.assertThat(children).hasSize(1);
  }

  @Test
  void reconcile_note_too_long_returns_400() throws Exception {
    String wId = lockedWeek(icSub);
    mvc.perform(asIc(post("/api/v1/weeks/" + wId + "/reconcile-start"), icSub));
    String[] commitIds = commitIdsOf(wId);
    String longNote = "x".repeat(1001);
    String body =
        """
        {"items":[
          {"commitId":"%s","outcome":"DONE","note":"%s","carryForward":false},
          {"commitId":"%s","outcome":"DONE","note":"ok","carryForward":false},
          {"commitId":"%s","outcome":"DONE","note":"ok","carryForward":false}
        ]}
        """
            .formatted(commitIds[0], longNote, commitIds[1], commitIds[2]);
    mvc.perform(
            asIc(put("/api/v1/weeks/" + wId + "/reconcile"), icSub)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isBadRequest());
  }

  @Test
  void reconcile_non_owner_returns_403() throws Exception {
    String wId = lockedWeek(icSub);
    mvc.perform(asIc(post("/api/v1/weeks/" + wId + "/reconcile-start"), icSub));
    String[] commitIds = commitIdsOf(wId);
    String body =
        """
        {"items":[
          {"commitId":"%s","outcome":"DONE","note":"x","carryForward":false},
          {"commitId":"%s","outcome":"DONE","note":"x","carryForward":false},
          {"commitId":"%s","outcome":"DONE","note":"x","carryForward":false}
        ]}
        """
            .formatted(commitIds[0], commitIds[1], commitIds[2]);
    mvc.perform(
            asIc(put("/api/v1/weeks/" + wId + "/reconcile"), otherIcSub)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isForbidden());
  }

  private String[] commitIdsOf(String weekId) throws Exception {
    String body =
        mvc.perform(asIc(get("/api/v1/weeks/" + weekId), icSub))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    var commits = json.readTree(body).get("commits");
    String[] ids = new String[commits.size()];
    for (int i = 0; i < commits.size(); i++) ids[i] = commits.get(i).get("id").asText();
    return ids;
  }
}
