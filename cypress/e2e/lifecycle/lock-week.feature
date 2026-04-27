@phase-2 @lifecycle
Feature: Lock the week
  As an IC who has finished planning
  I want to lock my week to commit my plan and trigger the AI portfolio review
  So that the manager dashboard reflects a finalized commitment

  Background:
    Given I am signed in as the demo persona "ic"
    And my draft week contains 3 commits, each linked to a Supporting Outcome

  @stub @happy-path
  Scenario: Happy path lock returns 200 with placeholder portfolioReview
    When I send "POST /api/v1/weeks/{id}/lock"
    Then the response status is 200
    And the response body's week.state is "LOCKED"
    And the response body's week.lockedAt is set
    And the response body's portfolioReview is null
    # AI assertion enabled in phase/4-ai (Phase 5b T3 wires the real Sonnet call).

  @stub @edge
  Scenario: Empty week rejected
    Given my draft week contains zero commits
    When I send "POST /api/v1/weeks/{id}/lock"
    Then the response status is 400
    And the problem detail title is "VALIDATION_ERROR"

  @stub @edge
  Scenario: Missing supportingOutcomeId rejected with field-level error
    Given my draft week contains 2 commits, the second missing supportingOutcomeId
    When I send "POST /api/v1/weeks/{id}/lock"
    Then the response status is 400
    And errors[].field includes "commits[1].supportingOutcomeId"

  @stub @edge
  Scenario: Idempotent replay on LOCKED returns the same week
    Given my week has already been locked
    When I send "POST /api/v1/weeks/{id}/lock" again
    Then the response status is 200
    And the response body's week.lockedAt equals the original lock timestamp
    And no new AIInsight row was persisted

  @stub @edge
  Scenario Outline: Lock from non-DRAFT, non-LOCKED state rejected
    Given my week is in state "<state>"
    When I send "POST /api/v1/weeks/{id}/lock"
    Then the response status is 409
    And the problem detail title is "ILLEGAL_STATE"

    Examples:
      | state       |
      | RECONCILING |
      | RECONCILED  |

  @stub @auth
  Scenario: Non-owner forbidden
    Given another IC owns the week
    When I send "POST /api/v1/weeks/{id}/lock" with my JWT
    Then the response status is 403

  @stub @ai @phase-5 @ai-t3
  Scenario: T3 portfolio review attaches to lock response within 8s sync window
    Given the AI provider is configured (stub mode)
    When I lock my draft week
    Then the response body's portfolioReview matches schema "T3_PORTFOLIO"
    And an AIInsight row of kind=T3_PORTFOLIO is persisted

  @stub @ai @phase-5 @ai-t3
  Scenario: T3 sync timeout falls back to async websocket push
    Given the Anthropic provider deliberately delays beyond 8 seconds
    When I lock my draft week
    Then the response body's portfolioReview is null
    And the websocket "/topic/insights.{weekId}" pushes a T3_PORTFOLIO insight within 60 seconds

  @stub @ai-fallback @phase-5 @ai-t3
  Scenario: T3 hard failure falls back to deterministic skeleton
    Given the Anthropic provider returns 503 on all retries
    When I lock my draft week
    Then the lock still succeeds with status 200
    And the LockedWeek view eventually shows "Portfolio review unavailable; manual retry"
    And the eventual deterministic AIInsight has model="deterministic"

  @integration @ai @phase-5 @ai-t3
  Scenario: Real Sonnet portfolio review surfaces concentration findings
    Given the Anthropic provider is configured with a real API key
    And my draft week has 5 of 7 commits on the same Supporting Outcome
    When I lock my draft week
    Then the response body's portfolioReview matches schema "T3_PORTFOLIO" within 8 seconds
    And the findings array contains at least one entry with dimension=outcome_concentration
    And the cost-cents accrued is below 3
    And the AIInsight row's model is "claude-sonnet-4-6"
