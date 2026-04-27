package com.throughline.weeklycommit.domain;

import com.throughline.weeklycommit.infrastructure.persistence.AbstractAuditingEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "outcome")
public class Outcome extends AbstractAuditingEntity {

  @Column(name = "defining_objective_id", nullable = false, length = 26)
  private String definingObjectiveId;

  @Column(nullable = false, length = 500)
  private String title;

  @Column(columnDefinition = "text")
  private String description;

  @Column(name = "metric_statement", columnDefinition = "text")
  private String metricStatement;

  @Column(name = "display_order", nullable = false)
  private int displayOrder;

  @Column(name = "archived_at")
  private Instant archivedAt;

  protected Outcome() {}

  public Outcome(String definingObjectiveId, String title) {
    this.definingObjectiveId = definingObjectiveId;
    this.title = title;
  }

  public boolean isArchived() {
    return archivedAt != null;
  }

  public void archive() {
    this.archivedAt = Instant.now();
  }

  public String getDefiningObjectiveId() {
    return definingObjectiveId;
  }

  public String getTitle() {
    return title;
  }

  public String getDescription() {
    return description;
  }

  public String getMetricStatement() {
    return metricStatement;
  }

  public int getDisplayOrder() {
    return displayOrder;
  }

  public Instant getArchivedAt() {
    return archivedAt;
  }

  public void setTitle(String title) {
    this.title = title;
  }

  public void setDescription(String description) {
    this.description = description;
  }

  public void setMetricStatement(String metricStatement) {
    this.metricStatement = metricStatement;
  }

  public void setDisplayOrder(int displayOrder) {
    this.displayOrder = displayOrder;
  }
}
