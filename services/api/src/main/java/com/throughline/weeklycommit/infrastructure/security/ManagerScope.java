package com.throughline.weeklycommit.infrastructure.security;

import com.throughline.weeklycommit.domain.User;
import com.throughline.weeklycommit.domain.repo.UserRepository;
import java.util.HashSet;
import java.util.Optional;
import java.util.Set;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * P9 + P15. {@code @PreAuthorize("@managerScope.canSee(#userId, principal)")} delegates here.
 *
 * <p>Rules:
 *
 * <ul>
 *   <li>The authenticated user can always see themselves.
 *   <li>{@code ROLE_ADMIN} bypasses scope.
 *   <li>A manager can see any direct or transitive report — we walk {@code User.managerId} up from
 *       the target until we hit the caller, the org root, or a cycle guard.
 * </ul>
 */
@Component("managerScope")
public class ManagerScope {

  static final int MAX_HIERARCHY_DEPTH = 16;

  private final UserRepository userRepository;

  public ManagerScope(UserRepository userRepository) {
    this.userRepository = userRepository;
  }

  @Transactional(readOnly = true)
  public boolean canSee(String targetUserId, Object principal) {
    if (principal == null || targetUserId == null) return false;
    Authentication auth = principalAsAuth(principal);
    if (auth == null) return false;

    if (hasRole(auth, "ROLE_ADMIN")) return true;

    Optional<User> caller = resolveCaller(auth);
    if (caller.isEmpty()) return false;

    if (caller.get().getId().equals(targetUserId)) return true;
    if (!hasRole(auth, "ROLE_MANAGER")) return false;

    return walksToCaller(targetUserId, caller.get().getId());
  }

  private boolean walksToCaller(String targetUserId, String callerId) {
    String cursor = targetUserId;
    Set<String> visited = new HashSet<>();
    for (int i = 0; i < MAX_HIERARCHY_DEPTH; i++) {
      if (cursor == null || !visited.add(cursor)) return false;
      Optional<User> u = userRepository.findById(cursor);
      if (u.isEmpty()) return false;
      String managerId = u.get().getManagerId();
      if (managerId == null) return false;
      if (managerId.equals(callerId)) return true;
      cursor = managerId;
    }
    return false;
  }

  private Authentication principalAsAuth(Object principal) {
    if (principal instanceof Authentication a) return a;
    return null;
  }

  private Optional<User> resolveCaller(Authentication auth) {
    if (auth instanceof JwtAuthenticationToken token) {
      Jwt jwt = token.getToken();
      String sub = jwt.getSubject();
      if (sub != null) return userRepository.findByAuth0Sub(sub);
    }
    return Optional.empty();
  }

  private boolean hasRole(Authentication auth, String role) {
    return auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals(role));
  }
}
