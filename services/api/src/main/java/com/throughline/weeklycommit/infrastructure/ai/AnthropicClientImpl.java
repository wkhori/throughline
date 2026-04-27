package com.throughline.weeklycommit.infrastructure.ai;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.Duration;
import java.util.Locale;
import java.util.concurrent.TimeUnit;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.ResponseBody;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Real Anthropic Messages API client. Active when {@code anthropic.api-key} is non-blank — the stub
 * (see {@code StubAnthropicClient} {@code @TestConfiguration}) takes over otherwise.
 *
 * <p>Implements:
 *
 * <ul>
 *   <li>Prompt-caching beta header ({@code anthropic-beta: prompt-caching-2024-07-31}) — system
 *       prompt is marked {@code cache_control: ephemeral} so subsequent calls within ~5min hit the
 *       cache (PRD §6.3 — 1hr stated cache is the soft TTL; the API guarantees ~5min ephemeral).
 *   <li>Per-model timeouts: Haiku 2.5s read, Sonnet 25s read (both 2s connect).
 *   <li>Per-model retry: Haiku 1× @ 400ms; Sonnet 3× @ 500ms / 1500ms / 4000ms.
 * </ul>
 */
@Component
@ConditionalOnProperty(prefix = "anthropic", name = "api-key")
public class AnthropicClientImpl implements AnthropicClient {

  private static final Logger LOG = LoggerFactory.getLogger(AnthropicClientImpl.class);
  private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");
  private static final String CACHE_HEADER_VALUE = "prompt-caching-2024-07-31";

  private final ObjectMapper mapper = new ObjectMapper();
  private final OkHttpClient haikuHttp;
  private final OkHttpClient sonnetHttp;

  private final String apiKey;
  private final String baseUrl;
  private final String anthropicVersion;
  private final String haikuModel;
  private final String sonnetModel;

  public AnthropicClientImpl(
      @Value("${anthropic.api-key}") String apiKey,
      @Value("${anthropic.base-url:https://api.anthropic.com}") String baseUrl,
      @Value("${anthropic.version:2023-06-01}") String anthropicVersion,
      @Value("${anthropic.model.haiku:claude-haiku-4-5-20251001}") String haikuModel,
      @Value("${anthropic.model.sonnet:claude-sonnet-4-6}") String sonnetModel,
      @Value("${anthropic.request.connect-timeout-ms:2000}") int connectTimeoutMs) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.anthropicVersion = anthropicVersion;
    this.haikuModel = haikuModel;
    this.sonnetModel = sonnetModel;
    this.haikuHttp = buildClient(connectTimeoutMs, 2500);
    this.sonnetHttp = buildClient(connectTimeoutMs, 25_000);
  }

  private OkHttpClient buildClient(int connectMs, int readMs) {
    return new OkHttpClient.Builder()
        .connectTimeout(Duration.ofMillis(connectMs))
        .readTimeout(Duration.ofMillis(readMs))
        .writeTimeout(Duration.ofMillis(connectMs))
        .build();
  }

  @Override
  public AnthropicResponse send(AnthropicRequest request) {
    long started = System.currentTimeMillis();
    boolean isHaiku = request.model() == AnthropicModel.HAIKU;
    OkHttpClient http = isHaiku ? haikuHttp : sonnetHttp;
    long[] backoffsMs = isHaiku ? new long[] {400} : new long[] {500, 1500, 4000};
    String body = buildRequestBody(request);
    Request httpRequest = buildHttpRequest(body);

    Throwable lastErr = null;
    int lastStatus = 0;
    String lastBody = null;
    for (int attempt = 0; attempt <= backoffsMs.length; attempt++) {
      if (attempt > 0) sleep(backoffsMs[attempt - 1]);
      try (Response resp = http.newCall(httpRequest).execute()) {
        lastStatus = resp.code();
        ResponseBody rb = resp.body();
        lastBody = rb == null ? "" : rb.string();
        if (resp.isSuccessful()) {
          return parseResponse(lastBody, (int) (System.currentTimeMillis() - started));
        }
        if (resp.code() < 500 && resp.code() != 429) {
          throw new AnthropicException(
              resp.code(), "Anthropic non-retryable error: " + truncate(lastBody, 240));
        }
      } catch (java.io.IOException e) {
        lastErr = e;
      }
    }
    throw new AnthropicException(
        lastStatus == 0 ? 502 : lastStatus,
        "Anthropic call failed after retries: "
            + (lastErr != null ? lastErr.getMessage() : truncate(lastBody, 240)),
        lastErr);
  }

  private Request buildHttpRequest(String body) {
    return new Request.Builder()
        .url(baseUrl + "/v1/messages")
        .header("x-api-key", apiKey)
        .header("anthropic-version", anthropicVersion)
        .header("anthropic-beta", CACHE_HEADER_VALUE)
        .header("content-type", "application/json")
        .post(RequestBody.create(body, JSON))
        .build();
  }

  private String buildRequestBody(AnthropicRequest request) {
    ObjectNode root = mapper.createObjectNode();
    root.put("model", modelId(request.model()));
    root.put("max_tokens", request.maxTokens());
    root.put("temperature", 0);
    // System block — array form so we can attach cache_control: ephemeral.
    ArrayNode system = root.putArray("system");
    ObjectNode sysBlock = system.addObject();
    sysBlock.put("type", "text");
    sysBlock.put("text", request.systemPrompt());
    sysBlock.putObject("cache_control").put("type", "ephemeral");
    // User message.
    ArrayNode messages = root.putArray("messages");
    ObjectNode userMsg = messages.addObject();
    userMsg.put("role", "user");
    ArrayNode userContent = userMsg.putArray("content");
    ObjectNode userBlock = userContent.addObject();
    userBlock.put("type", "text");
    userBlock.put("text", request.userPrompt());
    try {
      return mapper.writeValueAsString(root);
    } catch (JsonProcessingException e) {
      throw new IllegalStateException("Failed to serialize Anthropic request", e);
    }
  }

  private AnthropicResponse parseResponse(String body, int latencyMs) {
    JsonNode root;
    try {
      root = mapper.readTree(body);
    } catch (JsonProcessingException e) {
      throw new AnthropicInvalidJsonException("Anthropic envelope parse failed", body);
    }
    String model = root.path("model").asText("");
    JsonNode usage = root.path("usage");
    int tokensInput = usage.path("input_tokens").asInt(0);
    int tokensOutput = usage.path("output_tokens").asInt(0);
    int tokensCacheRead = usage.path("cache_read_input_tokens").asInt(0);
    JsonNode content = root.path("content");
    StringBuilder text = new StringBuilder();
    if (content.isArray()) {
      for (JsonNode block : content) {
        if ("text".equals(block.path("type").asText())) {
          text.append(block.path("text").asText());
        }
      }
    }
    String contentJson = stripMarkdownFences(text.toString().trim());
    if (contentJson.isEmpty() || (!contentJson.startsWith("{") && !contentJson.startsWith("["))) {
      throw new AnthropicInvalidJsonException(
          "Anthropic content was not a JSON object/array", contentJson);
    }
    LOG.debug(
        "anthropic_call model={} tokensIn={} tokensOut={} cacheRead={} latencyMs={}",
        model,
        tokensInput,
        tokensOutput,
        tokensCacheRead,
        latencyMs);
    return new AnthropicResponse(
        model, contentJson, tokensInput, tokensOutput, tokensCacheRead, latencyMs);
  }

  /**
   * Some Anthropic responses wrap structured JSON output in markdown fences (```json … ```).
   * Strip them before validating so the downstream parser sees raw JSON.
   */
  static String stripMarkdownFences(String s) {
    if (s == null) return "";
    String t = s.trim();
    if (t.startsWith("```")) {
      // remove leading ```lang\n
      int firstNewline = t.indexOf('\n');
      if (firstNewline > 0) {
        t = t.substring(firstNewline + 1);
      } else {
        t = t.substring(3);
      }
      // remove trailing ```
      if (t.endsWith("```")) {
        t = t.substring(0, t.length() - 3);
      }
      t = t.trim();
    }
    return t;
  }

  private String modelId(AnthropicModel m) {
    return switch (m) {
      case HAIKU -> haikuModel;
      case SONNET -> sonnetModel;
    };
  }

  private static void sleep(long ms) {
    try {
      TimeUnit.MILLISECONDS.sleep(ms);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
  }

  private static String truncate(String s, int max) {
    if (s == null) return "";
    return s.length() <= max ? s : s.substring(0, max).toLowerCase(Locale.ROOT);
  }
}
