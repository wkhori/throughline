package com.throughline.weeklycommit.infrastructure.notifications;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicReference;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * P26 — Slack readiness probe. Posts a single `{"text":""}` heartbeat to the configured webhook
 * (Slack accepts this as a no-op probe and replies with HTTP 200) on app boot, then once every 5
 * minutes. The result is cached so {@code /actuator/health/readiness} can reflect the channel's
 * health without re-hitting Slack on every probe call.
 *
 * <p>Active only when {@code app.notifications.channel=slack}; in {@code log} mode the bean is
 * absent and Spring's default health indicators apply.
 */
@Component
@ConditionalOnProperty(prefix = "app.notifications", name = "channel", havingValue = "slack")
public class SlackHealthIndicator implements HealthIndicator {

  private static final Logger LOG = LoggerFactory.getLogger(SlackHealthIndicator.class);
  private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");
  /** Slack accepts an empty-text payload by replying 400 "no_text" — but it proves the webhook is
   *  reachable and well-formed, which is the only thing readiness probes need. We treat any 2xx
   *  OR a 400 with body "no_text" as healthy. */
  private static final String EMPTY_BODY = "{\"text\":\"\"}";

  private final OkHttpClient http;
  private final String webhookUrl;
  private final AtomicReference<Health> cached =
      new AtomicReference<>(Health.unknown().withDetail("reason", "not yet probed").build());

  public SlackHealthIndicator(@Value("${app.notifications.slack.webhook-url:}") String webhookUrl) {
    this.webhookUrl = webhookUrl;
    this.http =
        new OkHttpClient.Builder()
            .connectTimeout(Duration.ofMillis(2000))
            .readTimeout(Duration.ofMillis(3000))
            .writeTimeout(Duration.ofMillis(2000))
            .build();
  }

  @Override
  public Health health() {
    return cached.get();
  }

  /** Initial probe after a short startup delay; then every 5 minutes. */
  @Scheduled(initialDelayString = "PT15S", fixedDelayString = "PT5M")
  public void probe() {
    if (webhookUrl == null || webhookUrl.isBlank()) {
      cached.set(Health.down().withDetail("reason", "SLACK_WEBHOOK_URL not configured").build());
      return;
    }
    Request req =
        new Request.Builder()
            .url(webhookUrl)
            .post(RequestBody.create(EMPTY_BODY, JSON))
            .build();
    try (Response resp = http.newCall(req).execute()) {
      String body = resp.body() == null ? "" : resp.body().string();
      if (resp.isSuccessful()) {
        cached.set(Health.up().withDetail("status", resp.code()).build());
        return;
      }
      // Slack returns 400 "no_text" for empty-text probes — that's a healthy reachable webhook.
      if (resp.code() == 400 && body.contains("no_text")) {
        cached.set(Health.up().withDetail("status", 400).withDetail("note", "no_text").build());
        return;
      }
      cached.set(
          Health.down().withDetail("status", resp.code()).withDetail("body", trim(body)).build());
    } catch (Exception ex) {
      LOG.warn("slack_health_probe_io_error err={}", ex.getMessage());
      cached.set(Health.down().withDetail("io", ex.getMessage()).build());
    }
  }

  private String trim(String s) {
    if (s == null) return "";
    return s.length() > 200 ? s.substring(0, 200) : s;
  }
}
