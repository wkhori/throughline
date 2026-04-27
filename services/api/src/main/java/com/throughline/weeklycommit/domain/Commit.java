package com.throughline.weeklycommit.domain;

import com.throughline.weeklycommit.infrastructure.persistence.AbstractAuditingEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

@Entity
@Table(name = "\"commit\"")
public class Commit extends AbstractAuditingEntity {

  @Column(name = "week_id", nullable = false, length = 26)
  private String weekId;

  @Column(nullable = false, length = 280)
  private String text;

  @Column(name = "supporting_outcome_id", length = 26)
  private String supportingOutcomeId;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private CommitCategory category = CommitCategory.OPERATIONAL;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 10)
  private CommitPriority priority = CommitPriority.SHOULD;

  @Column(name = "display_order", nullable = false)
  private int displayOrder;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private CommitState state = CommitState.ACTIVE;

  @Column(name = "parent_commit_id", length = 26)
  private String parentCommitId;

  @Enumerated(EnumType.STRING)
  @Column(name = "reconciliation_outcome", length = 10)
  private ReconciliationOutcome reconciliationOutcome;

  @Column(name = "reconciliation_note", length = 1000)
  private String reconciliationNote;

  @Column(name = "carry_forward_weeks", nullable = false)
  private int carryForwardWeeks;

  protected Commit() {}

  public Commit(String weekId, String text) {
    this.weekId = weekId;
    this.text = text;
  }

  public String getWeekId() {
    return weekId;
  }

  public String getText() {
    return text;
  }

  public String getSupportingOutcomeId() {
    return supportingOutcomeId;
  }

  public CommitCategory getCategory() {
    return category;
  }

  public CommitPriority getPriority() {
    return priority;
  }

  public int getDisplayOrder() {
    return displayOrder;
  }

  public CommitState getState() {
    return state;
  }

  public String getParentCommitId() {
    return parentCommitId;
  }

  public ReconciliationOutcome getReconciliationOutcome() {
    return reconciliationOutcome;
  }

  public String getReconciliationNote() {
    return reconciliationNote;
  }

  public int getCarryForwardWeeks() {
    return carryForwardWeeks;
  }

  public void setText(String text) {
    this.text = text;
  }

  public void setSupportingOutcomeId(String supportingOutcomeId) {
    this.supportingOutcomeId = supportingOutcomeId;
  }

  public void setCategory(CommitCategory category) {
    this.category = category;
  }

  public void setPriority(CommitPriority priority) {
    this.priority = priority;
  }

  public void setDisplayOrder(int displayOrder) {
    this.displayOrder = displayOrder;
  }

  public void setState(CommitState state) {
    this.state = state;
  }

  public void setParentCommitId(String parentCommitId) {
    this.parentCommitId = parentCommitId;
  }

  public void setReconciliationOutcome(ReconciliationOutcome reconciliationOutcome) {
    this.reconciliationOutcome = reconciliationOutcome;
  }

  public void setReconciliationNote(String reconciliationNote) {
    this.reconciliationNote = reconciliationNote;
  }

  public void setCarryForwardWeeks(int carryForwardWeeks) {
    this.carryForwardWeeks = carryForwardWeeks;
  }
}
