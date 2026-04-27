@phase-2 @lifecycle @state-machine
Feature: Lifecycle state machine guards
  As the system
  I want every state transition to enforce its preconditions
  So that the lifecycle invariants hold even under concurrent edits

  Background:
    Given I am signed in as the demo persona "ic"

  @stub @edge
  Scenario Outline: Edits to a non-DRAFT week are rejected
    Given my week is in state "<state>"
    When I attempt to "<action>"
    Then the response status is 409
    And the problem detail title is "ILLEGAL_STATE"
    And the problem detail body includes the current state "<state>"

    Examples:
      | state       | action                                |
      | LOCKED      | add a commit                          |
      | LOCKED      | edit an existing commit               |
      | LOCKED      | delete a commit                       |
      | RECONCILING | add a commit                          |
      | RECONCILED  | edit an existing commit               |
      | RECONCILED  | delete a commit                       |

  @stub @edge
  Scenario: Lock with zero commits rejected
    Given my draft week contains zero commits
    When I send "POST /api/v1/weeks/{id}/lock"
    Then the response status is 400
    And the problem detail title is "VALIDATION_ERROR"
    And the field "commits" message mentions "at least one commit"

  @stub @edge
  Scenario: Lock with a commit missing supportingOutcomeId rejected
    Given my draft week contains 3 commits, one with no supportingOutcomeId
    When I send "POST /api/v1/weeks/{id}/lock"
    Then the response status is 400
    And the problem detail title is "VALIDATION_ERROR"
    And errors[].field includes "commits[1].supportingOutcomeId"

  @stub @edge
  Scenario: Lock idempotent on terminal LOCKED replays prior response
    Given my week is in state "LOCKED"
    When I send "POST /api/v1/weeks/{id}/lock" again
    Then the response status is 200
    And the response body's portfolioReview is null in Phase 2 (T3 wires in Phase 5b)
    And the week's lockedAt is unchanged from the original lock

  @stub @edge
  Scenario: Reconcile-start requires the week to be at or past its end day
    Given my week is in state "LOCKED"
    And the org's reconcileOpensDayOfWeek is "FRIDAY"
    And it is currently Tuesday in the org timezone
    When I send "POST /api/v1/weeks/{id}/reconcile-start"
    Then the response status is 409
    And the problem detail mentions "reconcile window not yet open"

  @stub @auth
  Scenario: Non-owner cannot lock another IC's week
    Given another IC owns a DRAFT week W
    When I send "POST /api/v1/weeks/W/lock" with my JWT
    Then the response status is 403
