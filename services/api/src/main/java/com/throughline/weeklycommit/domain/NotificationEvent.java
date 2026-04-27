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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Outbound notification (PRD §3.3 V4 / §8). Audit row + retry record. Phase 5c writes here for T5
 * (manager digest) and T6 (alignment-risk alerts); Phase 6 will reuse this table for the rest of
 * the trigger inventory.
 */
@Entity
@Table(name = "notification_event")
public class NotificationEvent {

  @Id
  @Column(length = 26, nullable = false, updatable = false)
  private String id;

  @Column(name = "org_id", nullable = false, length = 26)
  private String orgId;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 40)
  private NotificationKind kind;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private NotificationChannelKind channel;

  @Column(name = "recipient_id", nullable = false, length = 26)
  private String recipientId;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "payload_json", nullable = false, columnDefinition = "jsonb")
  private String payloadJson;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 30)
  private NotificationState state = NotificationState.PENDING;

  @Column(nullable = false)
  private int attempts;

  @Column(name = "last_error")
  private String lastError;

  @Column(name = "sent_at")
  private Instant sentAt;

  /** P1 — set when the recipient first views the digest dashboard. Drives the
   *  `avgManagerDigestViewMinutesAfterDeliver` metric in {@code MetricsService}. */
  @Column(name = "viewed_at")
  private Instant viewedAt;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  protected NotificationEvent() {}

  public NotificationEvent(
      String orgId,
      NotificationKind kind,
      NotificationChannelKind channel,
      String recipientId,
      String payloadJson) {
    this.orgId = orgId;
    this.kind = kind;
    this.channel = channel;
    this.recipientId = recipientId;
    this.payloadJson = payloadJson;
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

  public NotificationKind getKind() {
    return kind;
  }

  public NotificationChannelKind getChannel() {
    return channel;
  }

  public String getRecipientId() {
    return recipientId;
  }

  public String getPayloadJson() {
    return payloadJson;
  }

  public NotificationState getState() {
    return state;
  }

  public int getAttempts() {
    return attempts;
  }

  public String getLastError() {
    return lastError;
  }

  public Instant getSentAt() {
    return sentAt;
  }

  public Instant getViewedAt() {
    return viewedAt;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public void setState(NotificationState state) {
    this.state = state;
  }

  public void setAttempts(int attempts) {
    this.attempts = attempts;
  }

  public void incrementAttempts() {
    this.attempts++;
  }

  public void setLastError(String lastError) {
    this.lastError = lastError;
  }

  public void setSentAt(Instant sentAt) {
    this.sentAt = sentAt;
  }

  public void setViewedAt(Instant viewedAt) {
    this.viewedAt = viewedAt;
  }
}
