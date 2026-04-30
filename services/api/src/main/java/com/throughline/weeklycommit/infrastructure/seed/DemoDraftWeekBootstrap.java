package com.throughline.weeklycommit.infrastructure.seed;

import com.throughline.weeklycommit.domain.Commit;
import com.throughline.weeklycommit.domain.CommitState;
import com.throughline.weeklycommit.domain.Org;
import com.throughline.weeklycommit.domain.Role;
import com.throughline.weeklycommit.domain.User;
import com.throughline.weeklycommit.domain.Week;
import com.throughline.weeklycommit.domain.WeekState;
import com.throughline.weeklycommit.domain.repo.CommitRepository;
import com.throughline.weeklycommit.domain.repo.OrgRepository;
import com.throughline.weeklycommit.domain.repo.UserRepository;
import com.throughline.weeklycommit.domain.repo.WeekRepository;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.TemporalAdjusters;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Idempotent demo-state rewind. The {@code DemoHistorySeeder} marks every week (including the
 * current one) {@code RECONCILED} so the manager dashboard has a populated rollup on day-zero, but
 * that leaves the IC view with nothing to plan — a reviewer signing in as IC sees a static
 * reconciled summary instead of the inline T1/T2/T7 AI surface.
 *
 * <p>This runner detects weeks whose {@code reconciledAt} matches the seeder's deterministic
 * pattern ({@code weekStart + 5 days} at midnight in the org timezone) and rewinds the most recent
 * such week per IC to {@code DRAFT}. Any reconcile written by a real run carries a different
 * timestamp and is left alone, so the runner is safe to fire on every startup.
 *
 * <p>Carry-forward ghost row: the auth-migration chain commit ({@code CARRIED_FORWARD} state, text
 * contains "Migrate legacy auth provider to Auth0") is intentionally kept in {@code
 * CARRIED_FORWARD} state so the FE renders it as the ghost row pinned at the top of the DRAFT week.
 */
@Component
@Profile("dev")
@Order(40)
public class DemoDraftWeekBootstrap implements CommandLineRunner {

  private static final Logger log = LoggerFactory.getLogger(DemoDraftWeekBootstrap.class);

  private final OrgRepository orgRepo;
  private final UserRepository userRepo;
  private final WeekRepository weekRepo;
  private final CommitRepository commitRepo;

  public DemoDraftWeekBootstrap(
      OrgRepository orgRepo,
      UserRepository userRepo,
      WeekRepository weekRepo,
      CommitRepository commitRepo) {
    this.orgRepo = orgRepo;
    this.userRepo = userRepo;
    this.weekRepo = weekRepo;
    this.commitRepo = commitRepo;
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
    Instant seederReconciledAt = currentWeekStart.plusDays(5).atStartOfDay(tz).toInstant();

    int rewound = 0;
    int skippedAlreadyDraft = 0;
    int skippedNotSeeded = 0;
    for (User user : userRepo.findAll()) {
      if (user.getRole() != Role.IC) continue;
      Week week = weekRepo.findByUserIdAndWeekStart(user.getId(), currentWeekStart).orElse(null);
      if (week == null) continue;
      if (week.getState() == WeekState.DRAFT) {
        skippedAlreadyDraft++;
        continue;
      }
      boolean isSeederPattern =
          week.getReconciledAt() != null && week.getReconciledAt().equals(seederReconciledAt);
      // The persona-switcher demo accounts (ic@demo, manager@demo, …) are minted by the
      // auth0-provision script with a provisioning-time reconciledAt — they don't match the
      // seeder pattern but they're still demo state. Always rewind those.
      boolean isDemoPersona =
          user.getEmail() != null && user.getEmail().endsWith("@demo.throughline.app");
      if (!isSeederPattern && !isDemoPersona) {
        // Real demo activity — never undo it.
        skippedNotSeeded++;
        continue;
      }
      week.setState(WeekState.DRAFT);
      week.setLockedAt(null);
      week.setReconciledAt(null);
      weekRepo.save(week);
      for (Commit commit : commitRepo.findAllByWeekIdOrderByDisplayOrderAsc(week.getId())) {
        // Preserve the auth-migration carry-forward chain commit so the FE sees it as the ghost
        // row pinned at the top of the DRAFT week. Any commit that is already CARRIED_FORWARD and
        // references the chain text is left in CARRIED_FORWARD state; only ordinary ACTIVE commits
        // have their reconciliation fields reset.
        boolean isChainCommit =
            commit.getState() == CommitState.CARRIED_FORWARD
                && commit.getText() != null
                && commit.getText().contains("Migrate legacy auth provider to Auth0");
        if (isChainCommit) {
          // Keep CARRIED_FORWARD; clear only reconciliation fields so the ghost row renders
          // cleanly.
          commit.setReconciliationOutcome(null);
          commit.setReconciliationNote(null);
          commitRepo.save(commit);
          continue;
        }
        commit.setReconciliationOutcome(null);
        commit.setReconciliationNote(null);
        if (commit.getState() == CommitState.CARRIED_FORWARD) {
          commit.setState(CommitState.ACTIVE);
        }
        commitRepo.save(commit);
      }
      rewound++;
    }
    log.info(
        "DemoDraftWeekBootstrap rewound {} IC weeks to DRAFT (already draft: {}, not"
            + " seeder-pattern: {})",
        rewound,
        skippedAlreadyDraft,
        skippedNotSeeded);
  }
}
