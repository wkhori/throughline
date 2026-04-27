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
 * Demo polish: seed four sample DRAFT commits for the {@code @demo.throughline.app} IC persona's
 * current week so the chess matrix is populated the moment a reviewer opens the IC view. Three
 * commits are well-aligned to their Supporting Outcome; the fourth is intentionally drift-y
 * (Reactive priority bug-bash linked to a strategic SMB outcome) so the T2 drift warning fires
 * inline and the AI surface is visible without the reviewer having to type anything.
 *
 * <p>Idempotent: skips if the demo persona already has commits, if the week isn't DRAFT, or if
 * the SO catalogue we look up isn't present.
 */
@Component
@Profile("dev")
@Order(50)
public class DemoIcCommitsBootstrap implements CommandLineRunner {

  private static final Logger log = LoggerFactory.getLogger(DemoIcCommitsBootstrap.class);

  // Three aligned + one intentionally drift-y commit. Each tuple is
  // (text, SO title contains, category, priority, displayOrder).
  // The drift seed picks an SO under "Win the SMB segment" but tags it Reactive — the linked SO
  // is strategic, so T2 should flag the mismatch.
  private record Seed(
      String text,
      String soTitleContains,
      CommitCategory category,
      CommitPriority priority,
      int displayOrder) {}

  private static final List<Seed> SEEDS =
      List.of(
          new Seed(
              "Ship the new SDR scoring rubric and onboard all reps to the qualification framework",
              "Tighten ICP qualification",
              CommitCategory.STRATEGIC,
              CommitPriority.MUST,
              0),
          new Seed(
              "Run an A/B test on the simplified self-serve onboarding flow with sample-data preload",
              "Reduce setup friction",
              CommitCategory.OPERATIONAL,
              CommitPriority.SHOULD,
              1),
          new Seed(
              "Instrument week-1 activation events and ship the dashboard for the GTM weekly review",
              "Lift activation events week-1",
              CommitCategory.OPERATIONAL,
              CommitPriority.SHOULD,
              2),
          // Intentionally drift-y: bug-bash work linked to a strategic SMB outcome.
          new Seed(
              "Bug-bash the staging billing flake — flapping P1 alerts woke oncall twice this week",
              "Tighten ICP qualification",
              CommitCategory.REACTIVE,
              CommitPriority.COULD,
              3));

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
      Optional<Week> weekOpt =
          weekRepo.findByUserIdAndWeekStart(user.getId(), currentWeekStart);
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
          log.warn("DemoIcCommitsBootstrap: SO matching '{}' not found, skipping seed", seed.soTitleContains());
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
    log.info("DemoIcCommitsBootstrap seeded commits for {} demo IC(s) (skipped {})", seeded, skipped);
  }
}
