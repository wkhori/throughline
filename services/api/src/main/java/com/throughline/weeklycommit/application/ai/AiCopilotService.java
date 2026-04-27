package com.throughline.weeklycommit.application.ai;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.throughline.weeklycommit.domain.AIInsight;
import com.throughline.weeklycommit.domain.AIInsightKind;
import com.throughline.weeklycommit.domain.repo.AIInsightRepository;
import com.throughline.weeklycommit.infrastructure.ai.AIInsightCache;
import com.throughline.weeklycommit.infrastructure.ai.AnthropicClient;
import com.throughline.weeklycommit.infrastructure.ai.AnthropicCostGuard;
import com.throughline.weeklycommit.infrastructure.ai.AnthropicException;
import com.throughline.weeklycommit.infrastructure.ai.AnthropicInvalidJsonException;
import com.throughline.weeklycommit.infrastructure.ai.AnthropicModel;
import com.throughline.weeklycommit.infrastructure.ai.AnthropicRequest;
import com.throughline.weeklycommit.infrastructure.ai.AnthropicResponse;
import com.throughline.weeklycommit.infrastructure.ai.CostCalculator;
import com.throughline.weeklycommit.infrastructure.ai.InputHash;
import com.throughline.weeklycommit.infrastructure.ai.prompts.PromptTemplates;
import java.math.BigDecimal;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Orchestrates an Anthropic call: cost guard preflight → 60s inputHash cache lookup → real call →
 * persist {@link AIInsight} → accrue org spend. Used by the T1/T2/T7 controller endpoints in Phase
 * 5a; T3/T4/T5/T6 service entry points layer on top of this in 5b/5c.
 */
@Service
public class AiCopilotService {

  private static final Logger LOG = LoggerFactory.getLogger(AiCopilotService.class);
  private static final ObjectMapper MAPPER = new ObjectMapper();

  private final AnthropicClient anthropicClient;
  private final AnthropicCostGuard costGuard;
  private final AIInsightCache cache;
  private final AIInsightRepository insightRepository;

  public AiCopilotService(
      AnthropicClient anthropicClient,
      AnthropicCostGuard costGuard,
      AIInsightCache cache,
      AIInsightRepository insightRepository) {
    this.anthropicClient = anthropicClient;
    this.costGuard = costGuard;
    this.cache = cache;
    this.insightRepository = insightRepository;
  }

  /** T1 — Outcome Suggestion (Haiku). */
  public AIInsight suggestOutcome(SuggestOutcomeInput input, String userId, String orgId) {
    String userPrompt = serialize(input);
    return invoke(
        AIInsightKind.T1_SUGGESTION,
        AnthropicModel.HAIKU,
        PromptTemplates.T1_NAME,
        PromptTemplates.T1_SYSTEM,
        userPrompt,
        300,
        "user",
        userId,
        userId,
        orgId);
  }

  /** T2 — Drift Warning (Haiku). */
  public AIInsight checkDrift(DriftCheckInput input, String userId, String orgId) {
    String userPrompt = serialize(input);
    return invoke(
        AIInsightKind.T2_DRIFT,
        AnthropicModel.HAIKU,
        PromptTemplates.T2_NAME,
        PromptTemplates.T2_SYSTEM,
        userPrompt,
        300,
        "commit",
        input.commitId(),
        userId,
        orgId);
  }

  /** T7 — Commit Quality Lint (Haiku). */
  public AIInsight qualityLint(QualityLintInput input, String userId, String orgId) {
    String userPrompt = serialize(input);
    return invoke(
        AIInsightKind.T7_QUALITY,
        AnthropicModel.HAIKU,
        PromptTemplates.T7_NAME,
        PromptTemplates.T7_SYSTEM,
        userPrompt,
        300,
        "commit",
        input.commitId(),
        userId,
        orgId);
  }

  /**
   * Generic Anthropic invocation. Public so Phase 5b/5c services can layer T3/T4/T5/T6 on top.
   * Caller supplies the entity (type/id) the resulting {@link AIInsight} is associated with.
   */
  @Transactional
  public AIInsight invoke(
      AIInsightKind kind,
      AnthropicModel model,
      String templateName,
      String systemPrompt,
      String userPrompt,
      int maxTokens,
      String entityType,
      String entityId,
      String userId,
      String orgId) {
    costGuard.preflight(kind, userId, orgId);

    String inputHash = InputHash.of(userPrompt);
    Optional<AIInsight> cached = cache.findFresh(kind, inputHash);
    if (cached.isPresent()) {
      AIInsight prior = cached.get();
      AIInsight hit =
          new AIInsight(
              orgId,
              kind,
              entityType,
              entityId,
              "cache:" + prior.getModel(),
              prior.getPayloadJson(),
              inputHash);
      hit.setLatencyMs(0);
      hit.setCostCents(BigDecimal.ZERO);
      AIInsight saved = insightRepository.save(hit);
      LOG.debug(
          "ai_call_cache_hit kind={} userId={} inputHash={} reusedInsightId={}",
          kind,
          userId,
          inputHash,
          prior.getId());
      return saved;
    }

    AnthropicResponse response;
    try {
      response =
          anthropicClient.send(
              new AnthropicRequest(model, templateName, kind, systemPrompt, userPrompt, maxTokens));
    } catch (AnthropicInvalidJsonException invalid) {
      LOG.warn(
          "ai_call_invalid_json kind={} userId={} bodyHead={}", kind, userId, invalid.getRawBody());
      throw invalid;
    } catch (AnthropicException ae) {
      LOG.warn(
          "ai_call_failed kind={} userId={} status={} msg={}",
          kind,
          userId,
          ae.getStatusCode(),
          ae.getMessage());
      throw ae;
    }

    BigDecimal cents =
        CostCalculator.cents(
            model, response.tokensInput(), response.tokensOutput(), response.tokensCacheRead());

    AIInsight row =
        new AIInsight(
            orgId, kind, entityType, entityId, response.model(), response.contentJson(), inputHash);
    row.setTokensInput(response.tokensInput());
    row.setTokensOutput(response.tokensOutput());
    row.setTokensCacheRead(response.tokensCacheRead());
    row.setLatencyMs(response.latencyMs());
    row.setCostCents(cents);
    AIInsight saved = insightRepository.save(row);
    costGuard.accrueOrgSpend(orgId, cents);
    LOG.info(
        "ai_call_ok kind={} userId={} model={} tokensIn={} tokensOut={} cacheRead={} costCents={}"
            + " latencyMs={}",
        kind,
        userId,
        response.model(),
        response.tokensInput(),
        response.tokensOutput(),
        response.tokensCacheRead(),
        cents,
        response.latencyMs());
    return saved;
  }

  private String serialize(Object value) {
    try {
      return MAPPER.writeValueAsString(value);
    } catch (JsonProcessingException e) {
      throw new IllegalStateException("Failed to serialize AI input", e);
    }
  }

  // ---------- Input records (mirror docs/ai-copilot-spec.md §T1/§T2/§T7) ----------

  public record OutcomeCandidate(
      String supportingOutcomeId,
      String title,
      String parentOutcomeTitle,
      String parentDOTitle,
      String parentRallyCryTitle) {}

  public record SuggestOutcomeInput(
      String draftCommitText,
      String userId,
      String teamId,
      java.util.List<OutcomeCandidate> candidates,
      java.util.List<Map<String, String>> recentUserCommits) {}

  public record LinkedOutcome(
      String supportingOutcomeId,
      String title,
      String parentOutcomeTitle,
      String parentDOTitle,
      String metricStatement) {}

  public record AlternativeOutcome(String supportingOutcomeId, String title) {}

  public record DriftCheckInput(
      String commitId,
      String commitText,
      LinkedOutcome linkedOutcome,
      java.util.List<AlternativeOutcome> alternativeOutcomes) {}

  public record QualityLintInput(
      String commitId,
      String commitText,
      String category,
      String priority,
      String supportingOutcomeTitle) {}
}
