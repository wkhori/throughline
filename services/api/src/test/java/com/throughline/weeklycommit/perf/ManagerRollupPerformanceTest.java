package com.throughline.weeklycommit.perf;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.throughline.weeklycommit.PostgresIntegrationTestBase;
import com.throughline.weeklycommit.TestDatabaseCleaner;
import com.throughline.weeklycommit.application.manager.MaterializedRollupJob;
import com.throughline.weeklycommit.domain.Commit;
import com.throughline.weeklycommit.domain.DefiningObjective;
import com.throughline.weeklycommit.domain.Org;
import com.throughline.weeklycommit.domain.Outcome;
import com.throughline.weeklycommit.domain.RallyCry;
import com.throughline.weeklycommit.domain.ReconciliationOutcome;
import com.throughline.weeklycommit.domain.Role;
import com.throughline.weeklycommit.domain.SupportingOutcome;
import com.throughline.weeklycommit.domain.Team;
import com.throughline.weeklycommit.domain.User;
import com.throughline.weeklycommit.domain.Week;
import com.throughline.weeklycommit.domain.WeekState;
import com.throughline.weeklycommit.domain.repo.CommitRepository;
import com.throughline.weeklycommit.domain.repo.DefiningObjectiveRepository;
import com.throughline.weeklycommit.domain.repo.OrgRepository;
import com.throughline.weeklycommit.domain.repo.OutcomeRepository;
import com.throughline.weeklycommit.domain.repo.RallyCryRepository;
import com.throughline.weeklycommit.domain.repo.SupportingOutcomeRepository;
import com.throughline.weeklycommit.domain.repo.TeamRepository;
import com.throughline.weeklycommit.domain.repo.UserRepository;
import com.throughline.weeklycommit.domain.repo.WeekRepository;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.web.servlet.MockMvc;

/**
 * P25 — manager team-rollup p95 latency under 200 ms with 2000 reconciled commits across 50 teams
 * for the current week. Seeds the rollup cache once, then issues 100 sequential reads through the
 * full Spring MVC + JSON pipeline so the perf assertion exercises the same code path as production.
 *
 * <p>Runs only via {@code ./gradlew perfTest} ({@code @Tag("perf")}); excluded from the default
 * test task so the 100-iteration loop doesn't skew CI's coverage gate.
 */
@Tag("perf")
@AutoConfigureMockMvc
class ManagerRollupPerformanceTest extends PostgresIntegrationTestBase {

  private static final int TEAMS = 50;
  private static final int COMMITS_PER_TEAM = 40; // 50 × 40 = 2000 rows
  private static final int WARMUP = 20;
  private static final int ITERATIONS = 100;
  private static final long P95_BUDGET_MS = 200L;

  @Autowired MockMvc mvc;
  @Autowired OrgRepository orgRepo;
  @Autowired TeamRepository teamRepo;
  @Autowired UserRepository userRepo;
  @Autowired RallyCryRepository rcRepo;
  @Autowired DefiningObjectiveRepository doRepo;
  @Autowired OutcomeRepository outcomeRepo;
  @Autowired SupportingOutcomeRepository soRepo;
  @Autowired WeekRepository weekRepo;
  @Autowired CommitRepository commitRepo;
  @Autowired MaterializedRollupJob job;
  @Autowired TestDatabaseCleaner cleaner;

  private String adminSub;

  @BeforeEach
  void seed() {
    cleaner.clean();
    Org org = orgRepo.save(new Org("PerfRollupOrg"));
    String orgId = org.getId();
    adminSub = "auth0|perf-admin";
    userRepo.save(new User(orgId, adminSub, "perf@x.com", "Perf Admin", Role.ADMIN));

    RallyCry rc = rcRepo.save(new RallyCry(orgId, "Perf RC"));
    DefiningObjective defo = doRepo.save(new DefiningObjective(rc.getId(), "Perf DO"));
    Outcome outcome = outcomeRepo.save(new Outcome(defo.getId(), "Perf Outcome"));
    SupportingOutcome so = soRepo.save(new SupportingOutcome(outcome.getId(), "Perf SO"));

    LocalDate weekStart = LocalDate.of(2026, 4, 20);
    List<Team> teams = new ArrayList<>();
    for (int i = 0; i < TEAMS; i++) {
      Team team = teamRepo.save(new Team(orgId, "Perf Team " + i));
      teams.add(team);
      User u =
          userRepo.save(
              new User(orgId, "auth0|perf-ic-" + i, "ic" + i + "@x.com", "Perf IC " + i, Role.IC));
      u.setTeamId(team.getId());
      userRepo.save(u);
      Week week = new Week(u.getId(), orgId, weekStart);
      week.setState(WeekState.RECONCILED);
      Week savedWeek = weekRepo.save(week);
      for (int c = 0; c < COMMITS_PER_TEAM; c++) {
        Commit commit = new Commit(savedWeek.getId(), "perf-commit-" + i + "-" + c);
        commit.setSupportingOutcomeId(so.getId());
        commit.setReconciliationOutcome(
            c % 3 == 0 ? ReconciliationOutcome.DONE : ReconciliationOutcome.PARTIAL);
        commit.setDisplayOrder(c);
        commitRepo.save(commit);
      }
      // Pre-warm the rollup cache so the assertion measures the cache-read path, not the
      // recompute. The MaterializedRollupJob handles the inline recompute fallback path
      // separately.
      job.recomputeForTeamWeek(team.getId(), weekStart);
    }
  }

  @Test
  void manager_team_rollup_first_page_p95_under_budget() throws Exception {
    var req =
        get("/api/v1/manager/team-rollup?page=0&size=50")
            .with(
                SecurityMockMvcRequestPostProcessors.jwt()
                    .jwt(j -> j.subject(adminSub).claim("permissions", List.of("ADMIN")))
                    .authorities(new SimpleGrantedAuthority("ROLE_ADMIN")));
    for (int i = 0; i < WARMUP; i++) {
      mvc.perform(req).andReturn();
    }
    long[] samples = new long[ITERATIONS];
    for (int i = 0; i < ITERATIONS; i++) {
      long start = System.nanoTime();
      mvc.perform(req).andReturn();
      samples[i] = (System.nanoTime() - start) / 1_000_000L;
    }
    Arrays.sort(samples);
    long p95 = samples[(int) Math.ceil(ITERATIONS * 0.95) - 1];
    assertThat(p95)
        .as(
            "p95 latency for /api/v1/manager/team-rollup must stay under %dms (was %dms)",
            P95_BUDGET_MS, p95)
        .isLessThan(P95_BUDGET_MS);
  }
}
