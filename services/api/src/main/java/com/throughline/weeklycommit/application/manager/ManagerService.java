package com.throughline.weeklycommit.application.manager;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.throughline.weeklycommit.application.lifecycle.WeekStateMachine;
import com.throughline.weeklycommit.domain.Org;
import com.throughline.weeklycommit.domain.Role;
import com.throughline.weeklycommit.domain.Team;
import com.throughline.weeklycommit.domain.TeamRollupCache;
import com.throughline.weeklycommit.domain.User;
import com.throughline.weeklycommit.domain.Week;
import com.throughline.weeklycommit.domain.repo.CommitRepository;
import com.throughline.weeklycommit.domain.repo.OrgRepository;
import com.throughline.weeklycommit.domain.repo.TeamRepository;
import com.throughline.weeklycommit.domain.repo.TeamRollupCacheRepository;
import com.throughline.weeklycommit.domain.repo.UserRepository;
import com.throughline.weeklycommit.domain.repo.WeekRepository;
import com.throughline.weeklycommit.web.dto.ManagerDtos;
import com.throughline.weeklycommit.web.dto.WeekDtos;
import com.throughline.weeklycommit.web.error.NotFoundException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Read-side service for the Phase-4 manager surface (PRD §4 / P9 / P10 / P25).
 *
 * <p>{@code @PreAuthorize} scope checks live on the controller — this service trusts that the
 * caller has already passed the {@code @managerScope.canSee} gate.
 */
@Service
public class ManagerService {

  /** Cache rows older than this are treated as recomputing — controller maps to 503 (P10). */
  static final Duration STALE_CACHE_AFTER = Duration.ofDays(7);

  private final TeamRollupCacheRepository cacheRepo;
  private final TeamRepository teamRepo;
  private final UserRepository userRepo;
  private final WeekRepository weekRepo;
  private final CommitRepository commitRepo;
  private final OrgRepository orgRepo;
  private final WeekStateMachine stateMachine;
  private final MaterializedRollupJob job;
  private final ObjectMapper json;
  private final Clock clock;

  public ManagerService(
      TeamRollupCacheRepository cacheRepo,
      TeamRepository teamRepo,
      UserRepository userRepo,
      WeekRepository weekRepo,
      CommitRepository commitRepo,
      OrgRepository orgRepo,
      WeekStateMachine stateMachine,
      MaterializedRollupJob job,
      ObjectMapper json,
      Clock clock) {
    this.cacheRepo = cacheRepo;
    this.teamRepo = teamRepo;
    this.userRepo = userRepo;
    this.weekRepo = weekRepo;
    this.commitRepo = commitRepo;
    this.orgRepo = orgRepo;
    this.stateMachine = stateMachine;
    this.job = job;
    this.json = json;
    this.clock = clock;
  }

  /**
   * Pageable team-rollup feed for the manager dashboard. Returns rows from {@code
   * team_rollup_cache}; on a cache miss we transparently recompute the row inline so the dashboard
   * stays functional. If a cached row exists but is older than {@link #STALE_CACHE_AFTER}, returns
   * a {@link StaleCacheException} that the controller maps to a 503 problem detail.
   */
  @Transactional
  public Page<ManagerDtos.TeamRollupRow> teamRollup(User caller, Pageable pageable) {
    List<Team> teamsInScope = teamsForCaller(caller);
    if (teamsInScope.isEmpty()) {
      return new PageImpl<>(List.of(), pageable, 0);
    }
    LocalDate weekStart = currentWeekStart(caller);

    List<ManagerDtos.TeamRollupRow> all = new ArrayList<>();
    for (Team team : teamsInScope) {
      TeamRollupCache row =
          cacheRepo
              .findByIdTeamIdAndIdWeekStart(team.getId(), weekStart)
              .orElseGet(() -> job.recomputeForTeamWeek(team.getId(), weekStart));
      if (Duration.between(row.getComputedAt(), Instant.now(clock)).compareTo(STALE_CACHE_AFTER)
          > 0) {
        throw new StaleCacheException();
      }
      Object payload;
      try {
        payload = json.readTree(row.getPayloadJson());
      } catch (JsonProcessingException e) {
        throw new IllegalStateException(
            "Corrupted team_rollup_cache.payload_json for team " + team.getId(), e);
      }
      all.add(
          new ManagerDtos.TeamRollupRow(
              team.getId(), row.getWeekStart(), payload, row.getComputedAt()));
    }
    // Page slice — Spring's PageImpl handles toFlux/total correctly for a small in-memory list.
    int from = (int) pageable.getOffset();
    int to = Math.min(from + pageable.getPageSize(), all.size());
    if (from > all.size()) {
      return new PageImpl<>(List.of(), pageable, all.size());
    }
    return new PageImpl<>(all.subList(from, to), pageable, all.size());
  }

  /** {@code GET /manager/team/{userId}/week/current} — read-only view, never creates a Week row. */
  @Transactional(readOnly = true)
  public WeekDtos.WeekDto teamMemberCurrentWeek(String userId) {
    User target =
        userRepo.findById(userId).orElseThrow(() -> new NotFoundException("User", userId));
    Org org =
        orgRepo
            .findById(target.getOrgId())
            .orElseThrow(() -> new NotFoundException("Org", target.getOrgId()));
    LocalDate weekStart = stateMachine.currentWeekStart(org);
    Week week =
        weekRepo
            .findByUserIdAndWeekStart(target.getId(), weekStart)
            // Manager view is non-mutating: synthesise a placeholder Week instead of inserting.
            .orElseGet(
                () -> {
                  Week placeholder = new Week(target.getId(), target.getOrgId(), weekStart);
                  return placeholder;
                });
    var commits =
        week.getId() == null
            ? List.<com.throughline.weeklycommit.domain.Commit>of()
            : commitRepo.findAllByWeekIdOrderByDisplayOrderAsc(week.getId());
    return new WeekDtos.WeekDto(
        week.getId(),
        week.getUserId(),
        week.getOrgId(),
        week.getWeekStart(),
        week.getState().name(),
        week.getLockedAt(),
        week.getReconciledAt(),
        commits.stream()
            .map(com.throughline.weeklycommit.application.week.WeekService::toCommitDto)
            .toList());
  }

  /** Phase-4 contract: digest is always null until Phase 5c wires T5. */
  public ManagerDtos.DigestEnvelope currentDigest() {
    return new ManagerDtos.DigestEnvelope(null, "AWAITING_AI");
  }

  /** Phase-4 contract: regenerate is recorded but returns digest=null + a queued state. */
  public ManagerDtos.DigestRegenerateResponse regenerateDigest() {
    return new ManagerDtos.DigestRegenerateResponse(
        null,
        "QUEUED",
        "Digest regeneration is queued; T5 wires the synchronous path in Phase 5c.");
  }

  /** Phase-4 contract: alignment risks list is empty (Phase 5c populates from T6). */
  public List<JsonNode> alignmentRisks() {
    return List.of();
  }

  // ---------------------------------------------------------------------------------------------

  private List<Team> teamsForCaller(User caller) {
    if (caller.getRole() == Role.ADMIN) {
      return teamRepo.findAll().stream()
          .filter(t -> caller.getOrgId().equals(t.getOrgId()))
          .toList();
    }
    // Walk reports + immediate team. ADMIN bypass handled above; ICs and managers see at minimum
    // their own team.
    List<Team> result = new ArrayList<>();
    if (caller.getTeamId() != null) {
      teamRepo.findById(caller.getTeamId()).ifPresent(result::add);
    }
    if (caller.getRole() == Role.MANAGER) {
      // Add every team whose manager chain includes the caller.
      for (Team t : teamRepo.findAll()) {
        if (!caller.getOrgId().equals(t.getOrgId())) continue;
        if (t.getManagerId() != null && managerChainContains(t.getManagerId(), caller.getId())) {
          if (!result.contains(t)) result.add(t);
        }
      }
    }
    return result;
  }

  private boolean managerChainContains(String startUserId, String callerId) {
    String cursor = startUserId;
    int depth = 0;
    while (cursor != null && depth++ < 16) {
      if (cursor.equals(callerId)) return true;
      User u = userRepo.findById(cursor).orElse(null);
      if (u == null) return false;
      cursor = u.getManagerId();
    }
    return false;
  }

  private LocalDate currentWeekStart(User caller) {
    Org org =
        orgRepo
            .findById(caller.getOrgId())
            .orElseThrow(() -> new NotFoundException("Org", caller.getOrgId()));
    return stateMachine.currentWeekStart(org);
  }

  /** Thrown when a cache row is older than {@link #STALE_CACHE_AFTER}; mapped to 503 by handler. */
  public static class StaleCacheException extends RuntimeException {
    public StaleCacheException() {
      super("team_rollup_cache row is older than 7 days; recomputing");
    }
  }
}
