package com.throughline.weeklycommit.web.manager;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.throughline.weeklycommit.PostgresIntegrationTestBase;
import com.throughline.weeklycommit.TestDatabaseCleaner;
import com.throughline.weeklycommit.application.manager.MaterializedRollupJob;
import com.throughline.weeklycommit.domain.Org;
import com.throughline.weeklycommit.domain.Role;
import com.throughline.weeklycommit.domain.Team;
import com.throughline.weeklycommit.domain.User;
import com.throughline.weeklycommit.domain.repo.OrgRepository;
import com.throughline.weeklycommit.domain.repo.TeamRepository;
import com.throughline.weeklycommit.domain.repo.TeamRollupCacheRepository;
import com.throughline.weeklycommit.domain.repo.UserRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * Phase-4 contract test for {@code ManagerController}. Covers the full PRD §4.1 manager surface:
 * paginated team-rollup with scope, drill-down (P9), digest envelope (T5 wires in Phase 5c so
 * Phase-4 returns digest=null), alignment-risks (Phase 5c populates so Phase-4 returns []).
 */
@AutoConfigureMockMvc
class ManagerControllerContractTest extends PostgresIntegrationTestBase {

  @Autowired MockMvc mvc;
  @Autowired OrgRepository orgRepo;
  @Autowired TeamRepository teamRepo;
  @Autowired UserRepository userRepo;
  @Autowired TeamRollupCacheRepository cacheRepo;
  @Autowired MaterializedRollupJob job;
  @Autowired TestDatabaseCleaner cleaner;
  @Autowired Clock clock;

  String managerSub;
  String otherManagerSub;
  String adminSub;
  String icSub;
  String otherIcSub;
  String managerId;
  String otherIcId;

  @BeforeEach
  void seed() {
    cleaner.clean();
    Org org = orgRepo.save(new Org("ManagerOrg"));
    String orgId = org.getId();
    Team teamAlpha = teamRepo.save(new Team(orgId, "Alpha"));
    Team teamBeta = teamRepo.save(new Team(orgId, "Beta"));

    managerSub = "auth0|mgr-alpha";
    otherManagerSub = "auth0|mgr-beta";
    adminSub = "auth0|adm";
    icSub = "auth0|ic-alpha";
    otherIcSub = "auth0|ic-beta";

    User manager = userRepo.save(new User(orgId, managerSub, "ma@x", "Mgr Alpha", Role.MANAGER));
    manager.setTeamId(teamAlpha.getId());
    userRepo.save(manager);
    managerId = manager.getId();

    User otherManager =
        userRepo.save(new User(orgId, otherManagerSub, "mb@x", "Mgr Beta", Role.MANAGER));
    otherManager.setTeamId(teamBeta.getId());
    userRepo.save(otherManager);

    userRepo.save(new User(orgId, adminSub, "ad@x", "Admin", Role.ADMIN));

    User ic = userRepo.save(new User(orgId, icSub, "ic@x", "IC Alpha", Role.IC));
    ic.setTeamId(teamAlpha.getId());
    ic.setManagerId(manager.getId());
    userRepo.save(ic);

    User otherIc = userRepo.save(new User(orgId, otherIcSub, "ico@x", "IC Beta", Role.IC));
    otherIc.setTeamId(teamBeta.getId());
    otherIc.setManagerId(otherManager.getId());
    userRepo.save(otherIc);
    otherIcId = otherIc.getId();

    teamAlpha.setManagerId(manager.getId());
    teamRepo.save(teamAlpha);
    teamBeta.setManagerId(otherManager.getId());
    teamRepo.save(teamBeta);
  }

  private MockHttpServletRequestBuilder asUser(
      MockHttpServletRequestBuilder b, String sub, String role) {
    return b.with(
        SecurityMockMvcRequestPostProcessors.jwt()
            .jwt(j -> j.subject(sub).claim("permissions", List.of(role)))
            .authorities(new SimpleGrantedAuthority("ROLE_" + role)));
  }

  private LocalDate currentWeekStart() {
    ZoneId tz = ZoneId.of("America/New_York");
    return ZonedDateTime.now(clock.withZone(tz))
        .toLocalDate()
        .with(TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY));
  }

  // --- GET /manager/team-rollup --------------------------------------------------------------

  @Test
  void teamRollup_manager_first_page_returns_200_with_payload() throws Exception {
    mvc.perform(asUser(get("/api/v1/manager/team-rollup?page=0&size=50"), managerSub, "MANAGER"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content").isArray())
        .andExpect(jsonPath("$.totalElements").exists())
        .andExpect(jsonPath("$.totalPages").exists())
        .andExpect(jsonPath("$.size").value(50));
  }

  @Test
  void teamRollup_pageable_respects_page_size_sort_params() throws Exception {
    mvc.perform(
            asUser(
                get("/api/v1/manager/team-rollup?page=0&size=10&sort=teamId,asc"),
                managerSub,
                "MANAGER"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.size").value(10));
  }

  @Test
  void teamRollup_unauthenticated_returns_401() throws Exception {
    mvc.perform(get("/api/v1/manager/team-rollup")).andExpect(status().isUnauthorized());
  }

  @Test
  void teamRollup_ic_role_returns_403() throws Exception {
    mvc.perform(asUser(get("/api/v1/manager/team-rollup"), icSub, "IC"))
        .andExpect(status().isForbidden());
  }

  @Test
  void teamRollup_admin_returns_all_teams_in_org() throws Exception {
    mvc.perform(asUser(get("/api/v1/manager/team-rollup?page=0&size=50"), adminSub, "ADMIN"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(2));
  }

  @Test
  void teamRollup_manager_only_sees_in_scope_teams() throws Exception {
    mvc.perform(asUser(get("/api/v1/manager/team-rollup?page=0&size=50"), managerSub, "MANAGER"))
        .andExpect(status().isOk())
        // Mgr Alpha owns Alpha (their own team) — no transitive sub-team in this fixture.
        .andExpect(jsonPath("$.totalElements").value(1));
  }

  @Test
  void teamRollup_stale_cache_older_than_7_days_returns_503_recomputing() throws Exception {
    LocalDate weekStart = currentWeekStart();
    // Prime an entry then stomp computed_at into the past so it counts as stale.
    var saved = job.recomputeForTeamWeek(teamRepo.findAll().get(0).getId(), weekStart);
    saved.setComputedAt(java.time.Instant.now(clock).minusSeconds(60L * 60 * 24 * 8));
    cacheRepo.save(saved);
    mvc.perform(asUser(get("/api/v1/manager/team-rollup"), managerSub, "MANAGER"))
        .andExpect(status().isServiceUnavailable())
        .andExpect(jsonPath("$.title").value("ROLLUP_RECOMPUTING"));
  }

  // --- GET /manager/team/{userId}/week/current ------------------------------------------------

  @Test
  void teamMemberWeek_manager_in_scope_returns_200() throws Exception {
    String icAlphaId = userRepo.findByAuth0Sub(icSub).orElseThrow().getId();
    mvc.perform(
            asUser(
                get("/api/v1/manager/team/" + icAlphaId + "/week/current"), managerSub, "MANAGER"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.userId").value(icAlphaId));
  }

  @Test
  void teamMemberWeek_manager_out_of_scope_returns_403() throws Exception {
    mvc.perform(
            asUser(
                get("/api/v1/manager/team/" + otherIcId + "/week/current"), managerSub, "MANAGER"))
        .andExpect(status().isForbidden());
  }

  @Test
  void teamMemberWeek_admin_bypasses_scope_returns_200() throws Exception {
    mvc.perform(
            asUser(get("/api/v1/manager/team/" + otherIcId + "/week/current"), adminSub, "ADMIN"))
        .andExpect(status().isOk());
  }

  @Test
  void teamMemberWeek_unknown_user_returns_404() throws Exception {
    mvc.perform(
            asUser(
                get("/api/v1/manager/team/01HZZZZZZZZZZZZZZZZZZZZZZZ/week/current"),
                adminSub,
                "ADMIN"))
        .andExpect(status().isNotFound());
  }

  @Test
  void teamMemberWeek_does_not_create_a_week_row_for_target_user() throws Exception {
    String icAlphaId = userRepo.findByAuth0Sub(icSub).orElseThrow().getId();
    long weeksBefore = countWeeks();
    mvc.perform(
            asUser(
                get("/api/v1/manager/team/" + icAlphaId + "/week/current"), managerSub, "MANAGER"))
        .andExpect(status().isOk());
    long weeksAfter = countWeeks();
    org.assertj.core.api.Assertions.assertThat(weeksAfter).isEqualTo(weeksBefore);
  }

  private long countWeeks() {
    return userRepo.count() == 0 ? 0 : weekCount();
  }

  @Autowired com.throughline.weeklycommit.domain.repo.WeekRepository weekRepo;

  private long weekCount() {
    return weekRepo.count();
  }

  // --- GET /manager/digest/current -----------------------------------------------------------

  @Test
  void digestCurrent_returns_200_with_digest_null_in_phase_4() throws Exception {
    mvc.perform(asUser(get("/api/v1/manager/digest/current"), managerSub, "MANAGER"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.digest").doesNotExist())
        .andExpect(jsonPath("$.state").value("AWAITING_AI"));
  }

  @Test
  void digestCurrent_unauthenticated_returns_401() throws Exception {
    mvc.perform(get("/api/v1/manager/digest/current")).andExpect(status().isUnauthorized());
  }

  @Test
  void digestCurrent_ic_role_returns_403() throws Exception {
    mvc.perform(asUser(get("/api/v1/manager/digest/current"), icSub, "IC"))
        .andExpect(status().isForbidden());
  }

  // --- POST /manager/digest/regenerate -------------------------------------------------------

  @Test
  void digestRegenerate_manager_returns_202_with_digest_null_in_phase_4() throws Exception {
    mvc.perform(asUser(post("/api/v1/manager/digest/regenerate"), managerSub, "MANAGER"))
        .andExpect(status().isAccepted())
        .andExpect(jsonPath("$.digest").doesNotExist())
        .andExpect(jsonPath("$.state").value("QUEUED"))
        .andExpect(jsonPath("$.message").exists());
  }

  // --- GET /manager/alignment-risks ----------------------------------------------------------

  @Test
  void alignmentRisks_manager_returns_empty_list_in_phase_4() throws Exception {
    mvc.perform(asUser(get("/api/v1/manager/alignment-risks"), managerSub, "MANAGER"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$").isArray())
        .andExpect(jsonPath("$.length()").value(0));
  }

  @Test
  void alignmentRisks_unauthenticated_returns_401() throws Exception {
    mvc.perform(get("/api/v1/manager/alignment-risks")).andExpect(status().isUnauthorized());
  }
}
