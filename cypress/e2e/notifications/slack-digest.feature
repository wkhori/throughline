@phase-6 @notif
Feature: Slack digest dispatch
  As the platform owner
  I want the Monday manager digest to land in Slack idempotently and survive transient failures
  So that managers wake up Monday with a single high-signal summary, not a flurry of duplicates

  # PRD §12 Phase 6 — covers the dispatcher idempotency contract (P20/P38), the Friday reminder
  # cron, the AFTER_COMMIT lifecycle listeners, and the retry scanner. The @stub variant runs
  # against `LogChannel`; the @integration variant flips to the real `SlackChannel` once
  # SLACK_WEBHOOK_URL is provided.

  Background:
    Given I am signed in as the demo persona "manager"
    And the org has at least one direct report with a reconciled week

  @stub @happy-path
  Scenario: Manual digest run posts a SENT notification with the manager-shaped payload
    When the manager invokes "POST /api/v1/notifications/digest/run"
    Then a notification_event row exists with kind WEEKLY_DIGEST in state SENT
    And the payload_json includes a non-empty alignmentHeadline
    And the payload_json's slackMessage contains "<DASHBOARD_URL>"

  @stub @idempotency
  Scenario: Duplicate digest dispatch within the same week persists SKIPPED_DUPLICATE
    Given the manager has already received a WEEKLY_DIGEST for the current weekStart
    When the manager invokes "POST /api/v1/notifications/digest/run"
    Then a second notification_event row exists in state SKIPPED_DUPLICATE
    And the original SENT row's sent_at is unchanged

  @stub @lifecycle-listener
  Scenario: WeekLockedEvent fires a LOCK_CONFIRM notification to the IC
    Given an IC has just transitioned their week DRAFT → LOCKED
    Then a notification_event row exists with kind LOCK_CONFIRM in state SENT for that IC
    And no LOCK_CONFIRM duplicate exists for that user + weekStart

  @stub @lifecycle-listener
  Scenario: WeekReconciledEvent fires a RECONCILE_COMPLETE notification to the IC
    Given an IC has just transitioned their week RECONCILING → RECONCILED
    Then a notification_event row exists with kind RECONCILE_COMPLETE in state SENT for that IC

  @stub @retry
  Scenario: Retry scanner re-dispatches FAILED events whose backoff window has elapsed
    Given a FAILED notification_event with attempts=1 and createdAt=now-30min
    When the NotificationRetryScanner runs once
    Then the event transitions back to SENT
    And the attempts counter is at most 3

  @stub @retry
  Scenario: Retry scanner leaves FAILED events alone once attempts cap is hit
    Given a FAILED notification_event with attempts=3
    When the NotificationRetryScanner runs once
    Then the event remains in FAILED state with attempts=3

  @integration @slack
  Scenario: Real Slack workspace receives the dispatched digest
    Given SLACK_WEBHOOK_URL is configured
    When the manager invokes "POST /api/v1/notifications/digest/run"
    Then the Slack webhook responds with HTTP 200
    And the notification_event row's state is SENT
    And the message body contains the manager's alignmentHeadline
