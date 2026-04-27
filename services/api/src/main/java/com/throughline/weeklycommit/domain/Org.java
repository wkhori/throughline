package com.throughline.weeklycommit.domain;

import com.throughline.weeklycommit.infrastructure.persistence.AbstractAuditingEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "org")
public class Org extends AbstractAuditingEntity {

  @Column(nullable = false, length = 200)
  private String name;

  @Column(nullable = false, length = 64)
  private String timezone = "America/New_York";

  @Column(name = "week_start_day", nullable = false, length = 10)
  private String weekStartDay = "MONDAY";

  protected Org() {}

  public Org(String name) {
    this.name = name;
  }

  public String getName() {
    return name;
  }

  public String getTimezone() {
    return timezone;
  }

  public String getWeekStartDay() {
    return weekStartDay;
  }

  public void setName(String name) {
    this.name = name;
  }

  public void setTimezone(String timezone) {
    this.timezone = timezone;
  }

  public void setWeekStartDay(String weekStartDay) {
    this.weekStartDay = weekStartDay;
  }
}
