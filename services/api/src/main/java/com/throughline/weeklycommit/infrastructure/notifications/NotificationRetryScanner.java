package com.throughline.weeklycommit.infrastructure.notifications;

import com.throughline.weeklycommit.domain.NotificationEvent;
import com.throughline.weeklycommit.domain.NotificationState;
import com.throughline.weeklycommit.domain.repo.NotificationEventRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Scans the {@code notification_event} table every 5 minutes and re-dispatches FAILED events whose
 * attempts counter is below the cap. Exponential backoff is enforced via the row's {@code
 * createdAt}: attempt 1 retries after 5min, attempt 2 after 20min, attempt 3 after 80min. Beyond
 * that the event is left in FAILED state for manual triage (or audit-only).
 *
 * <p>The scanner only retries FAILED events: PENDING events are still in flight (the channel is
 * the source of truth for transitioning PENDING → SENT or PENDING → FAILED). SKIPPED_DUPLICATE is
 * terminal.
 */
@Component
public class NotificationRetryScanner {

  private static final Logger LOG = LoggerFactory.getLogger(NotificationRetryScanner.class);
  private static final int MAX_ATTEMPTS = 3;
  /** Backoff thresholds keyed by current attempts count (0-indexed). 5min, 20min, 80min. */
  private static final long[] BACKOFF_MINUTES = {5, 20, 80};

  private final NotificationEventRepository repo;
  private final NotificationChannel channel;
  private final Clock clock;

  public NotificationRetryScanner(
      NotificationEventRepository repo, NotificationChannel channel, Clock clock) {
    this.repo = repo;
    this.channel = channel;
    this.clock = clock;
  }

  /** Scan every 5 minutes; initialDelay 60s so a fresh boot doesn't fire instantly. */
  @Scheduled(fixedDelayString = "PT5M", initialDelayString = "PT1M")
  @Transactional
  public void scan() {
    var failed = repo.findByStateOrderByCreatedAtAsc(NotificationState.FAILED);
    Instant now = Instant.now(clock);
    int retried = 0;
    int skipped = 0;
    for (NotificationEvent event : failed) {
      int attempts = event.getAttempts();
      if (attempts >= MAX_ATTEMPTS) {
        skipped++;
        continue;
      }
      long minutesSince = Duration.between(event.getCreatedAt(), now).toMinutes();
      long requiredMinutes = BACKOFF_MINUTES[Math.min(attempts, BACKOFF_MINUTES.length - 1)];
      if (minutesSince < requiredMinutes) {
        skipped++;
        continue;
      }
      // Reset to PENDING; the channel will increment attempts again as it sends.
      event.setState(NotificationState.PENDING);
      event.setLastError(null);
      repo.save(event);
      try {
        channel.send(event);
        retried++;
      } catch (Exception ex) {
        LOG.warn(
            "notification_retry_failed eventId={} attempts={} err={}",
            event.getId(),
            event.getAttempts(),
            ex.getMessage());
      }
    }
    if (retried > 0 || skipped > 0) {
      LOG.info("notification_retry_scan retried={} skipped={}", retried, skipped);
    }
  }
}
