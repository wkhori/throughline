@phase-5 @ai @ai-t6 @manager
Feature: Alignment-Risk Alerts (T6)
  As a manager scanning my team's risks
  I want T6 to surface long carry-forwards, starved outcomes, and over-concentration
  So that I focus my limited attention on cross-team patterns the AI flagged

  # T6 — Haiku 4.5; hourly @Scheduled scan; dedupeKey per P5 (sha1 with ISO_WEEK); 7-day suppression
  # unless severity escalates. Ack endpoint per P14.

  Background:
    Given I am signed in as the demo persona "manager"
    And the seeded org contains the four deliberate dysfunctions

  @stub @happy-path
  Scenario: Open risks panel renders the seeded HIGH-severity carry-forward
    When I open "/manager/alignment-risks"
    Then the risk list contains an entry for "Sarah Mendez"
    And the entry's rule is LONG_CARRY_FORWARD
    And the entry's severity is HIGH
    And the entry's affected entity opens via <InsightDrillDown>

  @stub @happy-path
  Scenario: Starved-outcome rule fires once per ISO week per entity
    Given the AlignmentRiskScanJob runs once
    Then exactly one alignment_risk row exists with rule=STARVED_OUTCOME for "Expand enterprise pipeline Q2" for the current ISO week
    When the AlignmentRiskScanJob runs again 5 minutes later
    Then no new alignment_risk row is written for the same dedupeKey

  @stub @happy-path
  Scenario: Severity escalation re-fires within the dedupe window
    Given the prior alignment_risk for "Expand enterprise pipeline Q2" was severity=LOW
    When the AlignmentRiskScanJob computes severity=MEDIUM for the same entity in the same week
    Then a new alignment_risk row is written with severity=MEDIUM
    And the dedupeKey on the new row reflects severity=MEDIUM

  @stub @happy-path
  Scenario: Acknowledge round-trip closes the risk
    Given the open-risks list contains an unacknowledged risk
    When I send "POST /api/v1/manager/alignment-risks/{id}/ack"
    Then the response status is 200
    And the alignment_risk row's acknowledgedAt is set
    And the alignment_risk row's acknowledgedBy is my user id
    And the open-risks list no longer contains that risk

  @stub @auth
  Scenario: Manager out of scope cannot acknowledge another manager's risk
    Given the risk belongs to a team outside my scope
    When I send "POST /api/v1/manager/alignment-risks/{id}/ack"
    Then the response status is 403

  @stub @ai-fallback
  Scenario: Anthropic 503 falls back to deterministic templated alert
    Given the Anthropic provider returns 503
    When the AlignmentRiskScanJob runs
    Then an alignment_risk row is written
    And the linked AIInsight row's model is "deterministic"

  @integration @happy-path
  Scenario: Real Haiku alert generation produces severity + finding + suggestedAction
    Given the Anthropic provider is configured with a real API key
    When the AlignmentRiskScanJob runs against the seeded HIGH carry-forward
    Then an AIInsight row is persisted with kind=T6_ALERT
    And the response body matches schema "T6_ALERT"
    And the response body's severity is HIGH
    And the response body's affectedEntities is non-empty
    And on HIGH severity, a NotificationEvent of kind=ALIGNMENT_RISK is enqueued for Slack

  @integration @happy-path
  Scenario: Slack message lands in the configured channel for HIGH severity
    Given app.notifications.channel=slack and the webhook URL is configured
    When the AlignmentRiskScanJob fires a HIGH-severity alert
    Then the NotificationEvent transitions to state=SENT
    And the Slack message contains the entity title and the suggestedAction text
