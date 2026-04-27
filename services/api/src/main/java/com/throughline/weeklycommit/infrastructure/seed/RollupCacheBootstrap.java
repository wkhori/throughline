package com.throughline.weeklycommit.infrastructure.seed;

import com.throughline.weeklycommit.application.manager.MaterializedRollupJob;
import com.throughline.weeklycommit.domain.Org;
import com.throughline.weeklycommit.domain.Team;
import com.throughline.weeklycommit.domain.repo.OrgRepository;
import com.throughline.weeklycommit.domain.repo.TeamRepository;
import java.time.DayOfWeek;
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

/**
 * Idempotent post-seed rollup cache repair. Runs after {@link DemoHistorySeeder} on every dev
 * startup so the manager dashboard always reads warm rollup data — without this, weeks written by
 * the seeder bypass the {@code WeekReconciledEvent} listener that normally drives cache writes,
 * and 7/8 sub-teams render empty drift / starved-outcome panels until the Monday 08:30 cron fires.
 */
@Component
@Profile("dev")
@Order(30)
public class RollupCacheBootstrap implements CommandLineRunner {

  private static final Logger log = LoggerFactory.getLogger(RollupCacheBootstrap.class);

  private final OrgRepository orgRepo;
  private final TeamRepository teamRepo;
  private final MaterializedRollupJob rollupJob;

  public RollupCacheBootstrap(
      OrgRepository orgRepo, TeamRepository teamRepo, MaterializedRollupJob rollupJob) {
    this.orgRepo = orgRepo;
    this.teamRepo = teamRepo;
    this.rollupJob = rollupJob;
  }

  @Override
  public void run(String... args) {
    int rows = 0;
    for (Org org : orgRepo.findAll()) {
      ZoneId tz = ZoneId.of(org.getTimezone());
      DayOfWeek startDay = org.getWeekStartDayOfWeek();
      LocalDate currentWeekStart =
          ZonedDateTime.now(tz).toLocalDate().with(TemporalAdjusters.previousOrSame(startDay));
      for (int w = 0; w < 2; w++) {
        LocalDate weekStart = currentWeekStart.minusDays(7L * w);
        for (Team team : teamRepo.findAll()) {
          if (!team.getOrgId().equals(org.getId())) continue;
          try {
            rollupJob.recomputeForTeamWeek(team.getId(), weekStart);
            rows++;
          } catch (Exception e) {
            log.warn(
                "RollupCacheBootstrap: recompute failed for team {} week {}: {}",
                team.getId(),
                weekStart,
                e.toString());
          }
        }
      }
    }
    log.info("RollupCacheBootstrap materialised {} team_rollup_cache rows", rows);
  }
}
