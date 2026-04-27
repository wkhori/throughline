package com.throughline.weeklycommit.domain;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;

/**
 * Persistent audit snapshot of the per-user-per-hour AI rate counter (P23). The hot path lives in
 * {@code AnthropicCostGuard}'s Caffeine cache; this row is the durable record + crash-safety
 * fallback.
 */
@Entity
@Table(name = "ai_user_hour_counter")
public class AIUserHourCounter {

  @EmbeddedId private AIUserHourCounterId id;

  @Column(name = "call_count", nullable = false)
  private int callCount;

  protected AIUserHourCounter() {}

  public AIUserHourCounter(String userId, Instant hourStart, String kind) {
    this.id = new AIUserHourCounterId(userId, hourStart, kind);
  }

  public AIUserHourCounterId getId() {
    return id;
  }

  public int getCallCount() {
    return callCount;
  }

  public void setCallCount(int callCount) {
    this.callCount = callCount;
  }

  public void increment() {
    this.callCount++;
  }

  /** Composite primary key. */
  @jakarta.persistence.Embeddable
  public static class AIUserHourCounterId implements Serializable {

    @Column(name = "user_id", nullable = false, length = 26)
    private String userId;

    @Column(name = "hour_start", nullable = false)
    private Instant hourStart;

    @Column(nullable = false, length = 20)
    private String kind;

    protected AIUserHourCounterId() {}

    public AIUserHourCounterId(String userId, Instant hourStart, String kind) {
      this.userId = userId;
      this.hourStart = hourStart;
      this.kind = kind;
    }

    public String getUserId() {
      return userId;
    }

    public Instant getHourStart() {
      return hourStart;
    }

    public String getKind() {
      return kind;
    }

    @Override
    public boolean equals(Object o) {
      if (this == o) return true;
      if (!(o instanceof AIUserHourCounterId other)) return false;
      return Objects.equals(userId, other.userId)
          && Objects.equals(hourStart, other.hourStart)
          && Objects.equals(kind, other.kind);
    }

    @Override
    public int hashCode() {
      return Objects.hash(userId, hourStart, kind);
    }
  }
}
