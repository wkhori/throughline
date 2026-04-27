package com.throughline.weeklycommit.domain.repo;

import com.throughline.weeklycommit.domain.AIBudget;
import com.throughline.weeklycommit.domain.AIBudget.AIBudgetId;
import jakarta.persistence.LockModeType;
import java.time.LocalDate;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AIBudgetRepository extends JpaRepository<AIBudget, AIBudgetId> {

  /**
   * Read-and-lock the org's current-month budget row (P12). Pessimistic-read semantics serialize
   * concurrent {@code preflight} checks across replicas without blocking unrelated rows.
   */
  @Lock(LockModeType.PESSIMISTIC_READ)
  @Query("select b from AIBudget b where b.id.orgId = :orgId and b.id.monthStart = :monthStart")
  Optional<AIBudget> findForUpdate(
      @Param("orgId") String orgId, @Param("monthStart") LocalDate monthStart);
}
