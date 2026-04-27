package com.throughline.weeklycommit.infrastructure.notifications;

import com.throughline.weeklycommit.domain.NotificationEvent;

/**
 * Notification adapter contract (PRD §8.1). Implementations are selected by
 * {@code @ConditionalOnProperty(prefix="app.notifications", name="channel", ...)}.
 */
public interface NotificationChannel {

  /**
   * Deliver the notification. Implementations are expected to update the {@link NotificationEvent}
   * state to SENT (or FAILED with {@code lastError}) and stamp {@code sentAt} on success.
   */
  void send(NotificationEvent event);

  String name();
}
