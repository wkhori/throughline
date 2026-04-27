package com.throughline.weeklycommit.domain;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Materialized per-team manager rollup payload (PRD §3.3 V5 / P10 / P25). Composite key {@code
 * (teamId, weekStart)}; payload is JSON authored by {@code MaterializedRollupJob.computePayload}.
 *
 * <p>{@code @JdbcTypeCode(SqlTypes.JSON)} maps the Java {@code String} to a Postgres {@code jsonb}
 * column with no extra dependency (Hibernate 6.5 has native JSON support).
 */
@Entity
@Table(name = "team_rollup_cache")
public class TeamRollupCache {

  @EmbeddedId private TeamRollupCacheId id;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "payload_json", nullable = false, columnDefinition = "jsonb")
  private String payloadJson;

  @Column(name = "computed_at", nullable = false)
  private Instant computedAt;

  protected TeamRollupCache() {}

  public TeamRollupCache(
      String teamId, LocalDate weekStart, String payloadJson, Instant computedAt) {
    this.id = new TeamRollupCacheId(teamId, weekStart);
    this.payloadJson = payloadJson;
    this.computedAt = computedAt;
  }

  public TeamRollupCacheId getId() {
    return id;
  }

  public String getTeamId() {
    return id == null ? null : id.getTeamId();
  }

  public LocalDate getWeekStart() {
    return id == null ? null : id.getWeekStart();
  }

  public String getPayloadJson() {
    return payloadJson;
  }

  public Instant getComputedAt() {
    return computedAt;
  }

  public void setPayloadJson(String payloadJson) {
    this.payloadJson = payloadJson;
  }

  public void setComputedAt(Instant computedAt) {
    this.computedAt = computedAt;
  }

  /** Composite primary key for {@link TeamRollupCache}. */
  @jakarta.persistence.Embeddable
  public static class TeamRollupCacheId implements Serializable {

    @Column(name = "team_id", nullable = false, length = 26)
    private String teamId;

    @Column(name = "week_start", nullable = false)
    private LocalDate weekStart;

    protected TeamRollupCacheId() {}

    public TeamRollupCacheId(String teamId, LocalDate weekStart) {
      this.teamId = teamId;
      this.weekStart = weekStart;
    }

    public String getTeamId() {
      return teamId;
    }

    public LocalDate getWeekStart() {
      return weekStart;
    }

    @Override
    public boolean equals(Object o) {
      if (this == o) return true;
      if (!(o instanceof TeamRollupCacheId other)) return false;
      return Objects.equals(teamId, other.teamId) && Objects.equals(weekStart, other.weekStart);
    }

    @Override
    public int hashCode() {
      return Objects.hash(teamId, weekStart);
    }
  }
}
