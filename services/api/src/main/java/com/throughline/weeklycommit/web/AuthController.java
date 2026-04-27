package com.throughline.weeklycommit.web;

import com.throughline.weeklycommit.application.CurrentUserResolver;
import com.throughline.weeklycommit.domain.User;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class AuthController {

  private final CurrentUserResolver currentUser;

  public AuthController(CurrentUserResolver currentUser) {
    this.currentUser = currentUser;
  }

  @GetMapping("/me")
  public ResponseEntity<MeDto> me() {
    User u = currentUser.requireCurrentUser();
    return ResponseEntity.ok(
        new MeDto(
            u.getId(),
            u.getOrgId(),
            u.getTeamId(),
            u.getEmail(),
            u.getDisplayName(),
            u.getRole().name(),
            u.getManagerId(),
            List.of(u.getRole().name())));
  }

  public record MeDto(
      String id,
      String orgId,
      String teamId,
      String email,
      String displayName,
      String role,
      String managerId,
      List<String> permissions) {}
}
