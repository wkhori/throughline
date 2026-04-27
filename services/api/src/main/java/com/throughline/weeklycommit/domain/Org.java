package com.throughline.weeklycommit.domain;

import com.throughline.weeklycommit.infrastructure.persistence.AbstractAuditingEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.DayOfWeek;
import java.time.LocalTime;

@Entity
@Table(name = "org")
public class Org extends AbstractAuditingEntity {

  @Column(nullable = false, length = 200)
  private String name;

  @Column(nullable = false, length = 64)
  private String timezone = "America/New_York";

  @Column(name = "week_start_day", nullable = false, length = 10)
  private String weekStartDay = "MONDAY";

  // P18: when the reconcile window opens for ICs in this org. Default Friday 12:00 in org TZ.
  @Column(name = "reconcile_opens_day_of_week", nullable = false, length = 10)
  private String reconcileOpensDayOfWeek = "FRIDAY";

  @Column(name = "reconcile_opens_time", nullable = false)
  private LocalTime reconcileOpensTime = LocalTime.of(12, 0);

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

  public DayOfWeek getReconcileOpensDayOfWeek() {
    return DayOfWeek.valueOf(reconcileOpensDayOfWeek);
  }

  public LocalTime getReconcileOpensTime() {
    return reconcileOpensTime;
  }

  public void setReconcileOpensDayOfWeek(DayOfWeek d) {
    this.reconcileOpensDayOfWeek = d.name();
  }

  public void setReconcileOpensTime(LocalTime t) {
    this.reconcileOpensTime = t;
  }

  public DayOfWeek getWeekStartDayOfWeek() {
    return DayOfWeek.valueOf(weekStartDay);
  }
}
