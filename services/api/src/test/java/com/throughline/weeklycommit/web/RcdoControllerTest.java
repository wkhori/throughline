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
import com.throughline.weeklycommit.domain.RallyCry;
import com.throughline.weeklycommit.domain.Role;
import com.throughline.weeklycommit.domain.User;
import com.throughline.weeklycommit.domain.repo.DefiningObjectiveRepository;
import com.throughline.weeklycommit.domain.repo.OrgRepository;
import com.throughline.weeklycommit.domain.repo.OutcomeRepository;
import com.throughline.weeklycommit.domain.repo.RallyCryRepository;
import com.throughline.weeklycommit.domain.repo.SupportingOutcomeRepository;
import com.throughline.weeklycommit.domain.repo.UserRepository;
import com.throughline.weeklycommit.web.dto.RcdoDtos;
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

@AutoConfigureMockMvc
class RcdoControllerTest extends PostgresIntegrationTestBase {

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

  @BeforeEach
  void seed() {
    cleaner.clean();
    Org org = orgRepo.save(new Org("ACME"));
    orgId = org.getId();
    userRepo.save(new User(orgId, "auth0|mock-admin", "a@x.com", "A", Role.ADMIN));
    userRepo.save(new User(orgId, "auth0|mock-ic", "i@x.com", "I", Role.IC));
  }

  private MockHttpServletRequestBuilder withAdmin(MockHttpServletRequestBuilder b) {
    return b.with(
        SecurityMockMvcRequestPostProcessors.jwt()
            .jwt(j -> j.subject("auth0|mock-admin").claim("permissions", List.of("ADMIN")))
            .authorities(new SimpleGrantedAuthority("ROLE_ADMIN")));
  }

  private MockHttpServletRequestBuilder withIc(MockHttpServletRequestBuilder b) {
    return b.with(
        SecurityMockMvcRequestPostProcessors.jwt()
            .jwt(j -> j.subject("auth0|mock-ic").claim("permissions", List.of("IC")))
            .authorities(new SimpleGrantedAuthority("ROLE_IC")));
  }

  @Test
  void rcdo_tree_get_empty_returns_200_with_empty_rallyCries() throws Exception {
    mvc.perform(withIc(get("/api/v1/rcdo/tree")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.rallyCries").isArray())
        .andExpect(jsonPath("$.rallyCries.length()").value(0));
  }

  @Test
  void create_rally_cry_admin_returns_201() throws Exception {
    var body = new RcdoDtos.CreateRallyCryRequest("Win the SMB segment", null, 0);
    mvc.perform(
            withAdmin(post("/api/v1/admin/rally-cries"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.title").value("Win the SMB segment"))
        .andExpect(jsonPath("$.id").exists());
  }

  @Test
  void create_rally_cry_ic_returns_403() throws Exception {
    var body = new RcdoDtos.CreateRallyCryRequest("Win the SMB segment", null, 0);
    mvc.perform(
            withIc(post("/api/v1/admin/rally-cries"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
        .andExpect(status().isForbidden());
  }

  @Test
  void create_rally_cry_validation_short_title_returns_400() throws Exception {
    var body = new RcdoDtos.CreateRallyCryRequest("a", null, 0);
    mvc.perform(
            withAdmin(post("/api/v1/admin/rally-cries"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.title").value("VALIDATION_ERROR"));
  }

  @Test
  void create_rally_cry_duplicate_title_returns_409() throws Exception {
    var body = new RcdoDtos.CreateRallyCryRequest("Same Title Cry", null, 0);
    mvc.perform(
            withAdmin(post("/api/v1/admin/rally-cries"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
        .andExpect(status().isCreated());
    mvc.perform(
            withAdmin(post("/api/v1/admin/rally-cries"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
        .andExpect(status().isConflict());
  }

  @Test
  void update_rally_cry_admin_returns_200() throws Exception {
    RallyCry rc = rcRepo.save(new RallyCry(orgId, "Win the SMB segment"));
    var body = new RcdoDtos.UpdateRallyCryRequest("Win the mid-market", null, 0);
    mvc.perform(
            withAdmin(put("/api/v1/admin/rally-cries/" + rc.getId()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.title").value("Win the mid-market"));
  }

  @Test
  void delete_rally_cry_with_active_DOs_returns_409() throws Exception {
    RallyCry rc = rcRepo.save(new RallyCry(orgId, "RC with DO"));
    doRepo.save(new DefiningObjective(rc.getId(), "Inner DO"));
    mvc.perform(withAdmin(delete("/api/v1/admin/rally-cries/" + rc.getId())))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.title").value("ILLEGAL_STATE"));
  }

  @Test
  void delete_rally_cry_with_no_active_children_archives_returns_204() throws Exception {
    RallyCry rc = rcRepo.save(new RallyCry(orgId, "Lonely RC"));
    mvc.perform(withAdmin(delete("/api/v1/admin/rally-cries/" + rc.getId())))
        .andExpect(status().isNoContent());
  }

  @Test
  void create_DO_under_archived_RC_returns_409() throws Exception {
    RallyCry rc = new RallyCry(orgId, "Archived RC");
    rc.archive();
    rcRepo.save(rc);
    var body = new RcdoDtos.CreateDefiningObjectiveRequest(rc.getId(), "Some DO", null, 0);
    mvc.perform(
            withAdmin(post("/api/v1/admin/defining-objectives"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
        .andExpect(status().isConflict());
  }

  @Test
  void create_DO_admin_returns_201() throws Exception {
    RallyCry rc = rcRepo.save(new RallyCry(orgId, "Live RC"));
    var body = new RcdoDtos.CreateDefiningObjectiveRequest(rc.getId(), "Reduce churn", null, 0);
    mvc.perform(
            withAdmin(post("/api/v1/admin/defining-objectives"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body)))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.title").value("Reduce churn"));
  }

  @Test
  void create_outcome_admin_returns_201_then_so_201() throws Exception {
    RallyCry rc = rcRepo.save(new RallyCry(orgId, "Live RC 2"));
    DefiningObjective defo = doRepo.save(new DefiningObjective(rc.getId(), "Reduce churn 2"));
    var oReq = new RcdoDtos.CreateOutcomeRequest(defo.getId(), "Improve onboarding", null, null, 0);
    String oJson =
        mvc.perform(
                withAdmin(post("/api/v1/admin/outcomes"))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(json.writeValueAsString(oReq)))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    String oId = json.readTree(oJson).get("id").asText();
    var soReq = new RcdoDtos.CreateSupportingOutcomeRequest(oId, "Ship sequence v2", null, 0);
    mvc.perform(
            withAdmin(post("/api/v1/admin/supporting-outcomes"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(soReq)))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.title").value("Ship sequence v2"));
  }

  @Test
  void rcdo_tree_returns_full_subtree() throws Exception {
    RallyCry rc = rcRepo.save(new RallyCry(orgId, "Tree RC"));
    DefiningObjective defo = doRepo.save(new DefiningObjective(rc.getId(), "Tree DO"));
    var o = new com.throughline.weeklycommit.domain.Outcome(defo.getId(), "Tree O");
    outcomeRepo.save(o);
    soRepo.save(new com.throughline.weeklycommit.domain.SupportingOutcome(o.getId(), "Tree SO"));

    mvc.perform(withIc(get("/api/v1/rcdo/tree")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.rallyCries[0].title").value("Tree RC"))
        .andExpect(jsonPath("$.rallyCries[0].definingObjectives[0].title").value("Tree DO"))
        .andExpect(
            jsonPath("$.rallyCries[0].definingObjectives[0].outcomes[0].title").value("Tree O"))
        .andExpect(
            jsonPath(
                    "$.rallyCries[0].definingObjectives[0].outcomes[0].supportingOutcomes[0].title")
                .value("Tree SO"));
  }
}
