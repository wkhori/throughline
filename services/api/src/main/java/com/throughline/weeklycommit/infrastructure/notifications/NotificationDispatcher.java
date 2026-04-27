package com.throughline.weeklycommit.infrastructure.notifications;

import com.throughline.weeklycommit.domain.NotificationChannelKind;
import com.throughline.weeklycommit.domain.NotificationEvent;
import com.throughline.weeklycommit.domain.NotificationKind;
import com.throughline.weeklycommit.domain.NotificationState;
import com.throughline.weeklycommit.domain.repo.NotificationEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Persists a {@link NotificationEvent} and dispatches it via the configured {@link
 * NotificationChannel}.
 *
 * <p>Idempotency: weekly digest writes hit the partial unique index {@code idx_notif_digest_unique}
 * (P20/P38). On collision the dispatcher catches {@link DataIntegrityViolationException} and
 * persists a sentinel SKIPPED_DUPLICATE row instead so the audit trail still records that the
 * digest was attempted twice.
 */
@Component
public class NotificationDispatcher {

  private static final Logger LOG = LoggerFactory.getLogger(NotificationDispatcher.class);

  private final NotificationChannel channel;
  private final NotificationEventRepository repo;

  public NotificationDispatcher(NotificationChannel channel, NotificationEventRepository repo) {
    this.channel = channel;
    this.repo = repo;
  }

  /** Save a fresh PENDING event then dispatch it on the configured channel. */
  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public NotificationEvent dispatch(
      String orgId,
      NotificationKind kind,
      NotificationChannelKind channelKind,
      String recipientId,
      String payloadJson) {
    NotificationEvent event;
    try {
      event = repo.save(new NotificationEvent(orgId, kind, channelKind, recipientId, payloadJson));
    } catch (DataIntegrityViolationException dup) {
      LOG.info("notification_skipped_duplicate kind={} recipientId={}", kind, recipientId);
      NotificationEvent skipped =
          new NotificationEvent(orgId, kind, channelKind, recipientId, payloadJson);
      skipped.setState(NotificationState.SKIPPED_DUPLICATE);
      return repo.save(skipped);
    }
    channel.send(event);
    return event;
  }
}
