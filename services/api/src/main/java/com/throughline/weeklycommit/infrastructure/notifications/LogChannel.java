package com.throughline.weeklycommit.infrastructure.notifications;

import com.throughline.weeklycommit.domain.NotificationEvent;
import com.throughline.weeklycommit.domain.NotificationState;
import com.throughline.weeklycommit.domain.repo.NotificationEventRepository;
import java.time.Clock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Default channel — logs the notification at INFO and marks it SENT. Used in tests and for
 * `NOTIFICATION_CHANNEL=log`.
 */
@Component
@ConditionalOnProperty(
    prefix = "app.notifications",
    name = "channel",
    havingValue = "log",
    matchIfMissing = true)
public class LogChannel implements NotificationChannel {

  private static final Logger LOG = LoggerFactory.getLogger(LogChannel.class);

  private final NotificationEventRepository repo;
  private final Clock clock;

  public LogChannel(NotificationEventRepository repo, Clock clock) {
    this.repo = repo;
    this.clock = clock;
  }

  @Override
  @Transactional
  public void send(NotificationEvent event) {
    LOG.info(
        "notification_log channel=log kind={} recipientId={} payload={}",
        event.getKind(),
        event.getRecipientId(),
        event.getPayloadJson());
    event.setState(NotificationState.SENT);
    event.setSentAt(clock.instant());
    event.incrementAttempts();
    repo.save(event);
  }

  @Override
  public String name() {
    return "log";
  }
}
