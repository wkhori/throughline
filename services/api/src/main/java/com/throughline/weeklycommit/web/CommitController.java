package com.throughline.weeklycommit.web;

import com.throughline.weeklycommit.application.CurrentUserResolver;
import com.throughline.weeklycommit.application.commit.CommitService;
import com.throughline.weeklycommit.web.dto.WeekDtos;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/commits")
public class CommitController {

  private final CommitService commitService;
  private final CurrentUserResolver currentUser;

  public CommitController(CommitService commitService, CurrentUserResolver currentUser) {
    this.commitService = commitService;
    this.currentUser = currentUser;
  }

  @PostMapping
  public ResponseEntity<WeekDtos.CommitDto> create(
      @RequestBody @Valid WeekDtos.CreateCommitRequest req) {
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(commitService.create(req, currentUser.requireCurrentUser()));
  }

  @PutMapping("/{id}")
  public ResponseEntity<WeekDtos.CommitDto> update(
      @PathVariable String id, @RequestBody @Valid WeekDtos.UpdateCommitRequest req) {
    return ResponseEntity.ok(commitService.update(id, req, currentUser.requireCurrentUser()));
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@PathVariable String id) {
    commitService.delete(id, currentUser.requireCurrentUser());
    return ResponseEntity.noContent().build();
  }
}
