package com.throughline.weeklycommit.domain;

/** Notification dispatch state. */
public enum NotificationState {
  PENDING,
  SENT,
  FAILED,
  SKIPPED_DUPLICATE;
}
