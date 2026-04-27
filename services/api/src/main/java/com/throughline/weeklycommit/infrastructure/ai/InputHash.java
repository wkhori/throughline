package com.throughline.weeklycommit.infrastructure.ai;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/** sha256 of the per-call user prompt — keys the 60s insight cache (P13). */
public final class InputHash {

  private InputHash() {}

  public static String of(String userPrompt) {
    try {
      MessageDigest md = MessageDigest.getInstance("SHA-256");
      byte[] out = md.digest(userPrompt.getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(out);
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("sha-256 missing", e);
    }
  }
}
