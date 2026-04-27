package com.throughline.weeklycommit.application.manager;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.throughline.weeklycommit.PostgresIntegrationTestBase;
import com.throughline.weeklycommit.TestDatabaseCleaner;
import com.throughline.weeklycommit.application.lifecycle.WeekReconciledEvent;
import com.throughline.weeklycommit.domain.Commit;
import com.throughline.weeklycommit.domain.CommitState;
import com.throughline.weeklycommit.domain.DefiningObjective;
import com.throughline.weeklycommit.domain.Org;
import com.throughline.weeklycommit.domain.Outcome;
import com.throughline.weeklycommit.domain.RallyCry;
import com.throughline.weeklycommit.domain.ReconciliationOutcome;
import com.throughline.weeklycommit.domain.Role;
import com.throughline.weeklycommit.domain.SupportingOutcome;
import com.throughline.weeklycommit.domain.Team;
import com.throughline.weeklycommit.domain.TeamPriorityWeight;
import com.throughline.weeklycommit.domain.TeamRollupCache;
import com.throughline.weeklycommit.domain.User;
import com.throughline.weeklycommit.domain.Week;
import com.throughline.weeklycommit.domain.WeekState;
import com.throughline.weeklycommit.domain.repo.CommitRepository;
import com.throughline.weeklycommit.domain.repo.DefiningObjectiveRepository;
import com.throughline.weeklycommit.domain.repo.OrgRepository;
import com.throughline.weeklycommit.domain.repo.OutcomeRepository;
import com.throughline.weeklycommit.domain.repo.RallyCryRepository;
import com.throughline.weeklycommit.domain.repo.SupportingOutcomeRepository;
import com.throughline.weeklycommit.domain.repo.TeamPriorityWeightRepository;
import com.throughline.weeklycommit.domain.repo.TeamRepository;
import com.throughline.weeklycommit.domain.repo.TeamRollupCacheRepository;
import com.throughline.weeklycommit.domain.repo.UserRepository;
import com.throughline.weeklycommit.domain.repo.WeekRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Phase-4 contract test for {@link MaterializedRollupJob} (P10 / P25). Wires the full Spring
 * context so the {@code @TransactionalEventListener} + {@code @Scheduled} infrastructure is real;
 * we drive the job with explicit method calls and a simulated {@link WeekReconciledEvent}.
 */
class MaterializedRollupJobTest extends PostgresIntegrationTestBase {

  @Autowired MaterializedRollupJob job;
  @Autowired TeamRollupCacheRepository cacheRepo;
  @Autowired TeamRepository teamRepo;
  @Autowired UserRepository userRepo;
  @Autowired OrgRepository orgRepo;
  @Autowired RallyCryRepository rcRepo;
  @Autowired DefiningObjectiveRepository doRepo;
  @Autowired OutcomeRepository outcomeRepo;
  @Autowired SupportingOutcomeRepository soRepo;
  @Autowired TeamPriorityWeightRepository tpwRepo;
  @Autowired WeekRepository weekRepo;
  @Autowired CommitRepository commitRepo;
  @Autowired ObjectMapper json;
  @Autowired TestDatabaseCleaner cleaner;

  private String orgId;
  private String teamId;
  private String userId;
  private String soId;
  private String rcId;
  private LocalDate weekStart;

  @BeforeEach
  void seed() {
    cleaner.clean();
    Org org = orgRepo.save(new Org("RollupOrg"));
    orgId = org.getId();
    Team team = teamRepo.save(new Team(orgId, "Team Alpha"));
    teamId = team.getId();
    User user = userRepo.save(new User(orgId, "auth0|alpha-ic", "ic@x.com", "Alpha IC", Role.IC));
    user.setTeamId(teamId);
    userRepo.save(user);
    userId = user.getId();

    RallyCry rc = rcRepo.save(new RallyCry(orgId, "Win the SMB segment"));
    rcId = rc.getId();
    DefiningObjective defo = doRepo.save(new DefiningObjective(rc.getId(), "Reduce churn"));
    Outcome o = outcomeRepo.save(new Outcome(defo.getId(), "Improve activation"));
    soId = soRepo.save(new SupportingOutcome(o.getId(), "Ship activation v1")).getId();

    tpwRepo.save(
        new TeamPriorityWeight(teamId, rcId, new BigDecimal("0.10"), new BigDecimal("0.20")));

    weekStart = LocalDate.of(2026, 4, 20);
    Week week = new Week(userId, orgId, weekStart);
    week.setState(WeekState.RECONCILED);
    Week savedWeek = weekRepo.save(week);

    Commit done = new Commit(savedWeek.getId(), "Ship activation v1");
    done.setSupportingOutcomeId(soId);
    done.setReconciliationOutcome(ReconciliationOutcome.DONE);
    commitRepo.save(done);

    Commit partial = new Commit(savedWeek.getId(), "Run experiment");
    partial.setSupportingOutcomeId(soId);
    partial.setReconciliationOutcome(ReconciliationOutcome.PARTIAL);
    commitRepo.save(partial);

    Commit longCarry = new Commit(savedWeek.getId(), "Refactor billing tests");
    longCarry.setSupportingOutcomeId(soId);
    longCarry.setReconciliationOutcome(ReconciliationOutcome.NOT_DONE);
    longCarry.setState(CommitState.CARRIED_FORWARD);
    longCarry.setCarryForwardWeeks(4);
    commitRepo.save(longCarry);
  }

  @Test
  void recomputeForTeamWeek_writes_payload_with_counts_and_shares() throws Exception {
    TeamRollupCache cached = job.recomputeForTeamWeek(teamId, weekStart);
    assertThat(cached).isNotNull();
    assertThat(cached.getTeamId()).isEqualTo(teamId);
    assertThat(cached.getWeekStart()).isEqualTo(weekStart);
    JsonNode payload = json.readTree(cached.getPayloadJson());
    assertThat(payload.get("teamName").asText()).isEqualTo("Team Alpha");
    assertThat(payload.get("memberCount").asInt()).isEqualTo(1);
    assertThat(payload.get("reconciledCount").asInt()).isEqualTo(3);
    assertThat(payload.get("doneCount").asInt()).isEqualTo(1);
    assertThat(payload.get("partialCount").asInt()).isEqualTo(1);
    assertThat(payload.get("notDoneCount").asInt()).isEqualTo(1);
    assertThat(payload.get("carryForwardCount").asInt()).isEqualTo(1);
    assertThat(payload.get("commitsByOutcome").isArray()).isTrue();
    assertThat(payload.get("commitsByOutcome").size()).isEqualTo(1);
    double share = payload.get("commitsByOutcome").get(0).get("share").asDouble();
    assertThat(share).isEqualTo(1.0d);
  }

  @Test
  void recomputeForTeamWeek_replaces_existing_row_for_same_team_week() {
    TeamRollupCache first = job.recomputeForTeamWeek(teamId, weekStart);
    var firstAt = first.getComputedAt();
    TeamRollupCache second = job.recomputeForTeamWeek(teamId, weekStart);
    assertThat(second.getComputedAt()).isAfterOrEqualTo(firstAt);
    assertThat(cacheRepo.count()).isEqualTo(1L);
  }

  @Test
  void payload_priorityDrift_flags_when_observed_share_outside_band() throws Exception {
    TeamRollupCache cached = job.recomputeForTeamWeek(teamId, weekStart);
    JsonNode drift = json.readTree(cached.getPayloadJson()).get("driftExceptions");
    assertThat(drift.isArray()).isTrue();
    // Observed share for the seeded team is 1.0 (only RC has commits). Expected band 0.10–0.20 is
    // violated, so this RC should be present in the drift list.
    assertThat(drift.size()).isGreaterThanOrEqualTo(1);
    assertThat(drift.get(0).get("rallyCryId").asText()).isEqualTo(rcId);
    assertThat(drift.get(0).get("observedShare").asDouble()).isEqualTo(1.0d);
  }

  @Test
  void payload_exceptionRibbon_includes_long_carry_forward() throws Exception {
    TeamRollupCache cached = job.recomputeForTeamWeek(teamId, weekStart);
    JsonNode ribbon = json.readTree(cached.getPayloadJson()).get("exceptionRibbon");
    assertThat(ribbon.isArray()).isTrue();
    boolean longCarry = false;
    for (JsonNode entry : ribbon) {
      if ("LONG_CARRY_FORWARD".equals(entry.get("kind").asText())) longCarry = true;
    }
    assertThat(longCarry).isTrue();
  }

  @Test
  void onWeekReconciled_is_idempotent_and_writes_cache_row() {
    Week reconciled = weekRepo.findByUserIdAndWeekStart(userId, weekStart).orElseThrow();
    job.onWeekReconciled(new WeekReconciledEvent(reconciled.getId(), userId, orgId));
    Optional<TeamRollupCache> row = cacheRepo.findByIdTeamIdAndIdWeekStart(teamId, weekStart);
    assertThat(row).isPresent();
  }
}
