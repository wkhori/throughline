package com.throughline.weeklycommit.web;

import com.throughline.weeklycommit.application.CurrentUserResolver;
import com.throughline.weeklycommit.application.week.ReconcileService;
import com.throughline.weeklycommit.application.week.WeekService;
import com.throughline.weeklycommit.web.dto.WeekDtos;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/weeks")
public class WeekController {

  private final WeekService weekService;
  private final ReconcileService reconcileService;
  private final CurrentUserResolver currentUser;

  public WeekController(
      WeekService weekService, ReconcileService reconcileService, CurrentUserResolver currentUser) {
    this.weekService = weekService;
    this.reconcileService = reconcileService;
    this.currentUser = currentUser;
  }

  @GetMapping("/current")
  public ResponseEntity<WeekDtos.WeekDto> getCurrent() {
    return ResponseEntity.ok(weekService.getOrCreateCurrentWeek(currentUser.requireCurrentUser()));
  }

  @GetMapping("/{id}")
  public ResponseEntity<WeekDtos.WeekDto> getById(@PathVariable String id) {
    return ResponseEntity.ok(weekService.getWeek(id, currentUser.requireCurrentUser()));
  }

  @PostMapping("/{id}/lock")
  public ResponseEntity<WeekDtos.LockResponse> lock(@PathVariable String id) {
    return ResponseEntity.ok(weekService.lock(id, currentUser.requireCurrentUser()));
  }

  @PostMapping("/{id}/reconcile-start")
  public ResponseEntity<WeekDtos.WeekDto> reconcileStart(@PathVariable String id) {
    return ResponseEntity.ok(reconcileService.startReconcile(id, currentUser.requireCurrentUser()));
  }

  @PutMapping("/{id}/reconcile")
  public ResponseEntity<WeekDtos.ReconcileResponse> reconcile(
      @PathVariable String id, @RequestBody @Valid WeekDtos.ReconcileRequest req) {
    return ResponseEntity.ok(
        reconcileService.submitReconcile(id, req, currentUser.requireCurrentUser()));
  }
}
