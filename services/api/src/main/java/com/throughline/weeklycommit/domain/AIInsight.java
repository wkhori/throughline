package com.throughline.weeklycommit.domain;

import com.github.f4b6a3.ulid.UlidCreator;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Persisted AI output (PRD §3.3 V4). One row per AI call (or per cache-hit; cache hits store
 * {@code cost_cents=0} and {@code model='cache:<original>'} per P13). Append-only — never updated.
 */
@Entity
@Table(name = "ai_insight")
public class AIInsight {

  @Id
  @Column(length = 26, nullable = false, updatable = false)
  private String id;

  @Column(name = "org_id", nullable = false, length = 26)
  private String orgId;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 40)
  private AIInsightKind kind;

  @Column(name = "entity_type", nullable = false, length = 40)
  private String entityType;

  @Column(name = "entity_id", nullable = false, length = 26)
  private String entityId;

  @Column(nullable = false, length = 80)
  private String model;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "payload_json", nullable = false, columnDefinition = "jsonb")
  private String payloadJson;

  @Column(name = "input_hash", nullable = false, length = 64)
  private String inputHash;

  @Column(name = "tokens_input", nullable = false)
  private int tokensInput;

  @Column(name = "tokens_output", nullable = false)
  private int tokensOutput;

  @Column(name = "tokens_cache_read", nullable = false)
  private int tokensCacheRead;

  @Column(name = "latency_ms", nullable = false)
  private int latencyMs;

  @Column(name = "cost_cents", nullable = false, precision = 8, scale = 4)
  private BigDecimal costCents = BigDecimal.ZERO;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  protected AIInsight() {}

  public AIInsight(
      String orgId,
      AIInsightKind kind,
      String entityType,
      String entityId,
      String model,
      String payloadJson,
      String inputHash) {
    this.orgId = orgId;
    this.kind = kind;
    this.entityType = entityType;
    this.entityId = entityId;
    this.model = model;
    this.payloadJson = payloadJson;
    this.inputHash = inputHash;
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

  public AIInsightKind getKind() {
    return kind;
  }

  public String getEntityType() {
    return entityType;
  }

  public String getEntityId() {
    return entityId;
  }

  public String getModel() {
    return model;
  }

  public String getPayloadJson() {
    return payloadJson;
  }

  public String getInputHash() {
    return inputHash;
  }

  public int getTokensInput() {
    return tokensInput;
  }

  public int getTokensOutput() {
    return tokensOutput;
  }

  public int getTokensCacheRead() {
    return tokensCacheRead;
  }

  public int getLatencyMs() {
    return latencyMs;
  }

  public BigDecimal getCostCents() {
    return costCents;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public void setTokensInput(int tokensInput) {
    this.tokensInput = tokensInput;
  }

  public void setTokensOutput(int tokensOutput) {
    this.tokensOutput = tokensOutput;
  }

  public void setTokensCacheRead(int tokensCacheRead) {
    this.tokensCacheRead = tokensCacheRead;
  }

  public void setLatencyMs(int latencyMs) {
    this.latencyMs = latencyMs;
  }

  public void setCostCents(BigDecimal costCents) {
    this.costCents = costCents;
  }
}
