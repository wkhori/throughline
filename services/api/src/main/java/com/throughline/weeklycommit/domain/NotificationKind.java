package com.throughline.weeklycommit.domain;

/** Notification kind enum (PRD §8.3 trigger inventory). */
public enum NotificationKind {
  WEEKLY_DIGEST,
  ALIGNMENT_RISK,
  LOCK_CONFIRM,
  RECONCILE_REMINDER,
  RECONCILE_COMPLETE;
}
