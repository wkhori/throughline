package com.throughline.weeklycommit.domain;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/**
 * Org-level monthly AI cost guard (PRD §3.3 V4 / P3 audit columns). Composite primary key {@code
 * (orgId, monthStart)}; loaded with {@code PESSIMISTIC_READ} from {@code AnthropicCostGuard} per
 * P12. Audit columns are required by P3.
 */
@Entity
@Table(name = "ai_budget")
@jakarta.persistence.EntityListeners(AuditingEntityListener.class)
public class AIBudget {

  @EmbeddedId private AIBudgetId id;

  @Column(name = "cost_cents_accrued", nullable = false, precision = 10, scale = 4)
  private BigDecimal costCentsAccrued = BigDecimal.ZERO;

  @Column(name = "soft_cap_cents", nullable = false, precision = 10, scale = 4)
  private BigDecimal softCapCents = new BigDecimal("25000");

  @Column(name = "hard_cap_cents", nullable = false, precision = 10, scale = 4)
  private BigDecimal hardCapCents = new BigDecimal("50000");

  @CreatedDate
  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @CreatedBy
  @Column(name = "created_by", length = 64, updatable = false)
  private String createdBy;

  @LastModifiedDate
  @Column(name = "updated_at")
  private Instant updatedAt;

  @LastModifiedBy
  @Column(name = "updated_by", length = 64)
  private String updatedBy;

  @jakarta.persistence.Version
  @Column(nullable = false)
  private long version;

  protected AIBudget() {}

  public AIBudget(String orgId, LocalDate monthStart) {
    this.id = new AIBudgetId(orgId, monthStart);
  }

  public AIBudgetId getId() {
    return id;
  }

  public String getOrgId() {
    return id == null ? null : id.getOrgId();
  }

  public LocalDate getMonthStart() {
    return id == null ? null : id.getMonthStart();
  }

  public BigDecimal getCostCentsAccrued() {
    return costCentsAccrued;
  }

  public BigDecimal getSoftCapCents() {
    return softCapCents;
  }

  public BigDecimal getHardCapCents() {
    return hardCapCents;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }

  public long getVersion() {
    return version;
  }

  public void setCostCentsAccrued(BigDecimal costCentsAccrued) {
    this.costCentsAccrued = costCentsAccrued;
  }

  public void addCost(BigDecimal delta) {
    this.costCentsAccrued = this.costCentsAccrued.add(delta);
  }

  public void setSoftCapCents(BigDecimal softCapCents) {
    this.softCapCents = softCapCents;
  }

  public void setHardCapCents(BigDecimal hardCapCents) {
    this.hardCapCents = hardCapCents;
  }

  /** Composite primary key for {@link AIBudget}. */
  @jakarta.persistence.Embeddable
  public static class AIBudgetId implements Serializable {

    @Column(name = "org_id", nullable = false, length = 26)
    private String orgId;

    @Column(name = "month_start", nullable = false)
    private LocalDate monthStart;

    protected AIBudgetId() {}

    public AIBudgetId(String orgId, LocalDate monthStart) {
      this.orgId = orgId;
      this.monthStart = monthStart;
    }

    public String getOrgId() {
      return orgId;
    }

    public LocalDate getMonthStart() {
      return monthStart;
    }

    @Override
    public boolean equals(Object o) {
      if (this == o) return true;
      if (!(o instanceof AIBudgetId other)) return false;
      return Objects.equals(orgId, other.orgId) && Objects.equals(monthStart, other.monthStart);
    }

    @Override
    public int hashCode() {
      return Objects.hash(orgId, monthStart);
    }
  }
}
