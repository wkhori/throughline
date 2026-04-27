package com.throughline.weeklycommit.web;

import com.throughline.weeklycommit.application.CurrentUserResolver;
import com.throughline.weeklycommit.application.rcdo.RcdoService;
import com.throughline.weeklycommit.web.dto.RcdoDtos;
import com.throughline.weeklycommit.web.dto.RcdoDtos.CreateDefiningObjectiveRequest;
import com.throughline.weeklycommit.web.dto.RcdoDtos.CreateOutcomeRequest;
import com.throughline.weeklycommit.web.dto.RcdoDtos.CreateRallyCryRequest;
import com.throughline.weeklycommit.web.dto.RcdoDtos.CreateSupportingOutcomeRequest;
import com.throughline.weeklycommit.web.dto.RcdoDtos.UpdateRallyCryRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class RcdoController {

  private final RcdoService rcdoService;
  private final CurrentUserResolver currentUser;

  public RcdoController(RcdoService rcdoService, CurrentUserResolver currentUser) {
    this.rcdoService = rcdoService;
    this.currentUser = currentUser;
  }

  @GetMapping("/rcdo/tree")
  public ResponseEntity<RcdoDtos.TreeDto> getTree() {
    String orgId = currentUser.requireCurrentUser().getOrgId();
    return ResponseEntity.ok(rcdoService.getTree(orgId));
  }

  @PostMapping("/admin/rally-cries")
  @PreAuthorize("hasRole('ADMIN')")
  public ResponseEntity<RcdoDtos.RallyCryDto> createRallyCry(
      @RequestBody @Valid CreateRallyCryRequest req) {
    String orgId = currentUser.requireCurrentUser().getOrgId();
    return ResponseEntity.status(HttpStatus.CREATED).body(rcdoService.createRallyCry(orgId, req));
  }

  @PutMapping("/admin/rally-cries/{id}")
  @PreAuthorize("hasRole('ADMIN')")
  public ResponseEntity<RcdoDtos.RallyCryDto> updateRallyCry(
      @PathVariable String id, @RequestBody @Valid UpdateRallyCryRequest req) {
    return ResponseEntity.ok(rcdoService.updateRallyCry(id, req));
  }

  @DeleteMapping("/admin/rally-cries/{id}")
  @PreAuthorize("hasRole('ADMIN')")
  public ResponseEntity<Void> deleteRallyCry(@PathVariable String id) {
    rcdoService.archiveRallyCry(id);
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/admin/defining-objectives")
  @PreAuthorize("hasRole('ADMIN')")
  public ResponseEntity<RcdoDtos.DefiningObjectiveDto> createDefiningObjective(
      @RequestBody @Valid CreateDefiningObjectiveRequest req) {
    return ResponseEntity.status(HttpStatus.CREATED).body(rcdoService.createDefiningObjective(req));
  }

  @PostMapping("/admin/outcomes")
  @PreAuthorize("hasRole('ADMIN')")
  public ResponseEntity<RcdoDtos.OutcomeDto> createOutcome(
      @RequestBody @Valid CreateOutcomeRequest req) {
    return ResponseEntity.status(HttpStatus.CREATED).body(rcdoService.createOutcome(req));
  }

  @PostMapping("/admin/supporting-outcomes")
  @PreAuthorize("hasRole('ADMIN')")
  public ResponseEntity<RcdoDtos.SupportingOutcomeDto> createSupportingOutcome(
      @RequestBody @Valid CreateSupportingOutcomeRequest req) {
    return ResponseEntity.status(HttpStatus.CREATED).body(rcdoService.createSupportingOutcome(req));
  }

  @DeleteMapping("/admin/supporting-outcomes/{id}")
  @PreAuthorize("hasRole('ADMIN')")
  public ResponseEntity<Void> deleteSupportingOutcome(@PathVariable String id) {
    rcdoService.archiveSupportingOutcome(id);
    return ResponseEntity.noContent().build();
  }
}
