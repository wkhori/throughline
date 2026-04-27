package com.throughline.weeklycommit.domain;

import com.github.f4b6a3.ulid.UlidCreator;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;

/**
 * Materialized T6 alignment-risk alert (PRD §3.3 V4). One row per (rule, entity, severity, ISO
 * week) — see P5 dedupe key algorithm. {@link #acknowledgedAt} is set by the manager via {@code
 * POST /manager/alignment-risks/{id}/ack} (P14).
 */
@Entity
@Table(name = "alignment_risk")
public class AlignmentRisk {

  @Id
  @Column(length = 26, nullable = false, updatable = false)
  private String id;

  @Column(name = "org_id", nullable = false, length = 26)
  private String orgId;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 40)
  private AlignmentRiskRule rule;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 10)
  private AlignmentRiskSeverity severity;

  @Column(name = "entity_type", nullable = false, length = 40)
  private String entityType;

  @Column(name = "entity_id", nullable = false, length = 26)
  private String entityId;

  @Column(name = "week_start", nullable = false)
  private LocalDate weekStart;

  @Column(name = "ai_insight_id", length = 26)
  private String aiInsightId;

  @Column(name = "acknowledged_at")
  private Instant acknowledgedAt;

  @Column(name = "acknowledged_by", length = 26)
  private String acknowledgedBy;

  @Column(name = "dedupe_key", nullable = false, length = 128)
  private String dedupeKey;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  protected AlignmentRisk() {}

  public AlignmentRisk(
      String orgId,
      AlignmentRiskRule rule,
      AlignmentRiskSeverity severity,
      String entityType,
      String entityId,
      LocalDate weekStart,
      String dedupeKey) {
    this.orgId = orgId;
    this.rule = rule;
    this.severity = severity;
    this.entityType = entityType;
    this.entityId = entityId;
    this.weekStart = weekStart;
    this.dedupeKey = dedupeKey;
  }

  @PrePersist
  void onPersist() {
    if (id == null) {
      id = UlidCreator.getMonotonicUlid().toString();
    }
    if (createdAt == null) {
      createdAt = Instant.now();
    }
  }

  public String getId() {
    return id;
  }

  public String getOrgId() {
    return orgId;
  }

  public AlignmentRiskRule getRule() {
    return rule;
  }

  public AlignmentRiskSeverity getSeverity() {
    return severity;
  }

  public String getEntityType() {
    return entityType;
  }

  public String getEntityId() {
    return entityId;
  }

  public LocalDate getWeekStart() {
    return weekStart;
  }

  public String getAiInsightId() {
    return aiInsightId;
  }

  public Instant getAcknowledgedAt() {
    return acknowledgedAt;
  }

  public String getAcknowledgedBy() {
    return acknowledgedBy;
  }

  public String getDedupeKey() {
    return dedupeKey;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public void setSeverity(AlignmentRiskSeverity severity) {
    this.severity = severity;
  }

  public void setAiInsightId(String aiInsightId) {
    this.aiInsightId = aiInsightId;
  }

  public void acknowledge(String userId, Instant when) {
    this.acknowledgedAt = when;
    this.acknowledgedBy = userId;
  }
}
