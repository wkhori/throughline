package com.throughline.weeklycommit.domain;

import com.throughline.weeklycommit.infrastructure.persistence.AbstractAuditingEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(
    name = "week",
    uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "week_start"}))
public class Week extends AbstractAuditingEntity {

  @Column(name = "user_id", nullable = false, length = 26)
  private String userId;

  @Column(name = "org_id", nullable = false, length = 26)
  private String orgId;

  @Column(name = "week_start", nullable = false)
  private LocalDate weekStart;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private WeekState state = WeekState.DRAFT;

  @Column(name = "locked_at")
  private Instant lockedAt;

  @Column(name = "reconciled_at")
  private Instant reconciledAt;

  protected Week() {}

  public Week(String userId, String orgId, LocalDate weekStart) {
    this.userId = userId;
    this.orgId = orgId;
    this.weekStart = weekStart;
  }

  public String getUserId() {
    return userId;
  }

  public String getOrgId() {
    return orgId;
  }

  public LocalDate getWeekStart() {
    return weekStart;
  }

  public WeekState getState() {
    return state;
  }

  public Instant getLockedAt() {
    return lockedAt;
  }

  public Instant getReconciledAt() {
    return reconciledAt;
  }

  public void setState(WeekState state) {
    this.state = state;
  }

  public void setLockedAt(Instant lockedAt) {
    this.lockedAt = lockedAt;
  }

  public void setReconciledAt(Instant reconciledAt) {
    this.reconciledAt = reconciledAt;
  }
}
