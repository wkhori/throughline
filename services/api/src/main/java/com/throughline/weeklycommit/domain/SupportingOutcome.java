package com.throughline.weeklycommit.domain;

import com.throughline.weeklycommit.infrastructure.persistence.AbstractAuditingEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "supporting_outcome")
public class SupportingOutcome extends AbstractAuditingEntity {

  @Column(name = "outcome_id", nullable = false, length = 26)
  private String outcomeId;

  @Column(nullable = false, length = 500)
  private String title;

  @Column(columnDefinition = "text")
  private String description;

  @Column(name = "display_order", nullable = false)
  private int displayOrder;

  @Column(name = "archived_at")
  private Instant archivedAt;

  protected SupportingOutcome() {}

  public SupportingOutcome(String outcomeId, String title) {
    this.outcomeId = outcomeId;
    this.title = title;
  }

  public boolean isArchived() {
    return archivedAt != null;
  }

  public void archive() {
    this.archivedAt = Instant.now();
  }

  public String getOutcomeId() {
    return outcomeId;
  }

  public String getTitle() {
    return title;
  }

  public String getDescription() {
    return description;
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

  public void setDisplayOrder(int displayOrder) {
    this.displayOrder = displayOrder;
  }
}
