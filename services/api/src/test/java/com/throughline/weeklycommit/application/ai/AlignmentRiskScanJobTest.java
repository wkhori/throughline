package com.throughline.weeklycommit.application.ai;

import static org.assertj.core.api.Assertions.assertThat;

import com.throughline.weeklycommit.PostgresIntegrationTestBase;
import com.throughline.weeklycommit.TestDatabaseCleaner;
import com.throughline.weeklycommit.domain.AlignmentRisk;
import com.throughline.weeklycommit.domain.AlignmentRiskRule;
import com.throughline.weeklycommit.domain.AlignmentRiskSeverity;
import com.throughline.weeklycommit.domain.Commit;
import com.throughline.weeklycommit.domain.CommitPriority;
import com.throughline.weeklycommit.domain.Org;
import com.throughline.weeklycommit.domain.Role;
import com.throughline.weeklycommit.domain.User;
import com.throughline.weeklycommit.domain.Week;
import com.throughline.weeklycommit.domain.repo.AlignmentRiskRepository;
import com.throughline.weeklycommit.domain.repo.CommitRepository;
import com.throughline.weeklycommit.domain.repo.OrgRepository;
import com.throughline.weeklycommit.domain.repo.UserRepository;
import com.throughline.weeklycommit.domain.repo.WeekRepository;
import com.throughline.weeklycommit.infrastructure.ai.StubAnthropicClient;
import java.time.LocalDate;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;

@Import(StubAnthropicClient.class)
class AlignmentRiskScanJobTest extends PostgresIntegrationTestBase {

  @Autowired AlignmentRiskScanJob job;
  @Autowired OrgRepository orgRepo;
  @Autowired UserRepository userRepo;
  @Autowired WeekRepository weekRepo;
  @Autowired CommitRepository commitRepo;
  @Autowired AlignmentRiskRepository riskRepo;
  @Autowired TestDatabaseCleaner cleaner;

  Org org;
  String userId;

  @BeforeEach
  void seed() {
    cleaner.clean();
    StubAnthropicClient.reset();
    org = orgRepo.save(new Org("RiskOrg"));
    User u = userRepo.save(new User(org.getId(), "auth0|risk", "r@x", "Risk", Role.IC));
    userId = u.getId();
    Week w = weekRepo.save(new Week(userId, org.getId(), LocalDate.of(2026, 4, 13)));
    Commit c = new Commit(w.getId(), "Refactor billing service test suite");
    c.setCarryForwardWeeks(4);
    c.setPriority(CommitPriority.MUST);
    commitRepo.save(c);
  }

  @AfterEach
  void resetStub() {
    StubAnthropicClient.reset();
  }

  @Test
  void scanOrg_creates_LONG_CARRY_FORWARD_risk_for_4_week_carry_forward() {
    StubAnthropicClient.register(
        "T6",
        "{\"severity\":\"medium\",\"finding\":\"f\",\"suggestedAction\":\"a\","
            + "\"affectedEntities\":[],\"reasoning\":\"r\",\"model\":\"claude-haiku-4-5-20251001\"}");
    int created = job.scanOrg(org);
    assertThat(created).isEqualTo(1);
    var risks = riskRepo.findAll();
    assertThat(risks).hasSize(1);
    AlignmentRisk r = risks.get(0);
    assertThat(r.getRule()).isEqualTo(AlignmentRiskRule.LONG_CARRY_FORWARD);
    assertThat(r.getSeverity()).isEqualTo(AlignmentRiskSeverity.MEDIUM);
    assertThat(r.getEntityType()).isEqualTo("commit");
  }

  @Test
  void scanOrg_dedupes_within_7_days_same_severity() {
    StubAnthropicClient.register(
        "T6",
        "{\"severity\":\"medium\",\"finding\":\"f\",\"suggestedAction\":\"a\","
            + "\"affectedEntities\":[],\"reasoning\":\"r\",\"model\":\"claude-haiku-4-5-20251001\"}");
    job.scanOrg(org);
    int second = job.scanOrg(org);
    assertThat(second).isEqualTo(0);
    assertThat(riskRepo.findAll()).hasSize(1);
  }

  @Test
  void dedupeKey_is_stable_for_same_inputs() {
    String a =
        AlignmentRiskScanJob.dedupeKey(
            AlignmentRiskRule.LONG_CARRY_FORWARD,
            "commit",
            "01HXC0",
            AlignmentRiskSeverity.HIGH,
            LocalDate.of(2026, 4, 20));
    String b =
        AlignmentRiskScanJob.dedupeKey(
            AlignmentRiskRule.LONG_CARRY_FORWARD,
            "commit",
            "01HXC0",
            AlignmentRiskSeverity.HIGH,
            LocalDate.of(2026, 4, 20));
    assertThat(a).isEqualTo(b);
  }
}
