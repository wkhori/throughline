-- V6 — Phase 7 metrics + digest-view tracking. See PRD §10.5.
--
-- `viewed_at` records the manager's first GET of /manager/digest/current after delivery.
-- The metrics service reads (notification_event.sent_at, notification_event.viewed_at) to
-- compute `avgManagerDigestViewMinutesAfterDeliver`.

ALTER TABLE notification_event
  ADD COLUMN viewed_at timestamptz;

CREATE INDEX idx_notif_event_viewed_at ON notification_event(recipient_id, kind, viewed_at)
  WHERE viewed_at IS NOT NULL;
