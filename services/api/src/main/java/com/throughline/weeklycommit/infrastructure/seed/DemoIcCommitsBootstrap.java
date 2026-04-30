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
import java.util.Optional;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Seed eight DRAFT commits for the {@code @demo.throughline.app} IC persona's current week so the
 * chess matrix is populated on first load.
 *
 * <p>Distribution: five commits concentrated on the "Deliver workflow builder GA" outcome, two on
 * the "Reduce flake rate below 1%" reliability outcome, and one intentionally drift-y commit (P1
 * incident response text linked to a strategic SMB/ICP outcome) so T2 fires visibly on the row.
 *
 * <p>Idempotent: skips if the persona already has commits, if the week isn't DRAFT, or if the SO
 * catalogue is absent.
 */
@Component
@Profile("dev")
@Order(50)
public class DemoIcCommitsBootstrap implements CommandLineRunner {

  private static final Logger log = LoggerFactory.getLogger(DemoIcCommitsBootstrap.class);

  // Eight commits: five aligned to the workflow-builder GA outcome (concentration visible in T3),
  // two aligned to reliability/flake reduction, and one intentionally drift-y commit whose text
  // is incident-response work but whose SO is linked to the strategic SMB/ICP outcome — T2 should
  // flag the mismatch visibly on the row. Each tuple: (text, SO title contains, category,
  // priority, displayOrder).
  private record Seed(
      String text,
      String soTitleContains,
      CommitCategory category,
      CommitPriority priority,
      int displayOrder) {}

  private static final List<Seed> SEEDS =
      List.of(
          // --- Workflow builder GA cluster (5 commits) ---
          new Seed(
              "Ship the workflow builder GA milestone — all trigger types wired and load-tested"
                  + " against 50K events/hour",
              "Deliver workflow builder GA",
              CommitCategory.STRATEGIC,
              CommitPriority.MUST,
              0),
          new Seed(
              "Instrument end-to-end metrics for the workflow builder GA launch: funnel drop-off,"
                  + " step latency p95, error rate by trigger type",
              "Deliver workflow builder GA",
              CommitCategory.OPERATIONAL,
              CommitPriority.MUST,
              1),
          new Seed(
              "Roll out automation for workflow builder GA smoke suite across all trigger"
                  + " permutations in staging",
              "Deliver workflow builder GA",
              CommitCategory.OPERATIONAL,
              CommitPriority.SHOULD,
              2),
          new Seed(
              "Complete the Auth0 PKCE handshake integration for third-party workflow triggers"
                  + " and validate token refresh across all IDP configurations",
              "Enable third-party triggers",
              CommitCategory.STRATEGIC,
              CommitPriority.MUST,
              3),
          new Seed(
              "Run A/B test on workflow onboarding modal: guided-setup vs blank-canvas path,"
                  + " target ≥15% improvement in first-workflow completion",
              "Deliver workflow builder GA", CommitCategory.OPERATIONAL, CommitPriority.SHOULD, 4),
          // --- Reliability cluster (2 commits) ---
          new Seed(
              "Instrument metrics for flake rate baseline and ship the flaky-test dashboard to"
                  + " platform-reliability Slack channel",
              "Reduce flake rate below 1%",
              CommitCategory.OPERATIONAL,
              CommitPriority.SHOULD,
              5),
          new Seed(
              "Roll out automation for the retry-on-flake wrapper in the CI pipeline; validate"
                  + " flake rate drops below 1% threshold on three consecutive runs",
              "Reduce flake rate below 1%", CommitCategory.OPERATIONAL, CommitPriority.SHOULD, 6),
          // --- Intentional drift (1 commit): P1 incident response linked to SMB/ICP SO ---
          // T2 should fire: commit text is reactive incident work; linked SO is a strategic
          // ICP-qualification outcome under "Win the SMB segment".
          new Seed(
              "Rotate compromised JWT signing key and audit all active sessions — P1 incident"
                  + " response, oncall page at 02:47",
              "Tighten ICP qualification",
              CommitCategory.REACTIVE,
              CommitPriority.MUST,
              7));

  private final OrgRepository orgRepo;
  private final UserRepository userRepo;
  private final WeekRepository weekRepo;
  private final CommitRepository commitRepo;
  private final SupportingOutcomeRepository soRepo;

  public DemoIcCommitsBootstrap(
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

    Map<String, SupportingOutcome> soByTitleSubstring =
        soRepo.findAll().stream()
            .collect(Collectors.toMap(SupportingOutcome::getTitle, s -> s, (a, b) -> a));

    int seeded = 0;
    int skipped = 0;
    for (User user : userRepo.findAll()) {
      if (user.getRole() != Role.IC) continue;
      if (user.getEmail() == null || !user.getEmail().endsWith("@demo.throughline.app")) continue;
      Optional<Week> weekOpt = weekRepo.findByUserIdAndWeekStart(user.getId(), currentWeekStart);
      if (weekOpt.isEmpty()) continue;
      Week week = weekOpt.get();
      if (week.getState() != WeekState.DRAFT) {
        skipped++;
        continue;
      }
      List<Commit> existing = commitRepo.findAllByWeekIdOrderByDisplayOrderAsc(week.getId());
      if (!existing.isEmpty()) {
        skipped++;
        continue;
      }
      for (Seed seed : SEEDS) {
        SupportingOutcome so =
            soByTitleSubstring.entrySet().stream()
                .filter(e -> e.getKey().contains(seed.soTitleContains()))
                .map(Map.Entry::getValue)
                .findFirst()
                .orElse(null);
        if (so == null) {
          log.warn(
              "DemoIcCommitsBootstrap: SO matching '{}' not found, skipping seed",
              seed.soTitleContains());
          continue;
        }
        Commit commit = new Commit(week.getId(), seed.text());
        commit.setSupportingOutcomeId(so.getId());
        commit.setCategory(seed.category());
        commit.setPriority(seed.priority());
        commit.setDisplayOrder(seed.displayOrder());
        commitRepo.save(commit);
      }
      seeded++;
    }
    log.info(
        "DemoIcCommitsBootstrap seeded commits for {} demo IC(s) (skipped {})", seeded, skipped);
  }
}
