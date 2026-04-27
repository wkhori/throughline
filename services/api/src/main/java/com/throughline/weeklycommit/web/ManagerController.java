package com.throughline.weeklycommit.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.throughline.weeklycommit.application.CurrentUserResolver;
import com.throughline.weeklycommit.application.manager.ManagerService;
import com.throughline.weeklycommit.web.dto.ManagerDtos;
import com.throughline.weeklycommit.web.dto.WeekDtos;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Phase-4 manager dashboard endpoints (PRD §4.1 / P9 / P10 / P25).
 *
 * <p>Scope: the {@code /team/{userId}/week/current} endpoint runs through {@link
 * com.throughline.weeklycommit.infrastructure.security.ManagerScope#canSee} (P9). The other
 * endpoints scope by *caller's* role / managed teams in the service layer (a manager only ever sees
 * their own teams, ADMIN sees all).
 */
@RestController
@RequestMapping("/api/v1/manager")
public class ManagerController {

  private final ManagerService service;
  private final CurrentUserResolver currentUser;

  public ManagerController(ManagerService service, CurrentUserResolver currentUser) {
    this.service = service;
    this.currentUser = currentUser;
  }

  @GetMapping("/team-rollup")
  @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
  public ResponseEntity<Page<ManagerDtos.TeamRollupRow>> teamRollup(
      @PageableDefault(size = 50) Pageable pageable) {
    return ResponseEntity.ok(service.teamRollup(currentUser.requireCurrentUser(), pageable));
  }

  @GetMapping("/team/{userId}/week/current")
  @PreAuthorize("@managerScope.canSee(#userId, authentication)")
  public ResponseEntity<WeekDtos.WeekDto> teamMemberCurrentWeek(@PathVariable String userId) {
    return ResponseEntity.ok(service.teamMemberCurrentWeek(userId));
  }

  @GetMapping("/digest/current")
  @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
  public ResponseEntity<ManagerDtos.DigestEnvelope> currentDigest() {
    return ResponseEntity.ok(service.currentDigest());
  }

  @PostMapping("/digest/regenerate")
  @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
  public ResponseEntity<ManagerDtos.DigestRegenerateResponse> regenerateDigest() {
    return ResponseEntity.status(HttpStatus.ACCEPTED).body(service.regenerateDigest());
  }

  @GetMapping("/alignment-risks")
  @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
  public ResponseEntity<List<JsonNode>> alignmentRisks() {
    return ResponseEntity.ok(service.alignmentRisks());
  }

  /** P14: acknowledge an alignment risk. Same-org check enforced in the service. */
  @PostMapping("/alignment-risks/{id}/ack")
  @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
  public ResponseEntity<Void> ackAlignmentRisk(@PathVariable String id) {
    service.acknowledgeRisk(id, currentUser.requireCurrentUser());
    return ResponseEntity.noContent().build();
  }
}
