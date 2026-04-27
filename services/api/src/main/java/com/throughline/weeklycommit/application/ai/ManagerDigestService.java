package com.throughline.weeklycommit.application.ai;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.throughline.weeklycommit.domain.AIInsight;
import com.throughline.weeklycommit.domain.AIInsightKind;
import com.throughline.weeklycommit.domain.NotificationChannelKind;
import com.throughline.weeklycommit.domain.NotificationKind;
import com.throughline.weeklycommit.domain.Org;
import com.throughline.weeklycommit.domain.Role;
import com.throughline.weeklycommit.domain.User;
import com.throughline.weeklycommit.domain.repo.AIInsightRepository;
import com.throughline.weeklycommit.domain.repo.OrgRepository;
import com.throughline.weeklycommit.domain.repo.UserRepository;
import com.throughline.weeklycommit.infrastructure.ai.AnthropicException;
import com.throughline.weeklycommit.infrastructure.ai.AnthropicInvalidJsonException;
import com.throughline.weeklycommit.infrastructure.ai.AnthropicModel;
import com.throughline.weeklycommit.infrastructure.ai.BudgetExhaustedException;
import com.throughline.weeklycommit.infrastructure.ai.prompts.PromptTemplates;
import com.throughline.weeklycommit.infrastructure.notifications.NotificationDispatcher;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.Optional;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * T5 — Manager Weekly Digest (Sonnet). PRD §6 / docs/ai-copilot-spec.md §T5.
 *
 * <p>Triggered by:
 *
 * <ul>
 *   <li>{@code @Scheduled} cron at 16:00 manager-tz on Friday — fires for every MANAGER user in the
 *       org.
 *   <li>On-demand via {@code POST /api/v1/manager/digest/regenerate}, throttled to ≤2/day per
 *       manager via Caffeine.
 * </ul>
 *
 * <p>Every fire writes a {@link AIInsight} row + dispatches a {@code WEEKLY_DIGEST}
 * NotificationEvent. The partial unique index from V4 (P20/P38) makes dispatch idempotent per
 * (managerId, weekStart).
 */
@Service
public class ManagerDigestService {

  private static final Logger LOG = LoggerFactory.getLogger(ManagerDigestService.class);
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final int ON_DEMAND_PER_DAY_CAP = 2;

  private final AiCopilotService aiService;
  private final AIInsightRepository insightRepository;
  private final UserRepository userRepository;
  private final OrgRepository orgRepository;
  private final NotificationDispatcher dispatcher;
  private final Clock clock;

  private final Cache<String, Integer> onDemandCounter =
      Caffeine.newBuilder().expireAfterWrite(24, TimeUnit.HOURS).maximumSize(10_000).build();

  public ManagerDigestService(
      AiCopilotService aiService,
      AIInsightRepository insightRepository,
      UserRepository userRepository,
      OrgRepository orgRepository,
      NotificationDispatcher dispatcher,
      Clock clock) {
    this.aiService = aiService;
    this.insightRepository = insightRepository;
    this.userRepository = userRepository;
    this.orgRepository = orgRepository;
    this.dispatcher = dispatcher;
    this.clock = clock;
  }

  /** P17: latest digest insight for the manager (powers /manager/digest/current hero card). */
  @Transactional(readOnly = true)
  public Optional<AIInsight> findLatestDigestForManager(String managerId) {
    return insightRepository.findMostRecentDigestForManager(managerId);
  }

  /**
   * On-demand regenerate. Enforces ≤2/day per manager via Caffeine. Returns the persisted insight.
   */
  @Transactional
  public AIInsight regenerateOnDemand(User manager) {
    String key =
        manager.getId() + ":" + clock.instant().truncatedTo(java.time.temporal.ChronoUnit.DAYS);
    int prior = onDemandCounter.get(key, k -> 0);
    if (prior >= ON_DEMAND_PER_DAY_CAP) {
      throw new IllegalStateException(
          "Per-manager on-demand digest cap reached (" + ON_DEMAND_PER_DAY_CAP + "/day)");
    }
    onDemandCounter.put(key, prior + 1);
    return runDigest(manager);
  }

  /** Internal entry — runs the AI call (or fallback) and dispatches the notification. */
  @Transactional
  public AIInsight runDigest(User manager) {
    String userPrompt = serializeInput(manager);
    AIInsight insight;
    try {
      insight =
          aiService.invoke(
              AIInsightKind.T5_DIGEST,
              AnthropicModel.SONNET,
              PromptTemplates.T5_NAME,
              PromptTemplates.T5_SYSTEM,
              userPrompt,
              2000,
              "user",
              manager.getId(),
              manager.getId(),
              manager.getOrgId());
    } catch (AnthropicException | AnthropicInvalidJsonException | BudgetExhaustedException e) {
      LOG.warn(
          "t5_digest_fallback managerId={} cause={}",
          manager.getId(),
          e.getClass().getSimpleName());
      insight = persistFallback(manager);
    }
    dispatchSlack(manager, insight);
    return insight;
  }

  private AIInsight persistFallback(User manager) {
    String payloadJson = deterministicDigest(manager);
    AIInsight row =
        new AIInsight(
            manager.getOrgId(),
            AIInsightKind.T5_DIGEST,
            "user",
            manager.getId(),
            "deterministic",
            payloadJson,
            "deterministic-" + manager.getId() + "-" + currentWeekStart(manager));
    return insightRepository.save(row);
  }

  String deterministicDigest(User manager) {
    ObjectNode root = MAPPER.createObjectNode();
    root.put(
        "alignmentHeadline",
        "Weekly digest unavailable — Anthropic offline. Manual rollup in dashboard.");
    root.putArray("starvedOutcomes");
    root.putArray("driftExceptions");
    root.putArray("longCarryForwards");
    root.putArray("drillDowns");
    root.put(
        "slackMessage", "*Weekly digest unavailable* — see <DASHBOARD_URL> for the live rollup.");
    root.put("reasoning", "Deterministic skeleton — Anthropic unavailable.");
    root.put("model", "deterministic");
    return root.toString();
  }

  private void dispatchSlack(User manager, AIInsight insight) {
    ObjectNode payload = MAPPER.createObjectNode();
    payload.put("weekStart", currentWeekStart(manager).toString());
    payload.put("managerId", manager.getId());
    payload.put("insightId", insight.getId());
    payload.set("aiPayload", parse(insight.getPayloadJson()));
    payload.put("slackMessage", parse(insight.getPayloadJson()).path("slackMessage").asText(""));
    String payloadJson;
    try {
      payloadJson = MAPPER.writeValueAsString(payload);
    } catch (JsonProcessingException e) {
      throw new IllegalStateException(e);
    }
    dispatcher.dispatch(
        manager.getOrgId(),
        NotificationKind.WEEKLY_DIGEST,
        NotificationChannelKind.SLACK,
        manager.getId(),
        payloadJson);
  }

  /**
   * Monday 09:00 cron — PRD §12 Phase 6. Spec docs/ai-copilot-spec.md §T5 originally said Friday
   * 16:00; PRD/Phase 6 plan reset it to Monday 09:00 so the digest lands at the start of the
   * manager's planning week (after all reports' Friday reconciliations).
   */
  @Scheduled(cron = "0 0 9 ? * MON")
  @Transactional
  public void weeklyDigestCron() {
    var managers =
        userRepository.findAll().stream().filter(u -> u.getRole() == Role.MANAGER).toList();
    LOG.info("t5_digest_cron managers={}", managers.size());
    for (User m : managers) {
      try {
        runDigest(m);
      } catch (Exception ex) {
        LOG.error("t5_digest_cron_error managerId={} err={}", m.getId(), ex.getMessage());
      }
    }
  }

  private LocalDate currentWeekStart(User manager) {
    Org org = orgRepository.findById(manager.getOrgId()).orElse(null);
    ZoneId tz = org == null ? ZoneId.of("UTC") : ZoneId.of(org.getTimezone());
    DayOfWeek startDay =
        org == null ? DayOfWeek.MONDAY : DayOfWeek.valueOf(org.getWeekStartDayOfWeek().name());
    return ZonedDateTime.now(clock.withZone(tz))
        .toLocalDate()
        .with(TemporalAdjusters.previousOrSame(startDay));
  }

  private String serializeInput(User manager) {
    ObjectNode root = MAPPER.createObjectNode();
    root.put("managerId", manager.getId());
    root.put("orgId", manager.getOrgId());
    root.put("weekStart", currentWeekStart(manager).toString());
    // The full per-report rollup would be computed from team_rollup_cache here. Keeping the prompt
    // input minimal for the demo so the deterministic + LLM paths share shape.
    ArrayNode reports = root.putArray("reports");
    var directs =
        userRepository.findAll().stream()
            .filter(u -> manager.getId().equals(u.getManagerId()))
            .toList();
    for (User d : directs) {
      ObjectNode r = reports.addObject();
      r.put("userId", d.getId());
      r.put("displayName", d.getDisplayName());
      r.put("email", d.getEmail());
    }
    try {
      return MAPPER.writeValueAsString(root);
    } catch (JsonProcessingException e) {
      throw new IllegalStateException(e);
    }
  }

  private com.fasterxml.jackson.databind.JsonNode parse(String s) {
    try {
      return MAPPER.readTree(s);
    } catch (JsonProcessingException e) {
      return MAPPER.createObjectNode();
    }
  }
}
