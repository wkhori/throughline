package com.throughline.weeklycommit.application.ai;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.MapperFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
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
import java.util.Comparator;
import java.util.List;
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

  /**
   * Deterministic JSON mapper for prompt construction. {@code SORT_PROPERTIES_ALPHABETICALLY} +
   * {@code ORDER_MAP_ENTRIES_BY_KEYS} are mandatory: without them, two requests with the same
   * logical input produce different prompts (record fields and {@code Map} entries iterate in
   * undefined order on the JVM), which silently breaks both the persistent cache key and the
   * stability evals. Combined with caller-side sorting of array fields (candidates / alternative
   * outcomes) this gives byte-for-byte stable canonical input JSON.
   */
  private static final ObjectMapper MAPPER =
      new ObjectMapper()
          .configure(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS, true)
          .configure(MapperFeature.SORT_PROPERTIES_ALPHABETICALLY, true);

  private static final Comparator<OutcomeCandidate> CANDIDATE_ORDER =
      Comparator.comparing(OutcomeCandidate::supportingOutcomeId);
  private static final Comparator<AlternativeOutcome> ALTERNATIVE_ORDER =
      Comparator.comparing(AlternativeOutcome::supportingOutcomeId);
  private static final Comparator<RecentCommit> RECENT_COMMIT_ORDER =
      Comparator.comparing(RecentCommit::supportingOutcomeId).thenComparing(RecentCommit::text);

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
    SuggestOutcomeInput canonical = canonicalize(input);
    String userPrompt = serialize(canonical);
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
    DriftCheckInput canonical = canonicalize(input);
    String userPrompt = serialize(canonical);
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
   * Returns a copy of {@code input} with {@code candidates} and {@code recentUserCommits} sorted by
   * stable keys so the canonical JSON is byte-for-byte identical for logically-equivalent inputs.
   * Caller-determined order would otherwise leak into the cache key.
   */
  static SuggestOutcomeInput canonicalize(SuggestOutcomeInput input) {
    List<OutcomeCandidate> sortedCandidates =
        input.candidates() == null
            ? List.of()
            : input.candidates().stream().sorted(CANDIDATE_ORDER).toList();
    List<RecentCommit> sortedRecent =
        input.recentUserCommits() == null
            ? List.of()
            : input.recentUserCommits().stream().sorted(RECENT_COMMIT_ORDER).toList();
    return new SuggestOutcomeInput(
        input.draftCommitText(), input.userId(), input.teamId(), sortedCandidates, sortedRecent);
  }

  /** Returns a copy of {@code input} with {@code alternativeOutcomes} sorted by ID. */
  static DriftCheckInput canonicalize(DriftCheckInput input) {
    List<AlternativeOutcome> sorted =
        input.alternativeOutcomes() == null
            ? List.of()
            : input.alternativeOutcomes().stream().sorted(ALTERNATIVE_ORDER).toList();
    return new DriftCheckInput(input.commitId(), input.commitText(), input.linkedOutcome(), sorted);
  }

  /**
   * Generic Anthropic invocation. Public so Phase 5b/5c services can layer T3/T4/T5/T6 on top.
   * Caller supplies the entity (type/id) the resulting {@link AIInsight} is associated with.
   *
   * <p>{@code noRollbackFor} on the routine "Anthropic-said-no" exceptions: those are recoverable
   * outcomes the caller will translate into either a 429 (BudgetExhausted) or a deterministic
   * fallback (T3/T4/T5/T6). The cost-guard hour-counter increment must NOT roll back when the
   * downstream call fails, otherwise a malicious caller could spin the rate-limit counter back to
   * zero by triggering invalid-JSON responses.
   */
  @Transactional(
      noRollbackFor = {
        AnthropicException.class,
        AnthropicInvalidJsonException.class,
        com.throughline.weeklycommit.infrastructure.ai.BudgetExhaustedException.class
      })
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
    String cacheKey = InputHash.computeCacheKey(model.name(), kind.name(), userPrompt);

    // V7 persistent cache: content-keyed lookup runs first (cross-session, no TTL). The legacy
    // 60s input_hash dedupe stays as defense-in-depth for the case where cache_key is not yet
    // backfilled (pre-V7 rows have cache_key IS NULL).
    Optional<AIInsight> persistent = insightRepository.findByCacheKeyAndKind(cacheKey, kind);
    if (persistent.isPresent()) {
      return reuse(
          persistent.get(), orgId, kind, entityType, entityId, inputHash, cacheKey, userId);
    }
    Optional<AIInsight> cached = cache.findFresh(kind, inputHash);
    if (cached.isPresent()) {
      return reuse(cached.get(), orgId, kind, entityType, entityId, inputHash, cacheKey, userId);
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
    row.setCacheKey(cacheKey);
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

  /**
   * Audit-trail row written when either the persistent cache_key lookup or the legacy 60s
   * input_hash dedupe returns a hit. Reuses the prior payload verbatim, marks model with the {@code
   * cache:} prefix so {@link #wasCacheHit(AIInsight)} can detect it, and skips org-spend accrual.
   */
  private AIInsight reuse(
      AIInsight prior,
      String orgId,
      AIInsightKind kind,
      String entityType,
      String entityId,
      String inputHash,
      String cacheKey,
      String userId) {
    String priorModel = prior.getModel();
    String originalModel =
        priorModel.startsWith("cache:") ? priorModel.substring("cache:".length()) : priorModel;
    AIInsight hit =
        new AIInsight(
            orgId,
            kind,
            entityType,
            entityId,
            "cache:" + originalModel,
            prior.getPayloadJson(),
            inputHash);
    // Audit-trail rows for cache hits intentionally leave cache_key NULL so they're exempt from
    // the V7 partial unique index on (cache_key, kind). The canonical (cache_key, kind) row is
    // the original miss row; this row records that a hit occurred without competing for the slot.
    hit.setCacheKey(null);
    hit.setLatencyMs(0);
    hit.setCostCents(BigDecimal.ZERO);
    AIInsight saved = insightRepository.save(hit);
    LOG.debug(
        "ai_call_cache_hit kind={} userId={} inputHash={} cacheKey={} reusedInsightId={}",
        kind,
        userId,
        inputHash,
        cacheKey,
        prior.getId());
    return saved;
  }

  /**
   * Returns whether the given {@link AIInsight} was produced by a cache hit. Used by the controller
   * to set the {@code X-Cache} response header. The {@code cache:} prefix on {@link
   * AIInsight#getModel()} is the durable signal both legacy 60s and V7 persistent cache hits stamp.
   */
  public static boolean wasCacheHit(AIInsight insight) {
    return insight != null && insight.getModel() != null && insight.getModel().startsWith("cache:");
  }

  // ---------- Input records (mirror docs/ai-copilot-spec.md §T1/§T2/§T7) ----------

  public record OutcomeCandidate(
      String supportingOutcomeId,
      String title,
      String parentOutcomeTitle,
      String parentDOTitle,
      String parentRallyCryTitle) {}

  /**
   * Typed replacement for the previous {@code List<Map<String,String>>} shape. {@code
   * java.util.Map} has no guaranteed iteration order, so two logically-identical inputs would
   * serialize to different JSON and produce different cache keys. The record gives Jackson stable
   * field order under {@code SORT_PROPERTIES_ALPHABETICALLY}.
   */
  public record RecentCommit(String supportingOutcomeId, String text) {}

  public record SuggestOutcomeInput(
      String draftCommitText,
      String userId,
      String teamId,
      List<OutcomeCandidate> candidates,
      List<RecentCommit> recentUserCommits) {}

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
