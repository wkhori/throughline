package com.throughline.weeklycommit.infrastructure.seed;

import com.throughline.weeklycommit.domain.Commit;
import com.throughline.weeklycommit.domain.CommitCategory;
import com.throughline.weeklycommit.domain.CommitPriority;
import com.throughline.weeklycommit.domain.CommitState;
import com.throughline.weeklycommit.domain.Org;
import com.throughline.weeklycommit.domain.Outcome;
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
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * P28 part b / P31 — four-week LOCKED+RECONCILED history slice.
 *
 * <p>Runs after {@link DemoSeeder} (Order=20). Idempotent: skips if any {@code week} row exists.
 *
 * <p>Distribution per IC per week: 5 commits avg (range 3–7). Reconciliation outcomes ~55% DONE /
 * ~25% PARTIAL / ~20% NOT_DONE; ~15% of NOT_DONE flagged carry-forward (creates the lineage chain
 * into week N+1 with {@code parentCommitId}). Deterministic via fixed-seed {@link Random} so the
 * dashboard demo is reproducible.
 *
 * <p>The four deliberate dysfunctions (PRD §11):
 *
 * <ol>
 *   <li>Outcome "Expand enterprise pipeline Q2" receives zero org-wide commits in the most recent 2
 *       weeks (the SO IDs under that DO are excluded from the random-pick pool).
 *   <li>Sarah Mendez's "Refactor billing service test suite" carry-forward chain — created
 *       four-weeks-running with {@code parentCommitId} chain depth 4.
 *   <li>Platform Reliability team concentrates 65% of its commits on a single SO under "Reduce P1
 *       incident MTTR < 30min".
 *   <li>Jordan Kim's 8 reports concentrate on the same Outcome (the Enterprise GTM team's "Land 10
 *       new logos quarter" outcome).
 * </ol>
 */
@Component
@Profile("dev")
@Order(20)
public class DemoHistorySeeder implements CommandLineRunner {

  private static final Logger log = LoggerFactory.getLogger(DemoHistorySeeder.class);

  private static final int HISTORY_WEEKS = 4;
  private static final long RNG_SEED = 0xC0FFEE_2026L;

  private final OrgRepository orgRepo;
  private final UserRepository userRepo;
  private final TeamRepository teamRepo;
  private final WeekRepository weekRepo;
  private final CommitRepository commitRepo;
  private final RallyCryRepository rcRepo;
  private final DefiningObjectiveRepository doRepo;
  private final OutcomeRepository outcomeRepo;
  private final SupportingOutcomeRepository soRepo;

  @Value("${throughline.seed.enabled:false}")
  private boolean seedEnabled;

  public DemoHistorySeeder(
      OrgRepository orgRepo,
      UserRepository userRepo,
      TeamRepository teamRepo,
      WeekRepository weekRepo,
      CommitRepository commitRepo,
      RallyCryRepository rcRepo,
      DefiningObjectiveRepository doRepo,
      OutcomeRepository outcomeRepo,
      SupportingOutcomeRepository soRepo) {
    this.orgRepo = orgRepo;
    this.userRepo = userRepo;
    this.teamRepo = teamRepo;
    this.weekRepo = weekRepo;
    this.commitRepo = commitRepo;
    this.rcRepo = rcRepo;
    this.doRepo = doRepo;
    this.outcomeRepo = outcomeRepo;
    this.soRepo = soRepo;
  }

  @Override
  @Transactional
  public void run(String... args) {
    if (!seedEnabled) return;
    if (weekRepo.count() > 0) {
      log.info("DemoHistorySeeder skipped (week rows already seeded)");
      return;
    }
    Org org = orgRepo.findAll().stream().findFirst().orElse(null);
    if (org == null) {
      log.info("DemoHistorySeeder skipped (no org seeded)");
      return;
    }

    Random rng = new Random(RNG_SEED);
    ZoneId tz = ZoneId.of(org.getTimezone());
    LocalDate today = ZonedDateTime.now(tz).toLocalDate();
    DayOfWeek startDay = org.getWeekStartDayOfWeek();
    LocalDate currentWeekStart = today.with(TemporalAdjusters.previousOrSame(startDay));

    List<User> ics = userRepo.findAll().stream().filter(u -> u.getRole() == Role.IC).toList();
    if (ics.isEmpty()) return;

    Map<String, Team> teamsById =
        teamRepo.findAll().stream().collect(Collectors.toMap(Team::getId, t -> t));

    List<SupportingOutcome> allSos = soRepo.findAll();
    if (allSos.isEmpty()) return;

    // Dysfunction #1: starve "Expand enterprise pipeline Q2" — exclude every SO whose Outcome's DO
    // matches that title in the most recent two weeks.
    List<String> starvedSoIds = resolveStarvedSoIds();

    // Dysfunction #3: Platform Reliability team concentrates 65% on one SO — pick a single
    // SO under "Reduce P1 incident MTTR < 30min" as the magnet.
    String platformReliabilityMagnetSo =
        resolveSoIdByOutcomeTitle("Reduce P1 incident MTTR < 30min", allSos);

    // Dysfunction #4: Jordan Kim's 8 reports all hammer one Outcome — pick a single SO under
    // "Land 10 new logos quarter".
    String enterpriseGtmMagnetSo = resolveSoIdByOutcomeTitle("Land 10 new logos quarter", allSos);
    Team enterpriseGtm =
        teamsById.values().stream()
            .filter(t -> "Enterprise GTM".equals(t.getName()))
            .findFirst()
            .orElse(null);

    // Dysfunction #2: Sarah Mendez's 4-week carry-forward chain (handled inline below).
    User sarah =
        ics.stream()
            .filter(u -> "auth0|seed-sarah-mendez".equals(u.getAuth0Sub()))
            .findFirst()
            .orElse(null);
    String sarahCarryForwardSo =
        allSos.stream().findFirst().map(SupportingOutcome::getId).orElse(null);

    int totalWeeks = 0;
    int totalCommits = 0;
    int totalCarryForwardChains = 0;

    // For each IC, seed weeks N-3, N-2, N-1, N (current). The most recent week is left as
    // RECONCILED so the manager dashboard immediately has a populated rollup.
    for (User ic : ics) {
      String parentCommitForSarahChain = null;
      Commit prevSarahCarryCommit = null;

      for (int w = HISTORY_WEEKS - 1; w >= 0; w--) {
        LocalDate weekStart = currentWeekStart.minusDays(7L * w);
        boolean isMostRecentTwo = w <= 1;

        Week week = new Week(ic.getId(), org.getId(), weekStart);
        week.setState(WeekState.RECONCILED);
        week.setLockedAt(weekStart.plusDays(4).atStartOfDay(tz).toInstant());
        week.setReconciledAt(weekStart.plusDays(5).atStartOfDay(tz).toInstant());
        Week saved = weekRepo.save(week);
        totalWeeks++;

        int commitCount = 3 + rng.nextInt(5); // 3..7
        boolean isPlatformReliability =
            ic.getTeamId() != null
                && teamsById.get(ic.getTeamId()) != null
                && "Platform Reliability".equals(teamsById.get(ic.getTeamId()).getName());
        boolean isJordansReport =
            enterpriseGtm != null
                && enterpriseGtm.getId().equals(ic.getTeamId())
                && ic.getAuth0Sub() != null
                && ic.getAuth0Sub().startsWith("auth0|seed-ic-jordan-");

        for (int i = 0; i < commitCount; i++) {
          String soId = pickSupportingOutcome(rng, allSos, starvedSoIds, isMostRecentTwo);
          // Dysfunction #3: 65% concentration on platform reliability magnet
          if (isPlatformReliability
              && platformReliabilityMagnetSo != null
              && rng.nextDouble() < 0.65) {
            soId = platformReliabilityMagnetSo;
          }
          // Dysfunction #4: Jordan's reports concentrate on Enterprise GTM magnet
          if (isJordansReport && enterpriseGtmMagnetSo != null && rng.nextDouble() < 0.75) {
            soId = enterpriseGtmMagnetSo;
          }
          ReconciliationOutcome outcome = pickOutcome(rng);
          boolean carryForward =
              outcome == ReconciliationOutcome.NOT_DONE && rng.nextDouble() < 0.15;

          Commit c = new Commit(saved.getId(), commitText(rng, i));
          c.setSupportingOutcomeId(soId);
          c.setCategory(pickCategory(rng));
          c.setPriority(pickPriority(rng));
          c.setDisplayOrder(i);
          c.setReconciliationOutcome(outcome);
          c.setReconciliationNote(noteFor(outcome));
          if (carryForward) c.setState(CommitState.CARRIED_FORWARD);
          commitRepo.save(c);
          totalCommits++;
          if (carryForward) totalCarryForwardChains++;
        }

        // Dysfunction #2: Sarah Mendez's 4-week carry-forward chain. One commit per week,
        // each week's commit references the prior week's commit via parentCommitId.
        if (sarah != null && sarah.getId().equals(ic.getId()) && sarahCarryForwardSo != null) {
          Commit chainCommit = new Commit(saved.getId(), "Refactor billing service test suite");
          chainCommit.setSupportingOutcomeId(sarahCarryForwardSo);
          chainCommit.setCategory(CommitCategory.OPERATIONAL);
          chainCommit.setPriority(CommitPriority.MUST);
          chainCommit.setDisplayOrder(commitCount);
          chainCommit.setReconciliationOutcome(ReconciliationOutcome.PARTIAL);
          chainCommit.setReconciliationNote("Still wading through legacy fixtures");
          chainCommit.setParentCommitId(parentCommitForSarahChain);
          chainCommit.setCarryForwardWeeks(HISTORY_WEEKS - 1 - w);
          // Earlier weeks' chain commit is CARRIED_FORWARD (it was carried into the next week).
          // The most recent week's chain commit stays ACTIVE so the AI can flag the live carry.
          if (w > 0) chainCommit.setState(CommitState.CARRIED_FORWARD);
          Commit savedChain = commitRepo.save(chainCommit);
          parentCommitForSarahChain = savedChain.getId();
          prevSarahCarryCommit = savedChain;
          totalCommits++;
        }
      }
      // Reference prevSarahCarryCommit only for log linkage clarity; suppress unused warning.
      if (prevSarahCarryCommit != null) {
        log.debug(
            "Sarah Mendez carry-forward chain head commit id={}", prevSarahCarryCommit.getId());
      }
    }

    log.info(
        "DemoHistorySeeder complete — weeks={} commits={} carryForwardFlags={} ics={}",
        totalWeeks,
        totalCommits,
        totalCarryForwardChains,
        ics.size());
  }

  /**
   * Pick a SupportingOutcome ID. In the most-recent two weeks the starved SO list is excluded —
   * that 's how the dysfunction #1 ("Expand enterprise pipeline Q2" gets zero commits in the
   * current and previous week) is materialized.
   */
  private String pickSupportingOutcome(
      Random rng, List<SupportingOutcome> all, List<String> starvedSoIds, boolean excludeStarved) {
    if (excludeStarved && !starvedSoIds.isEmpty()) {
      List<SupportingOutcome> pool =
          all.stream().filter(s -> !starvedSoIds.contains(s.getId())).toList();
      return pool.get(rng.nextInt(pool.size())).getId();
    }
    return all.get(rng.nextInt(all.size())).getId();
  }

  private List<String> resolveStarvedSoIds() {
    return doRepo.findAll().stream()
        .filter(d -> "Expand enterprise pipeline Q2".equals(d.getTitle()))
        .flatMap(
            d ->
                outcomeRepo.findAll().stream()
                    .filter(o -> o.getDefiningObjectiveId().equals(d.getId())))
        .flatMap(o -> soRepo.findAll().stream().filter(s -> s.getOutcomeId().equals(o.getId())))
        .map(SupportingOutcome::getId)
        .toList();
  }

  private String resolveSoIdByOutcomeTitle(String title, List<SupportingOutcome> allSos) {
    Outcome o =
        outcomeRepo.findAll().stream()
            .filter(out -> title.equals(out.getTitle()))
            .findFirst()
            .orElse(null);
    if (o == null) return null;
    return allSos.stream()
        .filter(s -> s.getOutcomeId().equals(o.getId()))
        .findFirst()
        .map(SupportingOutcome::getId)
        .orElse(null);
  }

  private ReconciliationOutcome pickOutcome(Random rng) {
    double r = rng.nextDouble();
    if (r < 0.55) return ReconciliationOutcome.DONE;
    if (r < 0.80) return ReconciliationOutcome.PARTIAL;
    return ReconciliationOutcome.NOT_DONE;
  }

  private CommitCategory pickCategory(Random rng) {
    return switch (rng.nextInt(3)) {
      case 0 -> CommitCategory.STRATEGIC;
      case 1 -> CommitCategory.OPERATIONAL;
      default -> CommitCategory.REACTIVE;
    };
  }

  private CommitPriority pickPriority(Random rng) {
    return switch (rng.nextInt(3)) {
      case 0 -> CommitPriority.MUST;
      case 1 -> CommitPriority.SHOULD;
      default -> CommitPriority.COULD;
    };
  }

  private static final String[] COMMIT_TEMPLATES = {
    "Ship %s",
    "Land %s",
    "Instrument metrics for %s",
    "Run experiment on %s",
    "Roll out automation for %s",
    "Tighten %s",
    "Reduce friction in %s"
  };

  private static final String[] COMMIT_OBJECTS = {
    "weekly digest",
    "activation funnel",
    "onboarding tour",
    "billing reconciliation",
    "deploy pipeline",
    "incident playbook",
    "expansion playbook",
    "alignment review",
    "growth experiment",
    "retention loop"
  };

  private String commitText(Random rng, int idx) {
    return COMMIT_TEMPLATES[(idx + rng.nextInt(7)) % COMMIT_TEMPLATES.length].formatted(
        COMMIT_OBJECTS[(idx + rng.nextInt(10)) % COMMIT_OBJECTS.length]);
  }

  private String noteFor(ReconciliationOutcome outcome) {
    return switch (outcome) {
      case DONE -> "Shipped clean.";
      case PARTIAL -> "Mostly there; remainder rolls into next week.";
      case NOT_DONE -> "Blocked on dependency; revisit Monday.";
    };
  }
}
