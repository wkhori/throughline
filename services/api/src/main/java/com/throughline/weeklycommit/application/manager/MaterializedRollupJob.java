package com.throughline.weeklycommit.application.manager;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.throughline.weeklycommit.application.lifecycle.WeekReconciledEvent;
import com.throughline.weeklycommit.domain.Commit;
import com.throughline.weeklycommit.domain.CommitState;
import com.throughline.weeklycommit.domain.Org;
import com.throughline.weeklycommit.domain.RallyCry;
import com.throughline.weeklycommit.domain.SupportingOutcome;
import com.throughline.weeklycommit.domain.Team;
import com.throughline.weeklycommit.domain.TeamPriorityWeight;
import com.throughline.weeklycommit.domain.TeamRollupCache;
import com.throughline.weeklycommit.domain.User;
import com.throughline.weeklycommit.domain.Week;
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
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * P10 / P25 — keeps {@code team_rollup_cache} fresh.
 *
 * <p>Two triggers:
 *
 * <ol>
 *   <li>{@link TransactionalEventListener} on {@link WeekReconciledEvent} ({@code AFTER_COMMIT}) —
 *       recomputes the row for the affected user's team so a manager polling the dashboard sees
 *       fresh numbers within seconds of an IC reconciling.
 *   <li>{@link Scheduled} cron at {@code 30 8 * * MON} ({@code 08:30 Monday} in the JVM's default
 *       timezone — the digest cron itself fires at {@code 09:00 Monday} per PRD §8.3) — full
 *       org-wide refresh ensures the digest reads a warm cache even for teams that didn't reconcile
 *       this week.
 * </ol>
 *
 * <p>Payload schema is {@link RollupPayload}; serialised with the shared {@link ObjectMapper} so
 * the surface stays consistent with the rest of the API.
 */
@Service
public class MaterializedRollupJob {

  private static final Logger log = LoggerFactory.getLogger(MaterializedRollupJob.class);

  private static final int STARVED_OUTCOME_LOOKBACK_WEEKS = 2;
  private static final int LONG_CARRY_FORWARD_THRESHOLD = 3;

  private final TeamRollupCacheRepository cacheRepo;
  private final TeamRepository teamRepo;
  private final UserRepository userRepo;
  private final WeekRepository weekRepo;
  private final CommitRepository commitRepo;
  private final RallyCryRepository rcRepo;
  private final DefiningObjectiveRepository doRepo;
  private final OutcomeRepository outcomeRepo;
  private final SupportingOutcomeRepository soRepo;
  private final TeamPriorityWeightRepository tpwRepo;
  private final OrgRepository orgRepo;
  private final ObjectMapper json;
  private final Clock clock;

  public MaterializedRollupJob(
      TeamRollupCacheRepository cacheRepo,
      TeamRepository teamRepo,
      UserRepository userRepo,
      WeekRepository weekRepo,
      CommitRepository commitRepo,
      RallyCryRepository rcRepo,
      DefiningObjectiveRepository doRepo,
      OutcomeRepository outcomeRepo,
      SupportingOutcomeRepository soRepo,
      TeamPriorityWeightRepository tpwRepo,
      OrgRepository orgRepo,
      ObjectMapper json,
      Clock clock) {
    this.cacheRepo = cacheRepo;
    this.teamRepo = teamRepo;
    this.userRepo = userRepo;
    this.weekRepo = weekRepo;
    this.commitRepo = commitRepo;
    this.rcRepo = rcRepo;
    this.doRepo = doRepo;
    this.outcomeRepo = outcomeRepo;
    this.soRepo = soRepo;
    this.tpwRepo = tpwRepo;
    this.orgRepo = orgRepo;
    this.json = json;
    this.clock = clock;
  }

  /**
   * Recompute the cache row for the team that owns the reconciled week. Runs after the reconcile
   * transaction commits ({@link TransactionPhase#AFTER_COMMIT}) so a rollback never leaks into the
   * dashboard.
   */
  @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public void onWeekReconciled(WeekReconciledEvent event) {
    Optional<User> user = userRepo.findById(event.userId());
    if (user.isEmpty() || user.get().getTeamId() == null) return;
    Optional<Week> week = weekRepo.findById(event.weekId());
    if (week.isEmpty()) return;
    try {
      recomputeForTeamWeek(user.get().getTeamId(), week.get().getWeekStart());
    } catch (Exception e) {
      // P10 contract: an isolated rollup failure must not poison the dashboard for other teams.
      log.warn(
          "MaterializedRollupJob: recompute failed for team {} week {}: {}",
          user.get().getTeamId(),
          week.get().getWeekStart(),
          e.toString());
    }
  }

  /**
   * Monday 08:30 — runs 30 minutes before the {@code WEEKLY_DIGEST} cron (Monday 09:00, PRD §8.3).
   * Recomputes the cache row for every team in every org for the week that is just ending.
   */
  @Scheduled(cron = "0 30 8 * * MON")
  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public void scheduledRecompute() {
    int teams = 0;
    int rows = 0;
    for (Org org : orgRepo.findAll()) {
      LocalDate weekStart = currentWeekStartFor(org);
      for (Team team : teamRepo.findAll()) {
        if (!team.getOrgId().equals(org.getId())) continue;
        teams++;
        try {
          recomputeForTeamWeek(team.getId(), weekStart);
          rows++;
        } catch (Exception e) {
          log.warn(
              "MaterializedRollupJob: scheduled recompute failed for team {} week {}: {}",
              team.getId(),
              weekStart,
              e.toString());
        }
      }
    }
    log.info("MaterializedRollupJob: scheduled recompute wrote {}/{} rows", rows, teams);
  }

  /**
   * Compute and persist the rollup payload for one team / week. Public so {@code
   * /manager/team-rollup} can demand-refresh on stale-cache fallback.
   */
  @Transactional
  public TeamRollupCache recomputeForTeamWeek(String teamId, LocalDate weekStart) {
    RollupPayload payload = computePayload(teamId, weekStart);
    String payloadJson;
    try {
      payloadJson = json.writeValueAsString(payload);
    } catch (JsonProcessingException e) {
      throw new IllegalStateException("Failed to serialise team_rollup_cache payload", e);
    }
    TeamRollupCache existing =
        cacheRepo
            .findByIdTeamIdAndIdWeekStart(teamId, weekStart)
            .orElse(new TeamRollupCache(teamId, weekStart, payloadJson, Instant.now(clock)));
    existing.setPayloadJson(payloadJson);
    existing.setComputedAt(Instant.now(clock));
    return cacheRepo.save(existing);
  }

  // ---------------------------------------------------------------------------------------------

  /** Compute (without persisting) the rollup payload for a team / week. Pure-ish for testing. */
  public RollupPayload computePayload(String teamId, LocalDate weekStart) {
    Team team = teamRepo.findById(teamId).orElse(null);
    String teamName = team == null ? teamId : team.getName();

    List<User> members =
        userRepo.findAll().stream().filter(u -> teamId.equals(u.getTeamId())).toList();

    List<Commit> commits = commitRepo.findAllByTeamAndWeekStart(teamId, weekStart);
    int reconciledCount = 0;
    int doneCount = 0;
    int partialCount = 0;
    int notDoneCount = 0;
    int carryForwardCount = 0;
    Map<String, Long> commitsByOutcomeId = new HashMap<>();
    for (Commit c : commits) {
      if (c.getReconciliationOutcome() != null) {
        reconciledCount++;
        switch (c.getReconciliationOutcome()) {
          case DONE -> doneCount++;
          case PARTIAL -> partialCount++;
          case NOT_DONE -> notDoneCount++;
          default -> {
            // exhaustive
          }
        }
      }
      if (c.getState() == CommitState.CARRIED_FORWARD) carryForwardCount++;
      if (c.getSupportingOutcomeId() != null) {
        SupportingOutcome so = soRepo.findById(c.getSupportingOutcomeId()).orElse(null);
        if (so != null) {
          commitsByOutcomeId.merge(so.getOutcomeId(), 1L, Long::sum);
        }
      }
    }

    int lockedCount = 0;
    for (User u : members) {
      Optional<Week> w = weekRepo.findByUserIdAndWeekStart(u.getId(), weekStart);
      if (w.isPresent() && w.get().getLockedAt() != null) lockedCount++;
    }

    // commits-by-Outcome shares
    long totalLinkedCommits = commitsByOutcomeId.values().stream().mapToLong(Long::longValue).sum();
    List<RollupPayload.OutcomeShare> shares = new ArrayList<>();
    for (Map.Entry<String, Long> e : commitsByOutcomeId.entrySet()) {
      String outcomeId = e.getKey();
      String outcomeTitle =
          outcomeRepo.findById(outcomeId).map(o -> o.getTitle()).orElse(outcomeId);
      double share = totalLinkedCommits == 0 ? 0d : (double) e.getValue() / totalLinkedCommits;
      shares.add(new RollupPayload.OutcomeShare(outcomeId, outcomeTitle, share));
    }
    shares.sort(Comparator.comparingDouble(RollupPayload.OutcomeShare::share).reversed());

    // Starved outcomes: outcomes whose SOs received zero commits org-wide for the most recent 2
    // weeks. (For Phase 4 we report only those visible to the team via the org RCDO tree.)
    List<RollupPayload.StarvedOutcome> starved = computeStarvedOutcomes(weekStart);

    // Drift exceptions: per RallyCry, computed observed share vs. expected band.
    List<RollupPayload.PriorityDrift> drift =
        computeDriftExceptions(teamId, commits, totalLinkedCommits);

    // Exception ribbon: long carry-forward chains + drift entries promoted as ribbon items.
    List<RollupPayload.RibbonEntry> ribbon = new ArrayList<>();
    for (Commit c : commits) {
      if (c.getCarryForwardWeeks() >= LONG_CARRY_FORWARD_THRESHOLD) {
        ribbon.add(
            new RollupPayload.RibbonEntry(
                "LONG_CARRY_FORWARD",
                c.getCarryForwardWeeks() >= 4 ? "HIGH" : "MEDIUM",
                "Commit carried forward " + c.getCarryForwardWeeks() + " weeks running",
                "commit",
                c.getId()));
      }
    }
    for (RollupPayload.PriorityDrift d : drift) {
      ribbon.add(
          new RollupPayload.RibbonEntry(
              "PRIORITY_DRIFT",
              "MEDIUM",
              "Team is drifting on " + d.rallyCryTitle(),
              "rally_cry",
              d.rallyCryId()));
    }
    for (RollupPayload.StarvedOutcome s : starved) {
      ribbon.add(
          new RollupPayload.RibbonEntry(
              "STARVED_OUTCOME",
              "MEDIUM",
              s.outcomeTitle() + " starved for " + s.weeksStarved() + " weeks",
              "outcome",
              s.outcomeId()));
    }

    return new RollupPayload(
        teamId,
        teamName,
        weekStart,
        members.size(),
        lockedCount,
        reconciledCount,
        doneCount,
        partialCount,
        notDoneCount,
        carryForwardCount,
        shares,
        starved,
        drift,
        ribbon);
  }

  private List<RollupPayload.StarvedOutcome> computeStarvedOutcomes(LocalDate weekStart) {
    LocalDate from = weekStart.minusDays(7L * (STARVED_OUTCOME_LOOKBACK_WEEKS - 1));
    List<RollupPayload.StarvedOutcome> out = new ArrayList<>();
    for (var outcome : outcomeRepo.findAll()) {
      // For each outcome, count commits across all teams whose SO maps under this outcome in the
      // lookback window. Keep this O(outcomes × SOs) — acceptable at demo scale (36 × ~4 = 144).
      List<SupportingOutcome> sosUnder =
          soRepo.findAll().stream().filter(s -> outcome.getId().equals(s.getOutcomeId())).toList();
      long total = 0;
      for (SupportingOutcome so : sosUnder) {
        for (Team t : teamRepo.findAll()) {
          total +=
              commitRepo.countByTeamAndSupportingOutcomeBetweenWeeks(
                  t.getId(), so.getId(), from, weekStart);
        }
        if (total > 0) break;
      }
      if (total == 0) {
        out.add(
            new RollupPayload.StarvedOutcome(
                outcome.getId(), outcome.getTitle(), STARVED_OUTCOME_LOOKBACK_WEEKS));
      }
    }
    return out;
  }

  private List<RollupPayload.PriorityDrift> computeDriftExceptions(
      String teamId, List<Commit> commits, long totalLinkedCommits) {
    if (totalLinkedCommits == 0) return List.of();
    // Bucket commits → SO → Outcome → DO → RallyCry to compute per-RC observed share.
    Map<String, Long> rcCounts = new HashMap<>();
    for (Commit c : commits) {
      if (c.getSupportingOutcomeId() == null) continue;
      String rcId = resolveRallyCryId(c.getSupportingOutcomeId());
      if (rcId != null) rcCounts.merge(rcId, 1L, Long::sum);
    }
    List<RollupPayload.PriorityDrift> drift = new ArrayList<>();
    for (TeamPriorityWeight tpw : tpwRepo.findAll()) {
      if (!teamId.equals(tpw.getTeamId())) continue;
      double observed =
          rcCounts.getOrDefault(tpw.getRallyCryId(), 0L) / (double) totalLinkedCommits;
      double low = tpw.getExpectedShareLow().doubleValue();
      double high = tpw.getExpectedShareHigh().doubleValue();
      if (observed < low || observed > high) {
        RallyCry rc = rcRepo.findById(tpw.getRallyCryId()).orElse(null);
        drift.add(
            new RollupPayload.PriorityDrift(
                tpw.getRallyCryId(),
                rc == null ? tpw.getRallyCryId() : rc.getTitle(),
                observed,
                low,
                high));
      }
    }
    return drift;
  }

  private String resolveRallyCryId(String supportingOutcomeId) {
    return soRepo
        .findById(supportingOutcomeId)
        .flatMap(s -> outcomeRepo.findById(s.getOutcomeId()))
        .flatMap(o -> doRepo.findById(o.getDefiningObjectiveId()))
        .map(d -> d.getRallyCryId())
        .orElse(null);
  }

  private LocalDate currentWeekStartFor(Org org) {
    ZoneId tz = ZoneId.of(org.getTimezone());
    LocalDate today = ZonedDateTime.now(clock.withZone(tz)).toLocalDate();
    DayOfWeek startDay = org.getWeekStartDayOfWeek();
    return today.with(TemporalAdjusters.previousOrSame(startDay));
  }
}
