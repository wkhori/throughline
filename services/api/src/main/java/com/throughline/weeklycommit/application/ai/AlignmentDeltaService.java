package com.throughline.weeklycommit.application.ai;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.throughline.weeklycommit.application.lifecycle.WeekReconciledEvent;
import com.throughline.weeklycommit.domain.AIInsight;
import com.throughline.weeklycommit.domain.AIInsightKind;
import com.throughline.weeklycommit.domain.Commit;
import com.throughline.weeklycommit.domain.ReconciliationOutcome;
import com.throughline.weeklycommit.domain.repo.AIInsightRepository;
import com.throughline.weeklycommit.domain.repo.CommitRepository;
import com.throughline.weeklycommit.infrastructure.ai.AnthropicException;
import com.throughline.weeklycommit.infrastructure.ai.AnthropicInvalidJsonException;
import com.throughline.weeklycommit.infrastructure.ai.AnthropicModel;
import com.throughline.weeklycommit.infrastructure.ai.BudgetExhaustedException;
import com.throughline.weeklycommit.infrastructure.ai.prompts.PromptTemplates;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * T4 — Alignment Delta (Sonnet). Triggered AFTER_COMMIT on {@link WeekReconciledEvent}; persists an
 * {@link AIInsight} keyed to the reconciled week.
 *
 * <p>P11: {@code priorCarryForwardWeeks} for the input is read from each commit's persisted {@code
 * carryForwardWeeks} which {@code ReconcileService} preserves on the original commit (it spawns a
 * child with {@code +1} but never mutates the parent's counter). Reading at AFTER_COMMIT is the
 * BEFORE-mutation value the spec requires.
 */
@Service
public class AlignmentDeltaService {

  private static final Logger LOG = LoggerFactory.getLogger(AlignmentDeltaService.class);
  private static final ObjectMapper MAPPER = new ObjectMapper();

  private final AiCopilotService aiService;
  private final CommitRepository commitRepository;
  private final AIInsightRepository insightRepository;

  public AlignmentDeltaService(
      AiCopilotService aiService,
      CommitRepository commitRepository,
      AIInsightRepository insightRepository) {
    this.aiService = aiService;
    this.commitRepository = commitRepository;
    this.insightRepository = insightRepository;
  }

  @Transactional(readOnly = true)
  public Optional<AIInsight> findLatestForWeek(String weekId) {
    return insightRepository.findMostRecent("week", weekId, AIInsightKind.T4_DELTA);
  }

  @Async("notificationExecutor")
  @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public void onWeekReconciled(WeekReconciledEvent event) {
    if (insightRepository
        .findMostRecent("week", event.weekId(), AIInsightKind.T4_DELTA)
        .isPresent()) {
      return;
    }
    runDelta(event.weekId(), event.userId(), event.orgId());
  }

  @Transactional
  public AIInsight runDelta(String weekId, String userId, String orgId) {
    List<Commit> commits = commitRepository.findAllByWeekIdOrderByDisplayOrderAsc(weekId);
    String userPrompt = serializeInput(weekId, commits);
    try {
      return aiService.invoke(
          AIInsightKind.T4_DELTA,
          AnthropicModel.SONNET,
          PromptTemplates.T4_NAME,
          PromptTemplates.T4_SYSTEM,
          userPrompt,
          1500,
          "week",
          weekId,
          userId,
          orgId);
    } catch (AnthropicException | AnthropicInvalidJsonException | BudgetExhaustedException e) {
      LOG.warn("t4_delta_fallback weekId={} cause={}", weekId, e.getClass().getSimpleName());
      return persistFallback(weekId, orgId, commits);
    }
  }

  private AIInsight persistFallback(String weekId, String orgId, List<Commit> commits) {
    String payloadJson = deterministicDelta(commits);
    AIInsight row =
        new AIInsight(
            orgId,
            AIInsightKind.T4_DELTA,
            "week",
            weekId,
            "deterministic",
            payloadJson,
            "deterministic-" + weekId);
    return insightRepository.save(row);
  }

  String deterministicDelta(List<Commit> commits) {
    int done = 0;
    int partial = 0;
    int notDone = 0;
    Map<String, Integer> doneBySO = new HashMap<>();
    Map<String, Integer> totalBySO = new HashMap<>();
    ArrayNode shipped = MAPPER.createArrayNode();
    ArrayNode slipped = MAPPER.createArrayNode();
    ArrayNode carryFwd = MAPPER.createArrayNode();

    for (Commit c : commits) {
      ReconciliationOutcome outcome = c.getReconciliationOutcome();
      if (outcome == null) continue;
      String soId = c.getSupportingOutcomeId();
      if (soId != null) totalBySO.merge(soId, 1, Integer::sum);
      switch (outcome) {
        case DONE -> {
          done++;
          if (soId != null) doneBySO.merge(soId, 1, Integer::sum);
          ObjectNode s = shipped.addObject();
          s.put("commitId", c.getId());
          s.put("parentOutcomeId", soId);
        }
        case PARTIAL -> {
          partial++;
          ObjectNode s = slipped.addObject();
          s.put("commitId", c.getId());
          s.put("slipCause", "unclear");
          s.put("evidence", "partial reconciliation");
          ObjectNode rec = carryFwd.addObject();
          rec.put("commitId", c.getId());
          rec.put("action", c.getCarryForwardWeeks() >= 2 ? "re-scope" : "carry_forward");
          rec.put("rationale", "partial — fallback heuristic");
        }
        case NOT_DONE -> {
          notDone++;
          ObjectNode s = slipped.addObject();
          s.put("commitId", c.getId());
          s.put("slipCause", "unclear");
          s.put("evidence", "not done");
          ObjectNode rec = carryFwd.addObject();
          rec.put("commitId", c.getId());
          rec.put("action", c.getCarryForwardWeeks() >= 2 ? "drop" : "carry_forward");
          rec.put("rationale", "not done — fallback heuristic");
        }
      }
    }

    ObjectNode root = MAPPER.createObjectNode();
    root.put(
        "summary",
        commits.size()
            + " commits — "
            + done
            + " done, "
            + partial
            + " partial, "
            + notDone
            + " not done.");
    root.set("shipped", shipped);
    root.set("slipped", slipped);
    root.set("carryForwardRecommendations", carryFwd);

    ArrayNode delta = root.putArray("outcomeTractionDelta");
    for (Map.Entry<String, Integer> e : totalBySO.entrySet()) {
      ObjectNode o = delta.addObject();
      o.put("supportingOutcomeId", e.getKey());
      int doneCount = doneBySO.getOrDefault(e.getKey(), 0);
      double share = (double) doneCount / e.getValue();
      o.put("delta", share >= 0.7 ? "gained" : share >= 0.4 ? "held" : "lost");
    }
    root.put("reasoning", "Counts-only fallback — Anthropic unavailable.");
    root.put("model", "deterministic");
    return root.toString();
  }

  String serializeInput(String weekId, List<Commit> commits) {
    ObjectNode root = MAPPER.createObjectNode();
    root.put("weekId", weekId);
    ArrayNode arr = root.putArray("commits");
    for (Commit c : commits) {
      ObjectNode o = arr.addObject();
      o.put("commitId", c.getId());
      o.put("text", c.getText());
      o.put("supportingOutcomeId", c.getSupportingOutcomeId());
      o.put("category", c.getCategory().name());
      o.put("priority", c.getPriority().name());
      // P11: carryForwardWeeks is the BEFORE-mutation value — ReconcileService preserves the
      // original commit's counter while spawning a child at +1. Reading post-commit returns
      // exactly what the spec asks for.
      o.put("priorCarryForwardWeeks", c.getCarryForwardWeeks());
      if (c.getReconciliationOutcome() != null) {
        o.put("outcome", c.getReconciliationOutcome().name());
      }
      if (c.getReconciliationNote() != null) {
        o.put("note", c.getReconciliationNote());
      }
    }
    try {
      return MAPPER.writeValueAsString(root);
    } catch (JsonProcessingException e) {
      throw new IllegalStateException(e);
    }
  }
}
