package com.throughline.weeklycommit.web;

import com.throughline.weeklycommit.application.CurrentUserResolver;
import com.throughline.weeklycommit.application.ai.ManagerDigestService;
import com.throughline.weeklycommit.domain.AIInsight;
import com.throughline.weeklycommit.domain.User;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Phase 6 — manual notification triggers used by the demo smoke (PRD §12 Phase 8 Slack health
 * smoke). Production traffic flows through the schedulers + lifecycle listeners; this controller
 * exists so an operator (or smoke script) can force a dispatch on demand.
 */
@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationController {

  private final ManagerDigestService digestService;
  private final CurrentUserResolver currentUser;

  public NotificationController(
      ManagerDigestService digestService, CurrentUserResolver currentUser) {
    this.digestService = digestService;
    this.currentUser = currentUser;
  }

  /**
   * Manually run the T5 digest pipeline for the calling manager — generates the insight and
   * dispatches the notification event. Idempotency is enforced by the digest unique index in V4
   * (P20/P38): a duplicate within the same week persists as SKIPPED_DUPLICATE.
   */
  @PostMapping("/digest/run")
  @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
  public ResponseEntity<Map<String, String>> runDigest() {
    User caller = currentUser.requireCurrentUser();
    AIInsight insight = digestService.runDigest(caller);
    return ResponseEntity.status(HttpStatus.ACCEPTED)
        .body(
            Map.of(
                "insightId", insight.getId(),
                "model", insight.getModel(),
                "managerId", caller.getId()));
  }
}
