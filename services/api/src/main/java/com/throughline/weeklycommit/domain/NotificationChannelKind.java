package com.throughline.weeklycommit.domain;

/**
 * Channel kind enum mirroring {@code NotificationChannel} implementations (PRD §8 / architecture
 * decision row 33 — Outlook substitution path).
 */
public enum NotificationChannelKind {
  SLACK,
  OUTLOOK,
  LOG;
}
