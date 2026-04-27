package com.throughline.weeklycommit.infrastructure.persistence;

import com.github.f4b6a3.ulid.UlidCreator;
import jakarta.persistence.Column;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Version;
import java.time.Instant;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/**
 * Single source of truth for audit columns. Every domain entity extends this — see CLAUDE.md §3 and
 * docs/architecture-decisions.md row 16.
 */
@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
public abstract class AbstractAuditingEntity {

  @Id
  @Column(length = 26, nullable = false, updatable = false)
  protected String id;

  @CreatedDate
  @Column(name = "created_at", nullable = false, updatable = false)
  protected Instant createdAt;

  @CreatedBy
  @Column(name = "created_by", length = 64, updatable = false)
  protected String createdBy;

  @LastModifiedDate
  @Column(name = "updated_at")
  protected Instant updatedAt;

  @LastModifiedBy
  @Column(name = "updated_by", length = 64)
  protected String updatedBy;

  @Version
  @Column(nullable = false)
  protected long version;

  @PrePersist
  protected void assignUlidIfMissing() {
    if (id == null) {
      id = UlidCreator.getMonotonicUlid().toString();
    }
  }

  public String getId() {
    return id;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public String getCreatedBy() {
    return createdBy;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }

  public String getUpdatedBy() {
    return updatedBy;
  }

  public long getVersion() {
    return version;
  }

  public void setId(String id) {
    this.id = id;
  }
}
