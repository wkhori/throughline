package com.throughline.weeklycommit.perf;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.throughline.weeklycommit.PostgresIntegrationTestBase;
import com.throughline.weeklycommit.TestDatabaseCleaner;
import com.throughline.weeklycommit.domain.Org;
import com.throughline.weeklycommit.domain.Role;
import com.throughline.weeklycommit.domain.User;
import com.throughline.weeklycommit.domain.repo.OrgRepository;
import com.throughline.weeklycommit.domain.repo.UserRepository;
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
 * P2 / P32 — perf harness. Asserts p95 latency stays under the §13/§14 perf gates.
 *
 * <p>Runs only via the dedicated Gradle {@code perfTest} task ({@code @Tag("perf")}); excluded from
 * the default {@code test} task so CI's coverage gate doesn't get skewed by a 100-iteration loop.
 *
 * <p>Phase-2 surface: the §13 gate is "{@code GET /api/v1/weeks/current} <200ms p95". Seed data
 * exercises the real query path (Org → currentWeekStart → findByUserIdAndWeekStart →
 * commits-for-week). Phase 4 adds a manager-rollup variant against a 2000-row seed (P25).
 */
@Tag("perf")
@AutoConfigureMockMvc
class EndpointPerformanceTest extends PostgresIntegrationTestBase {

  private static final int WARMUP = 20;
  private static final int ITERATIONS = 100;
  private static final long P95_BUDGET_MS = 200L;

  @Autowired MockMvc mvc;
  @Autowired OrgRepository orgRepo;
  @Autowired UserRepository userRepo;
  @Autowired TestDatabaseCleaner cleaner;

  private String icSub;

  @BeforeEach
  void seed() {
    cleaner.clean();
    Org org = orgRepo.save(new Org("PerfOrg"));
    icSub = "auth0|perf-ic";
    userRepo.save(new User(org.getId(), icSub, "perf@x.com", "Perf IC", Role.IC));
  }

  @Test
  void weeks_current_p95_under_budget() throws Exception {
    var req =
        get("/api/v1/weeks/current")
            .with(
                SecurityMockMvcRequestPostProcessors.jwt()
                    .jwt(j -> j.subject(icSub).claim("permissions", List.of("IC")))
                    .authorities(new SimpleGrantedAuthority("ROLE_IC")));
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
            "p95 latency for /api/v1/weeks/current must stay under %dms (was %dms)",
            P95_BUDGET_MS, p95)
        .isLessThan(P95_BUDGET_MS);
  }
}
