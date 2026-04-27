package com.throughline.weeklycommit.infrastructure.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.throughline.weeklycommit.PostgresIntegrationTestBase;
import com.throughline.weeklycommit.TestDatabaseCleaner;
import com.throughline.weeklycommit.domain.AIBudget;
import com.throughline.weeklycommit.domain.AIInsightKind;
import com.throughline.weeklycommit.domain.Org;
import com.throughline.weeklycommit.domain.Role;
import com.throughline.weeklycommit.domain.User;
import com.throughline.weeklycommit.domain.repo.AIBudgetRepository;
import com.throughline.weeklycommit.domain.repo.OrgRepository;
import com.throughline.weeklycommit.domain.repo.UserRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneOffset;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

class AnthropicCostGuardTest extends PostgresIntegrationTestBase {

  @Autowired AnthropicCostGuard guard;
  @Autowired OrgRepository orgRepo;
  @Autowired UserRepository userRepo;
  @Autowired AIBudgetRepository budgetRepo;
  @Autowired TestDatabaseCleaner cleaner;

  String orgId;
  String userId;

  @BeforeEach
  void seed() {
    cleaner.clean();
    Org org = orgRepo.save(new Org("ACME"));
    orgId = org.getId();
    User u = new User(orgId, "auth0|guard-user", "g@x.com", "Guarded", Role.IC);
    userRepo.save(u);
    userId = u.getId();
  }

  @Test
  @Transactional
  void preflight_passes_within_hour_cap() {
    for (int i = 0; i < 30; i++) {
      guard.preflight(AIInsightKind.T1_SUGGESTION, userId, orgId);
    }
  }

  @Test
  @Transactional
  void preflight_throws_USER_HOUR_CAP_when_exceeded() {
    for (int i = 0; i < 30; i++) {
      guard.preflight(AIInsightKind.T1_SUGGESTION, userId, orgId);
    }
    assertThatThrownBy(() -> guard.preflight(AIInsightKind.T1_SUGGESTION, userId, orgId))
        .isInstanceOf(BudgetExhaustedException.class)
        .extracting("reason")
        .isEqualTo(BudgetExhaustedException.Reason.USER_HOUR_CAP);
  }

  @Test
  @Transactional
  void preflight_throws_ORG_MONTH_HARD_CAP_for_T1_when_budget_exhausted() {
    LocalDate monthStart =
        java.time.Instant.now().atZone(ZoneOffset.UTC).toLocalDate().withDayOfMonth(1);
    AIBudget budget = new AIBudget(orgId, monthStart);
    budget.setHardCapCents(new BigDecimal("100"));
    budget.setSoftCapCents(new BigDecimal("50"));
    budget.setCostCentsAccrued(new BigDecimal("100"));
    budgetRepo.save(budget);

    assertThatThrownBy(() -> guard.preflight(AIInsightKind.T1_SUGGESTION, userId, orgId))
        .isInstanceOf(BudgetExhaustedException.class)
        .extracting("reason")
        .isEqualTo(BudgetExhaustedException.Reason.ORG_MONTH_HARD_CAP);
  }

  @Test
  @Transactional
  void accrueOrgSpend_increments_budget_and_creates_row_when_missing() {
    guard.accrueOrgSpend(orgId, new BigDecimal("12.5"));
    LocalDate monthStart =
        java.time.Instant.now().atZone(ZoneOffset.UTC).toLocalDate().withDayOfMonth(1);
    AIBudget after = budgetRepo.findById(new AIBudget.AIBudgetId(orgId, monthStart)).orElseThrow();
    assertThat(after.getCostCentsAccrued()).isEqualByComparingTo("12.5");
  }

  @Test
  @Transactional
  void accrueOrgSpend_no_op_for_zero_or_negative_cents() {
    guard.accrueOrgSpend(orgId, BigDecimal.ZERO);
    LocalDate monthStart =
        java.time.Instant.now().atZone(ZoneOffset.UTC).toLocalDate().withDayOfMonth(1);
    assertThat(budgetRepo.findById(new AIBudget.AIBudgetId(orgId, monthStart))).isEmpty();
  }
}
