package com.throughline.weeklycommit.infrastructure.persistence;

import java.util.Optional;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.AuditorAware;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component("auditorProvider")
@Configuration
public class AuditorProvider implements AuditorAware<String> {

  @Override
  public Optional<String> getCurrentAuditor() {
    Authentication a = SecurityContextHolder.getContext().getAuthentication();
    if (a == null || !a.isAuthenticated()) return Optional.of("system");
    return Optional.ofNullable(a.getName()).or(() -> Optional.of("system"));
  }
}
