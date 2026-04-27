package com.throughline.weeklycommit.infrastructure.security;

import java.util.Collection;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

/**
 * Maps the Auth0 {@code permissions} array claim to Spring authorities prefixed with {@code ROLE_}.
 * The {@link RoleHierarchyConfig} bean expands these so a {@code ROLE_ADMIN} JWT also satisfies
 * {@code @PreAuthorize("hasRole('IC')")} without explicit fan-out (P6).
 */
public class JwtAuthConverter implements Converter<Jwt, AbstractAuthenticationToken> {

  @Override
  public AbstractAuthenticationToken convert(Jwt jwt) {
    Collection<GrantedAuthority> authorities = extractAuthorities(jwt);
    String principal = jwt.getSubject();
    return new JwtAuthenticationToken(jwt, authorities, principal);
  }

  @SuppressWarnings("unchecked")
  private Collection<GrantedAuthority> extractAuthorities(Jwt jwt) {
    Object permissions = jwt.getClaim("permissions");
    Stream<String> stream =
        switch (permissions) {
          case List<?> list -> list.stream().map(String::valueOf);
          case String s -> Stream.of(s);
          case null -> Stream.empty();
          default -> Stream.empty();
        };
    return stream
        .map(p -> p.toUpperCase())
        .map(p -> new SimpleGrantedAuthority("ROLE_" + p))
        .collect(Collectors.toUnmodifiableSet());
  }
}
