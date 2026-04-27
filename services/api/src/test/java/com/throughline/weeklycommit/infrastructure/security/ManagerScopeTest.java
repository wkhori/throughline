package com.throughline.weeklycommit.infrastructure.security;

import static org.assertj.core.api.Assertions.assertThat;

import com.throughline.weeklycommit.PostgresIntegrationTestBase;
import com.throughline.weeklycommit.TestDatabaseCleaner;
import com.throughline.weeklycommit.domain.Org;
import com.throughline.weeklycommit.domain.Role;
import com.throughline.weeklycommit.domain.User;
import com.throughline.weeklycommit.domain.repo.OrgRepository;
import com.throughline.weeklycommit.domain.repo.UserRepository;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

class ManagerScopeTest extends PostgresIntegrationTestBase {

  @Autowired ManagerScope managerScope;
  @Autowired UserRepository userRepo;
  @Autowired OrgRepository orgRepo;
  @Autowired TestDatabaseCleaner cleaner;

  String orgId;
  User admin;
  User managerA;
  User managerB;
  User icDirectOfA;
  User icTransitiveOfA;
  User icOfB;

  @BeforeEach
  void seed() {
    cleaner.clean();
    Org org = orgRepo.save(new Org("ACME"));
    orgId = org.getId();

    admin = userRepo.save(new User(orgId, "auth0|admin", "ad@x", "Admin", Role.ADMIN));
    managerA = userRepo.save(new User(orgId, "auth0|mgrA", "ma@x", "Manager A", Role.MANAGER));
    managerB = userRepo.save(new User(orgId, "auth0|mgrB", "mb@x", "Manager B", Role.MANAGER));
    icDirectOfA = userRepo.save(new User(orgId, "auth0|icA", "ica@x", "IC under A", Role.IC));
    icDirectOfA.setManagerId(managerA.getId());
    userRepo.save(icDirectOfA);

    User middleManager =
        userRepo.save(new User(orgId, "auth0|mid", "mid@x", "Middle", Role.MANAGER));
    middleManager.setManagerId(managerA.getId());
    userRepo.save(middleManager);
    icTransitiveOfA =
        userRepo.save(new User(orgId, "auth0|ict", "ict@x", "IC transitive", Role.IC));
    icTransitiveOfA.setManagerId(middleManager.getId());
    userRepo.save(icTransitiveOfA);

    icOfB = userRepo.save(new User(orgId, "auth0|icB", "icb@x", "IC under B", Role.IC));
    icOfB.setManagerId(managerB.getId());
    userRepo.save(icOfB);
  }

  private JwtAuthenticationToken jwtFor(String sub, String role) {
    Jwt jwt =
        Jwt.withTokenValue("t")
            .header("alg", "none")
            .subject(sub)
            .claim("permissions", List.of(role))
            .build();
    return new JwtAuthenticationToken(
        jwt, List.of(new SimpleGrantedAuthority("ROLE_" + role)), sub);
  }

  @Test
  void self_always_passes() {
    var auth = jwtFor("auth0|icA", "IC");
    assertThat(managerScope.canSee(icDirectOfA.getId(), auth)).isTrue();
  }

  @Test
  void admin_bypasses_scope_check() {
    var auth = jwtFor("auth0|admin", "ADMIN");
    assertThat(managerScope.canSee(icOfB.getId(), auth)).isTrue();
  }

  @Test
  void manager_can_see_direct_report() {
    var auth = jwtFor("auth0|mgrA", "MANAGER");
    assertThat(managerScope.canSee(icDirectOfA.getId(), auth)).isTrue();
  }

  @Test
  void manager_can_see_transitive_report() {
    var auth = jwtFor("auth0|mgrA", "MANAGER");
    assertThat(managerScope.canSee(icTransitiveOfA.getId(), auth)).isTrue();
  }

  @Test
  void manager_cannot_see_other_managers_reports() {
    var auth = jwtFor("auth0|mgrA", "MANAGER");
    assertThat(managerScope.canSee(icOfB.getId(), auth)).isFalse();
  }

  @Test
  void IC_cannot_see_others() {
    var auth = jwtFor("auth0|icA", "IC");
    assertThat(managerScope.canSee(icOfB.getId(), auth)).isFalse();
  }
}
