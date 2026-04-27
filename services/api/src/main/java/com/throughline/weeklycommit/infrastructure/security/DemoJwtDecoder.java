package com.throughline.weeklycommit.infrastructure.security;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSObject;
import com.nimbusds.jose.crypto.MACVerifier;
import com.nimbusds.jwt.SignedJWT;
import java.text.ParseException;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;

/**
 * HS256 verifier for demo tokens minted by {@link DemoTokenIssuer}. Symmetric secret —
 * acceptable because both the minter and the verifier live inside the same Spring Boot service
 * (no token-issuing third party). Pure verification: signature, exp, iss, aud.
 */
public class DemoJwtDecoder implements JwtDecoder {

  private final byte[] secretBytes;
  private final String expectedAudience;

  public DemoJwtDecoder(String secret, String expectedAudience) {
    this.secretBytes = secret.getBytes(java.nio.charset.StandardCharsets.UTF_8);
    this.expectedAudience = expectedAudience;
  }

  @Override
  public Jwt decode(String token) throws JwtException {
    try {
      SignedJWT jwt = SignedJWT.parse(token);
      if (!jwt.verify(new MACVerifier(secretBytes))) {
        throw new JwtException("Demo token signature invalid");
      }
      var claims = jwt.getJWTClaimsSet();
      Instant exp = claims.getExpirationTime() == null ? null : claims.getExpirationTime().toInstant();
      Instant iat = claims.getIssueTime() == null ? null : claims.getIssueTime().toInstant();
      if (exp != null && exp.isBefore(Instant.now())) {
        throw new JwtException("Demo token expired at " + exp);
      }
      if (!DemoTokenIssuer.ISSUER.equals(claims.getIssuer())) {
        throw new JwtException("Demo token issuer mismatch: " + claims.getIssuer());
      }
      if (claims.getAudience() == null || !claims.getAudience().contains(expectedAudience)) {
        throw new JwtException("Demo token audience mismatch: " + claims.getAudience());
      }
      Map<String, Object> headers = new HashMap<>();
      headers.put("alg", jwt.getHeader().getAlgorithm().getName());
      headers.put("typ", "JWT");
      Map<String, Object> claimMap = new HashMap<>(claims.getClaims());
      // Spring Security expects audience as List<String>.
      claimMap.put("aud", List.copyOf(claims.getAudience()));
      return new Jwt(token, iat, exp, headers, claimMap);
    } catch (ParseException | JOSEException e) {
      throw new JwtException("Demo token decode failed: " + e.getMessage(), e);
    } catch (JwtException e) {
      throw e;
    }
  }

  /** Returns true if the token's payload identifies it as a Throughline demo token. */
  public static boolean looksLikeDemoToken(String token) {
    try {
      JWSObject obj = JWSObject.parse(token);
      String body = obj.getPayload().toString();
      return body.contains("\"iss\":\"" + DemoTokenIssuer.ISSUER + "\"");
    } catch (ParseException e) {
      return false;
    }
  }
}
