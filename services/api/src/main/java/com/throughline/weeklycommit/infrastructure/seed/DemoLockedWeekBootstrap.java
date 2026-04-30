package com.throughline.weeklycommit.infrastructure.seed;

import com.throughline.weeklycommit.domain.Commit;
import com.throughline.weeklycommit.domain.CommitCategory;
import com.throughline.weeklycommit.domain.CommitPriority;
import com.throughline.weeklycommit.domain.Org;
import com.throughline.weeklycommit.domain.Role;
import com.throughline.weeklycommit.domain.SupportingOutcome;
import com.throughline.weeklycommit.domain.User;
import com.throughline.weeklycommit.domain.Week;
import com.throughline.weeklycommit.domain.WeekState;
import com.throughline.weeklycommit.domain.repo.CommitRepository;
import com.throughline.weeklycommit.domain.repo.OrgRepository;
import com.throughline.weeklycommit.domain.repo.SupportingOutcomeRepository;
import com.throughline.weeklycommit.domain.repo.UserRepository;
import com.throughline.weeklycommit.domain.repo.WeekRepository;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Seeds a LOCKED week at week N-1 (one cycle older than the current DRAFT week) for the {@code
 * @demo.throughline.app} IC persona. The week carries eight commits split 5/3 across two
 * Supporting Outcomes — an intentionally unbalanced distribution so T3 portfolio review fires with
 * visible signal when the manager dashboard is loaded.
 *
 * <p>SO split: five commits on the "Deliver workflow builder GA" cluster (dominant concentration)
 * and three commits on the "Reduce flake rate below 1%" reliability cluster. The remaining SOs
 * under the org's RCDO graph receive zero commits in this week, which T3 reports as
 * under-investment.
 *
 * <p>Idempotent: skips if the demo IC already has a week row for week N-1 (regardless of its
 * state), so repeated startups are safe.
 *
 * <p>Order=30 places this runner after {@link DemoHistorySeeder} (Order=20) and before {@link
 * DemoDraftWeekBootstrap} (Order=40), so the locked week is written before the draft-rewind pass.
 */
@Component
@Profile("dev")
@Order(30)
public class DemoLockedWeekBootstrap implements CommandLineRunner {

  private static final Logger log = LoggerFactory.getLogger(DemoLockedWeekBootstrap.class);

  // Eight commits: 5 concentrated on one SO ("Deliver workflow builder GA") + 3 on another
  // ("Reduce flake rate below 1%"). Each tuple: (text, SO title contains, category, priority,
  // displayOrder).
  private record Seed(
      String text,
      String soTitleContains,
      CommitCategory category,
      CommitPriority priority,
      int displayOrder) {}

  // Five commits on the workflow-builder GA outcome (dominant SO) — T3 will show ~62% concentration
  // on this single SO (5 MUST/SHOULD commits vs 3 SHOULD on the other SO).
  private static final List<Seed> SEEDS =
      List.of(
          new Seed(
              "Land the workflow builder GA feature flag rollout for all paying tiers and validate"
                  + " with 10 design-partner accounts",
              "Deliver workflow builder GA",
              CommitCategory.STRATEGIC,
              CommitPriority.MUST,
              0),
          new Seed(
              "Complete Auth0 integration for third-party workflow triggers — PKCE flow end-to-end"
                  + " verified across Okta, Google, and Azure IDP fixtures",
              "Enable third-party triggers",
              CommitCategory.STRATEGIC,
              CommitPriority.MUST,
              1),
          new Seed(
              "Ship the 30 prebuilt workflow templates to the public template library; instrument"
                  + " adoption events per template category",
              "Add 30 prebuilt templates",
              CommitCategory.OPERATIONAL,
              CommitPriority.MUST,
              2),
          new Seed(
              "Instrument workflow builder funnel: step-level completion rates and p95 latency"
                  + " per trigger type, wired to the GTM weekly dashboard",
              "Deliver workflow builder GA",
              CommitCategory.OPERATIONAL,
              CommitPriority.SHOULD,
              3),
          new Seed(
              "Roll out the workflow onboarding guided-setup modal to the 10% beta cohort and"
                  + " capture first-workflow completion rate for the A/B readout",
              "Deliver workflow builder GA", CommitCategory.OPERATIONAL, CommitPriority.SHOULD, 4),
          // Three commits on the reliability/flake outcome.
          new Seed(
              "Instrument flake-rate baseline across all CI suites and publish the flaky-test"
                  + " dashboard to the platform-reliability channel",
              "Reduce flake rate below 1%",
              CommitCategory.OPERATIONAL,
              CommitPriority.SHOULD,
              5),
          new Seed(
              "Roll out the retry-on-flake wrapper to the integration suite; confirmed flake rate"
                  + " dropped from 4.2% to 0.8% across three consecutive runs",
              "Reduce flake rate below 1%", CommitCategory.OPERATIONAL, CommitPriority.SHOULD, 6),
          new Seed(
              "Run the automated end-to-end billing suite against the new Auth0 JWT rotation"
                  + " fixture and confirm zero regressions on token-refresh paths",
              "Automate end-to-end suite",
              CommitCategory.OPERATIONAL,
              CommitPriority.COULD,
              7));

  private final OrgRepository orgRepo;
  private final UserRepository userRepo;
  private final WeekRepository weekRepo;
  private final CommitRepository commitRepo;
  private final SupportingOutcomeRepository soRepo;

  public DemoLockedWeekBootstrap(
      OrgRepository orgRepo,
      UserRepository userRepo,
      WeekRepository weekRepo,
      CommitRepository commitRepo,
      SupportingOutcomeRepository soRepo) {
    this.orgRepo = orgRepo;
    this.userRepo = userRepo;
    this.weekRepo = weekRepo;
    this.commitRepo = commitRepo;
    this.soRepo = soRepo;
  }

  @Override
  @Transactional
  public void run(String... args) {
    Org org = orgRepo.findAll().stream().findFirst().orElse(null);
    if (org == null) return;

    ZoneId tz = ZoneId.of(org.getTimezone());
    DayOfWeek startDay = org.getWeekStartDayOfWeek();
    LocalDate currentWeekStart =
        ZonedDateTime.now(tz).toLocalDate().with(TemporalAdjusters.previousOrSame(startDay));
    LocalDate lockedWeekStart = currentWeekStart.minusWeeks(1);

    // Build a SO lookup by partial title match (same strategy as DemoIcCommitsBootstrap).
    Map<String, SupportingOutcome> soByTitle =
        soRepo.findAll().stream()
            .collect(Collectors.toMap(SupportingOutcome::getTitle, s -> s, (a, b) -> a));

    int seeded = 0;
    int skipped = 0;

    for (User user : userRepo.findAll()) {
      if (user.getRole() != Role.IC) continue;
      if (user.getEmail() == null || !user.getEmail().endsWith("@demo.throughline.app")) continue;

      // Idempotency guard: if a week row for N-1 already exists for this persona, skip.
      if (weekRepo.findByUserIdAndWeekStart(user.getId(), lockedWeekStart).isPresent()) {
        skipped++;
        log.debug(
            "DemoLockedWeekBootstrap: LOCKED week already exists for {} at {}, skipping",
            user.getEmail(),
            lockedWeekStart);
        continue;
      }

      Week week = new Week(user.getId(), org.getId(), lockedWeekStart);
      week.setState(WeekState.LOCKED);
      week.setLockedAt(lockedWeekStart.plusDays(4).atStartOfDay(tz).toInstant());
      Week savedWeek = weekRepo.save(week);

      int commitsSaved = 0;
      for (Seed seed : SEEDS) {
        SupportingOutcome so =
            soByTitle.entrySet().stream()
                .filter(e -> e.getKey().contains(seed.soTitleContains()))
                .map(Map.Entry::getValue)
                .findFirst()
                .orElse(null);
        if (so == null) {
          log.warn(
              "DemoLockedWeekBootstrap: SO matching '{}' not found, skipping commit",
              seed.soTitleContains());
          continue;
        }
        Commit commit = new Commit(savedWeek.getId(), seed.text());
        commit.setSupportingOutcomeId(so.getId());
        commit.setCategory(seed.category());
        commit.setPriority(seed.priority());
        commit.setDisplayOrder(seed.displayOrder());
        commitRepo.save(commit);
        commitsSaved++;
      }
      seeded++;
      log.info(
          "DemoLockedWeekBootstrap: seeded LOCKED week {} for {} with {} commits",
          lockedWeekStart,
          user.getEmail(),
          commitsSaved);
    }

    log.info("DemoLockedWeekBootstrap complete — seeded={} skipped={}", seeded, skipped);
  }
}
