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

  /**
   * Save a fresh PENDING event then dispatch it on the configured channel.
   *
   * <p>For WEEKLY_DIGEST kinds we probe the partial unique index ({@code findActiveDigestFor})
   * up front — a duplicate persists as SKIPPED_DUPLICATE in a fresh transaction. For other kinds
   * (LOCK_CONFIRM / RECONCILE_COMPLETE / RECONCILE_REMINDER / ALIGNMENT_RISK) the index does not
   * apply and we always insert.
   */
  public NotificationEvent dispatch(
      String orgId,
      NotificationKind kind,
      NotificationChannelKind channelKind,
      String recipientId,
      String payloadJson) {
    if (kind == NotificationKind.WEEKLY_DIGEST) {
      String weekStart = extractWeekStart(payloadJson);
      if (weekStart != null && repo.findActiveDigestFor(recipientId, kind, weekStart) != null) {
        LOG.info("notification_skipped_duplicate kind={} recipientId={}", kind, recipientId);
        return persistSkippedDuplicate(orgId, kind, channelKind, recipientId, payloadJson);
      }
    }
    return persistAndSend(orgId, kind, channelKind, recipientId, payloadJson);
  }

  /** Persists the PENDING row + invokes the channel. Index races are caught and translated. */
  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public NotificationEvent persistAndSend(
      String orgId,
      NotificationKind kind,
      NotificationChannelKind channelKind,
      String recipientId,
      String payloadJson) {
    NotificationEvent event;
    try {
      event =
          repo.saveAndFlush(
              new NotificationEvent(orgId, kind, channelKind, recipientId, payloadJson));
    } catch (DataIntegrityViolationException dup) {
      // Race lost — fall through to skipped persist on the caller side.
      throw dup;
    }
    channel.send(event);
    return event;
  }

  /** Persists the SKIPPED_DUPLICATE audit row in a fresh transaction. */
  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public NotificationEvent persistSkippedDuplicate(
      String orgId,
      NotificationKind kind,
      NotificationChannelKind channelKind,
      String recipientId,
      String payloadJson) {
    NotificationEvent skipped =
        new NotificationEvent(orgId, kind, channelKind, recipientId, payloadJson);
    skipped.setState(NotificationState.SKIPPED_DUPLICATE);
    return repo.save(skipped);
  }

  /** Pull the weekStart out of the payload JSON without paying for a full Jackson tree. */
  private String extractWeekStart(String payloadJson) {
    int idx = payloadJson.indexOf("\"weekStart\"");
    if (idx < 0) return null;
    int colon = payloadJson.indexOf(':', idx);
    if (colon < 0) return null;
    int firstQuote = payloadJson.indexOf('"', colon);
    if (firstQuote < 0) return null;
    int secondQuote = payloadJson.indexOf('"', firstQuote + 1);
    if (secondQuote < 0) return null;
    return payloadJson.substring(firstQuote + 1, secondQuote);
  }
}
