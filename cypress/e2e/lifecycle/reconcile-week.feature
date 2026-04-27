@phase-3 @lifecycle
Feature: Reconcile the week
  As an IC at end-of-week
  I want to mark each committed item done / partial / not done with notes
  So that the system records what shipped and triggers the alignment delta

  Background:
    Given I am signed in as the demo persona "ic"
    And my week is in state "LOCKED"
    And the week contains 3 commits
    And the org's reconcile window is open (Friday 12:00 in org TZ)

  @stub @happy-path
  Scenario: reconcile-start transitions LOCKED → RECONCILING
    When I send "POST /api/v1/weeks/{id}/reconcile-start"
    Then the response status is 200
    And the response body's state is "RECONCILING"

  @stub @happy-path
  Scenario: Submitting reconcile transitions RECONCILING → RECONCILED
    Given my week is in state "RECONCILING"
    When I send "PUT /api/v1/weeks/{id}/reconcile" with body
      """
      {
        "items": [
          {"commitId": "c1", "outcome": "DONE",     "note": "shipped Tuesday",      "carryForward": false},
          {"commitId": "c2", "outcome": "PARTIAL",  "note": "design done; impl WIP", "carryForward": true},
          {"commitId": "c3", "outcome": "NOT_DONE", "note": "blocked on Auth0",     "carryForward": true}
        ]
      }
      """
    Then the response status is 200
    And the response body's week.state is "RECONCILED"
    And the response body's alignmentDelta is null
    # AI assertion enabled in phase/4-ai (Phase 5b T4 wires the real Sonnet call).

  @stub @edge
  Scenario: reconcile rejects when not every commit has an entry
    Given my week is in state "RECONCILING"
    When I send "PUT /api/v1/weeks/{id}/reconcile" with only 2 of 3 commits
    Then the response status is 400
    And the problem detail title is "VALIDATION_ERROR"

  @stub @edge
  Scenario: reconciliation note longer than 1000 chars rejected
    Given my week is in state "RECONCILING"
    When I send a reconcile item with a 1001-char note
    Then the response status is 400

  @stub @edge
  Scenario: carryForward on a DONE commit rejected
    Given my week is in state "RECONCILING"
    When I send a reconcile item with outcome=DONE and carryForward=true
    Then the response status is 400
    And the problem detail mentions "carry-forward only legal for PARTIAL or NOT_DONE"

  @stub @edge
  Scenario: reconcile-start before window opens returns 409
    Given the org's reconcile window is closed (it is Tuesday)
    When I send "POST /api/v1/weeks/{id}/reconcile-start"
    Then the response status is 409
    And the problem detail mentions "reconcile window not yet open"

  @stub @auth
  Scenario: Non-owner cannot reconcile
    Given another IC owns the week
    When I send "PUT /api/v1/weeks/{id}/reconcile" with my JWT
    Then the response status is 403

  @stub @ai @phase-5 @ai-t4
  Scenario: T4 alignment delta attaches to reconcile response within 10s sync window
    Given the AI provider is configured (stub mode)
    When I submit reconcile
    Then the response body's alignmentDelta matches schema "T4_DELTA"
    And an AIInsight row of kind=T4_DELTA is persisted

  @stub @ai @phase-5 @ai-t4
  Scenario: T4 priorCarryForwardWeeks reflects pre-mutation state per P11
    Given the slipped commit's carry_forward_weeks is 2 BEFORE reconcile mutation
    When I submit reconcile with that commit marked NOT_DONE and carryForward=true
    Then the request body sent to Anthropic has priorCarryForwardWeeks=2
    And the recommended action is in [drop,re-scope]

  @stub @ai-fallback @phase-5 @ai-t4
  Scenario: T4 hard failure falls back to deterministic counts-only delta
    Given the Anthropic provider returns 503 on all retries
    When I submit reconcile
    Then the reconcile still succeeds with status 200
    And the eventual deterministic AIInsight has model="deterministic"
    And the deterministic delta lists raw counts of done/partial/not_done by Outcome

  @integration @ai @phase-5 @ai-t4
  Scenario: Real Sonnet alignment delta classifies slip causes
    Given the Anthropic provider is configured with a real API key
    And one of my commits was reconciled NOT_DONE with note "blocked on Auth0 callback URL change"
    When I submit reconcile
    Then the response body matches schema "T4_DELTA" within 10 seconds
    And the slipped[] entry's slipCause is in [blocked_external,unclear]
    And the AIInsight row's model is "claude-sonnet-4-6"
