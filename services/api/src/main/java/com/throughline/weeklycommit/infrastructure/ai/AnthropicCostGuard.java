package com.throughline.weeklycommit.infrastructure.ai;

import com.throughline.weeklycommit.domain.AIBudget;
import com.throughline.weeklycommit.domain.AIInsightKind;
import com.throughline.weeklycommit.domain.repo.AIBudgetRepository;
import com.throughline.weeklycommit.infrastructure.ai.BudgetExhaustedException.Reason;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Server-side cost guard enforced before every Anthropic call (P12 / P23 / PRD §6.3).
 *
 * <p>Three caps:
 *
 * <ol>
 *   <li>Per-user-per-hour (atomic INSERT…ON CONFLICT…RETURNING on {@code ai_user_hour_counter} —
 *       increment first, refuse if returning row exceeds cap).
 *   <li>Per-user-per-day (sum of hour counters for the user/kind across the last 24 hours).
 *   <li>Org-level monthly hard cap on {@code AIBudget.costCentsAccrued} read with {@code
 *       PESSIMISTIC_READ}.
 * </ol>
 *
 * <p>Soft cap ($250) triggers an async Slack alert (wired in Phase 5c). Hard cap ($500) refuses
 * T1/T2 calls (Sonnet T3/T4/T5 are protected by the per-user caps; refusing those mid-week would
 * blackhole the lifecycle so they remain allowed beyond the hard cap — see PRD §6.3 wording "for
 * kind ∈ {T1, T2}").
 */
@Component
public class AnthropicCostGuard {

  private static final Logger LOG = LoggerFactory.getLogger(AnthropicCostGuard.class);

  /** Per-kind hour cap (P23). */
  private static final Map<AIInsightKind, Integer> HOUR_CAPS =
      Map.of(
          AIInsightKind.T1_SUGGESTION, 30,
          AIInsightKind.T2_DRIFT, 15,
          AIInsightKind.T7_QUALITY, 30,
          AIInsightKind.T3_PORTFOLIO, 2,
          AIInsightKind.T4_DELTA, 2,
          AIInsightKind.T5_DIGEST, 2,
          AIInsightKind.T6_ALERT, 60);

  /** Per-kind day cap. */
  private static final Map<AIInsightKind, Integer> DAY_CAPS =
      Map.of(
          AIInsightKind.T1_SUGGESTION, 100,
          AIInsightKind.T2_DRIFT, 50,
          AIInsightKind.T7_QUALITY, 100,
          AIInsightKind.T3_PORTFOLIO, 5,
          AIInsightKind.T4_DELTA, 5,
          AIInsightKind.T5_DIGEST, 5,
          AIInsightKind.T6_ALERT, 200);

  private final AIBudgetRepository budgetRepository;
  private final Clock clock;

  @PersistenceContext private EntityManager em;

  public AnthropicCostGuard(AIBudgetRepository budgetRepository, Clock clock) {
    this.budgetRepository = budgetRepository;
    this.clock = clock;
  }

  /**
   * Refuse the call if any cap would be exceeded. Increments the hour counter atomically before
   * checking the returned value (so concurrent callers cannot both squeeze under the cap).
   *
   * @throws BudgetExhaustedException 429 mapped by {@code AiBudgetExceptionHandler}
   */
  @Transactional(propagation = Propagation.REQUIRED)
  public void preflight(AIInsightKind kind, String userId, String orgId) {
    Instant now = clock.instant();
    int hourCap = HOUR_CAPS.getOrDefault(kind, 60);
    int dayCap = DAY_CAPS.getOrDefault(kind, 200);

    int hourCount = incrementAndReturn(userId, kind, now);
    if (hourCount > hourCap) {
      LOG.info(
          "ai_budget_refused reason=USER_HOUR_CAP userId={} kind={} hourCount={}",
          userId,
          kind,
          hourCount);
      throw new BudgetExhaustedException(
          Reason.USER_HOUR_CAP,
          kind,
          "Per-user hourly cap reached for " + kind + " (" + hourCap + "/hr)");
    }

    int dayCount = sumDayCount(userId, kind, now);
    if (dayCount > dayCap) {
      LOG.info(
          "ai_budget_refused reason=USER_DAY_CAP userId={} kind={} dayCount={}",
          userId,
          kind,
          dayCount);
      throw new BudgetExhaustedException(
          Reason.USER_DAY_CAP,
          kind,
          "Per-user daily cap reached for " + kind + " (" + dayCap + "/day)");
    }

    if (kind == AIInsightKind.T1_SUGGESTION
        || kind == AIInsightKind.T2_DRIFT
        || kind == AIInsightKind.T7_QUALITY) {
      enforceOrgHardCap(orgId, now, kind);
    }
  }

  /**
   * Idempotently records a successful Anthropic call's spend on the org's monthly budget. Skipped
   * for cache-hit insights (zero cost).
   */
  @Transactional
  public void accrueOrgSpend(String orgId, BigDecimal cents) {
    if (cents == null || cents.compareTo(BigDecimal.ZERO) <= 0) return;
    LocalDate monthStart = monthStart(clock.instant());
    AIBudget budget =
        budgetRepository
            .findForUpdate(orgId, monthStart)
            .orElseGet(() -> budgetRepository.save(new AIBudget(orgId, monthStart)));
    BigDecimal before = budget.getCostCentsAccrued();
    budget.addCost(cents);
    BigDecimal after = budget.getCostCentsAccrued();
    BigDecimal soft = budget.getSoftCapCents();
    if (before.compareTo(soft) < 0 && after.compareTo(soft) >= 0) {
      LOG.warn("ai_budget_soft_cap_crossed orgId={} accrued={} softCap={}", orgId, after, soft);
      // Phase 5c wires an async Slack alert here; for now the warn-log is the signal.
    }
  }

  private int incrementAndReturn(String userId, AIInsightKind kind, Instant now) {
    Instant hourStart = now.truncatedTo(ChronoUnit.HOURS);
    // Atomic UPSERT-then-RETURNING. The native query keeps the increment + cap check on a single
    // round trip so concurrent callers cannot race past the cap.
    Object result =
        em.createNativeQuery(
                "INSERT INTO ai_user_hour_counter(user_id, hour_start, kind, call_count) "
                    + "VALUES (:userId, :hourStart, :kind, 1) "
                    + "ON CONFLICT (user_id, hour_start, kind) "
                    + "DO UPDATE SET call_count = ai_user_hour_counter.call_count + 1 "
                    + "RETURNING call_count")
            .setParameter("userId", userId)
            .setParameter("hourStart", hourStart)
            .setParameter("kind", kind.name())
            .getSingleResult();
    return ((Number) result).intValue();
  }

  private int sumDayCount(String userId, AIInsightKind kind, Instant now) {
    Instant since = now.minus(Duration.ofHours(24));
    Number sum =
        (Number)
            em.createNativeQuery(
                    "SELECT COALESCE(SUM(call_count),0) FROM ai_user_hour_counter "
                        + "WHERE user_id = :userId AND kind = :kind AND hour_start >= :since")
                .setParameter("userId", userId)
                .setParameter("kind", kind.name())
                .setParameter("since", since)
                .getSingleResult();
    return sum.intValue();
  }

  private void enforceOrgHardCap(String orgId, Instant now, AIInsightKind kind) {
    LocalDate monthStart = monthStart(now);
    AIBudget budget = budgetRepository.findForUpdate(orgId, monthStart).orElse(null);
    if (budget == null) return;
    if (budget.getCostCentsAccrued().compareTo(budget.getHardCapCents()) >= 0) {
      LOG.warn(
          "ai_budget_refused reason=ORG_MONTH_HARD_CAP orgId={} kind={} accrued={}",
          orgId,
          kind,
          budget.getCostCentsAccrued());
      throw new BudgetExhaustedException(
          Reason.ORG_MONTH_HARD_CAP,
          kind,
          "Org monthly hard cap reached — " + kind + " disabled until next reset");
    }
  }

  private static LocalDate monthStart(Instant now) {
    return now.atZone(ZoneOffset.UTC).toLocalDate().withDayOfMonth(1);
  }
}
