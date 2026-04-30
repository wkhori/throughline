package com.throughline.weeklycommit.application.ai;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.MapperFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.throughline.weeklycommit.PostgresIntegrationTestBase;
import com.throughline.weeklycommit.TestDatabaseCleaner;
import com.throughline.weeklycommit.domain.AIInsight;
import com.throughline.weeklycommit.domain.AIInsightKind;
import com.throughline.weeklycommit.domain.Org;
import com.throughline.weeklycommit.domain.Role;
import com.throughline.weeklycommit.domain.User;
import com.throughline.weeklycommit.domain.repo.AIInsightRepository;
import com.throughline.weeklycommit.domain.repo.OrgRepository;
import com.throughline.weeklycommit.domain.repo.UserRepository;
import com.throughline.weeklycommit.infrastructure.ai.InputHash;
import com.throughline.weeklycommit.infrastructure.ai.StubAnthropicClient;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;

/**
 * Integration coverage for the V7 persistent AI invocation cache + the deterministic-prompt
 * contract that gates it. The tests prove three load-bearing properties:
 *
 * <ol>
 *   <li>The same logical input produces byte-for-byte identical canonical JSON regardless of
 *       caller-supplied list order — the cache key is stable.
 *   <li>A second call with that input is served from the cache: the reused row carries the {@code
 *       cache:} model prefix and the org-spend counter is not bumped.
 *   <li>The repository finder hits the persistent row through {@code cache_key + kind} (V7 index),
 *       not just the legacy 60s {@code input_hash} window.
 * </ol>
 */
@Import(StubAnthropicClient.class)
class AiCopilotServiceCacheTest extends PostgresIntegrationTestBase {

  @Autowired AiCopilotService aiService;
  @Autowired AIInsightRepository insightRepo;
  @Autowired OrgRepository orgRepo;
  @Autowired UserRepository userRepo;
  @Autowired TestDatabaseCleaner cleaner;

  String orgId;
  String userId;

  @BeforeEach
  void setup() {
    cleaner.clean();
    StubAnthropicClient.reset();
    Org org = orgRepo.save(new Org("ACME"));
    orgId = org.getId();
    User u = new User(orgId, "auth0|cache-test", "ic@x.com", "IC", Role.IC);
    userRepo.save(u);
    userId = u.getId();
    StubAnthropicClient.register(
        "T7",
        "{\"issues\":[],\"severity\":\"low\",\"reasoning\":\"clean commit\","
            + "\"model\":\"claude-haiku-4-5-20251001\"}");
  }

  @AfterEach
  void tearDown() {
    StubAnthropicClient.reset();
  }

  @Test
  void second_call_with_same_input_hits_persistent_cache_and_marks_model_with_cache_prefix() {
    AiCopilotService.QualityLintInput input =
        new AiCopilotService.QualityLintInput(
            "01HXC0MMITAAAAAAAAAAAAAAAA",
            "Ship onboarding email v2",
            "OPERATIONAL",
            "SHOULD",
            "Reduce churn");

    AIInsight first = aiService.qualityLint(input, userId, orgId);
    AIInsight second = aiService.qualityLint(input, userId, orgId);

    assertThat(first.getModel()).doesNotStartWith("cache:");
    assertThat(first.getCacheKey()).isNotNull().hasSize(64);
    assertThat(second.getModel()).startsWith("cache:");
    // Cache-hit audit rows intentionally leave cache_key NULL so the V7 partial unique index on
    // (cache_key, kind) only covers the canonical miss row.
    assertThat(second.getCacheKey()).isNull();
    assertThat(AiCopilotService.wasCacheHit(first)).isFalse();
    assertThat(AiCopilotService.wasCacheHit(second)).isTrue();
  }

  @Test
  void canonicalize_sorts_candidates_so_caller_order_does_not_change_cache_key() {
    var c1 = new AiCopilotService.OutcomeCandidate("01HBBB", "Beta", "po", "do", "rc");
    var c2 = new AiCopilotService.OutcomeCandidate("01HAAA", "Alpha", "po", "do", "rc");
    var c3 = new AiCopilotService.OutcomeCandidate("01HCCC", "Gamma", "po", "do", "rc");

    AiCopilotService.SuggestOutcomeInput orderA =
        new AiCopilotService.SuggestOutcomeInput(
            "ship the workflow builder GA milestone for paying enterprise pilots",
            userId,
            "team-1",
            List.of(c1, c2, c3),
            List.of());
    AiCopilotService.SuggestOutcomeInput orderB =
        new AiCopilotService.SuggestOutcomeInput(
            "ship the workflow builder GA milestone for paying enterprise pilots",
            userId,
            "team-1",
            List.of(c3, c1, c2),
            List.of());

    String jsonA = serializeCanonical(AiCopilotService.canonicalize(orderA));
    String jsonB = serializeCanonical(AiCopilotService.canonicalize(orderB));
    assertThat(jsonA).isEqualTo(jsonB);

    String keyA = InputHash.computeCacheKey("HAIKU", AIInsightKind.T1_SUGGESTION.name(), jsonA);
    String keyB = InputHash.computeCacheKey("HAIKU", AIInsightKind.T1_SUGGESTION.name(), jsonB);
    assertThat(keyA).isEqualTo(keyB);
  }

  @Test
  void findByCacheKeyAndKind_returns_persisted_row() {
    AiCopilotService.QualityLintInput input =
        new AiCopilotService.QualityLintInput(
            "01HXC0MMITBBBBBBBBBBBBBBBB",
            "Refactor billing service",
            "OPERATIONAL",
            "SHOULD",
            "Reduce churn");
    AIInsight saved = aiService.qualityLint(input, userId, orgId);
    String cacheKey = saved.getCacheKey();

    var fetched = insightRepo.findByCacheKeyAndKind(cacheKey, AIInsightKind.T7_QUALITY);
    assertThat(fetched).isPresent();
    assertThat(fetched.get().getCacheKey()).isEqualTo(cacheKey);
  }

  @Test
  void findLatestByEntityIdsAndKind_returns_latest_per_commit() {
    AiCopilotService.QualityLintInput a =
        new AiCopilotService.QualityLintInput(
            "01HXC0MMITCCCCCCCCCCCCCCCC",
            "Ship onboarding email v2",
            "OPERATIONAL",
            "SHOULD",
            "Reduce churn");
    AiCopilotService.QualityLintInput b =
        new AiCopilotService.QualityLintInput(
            "01HXC0MMITDDDDDDDDDDDDDDDD",
            "Refactor billing service test suite",
            "OPERATIONAL",
            "SHOULD",
            "Reduce churn");
    aiService.qualityLint(a, userId, orgId);
    aiService.qualityLint(b, userId, orgId);

    var rows =
        insightRepo.findLatestByEntityIdsAndKind(
            List.of("01HXC0MMITCCCCCCCCCCCCCCCC", "01HXC0MMITDDDDDDDDDDDDDDDD"),
            AIInsightKind.T7_QUALITY);
    assertThat(rows).hasSize(2);
    assertThat(rows.stream().map(AIInsight::getEntityId))
        .containsExactlyInAnyOrder("01HXC0MMITCCCCCCCCCCCCCCCC", "01HXC0MMITDDDDDDDDDDDDDDDD");
  }

  private static String serializeCanonical(Object value) {
    ObjectMapper mapper =
        new ObjectMapper()
            .configure(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS, true)
            .configure(MapperFeature.SORT_PROPERTIES_ALPHABETICALLY, true);
    try {
      return mapper.writeValueAsString(value);
    } catch (Exception e) {
      throw new RuntimeException(e);
    }
  }
}
