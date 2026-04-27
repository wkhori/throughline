package com.throughline.weeklycommit.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.Instant;
import org.junit.jupiter.api.Test;

/**
 * Sanity tests for entity getter/setter coverage. The actual persistence behavior is exercised by
 * the repository / controller integration tests; this class brings non-mutating accessors over the
 * JaCoCo gate.
 */
class EntityGettersTest {

  @Test
  void org_round_trip() {
    Org org = new Org("ACME");
    org.setTimezone("UTC");
    org.setWeekStartDay("SUNDAY");
    assertThat(org.getName()).isEqualTo("ACME");
    assertThat(org.getTimezone()).isEqualTo("UTC");
    assertThat(org.getWeekStartDay()).isEqualTo("SUNDAY");
    org.setName("ACME-2");
    assertThat(org.getName()).isEqualTo("ACME-2");
  }

  @Test
  void user_round_trip() {
    User u = new User("o1", "auth0|x", "x@y.com", "X", Role.IC);
    u.setTeamId("t1");
    u.setManagerId("m1");
    u.setRole(Role.MANAGER);
    u.setDisplayName("Y");
    assertThat(u.getOrgId()).isEqualTo("o1");
    assertThat(u.getTeamId()).isEqualTo("t1");
    assertThat(u.getManagerId()).isEqualTo("m1");
    assertThat(u.getEmail()).isEqualTo("x@y.com");
    assertThat(u.getDisplayName()).isEqualTo("Y");
    assertThat(u.getAuth0Sub()).isEqualTo("auth0|x");
    assertThat(u.getRole()).isEqualTo(Role.MANAGER);
  }

  @Test
  void team_round_trip() {
    Team t = new Team("o1", "Growth");
    t.setManagerId("m1");
    t.setName("Growth Eng");
    assertThat(t.getOrgId()).isEqualTo("o1");
    assertThat(t.getName()).isEqualTo("Growth Eng");
    assertThat(t.getManagerId()).isEqualTo("m1");
  }

  @Test
  void rallyCry_archive_marks_archivedAt() {
    RallyCry rc = new RallyCry("o1", "Win SMB");
    rc.setDescription("desc");
    rc.setDisplayOrder(2);
    assertThat(rc.isArchived()).isFalse();
    rc.archive();
    assertThat(rc.isArchived()).isTrue();
    assertThat(rc.getArchivedAt()).isBeforeOrEqualTo(Instant.now());
    rc.setTitle("Other");
    assertThat(rc.getTitle()).isEqualTo("Other");
    assertThat(rc.getDescription()).isEqualTo("desc");
    assertThat(rc.getDisplayOrder()).isEqualTo(2);
    assertThat(rc.getOrgId()).isEqualTo("o1");
  }

  @Test
  void definingObjective_round_trip() {
    DefiningObjective d = new DefiningObjective("rc1", "Reduce churn");
    d.setDescription("desc");
    d.setDisplayOrder(1);
    assertThat(d.getRallyCryId()).isEqualTo("rc1");
    assertThat(d.getTitle()).isEqualTo("Reduce churn");
    assertThat(d.getDescription()).isEqualTo("desc");
    assertThat(d.getDisplayOrder()).isEqualTo(1);
    d.setTitle("Reduce churn 2");
    assertThat(d.getTitle()).isEqualTo("Reduce churn 2");
    d.archive();
    assertThat(d.isArchived()).isTrue();
    assertThat(d.getArchivedAt()).isNotNull();
  }

  @Test
  void outcome_round_trip() {
    Outcome o = new Outcome("do1", "Improve onboarding");
    o.setDescription("desc");
    o.setMetricStatement("NPS >= 50");
    o.setDisplayOrder(1);
    o.setTitle("Improve onboarding 2");
    assertThat(o.getDefiningObjectiveId()).isEqualTo("do1");
    assertThat(o.getDescription()).isEqualTo("desc");
    assertThat(o.getMetricStatement()).isEqualTo("NPS >= 50");
    assertThat(o.getDisplayOrder()).isEqualTo(1);
    assertThat(o.getTitle()).isEqualTo("Improve onboarding 2");
    o.archive();
    assertThat(o.isArchived()).isTrue();
    assertThat(o.getArchivedAt()).isNotNull();
  }

  @Test
  void supportingOutcome_round_trip() {
    SupportingOutcome so = new SupportingOutcome("o1", "Ship sequence");
    so.setDescription("desc");
    so.setDisplayOrder(0);
    so.setTitle("Ship v2");
    assertThat(so.getOutcomeId()).isEqualTo("o1");
    assertThat(so.getDescription()).isEqualTo("desc");
    assertThat(so.getDisplayOrder()).isEqualTo(0);
    assertThat(so.getTitle()).isEqualTo("Ship v2");
    so.archive();
    assertThat(so.isArchived()).isTrue();
    assertThat(so.getArchivedAt()).isNotNull();
  }

  @Test
  void teamPriorityWeight_round_trip() {
    TeamPriorityWeight tpw =
        new TeamPriorityWeight("t1", "rc1", new BigDecimal("0.30"), new BigDecimal("0.50"));
    assertThat(tpw.getTeamId()).isEqualTo("t1");
    assertThat(tpw.getRallyCryId()).isEqualTo("rc1");
    assertThat(tpw.getExpectedShareLow()).isEqualByComparingTo("0.30");
    assertThat(tpw.getExpectedShareHigh()).isEqualByComparingTo("0.50");
  }

  @Test
  void role_enum_round_trip() {
    assertThat(Role.valueOf("IC")).isEqualTo(Role.IC);
    assertThat(Role.values()).hasSize(3);
  }
}
