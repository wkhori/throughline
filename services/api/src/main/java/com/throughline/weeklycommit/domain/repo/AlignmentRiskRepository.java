package com.throughline.weeklycommit.domain.repo;

import com.throughline.weeklycommit.domain.AlignmentRisk;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AlignmentRiskRepository extends JpaRepository<AlignmentRisk, String> {

  /** Open risks for a manager's org, newest first — drives the manager dashboard alerts panel. */
  Page<AlignmentRisk> findByOrgIdAndAcknowledgedAtIsNullOrderByCreatedAtDesc(
      String orgId, Pageable pageable);

  /** P5 dedupe: any prior fire of the same dedupeKey within the supplied window. */
  @Query(
      "select r from AlignmentRisk r where r.dedupeKey = :dedupeKey and r.createdAt >= :since"
          + " order by r.createdAt desc")
  List<AlignmentRisk> findByDedupeKeyWithin(
      @Param("dedupeKey") String dedupeKey, @Param("since") Instant since);

  Optional<AlignmentRisk> findFirstByDedupeKeyOrderByCreatedAtDesc(String dedupeKey);
}
