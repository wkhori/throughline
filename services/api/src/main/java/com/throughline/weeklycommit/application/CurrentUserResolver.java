package com.throughline.weeklycommit.application;

import com.throughline.weeklycommit.domain.User;
import com.throughline.weeklycommit.domain.repo.UserRepository;
import com.throughline.weeklycommit.web.error.NotFoundException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class CurrentUserResolver {

  private final UserRepository userRepository;

  public CurrentUserResolver(UserRepository userRepository) {
    this.userRepository = userRepository;
  }

  @Transactional(readOnly = true)
  public User requireCurrentUser() {
    var auth = SecurityContextHolder.getContext().getAuthentication();
    if (auth instanceof JwtAuthenticationToken jwt) {
      String sub = jwt.getToken().getSubject();
      return userRepository
          .findByAuth0Sub(sub)
          .orElseThrow(() -> new NotFoundException("User(sub)", sub));
    }
    throw new NotFoundException("Authentication", "(missing)");
  }
}
