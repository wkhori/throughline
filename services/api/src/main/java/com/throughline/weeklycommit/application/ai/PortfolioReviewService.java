package com.throughline.weeklycommit.application.ai;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.throughline.weeklycommit.application.lifecycle.WeekLockedEvent;
import com.throughline.weeklycommit.domain.AIInsight;
import com.throughline.weeklycommit.domain.AIInsightKind;
import com.throughline.weeklycommit.domain.Commit;
import com.throughline.weeklycommit.domain.CommitCategory;
import com.throughline.weeklycommit.domain.CommitPriority;
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
 * T3 — Portfolio Review (Sonnet). Triggered AFTER_COMMIT on {@link WeekLockedEvent}; persists an
 * {@link AIInsight} keyed to the locked week.
 *
 * <p>If Anthropic times out, fails after retries, or refuses with a budget cap, we persist a {@code
 * DeterministicFallback} review (counts only, marked {@code model='deterministic'}) so the UI never
 * blocks waiting on AI.
 */
@Service
public class PortfolioReviewService {

  private static final Logger LOG = LoggerFactory.getLogger(PortfolioReviewService.class);
  private static final ObjectMapper MAPPER = new ObjectMapper();

  private final AiCopilotService aiService;
  private final CommitRepository commitRepository;
  private final AIInsightRepository insightRepository;

  public PortfolioReviewService(
      AiCopilotService aiService,
      CommitRepository commitRepository,
      AIInsightRepository insightRepository) {
    this.aiService = aiService;
    this.commitRepository = commitRepository;
    this.insightRepository = insightRepository;
  }

  /** Idempotently fetch the most-recent T3 insight for a week. */
  @Transactional(readOnly = true)
  public Optional<AIInsight> findLatestForWeek(String weekId) {
    return insightRepository.findMostRecent("week", weekId, AIInsightKind.T3_PORTFOLIO);
  }

  /**
   * AFTER_COMMIT consumer of {@link WeekLockedEvent}. Runs in a background thread (via
   * {@code @Async}) so the user's lock POST doesn't block on Anthropic's 8s sync budget.
   */
  @Async("notificationExecutor")
  @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public void onWeekLocked(WeekLockedEvent event) {
    if (insightRepository
        .findMostRecent("week", event.weekId(), AIInsightKind.T3_PORTFOLIO)
        .isPresent()) {
      return;
    }
    runReview(event.weekId(), event.userId(), event.orgId());
  }

  /**
   * Generate the T3 review now (used by an explicit retry endpoint or test). Persists the result
   * and returns it; if the AI call fails or refuses, persists + returns a deterministic skeleton.
   */
  @Transactional
  public AIInsight runReview(String weekId, String userId, String orgId) {
    List<Commit> commits = commitRepository.findAllByWeekIdOrderByDisplayOrderAsc(weekId);
    String userPrompt = serializeInput(weekId, commits);
    try {
      return aiService.invoke(
          AIInsightKind.T3_PORTFOLIO,
          AnthropicModel.SONNET,
          PromptTemplates.T3_NAME,
          PromptTemplates.T3_SYSTEM,
          userPrompt,
          1500,
          "week",
          weekId,
          userId,
          orgId);
    } catch (AnthropicException | AnthropicInvalidJsonException | BudgetExhaustedException e) {
      LOG.warn("t3_portfolio_fallback weekId={} cause={}", weekId, e.getClass().getSimpleName());
      return persistFallback(weekId, orgId, commits);
    }
  }

  private AIInsight persistFallback(String weekId, String orgId, List<Commit> commits) {
    String payloadJson = deterministicReview(commits);
    AIInsight row =
        new AIInsight(
            orgId,
            AIInsightKind.T3_PORTFOLIO,
            "week",
            weekId,
            "deterministic",
            payloadJson,
            "deterministic-" + weekId);
    return insightRepository.save(row);
  }

  /** Deterministic skeleton review — counts only. Marks model='deterministic'. */
  String deterministicReview(List<Commit> commits) {
    int total = commits.size();
    Map<CommitCategory, Integer> byCategory = new HashMap<>();
    Map<CommitPriority, Integer> byPriority = new HashMap<>();
    Map<String, Integer> bySO = new HashMap<>();
    for (Commit c : commits) {
      byCategory.merge(c.getCategory(), 1, Integer::sum);
      byPriority.merge(c.getPriority(), 1, Integer::sum);
      if (c.getSupportingOutcomeId() != null) {
        bySO.merge(c.getSupportingOutcomeId(), 1, Integer::sum);
      }
    }
    int strategic = byCategory.getOrDefault(CommitCategory.STRATEGIC, 0);
    int operational = byCategory.getOrDefault(CommitCategory.OPERATIONAL, 0);
    int reactive = byCategory.getOrDefault(CommitCategory.REACTIVE, 0);
    String topSo =
        bySO.entrySet().stream()
            .max(Map.Entry.comparingByValue())
            .map(Map.Entry::getKey)
            .orElse(null);
    int topSoCount = topSo == null ? 0 : bySO.get(topSo);
    double topSoShare = total == 0 ? 0 : (double) topSoCount / total;

    ObjectNode root = MAPPER.createObjectNode();
    root.put(
        "headline",
        total == 0
            ? "Locked an empty week — no portfolio shape to review."
            : "Locked " + total + " commits across " + bySO.size() + " outcomes.");
    root.put("overallSeverity", topSoShare > 0.5 ? "warning" : "info");

    ArrayNode findings = root.putArray("findings");
    if (topSoShare > 0.5) {
      ObjectNode f = findings.addObject();
      f.put("dimension", "outcome_concentration");
      f.put("severity", "warning");
      f.put(
          "message",
          "One outcome received "
              + (int) Math.round(topSoShare * 100)
              + "% of commits — investigate concentration risk.");
      ArrayNode ids = f.putArray("affectedEntityIds");
      ids.add(topSo);
    }
    ObjectNode chess = root.putObject("chessGridSummary");
    chess.put("strategicShare", total == 0 ? 0.0 : (double) strategic / total);
    chess.put("operationalShare", total == 0 ? 0.0 : (double) operational / total);
    chess.put("reactiveShare", total == 0 ? 0.0 : (double) reactive / total);
    chess.put("mustCount", byPriority.getOrDefault(CommitPriority.MUST, 0));
    chess.put("shouldCount", byPriority.getOrDefault(CommitPriority.SHOULD, 0));
    chess.put("couldCount", byPriority.getOrDefault(CommitPriority.COULD, 0));

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
      o.put("carryForwardWeeks", c.getCarryForwardWeeks());
    }
    try {
      return MAPPER.writeValueAsString(root);
    } catch (JsonProcessingException e) {
      throw new IllegalStateException(e);
    }
  }
}
