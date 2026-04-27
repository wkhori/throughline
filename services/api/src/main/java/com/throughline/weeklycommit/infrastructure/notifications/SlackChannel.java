package com.throughline.weeklycommit.infrastructure.notifications;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.throughline.weeklycommit.domain.NotificationEvent;
import com.throughline.weeklycommit.domain.NotificationKind;
import com.throughline.weeklycommit.domain.NotificationState;
import com.throughline.weeklycommit.domain.repo.NotificationEventRepository;
import java.time.Clock;
import java.time.Duration;
import java.util.concurrent.TimeUnit;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Primary channel — POSTs Slack Block Kit JSON to {@code app.notifications.slack.webhook-url}.
 * Retries 3× on 429 / 5xx with exponential backoff (1s / 2s / 4s) honoring {@code Retry-After}.
 */
@Component
@ConditionalOnProperty(prefix = "app.notifications", name = "channel", havingValue = "slack")
public class SlackChannel implements NotificationChannel {

  private static final Logger LOG = LoggerFactory.getLogger(SlackChannel.class);
  private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final long[] BACKOFF_MS = {1_000L, 2_000L, 4_000L};

  private final NotificationEventRepository repo;
  private final Clock clock;
  private final OkHttpClient http;
  private final String webhookUrl;
  private final String dashboardUrl;

  public SlackChannel(
      NotificationEventRepository repo,
      Clock clock,
      @Value("${app.notifications.slack.webhook-url:}") String webhookUrl,
      @Value("${app.notifications.slack.dashboard-url:http://localhost:5173/manager}")
          String dashboardUrl) {
    this.repo = repo;
    this.clock = clock;
    this.webhookUrl = webhookUrl;
    this.dashboardUrl = dashboardUrl;
    this.http =
        new OkHttpClient.Builder()
            .connectTimeout(Duration.ofMillis(2000))
            .readTimeout(Duration.ofMillis(5000))
            .writeTimeout(Duration.ofMillis(2000))
            .build();
  }

  @Override
  @Transactional
  public void send(NotificationEvent event) {
    if (webhookUrl == null || webhookUrl.isBlank()) {
      LOG.warn("notification_slack_skipped reason=no_webhook eventId={}", event.getId());
      event.setState(NotificationState.FAILED);
      event.setLastError("no SLACK_WEBHOOK_URL configured");
      repo.save(event);
      return;
    }
    String body;
    try {
      body = buildBody(event);
    } catch (JsonProcessingException jpe) {
      event.setState(NotificationState.FAILED);
      event.setLastError("payload serialize failed: " + jpe.getMessage());
      repo.save(event);
      return;
    }
    Request req =
        new Request.Builder().url(webhookUrl).post(RequestBody.create(body, JSON)).build();
    int lastStatus = 0;
    String lastErr = null;
    for (int attempt = 0; attempt <= BACKOFF_MS.length; attempt++) {
      if (attempt > 0) sleep(BACKOFF_MS[attempt - 1]);
      event.incrementAttempts();
      try (Response resp = http.newCall(req).execute()) {
        lastStatus = resp.code();
        if (resp.isSuccessful()) {
          event.setState(NotificationState.SENT);
          event.setSentAt(clock.instant());
          event.setLastError(null);
          repo.save(event);
          LOG.info(
              "notification_slack_sent eventId={} kind={} attempts={}",
              event.getId(),
              event.getKind(),
              event.getAttempts());
          return;
        }
        if (resp.code() < 500 && resp.code() != 429) {
          lastErr = "non-retryable: " + resp.code();
          break;
        }
        lastErr = "transient: " + resp.code();
      } catch (java.io.IOException e) {
        lastErr = "io: " + e.getMessage();
      }
    }
    event.setState(NotificationState.FAILED);
    event.setLastError("status=" + lastStatus + " " + lastErr);
    repo.save(event);
    LOG.warn(
        "notification_slack_failed eventId={} status={} err={}",
        event.getId(),
        lastStatus,
        lastErr);
  }

  private String buildBody(NotificationEvent event) throws JsonProcessingException {
    JsonNode payload = MAPPER.readTree(event.getPayloadJson());
    String text = payload.path("slackMessage").asText("");
    if (text.isBlank()) {
      text = payload.path("finding").asText(payload.path("alignmentHeadline").asText(""));
    }
    text = text.replace("<DASHBOARD_URL>", dashboardUrl);

    ObjectNode root = MAPPER.createObjectNode();
    root.put("text", deriveFallbackText(event, text));
    ArrayNode blocks = root.putArray("blocks");

    String header = headerFor(event);
    if (header != null) {
      ObjectNode hb = blocks.addObject();
      hb.put("type", "header");
      ObjectNode ht = hb.putObject("text");
      ht.put("type", "plain_text");
      ht.put("text", header);
    }

    ObjectNode section = blocks.addObject();
    section.put("type", "section");
    ObjectNode txt = section.putObject("text");
    txt.put("type", "mrkdwn");
    txt.put("text", text.isBlank() ? "_No body for this event._" : text);

    if (event.getKind() == NotificationKind.WEEKLY_DIGEST
        || event.getKind() == NotificationKind.ALIGNMENT_RISK) {
      blocks.addObject().put("type", "divider");
      ObjectNode actions = blocks.addObject();
      actions.put("type", "actions");
      ArrayNode els = actions.putArray("elements");
      ObjectNode btn = els.addObject();
      btn.put("type", "button");
      ObjectNode btnText = btn.putObject("text");
      btnText.put("type", "plain_text");
      btnText.put("text", "Open dashboard");
      btn.put("url", dashboardUrl);
      btn.put("style", "primary");
    }
    return MAPPER.writeValueAsString(root);
  }

  private String headerFor(NotificationEvent event) {
    return switch (event.getKind()) {
      case WEEKLY_DIGEST -> "Weekly manager digest";
      case ALIGNMENT_RISK -> "Alignment risk";
      case LOCK_CONFIRM -> "Week locked";
      case RECONCILE_REMINDER -> "Reconciliation reminder";
      case RECONCILE_COMPLETE -> "Reconciliation submitted";
    };
  }

  private String deriveFallbackText(NotificationEvent event, String text) {
    if (!text.isBlank()) return text;
    return switch (event.getKind()) {
      case WEEKLY_DIGEST -> "Weekly digest pending — see " + dashboardUrl + " for the live rollup.";
      case ALIGNMENT_RISK -> "Alignment risk detected — see " + dashboardUrl + ".";
      case LOCK_CONFIRM -> "Week locked.";
      case RECONCILE_REMINDER -> "Reconciliation reminder.";
      case RECONCILE_COMPLETE -> "Reconciliation submitted.";
    };
  }

  @Override
  public String name() {
    return "slack";
  }

  private static void sleep(long ms) {
    try {
      TimeUnit.MILLISECONDS.sleep(ms);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
  }
}
