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

  @ai @phase-5
  Scenario: Real T3 portfolio review attaches to the response (deferred to phase/4-ai)
    Given the AI provider is configured
    When I lock my draft week
    Then the response body's portfolioReview matches schema "T3_PORTFOLIO" within 8 seconds
    Or the response body's portfolioReview is null and a websocket update arrives within 60 seconds
