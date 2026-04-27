package com.throughline.weeklycommit.domain;

import com.throughline.weeklycommit.infrastructure.persistence.AbstractAuditingEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

@Entity
@Table(name = "app_user")
public class User extends AbstractAuditingEntity {

  @Column(name = "org_id", nullable = false, length = 26)
  private String orgId;

  @Column(name = "team_id", length = 26)
  private String teamId;

  @Column(name = "auth0_sub", nullable = false, length = 128, unique = true)
  private String auth0Sub;

  @Column(nullable = false, length = 320)
  private String email;

  @Column(name = "display_name", nullable = false, length = 200)
  private String displayName;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false, length = 20)
  private Role role;

  @Column(name = "manager_id", length = 26)
  private String managerId;

  protected User() {}

  public User(String orgId, String auth0Sub, String email, String displayName, Role role) {
    this.orgId = orgId;
    this.auth0Sub = auth0Sub;
    this.email = email;
    this.displayName = displayName;
    this.role = role;
  }

  public String getOrgId() {
    return orgId;
  }

  public String getTeamId() {
    return teamId;
  }

  public String getAuth0Sub() {
    return auth0Sub;
  }

  public String getEmail() {
    return email;
  }

  public String getDisplayName() {
    return displayName;
  }

  public Role getRole() {
    return role;
  }

  public String getManagerId() {
    return managerId;
  }

  public void setTeamId(String teamId) {
    this.teamId = teamId;
  }

  public void setManagerId(String managerId) {
    this.managerId = managerId;
  }

  public void setRole(Role role) {
    this.role = role;
  }

  public void setDisplayName(String displayName) {
    this.displayName = displayName;
  }
}
