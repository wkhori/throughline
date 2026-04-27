package com.throughline.weeklycommit.application.manager;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.throughline.weeklycommit.application.CurrentUserResolver;
import com.throughline.weeklycommit.application.ai.ManagerDigestService;
import com.throughline.weeklycommit.application.lifecycle.WeekStateMachine;
import com.throughline.weeklycommit.domain.AIInsight;
import com.throughline.weeklycommit.domain.AlignmentRisk;
import com.throughline.weeklycommit.domain.Org;
import com.throughline.weeklycommit.domain.Role;
import com.throughline.weeklycommit.domain.Team;
import com.throughline.weeklycommit.domain.TeamRollupCache;
import com.throughline.weeklycommit.domain.User;
import com.throughline.weeklycommit.domain.Week;
import com.throughline.weeklycommit.domain.repo.AlignmentRiskRepository;
import com.throughline.weeklycommit.domain.repo.CommitRepository;
import com.throughline.weeklycommit.domain.repo.NotificationEventRepository;
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
  private final ManagerDigestService digestService;
  private final AlignmentRiskRepository alignmentRiskRepo;
  private final CurrentUserResolver currentUser;
  private final NotificationEventRepository notificationRepo;

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
      Clock clock,
      ManagerDigestService digestService,
      AlignmentRiskRepository alignmentRiskRepo,
      CurrentUserResolver currentUser,
      NotificationEventRepository notificationRepo) {
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
    this.digestService = digestService;
    this.alignmentRiskRepo = alignmentRiskRepo;
    this.currentUser = currentUser;
    this.notificationRepo = notificationRepo;
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

  /**
   * P17: latest digest for the calling manager (hero card). On first GET after delivery, stamps the
   * matching {@code notification_event.viewed_at} so the {@code MetricsService} can compute
   * `avgManagerDigestViewMinutesAfterDeliver` (P1).
   */
  @Transactional
  public ManagerDtos.DigestEnvelope currentDigest() {
    User caller = currentUser.requireCurrentUser();
    notificationRepo
        .findLatestSentDigest(caller.getId())
        .filter(e -> e.getViewedAt() == null)
        .ifPresent(
            event -> {
              event.setViewedAt(java.time.Instant.now(clock));
              notificationRepo.save(event);
            });
    return digestService
        .findLatestDigestForManager(caller.getId())
        .map(this::digestEnvelope)
        .orElseGet(() -> new ManagerDtos.DigestEnvelope(null, "AWAITING_AI"));
  }

  /** Synchronous on-demand digest regeneration. Throttled per manager via T5 service Caffeine. */
  @Transactional
  public ManagerDtos.DigestRegenerateResponse regenerateDigest() {
    User caller = currentUser.requireCurrentUser();
    AIInsight insight = digestService.regenerateOnDemand(caller);
    JsonNode payload = parse(insight.getPayloadJson());
    return new ManagerDtos.DigestRegenerateResponse(
        payload, insight.getModel().equals("deterministic") ? "FALLBACK" : "OK", "Generated");
  }

  /** Open alignment risks for the caller's org, newest first. */
  public List<JsonNode> alignmentRisks() {
    User caller = currentUser.requireCurrentUser();
    return alignmentRiskRepo
        .findByOrgIdAndAcknowledgedAtIsNullOrderByCreatedAtDesc(
            caller.getOrgId(), org.springframework.data.domain.Pageable.unpaged())
        .stream()
        .map(this::riskToJson)
        .toList();
  }

  /** Acknowledge an alignment risk (P14). Stamps acknowledgedAt + acknowledgedBy. */
  @Transactional
  public AlignmentRisk acknowledgeRisk(String riskId, User caller) {
    AlignmentRisk risk =
        alignmentRiskRepo
            .findById(riskId)
            .orElseThrow(() -> new NotFoundException("AlignmentRisk", riskId));
    if (!risk.getOrgId().equals(caller.getOrgId())) {
      throw new org.springframework.security.access.AccessDeniedException(
          "cross-org access blocked");
    }
    if (risk.getAcknowledgedAt() == null) {
      risk.acknowledge(caller.getId(), clock.instant());
      alignmentRiskRepo.save(risk);
    }
    return risk;
  }

  private ManagerDtos.DigestEnvelope digestEnvelope(AIInsight insight) {
    return new ManagerDtos.DigestEnvelope(
        parse(insight.getPayloadJson()),
        insight.getModel().equals("deterministic") ? "FALLBACK" : "OK");
  }

  private JsonNode parse(String s) {
    try {
      return json.readTree(s);
    } catch (JsonProcessingException e) {
      return json.createObjectNode();
    }
  }

  private JsonNode riskToJson(AlignmentRisk r) {
    var node = json.createObjectNode();
    node.put("id", r.getId());
    node.put("rule", r.getRule().name());
    node.put("severity", r.getSeverity().name());
    node.put("entityType", r.getEntityType());
    node.put("entityId", r.getEntityId());
    node.put("weekStart", r.getWeekStart().toString());
    node.put("createdAt", r.getCreatedAt().toString());
    return node;
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
