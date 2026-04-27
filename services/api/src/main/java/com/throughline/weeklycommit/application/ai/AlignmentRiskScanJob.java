package com.throughline.weeklycommit.application.ai;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.throughline.weeklycommit.domain.AIInsight;
import com.throughline.weeklycommit.domain.AIInsightKind;
import com.throughline.weeklycommit.domain.AlignmentRisk;
import com.throughline.weeklycommit.domain.AlignmentRiskRule;
import com.throughline.weeklycommit.domain.AlignmentRiskSeverity;
import com.throughline.weeklycommit.domain.NotificationChannelKind;
import com.throughline.weeklycommit.domain.NotificationKind;
import com.throughline.weeklycommit.domain.Org;
import com.throughline.weeklycommit.domain.repo.AlignmentRiskRepository;
import com.throughline.weeklycommit.domain.repo.CommitRepository;
import com.throughline.weeklycommit.domain.repo.OrgRepository;
import com.throughline.weeklycommit.infrastructure.ai.AnthropicException;
import com.throughline.weeklycommit.infrastructure.ai.AnthropicInvalidJsonException;
import com.throughline.weeklycommit.infrastructure.ai.AnthropicModel;
import com.throughline.weeklycommit.infrastructure.ai.BudgetExhaustedException;
import com.throughline.weeklycommit.infrastructure.ai.prompts.PromptTemplates;
import com.throughline.weeklycommit.infrastructure.notifications.NotificationDispatcher;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.IsoFields;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * T6 — Alignment-Risk Alert (Haiku). Hourly background scan that detects rule matches and persists
 * an {@link AlignmentRisk} per match, deduped by P5's algorithm. HIGH-severity risks emit a
 * NotificationEvent of kind=ALIGNMENT_RISK.
 *
 * <p>Three rules:
 *
 * <ul>
 *   <li>{@code LONG_CARRY_FORWARD} — any commit with {@code carryForwardWeeks >= 3}.
 *   <li>{@code STARVED_OUTCOME} — placeholder; full materialised-rollup query lives in 5d.
 *   <li>{@code SINGLE_OUTCOME_CONCENTRATION} — placeholder; same.
 * </ul>
 */
@Service
public class AlignmentRiskScanJob {

  private static final Logger LOG = LoggerFactory.getLogger(AlignmentRiskScanJob.class);
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final Duration DEDUPE_WINDOW = Duration.ofDays(7);

  private final AiCopilotService aiService;
  private final CommitRepository commitRepository;
  private final AlignmentRiskRepository alignmentRiskRepository;
  private final OrgRepository orgRepository;
  private final NotificationDispatcher dispatcher;
  private final Clock clock;

  @PersistenceContext private EntityManager em;

  public AlignmentRiskScanJob(
      AiCopilotService aiService,
      CommitRepository commitRepository,
      AlignmentRiskRepository alignmentRiskRepository,
      OrgRepository orgRepository,
      NotificationDispatcher dispatcher,
      Clock clock) {
    this.aiService = aiService;
    this.commitRepository = commitRepository;
    this.alignmentRiskRepository = alignmentRiskRepository;
    this.orgRepository = orgRepository;
    this.dispatcher = dispatcher;
    this.clock = clock;
  }

  @Scheduled(cron = "0 0 * * * *")
  @Transactional
  public void hourly() {
    int created = 0;
    for (Org org : orgRepository.findAll()) {
      created += scanOrg(org);
    }
    if (created > 0) LOG.info("t6_scan_completed risksCreated={}", created);
  }

  /** Public for tests: returns the number of new risks created. */
  @Transactional
  public int scanOrg(Org org) {
    int created = 0;
    LocalDate weekStart = LocalDate.now(clock.withZone(java.time.ZoneId.of(org.getTimezone())));
    @SuppressWarnings("unchecked")
    List<Object[]> longCarryRows =
        em.createNativeQuery(
                "SELECT c.id, c.carry_forward_weeks, c.priority FROM \"commit\" c, week w, app_user"
                    + " u WHERE c.week_id = w.id AND w.user_id = u.id AND u.org_id = :orgId AND"
                    + " c.carry_forward_weeks >= 3")
            .setParameter("orgId", org.getId())
            .getResultList();

    for (Object[] row : longCarryRows) {
      String commitId = (String) row[0];
      int weeks = ((Number) row[1]).intValue();
      String priority = (String) row[2];
      AlignmentRiskSeverity severity = severityForCarryForward(weeks, priority);
      String dedupeKey =
          dedupeKey(AlignmentRiskRule.LONG_CARRY_FORWARD, "commit", commitId, severity, weekStart);
      if (recentlyDeduped(dedupeKey, severity)) continue;
      AlignmentRisk risk =
          new AlignmentRisk(
              org.getId(),
              AlignmentRiskRule.LONG_CARRY_FORWARD,
              severity,
              "commit",
              commitId,
              weekStart,
              dedupeKey);
      // T6 LLM call: best-effort structured payload
      AIInsight insight =
          generateInsight(org.getId(), commitId, AlignmentRiskRule.LONG_CARRY_FORWARD, severity);
      if (insight != null) risk.setAiInsightId(insight.getId());
      alignmentRiskRepository.save(risk);
      created++;
      if (severity == AlignmentRiskSeverity.HIGH) emitSlackAlert(org, risk, insight);
    }
    return created;
  }

  private AIInsight generateInsight(
      String orgId, String entityId, AlignmentRiskRule rule, AlignmentRiskSeverity severity) {
    ObjectNode input = MAPPER.createObjectNode();
    input.put("rule", rule.name());
    input.put("entityId", entityId);
    input.put("severity", severity.name());
    String userPrompt;
    try {
      userPrompt = MAPPER.writeValueAsString(input);
    } catch (JsonProcessingException e) {
      return null;
    }
    try {
      return aiService.invoke(
          AIInsightKind.T6_ALERT,
          AnthropicModel.HAIKU,
          PromptTemplates.T6_NAME,
          PromptTemplates.T6_SYSTEM,
          userPrompt,
          400,
          "alignment_risk",
          entityId,
          "system",
          orgId);
    } catch (AnthropicException | AnthropicInvalidJsonException | BudgetExhaustedException e) {
      LOG.warn(
          "t6_llm_skipped rule={} entityId={} cause={}",
          rule,
          entityId,
          e.getClass().getSimpleName());
      return null;
    }
  }

  private void emitSlackAlert(Org org, AlignmentRisk risk, AIInsight insight) {
    ObjectNode payload = MAPPER.createObjectNode();
    payload.put("riskId", risk.getId());
    payload.put("rule", risk.getRule().name());
    payload.put("severity", risk.getSeverity().name());
    payload.put("entityType", risk.getEntityType());
    payload.put("entityId", risk.getEntityId());
    if (insight != null) {
      payload.put(
          "slackMessage",
          "*Alignment risk* — "
              + risk.getRule().name()
              + " ("
              + risk.getSeverity()
              + ") on "
              + risk.getEntityType()
              + " "
              + risk.getEntityId()
              + ". See <DASHBOARD_URL>.");
    } else {
      payload.put(
          "slackMessage",
          "*Alignment risk* — "
              + risk.getRule().name()
              + " ("
              + risk.getSeverity()
              + "). See <DASHBOARD_URL>.");
    }
    String json;
    try {
      json = MAPPER.writeValueAsString(payload);
    } catch (JsonProcessingException e) {
      return;
    }
    dispatcher.dispatch(
        org.getId(),
        NotificationKind.ALIGNMENT_RISK,
        NotificationChannelKind.SLACK,
        "broadcast",
        json);
  }

  private boolean recentlyDeduped(String dedupeKey, AlignmentRiskSeverity severity) {
    Instant since = clock.instant().minus(DEDUPE_WINDOW);
    List<AlignmentRisk> recent = alignmentRiskRepository.findByDedupeKeyWithin(dedupeKey, since);
    if (recent.isEmpty()) return false;
    AlignmentRisk top =
        recent.stream().max(Comparator.comparing(AlignmentRisk::getCreatedAt)).get();
    // Suppression unless severity escalates (P5 rule).
    return !severity.isHigherThan(top.getSeverity());
  }

  private AlignmentRiskSeverity severityForCarryForward(int weeks, String priority) {
    if (weeks >= 5) return AlignmentRiskSeverity.HIGH;
    if (weeks >= 4 || ("MUST".equals(priority) && weeks >= 3)) return AlignmentRiskSeverity.MEDIUM;
    return AlignmentRiskSeverity.LOW;
  }

  /**
   * P5: dedupeKey = sha1(rule + ':' + entityType + ':' + entityId + ':' + severity + ':' +
   * ISO_WEEK(weekStart)).
   */
  static String dedupeKey(
      AlignmentRiskRule rule,
      String entityType,
      String entityId,
      AlignmentRiskSeverity severity,
      LocalDate weekStart) {
    int isoWeek = weekStart.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR);
    int isoYear = weekStart.get(IsoFields.WEEK_BASED_YEAR);
    String raw =
        rule.name()
            + ":"
            + entityType
            + ":"
            + entityId
            + ":"
            + severity.name()
            + ":"
            + isoYear
            + "-W"
            + isoWeek;
    try {
      MessageDigest md = MessageDigest.getInstance("SHA-1");
      return HexFormat.of().formatHex(md.digest(raw.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException(e);
    }
  }
}
