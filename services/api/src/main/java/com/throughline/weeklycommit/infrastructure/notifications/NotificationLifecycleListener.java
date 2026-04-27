package com.throughline.weeklycommit.infrastructure.notifications;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.throughline.weeklycommit.application.lifecycle.WeekLockedEvent;
import com.throughline.weeklycommit.application.lifecycle.WeekReconciledEvent;
import com.throughline.weeklycommit.domain.NotificationChannelKind;
import com.throughline.weeklycommit.domain.NotificationKind;
import com.throughline.weeklycommit.domain.Week;
import com.throughline.weeklycommit.domain.repo.WeekRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Phase 6 — wires the remaining trigger inventory entries from PRD §8.3 onto the dispatcher.
 *
 * <p>Listeners are invoked AFTER_COMMIT on the lifecycle events the state machine already
 * publishes; running async on {@code notificationExecutor} keeps Anthropic-bound work off the
 * lifecycle critical path. The dispatcher is wholly idempotent (LOCK_CONFIRM and
 * RECONCILE_COMPLETE intentionally do not hit the digest unique index — those notifications fire
 * exactly once per state transition).
 */
@Component
public class NotificationLifecycleListener {

  private static final Logger LOG = LoggerFactory.getLogger(NotificationLifecycleListener.class);
  private static final ObjectMapper MAPPER = new ObjectMapper();

  private final NotificationDispatcher dispatcher;
  private final WeekRepository weekRepo;
  private final NotificationChannelKind channelKind;

  public NotificationLifecycleListener(
      NotificationDispatcher dispatcher,
      WeekRepository weekRepo,
      @Value("${app.notifications.channel:log}") String channel) {
    this.dispatcher = dispatcher;
    this.weekRepo = weekRepo;
    this.channelKind = "slack".equalsIgnoreCase(channel)
        ? NotificationChannelKind.SLACK
        : NotificationChannelKind.LOG;
  }

  @Async("notificationExecutor")
  @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
  public void onWeekLocked(WeekLockedEvent event) {
    weekRepo
        .findById(event.weekId())
        .ifPresent(
            week -> {
              try {
                dispatcher.dispatch(
                    event.orgId(),
                    NotificationKind.LOCK_CONFIRM,
                    channelKind,
                    event.userId(),
                    payload(week, "lock confirmed", "Week locked. Reconcile by Friday."));
              } catch (Exception ex) {
                LOG.warn(
                    "lock_confirm_dispatch_failed weekId={} userId={} err={}",
                    event.weekId(),
                    event.userId(),
                    ex.getMessage());
              }
            });
  }

  @Async("notificationExecutor")
  @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
  public void onWeekReconciled(WeekReconciledEvent event) {
    weekRepo
        .findById(event.weekId())
        .ifPresent(
            week -> {
              try {
                dispatcher.dispatch(
                    event.orgId(),
                    NotificationKind.RECONCILE_COMPLETE,
                    channelKind,
                    event.userId(),
                    payload(
                        week,
                        "reconcile complete",
                        "Reconciliation submitted. Manager digest fires Monday."));
              } catch (Exception ex) {
                LOG.warn(
                    "reconcile_complete_dispatch_failed weekId={} userId={} err={}",
                    event.weekId(),
                    event.userId(),
                    ex.getMessage());
              }
            });
  }

  private String payload(Week week, String headline, String slackMessage) {
    ObjectNode root = MAPPER.createObjectNode();
    root.put("weekId", week.getId());
    root.put("weekStart", week.getWeekStart().toString());
    root.put("userId", week.getUserId());
    root.put("alignmentHeadline", headline);
    root.put("slackMessage", slackMessage);
    try {
      return MAPPER.writeValueAsString(root);
    } catch (JsonProcessingException jpe) {
      throw new IllegalStateException(jpe);
    }
  }
}
