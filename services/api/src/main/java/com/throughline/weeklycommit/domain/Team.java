package com.throughline.weeklycommit.domain;

import com.throughline.weeklycommit.infrastructure.persistence.AbstractAuditingEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "team")
public class Team extends AbstractAuditingEntity {

  @Column(name = "org_id", nullable = false, length = 26)
  private String orgId;

  @Column(nullable = false, length = 200)
  private String name;

  @Column(name = "manager_id", length = 26)
  private String managerId;

  protected Team() {}

  public Team(String orgId, String name) {
    this.orgId = orgId;
    this.name = name;
  }

  public String getOrgId() {
    return orgId;
  }

  public String getName() {
    return name;
  }

  public String getManagerId() {
    return managerId;
  }

  public void setManagerId(String managerId) {
    this.managerId = managerId;
  }

  public void setName(String name) {
    this.name = name;
  }
}
