package com.throughline.weeklycommit.web;

import com.throughline.weeklycommit.application.CurrentUserResolver;
import com.throughline.weeklycommit.application.metrics.MetricsService;
import com.throughline.weeklycommit.web.dto.MetricsDtos;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Phase 7 — read-only metrics endpoint. Scoped to ADMIN per PRD §10.5; the org metrics surface is
 * deliberately not exposed to MANAGER (the manager dashboard already shows the underlying signals
 * in pre-digested form).
 */
@RestController
@RequestMapping("/api/v1/metrics")
public class MetricsController {

  private final MetricsService metrics;
  private final CurrentUserResolver currentUser;

  public MetricsController(MetricsService metrics, CurrentUserResolver currentUser) {
    this.metrics = metrics;
    this.currentUser = currentUser;
  }

  @GetMapping("/org")
  @PreAuthorize("hasRole('ADMIN')")
  public ResponseEntity<MetricsDtos.OrgMetrics> orgMetrics() {
    String orgId = currentUser.requireCurrentUser().getOrgId();
    return ResponseEntity.ok(metrics.computeForOrg(orgId));
  }
}
