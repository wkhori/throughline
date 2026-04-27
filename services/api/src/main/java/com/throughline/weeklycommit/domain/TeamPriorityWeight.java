package com.throughline.weeklycommit.domain;

import com.throughline.weeklycommit.infrastructure.persistence.AbstractAuditingEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.math.BigDecimal;

@Entity
@Table(name = "team_priority_weight")
public class TeamPriorityWeight extends AbstractAuditingEntity {

  @Column(name = "team_id", nullable = false, length = 26)
  private String teamId;

  @Column(name = "rally_cry_id", nullable = false, length = 26)
  private String rallyCryId;

  @Column(name = "expected_share_low", nullable = false, precision = 4, scale = 3)
  private BigDecimal expectedShareLow;

  @Column(name = "expected_share_high", nullable = false, precision = 4, scale = 3)
  private BigDecimal expectedShareHigh;

  protected TeamPriorityWeight() {}

  public TeamPriorityWeight(String teamId, String rallyCryId, BigDecimal low, BigDecimal high) {
    this.teamId = teamId;
    this.rallyCryId = rallyCryId;
    this.expectedShareLow = low;
    this.expectedShareHigh = high;
  }

  public String getTeamId() {
    return teamId;
  }

  public String getRallyCryId() {
    return rallyCryId;
  }

  public BigDecimal getExpectedShareLow() {
    return expectedShareLow;
  }

  public BigDecimal getExpectedShareHigh() {
    return expectedShareHigh;
  }
}
