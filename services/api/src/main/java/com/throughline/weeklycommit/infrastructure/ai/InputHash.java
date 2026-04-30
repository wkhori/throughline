package com.throughline.weeklycommit.infrastructure.ai;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/**
 * sha256 helpers used by both the legacy 60s {@code input_hash} dedupe and the persistent V7 {@code
 * cache_key} substrate. {@link #of(String)} hashes a single user prompt; {@link
 * #computeCacheKey(String, String, String)} hashes the canonicalized {@code modelVersion + kind +
 * inputJson} tuple so identical logical inputs share one row across sessions.
 */
public final class InputHash {

  private InputHash() {}

  public static String of(String userPrompt) {
    return sha256(userPrompt);
  }

  /**
   * Persistent cache key — sha256 over {@code modelVersion + ":" + kind + ":" +
   * canonicalizedInputJson}. Callers must canonicalize {@code inputJson} (alphabetical map / field
   * order, deterministic array order) before invoking; the helper neither sorts nor parses.
   */
  public static String computeCacheKey(
      String modelVersion, String kind, String canonicalInputJson) {
    return sha256(modelVersion + ":" + kind + ":" + canonicalInputJson);
  }

  private static String sha256(String value) {
    try {
      MessageDigest md = MessageDigest.getInstance("SHA-256");
      byte[] out = md.digest(value.getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(out);
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("sha-256 missing", e);
    }
  }
}
