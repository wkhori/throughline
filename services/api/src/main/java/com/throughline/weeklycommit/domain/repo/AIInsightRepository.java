package com.throughline.weeklycommit.domain.repo;

import com.throughline.weeklycommit.domain.AIInsight;
import com.throughline.weeklycommit.domain.AIInsightKind;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AIInsightRepository extends JpaRepository<AIInsight, String> {

  /**
   * Most-recent insight for a given (entityType, entityId, kind) — drives the dashboard hero card.
   */
  @Query(
      "select i from AIInsight i where i.entityType = :entityType and i.entityId = :entityId and"
          + " i.kind = :kind order by i.createdAt desc limit 1")
  Optional<AIInsight> findMostRecent(
      @Param("entityType") String entityType,
      @Param("entityId") String entityId,
      @Param("kind") AIInsightKind kind);

  /** Cache hit lookup keyed by inputHash (60s dedupe window per PRD §5.3). */
  @Query(
      "select i from AIInsight i where i.inputHash = :inputHash and i.kind = :kind and"
          + " i.createdAt > :since order by i.createdAt desc limit 1")
  Optional<AIInsight> findFreshByInputHash(
      @Param("inputHash") String inputHash,
      @Param("kind") AIInsightKind kind,
      @Param("since") Instant since);

  /**
   * Persistent cache lookup keyed on the V7 {@code cache_key} column. Returns the canonical row for
   * a given (modelVersion + kind + canonicalized input) tuple regardless of session age. Replaces
   * the 60-second TTL behaviour for cache participants — historical rows whose cache_key is null
   * are exempt from this lookup.
   */
  @Query(
      "select i from AIInsight i where i.cacheKey = :cacheKey and i.kind = :kind"
          + " order by i.createdAt desc limit 1")
  Optional<AIInsight> findByCacheKeyAndKind(
      @Param("cacheKey") String cacheKey, @Param("kind") AIInsightKind kind);

  /**
   * Batch hydration: latest insight per (entity_id, kind) tuple for a set of commit ids. Drives the
   * {@code POST /api/v1/ai/insights/batch} endpoint so the FE can hydrate rows in one round trip.
   * The partial index {@code idx_ai_insight_commit_kind} (V7) backs this query.
   */
  @Query(
      "select i from AIInsight i where i.entityType = 'commit' and i.kind = :kind and"
          + " i.entityId in :entityIds and i.createdAt = ("
          + "  select max(j.createdAt) from AIInsight j where j.entityType = 'commit'"
          + "    and j.kind = :kind and j.entityId = i.entityId"
          + ")")
  List<AIInsight> findLatestByEntityIdsAndKind(
      @Param("entityIds") Collection<String> entityIds, @Param("kind") AIInsightKind kind);

  /** Most-recent T5 digest for a manager (P17 hero card). */
  @Query(
      "select i from AIInsight i where i.kind ="
          + " com.throughline.weeklycommit.domain.AIInsightKind.T5_DIGEST and i.entityType = 'user'"
          + " and i.entityId = :managerId order by i.createdAt desc limit 1")
  Optional<AIInsight> findMostRecentDigestForManager(@Param("managerId") String managerId);
}
