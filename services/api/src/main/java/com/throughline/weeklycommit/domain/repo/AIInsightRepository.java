package com.throughline.weeklycommit.domain.repo;

import com.throughline.weeklycommit.domain.AIInsight;
import com.throughline.weeklycommit.domain.AIInsightKind;
import java.time.Instant;
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

  /** Most-recent T5 digest for a manager (P17 hero card). */
  @Query(
      "select i from AIInsight i where i.kind ="
          + " com.throughline.weeklycommit.domain.AIInsightKind.T5_DIGEST and i.entityType = 'user'"
          + " and i.entityId = :managerId order by i.createdAt desc limit 1")
  Optional<AIInsight> findMostRecentDigestForManager(@Param("managerId") String managerId);
}
