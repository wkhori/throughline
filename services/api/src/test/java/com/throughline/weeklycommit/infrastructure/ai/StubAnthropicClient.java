package com.throughline.weeklycommit.infrastructure.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.core.io.ClassPathResource;

/**
 * Stub used in {@code @SpringBootTest} runs that don't (or shouldn't) hit the real Anthropic API.
 *
 * <p>Returns deterministic JSON keyed by {@code promptTemplateName + sha1(userPrompt)} resolved
 * from {@code src/test/resources/fixtures/anthropic/<template>.json}. If a per-input fixture is
 * missing, falls back to {@code <template>.default.json}. Tests that need a specific shape can
 * register an in-memory override via {@link #register(String, String)} before the call.
 */
@TestConfiguration
public class StubAnthropicClient implements AnthropicClient {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final Map<String, String> OVERRIDES = new ConcurrentHashMap<>();

  /**
   * Test-side override: subsequent {@link #send} calls for {@code template} return {@code json}.
   */
  public static void register(String template, String json) {
    OVERRIDES.put(template, json);
  }

  /** Reset overrides — call from {@code @AfterEach} to keep tests independent. */
  public static void reset() {
    OVERRIDES.clear();
  }

  @Bean
  @Primary
  public AnthropicClient stubAnthropicClient() {
    return this;
  }

  @Override
  public AnthropicResponse send(AnthropicRequest request) {
    String contentJson = resolveContent(request);
    String modelId =
        request.model() == AnthropicModel.HAIKU ? "claude-haiku-4-5-20251001" : "claude-sonnet-4-6";
    return new AnthropicResponse(modelId, contentJson, 100, 80, 0, 12);
  }

  private String resolveContent(AnthropicRequest request) {
    String template = request.promptTemplateName();
    String override = OVERRIDES.get(template);
    if (override != null) return override;

    String hash = sha1(request.userPrompt());
    String specific = "fixtures/anthropic/" + template + "." + hash + ".json";
    String fallback = "fixtures/anthropic/" + template + ".default.json";
    String body = readClasspath(specific);
    if (body == null) body = readClasspath(fallback);
    if (body == null) {
      // Return a generic schema-shape: enough to satisfy parsers in tests where fixture absence
      // is incidental. Touchpoint-specific tests should provide a proper fixture or override.
      ObjectNode node = MAPPER.createObjectNode();
      node.put(
          "model",
          request.model() == AnthropicModel.HAIKU
              ? "claude-haiku-4-5-20251001"
              : "claude-sonnet-4-6");
      node.put("reasoning", "stub default — no fixture for " + template);
      return node.toString();
    }
    return body;
  }

  private static String readClasspath(String path) {
    ClassPathResource res = new ClassPathResource(path);
    if (!res.exists()) return null;
    try (InputStream in = res.getInputStream()) {
      return new String(in.readAllBytes(), StandardCharsets.UTF_8).trim();
    } catch (IOException e) {
      return null;
    }
  }

  private static String sha1(String s) {
    try {
      MessageDigest md = MessageDigest.getInstance("SHA-1");
      byte[] out = md.digest(s.getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(out);
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException(e);
    }
  }
}
