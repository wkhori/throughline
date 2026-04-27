@phase-5 @ai @ai-t7
Feature: AI Commit Quality Lint (T7)
  As an IC writing a weekly commit
  I want the AI to flag low-quality commits before I lock the week
  So that reconciliation is unambiguous

  # T7 — Haiku 4.5; non-blocking inline hint, dismissible.

  Background:
    Given I am signed in as the demo persona "ic"
    And my draft week contains a commit linked to SO "Reduce 30-day churn by 15%"

  @stub @happy-path
  Scenario: Vague verb produces a "vague" issue
    When I save the commit "Look into churn for top accounts" with priority MUST and category STRATEGIC
    And I wait 1100ms for the debounce
    Then a "POST /api/v1/ai/quality-lint" request fires
    And the response body's issues includes kind=vague
    And the CommitQualityHint renders the message inline on the commit row

  @stub @happy-path
  Scenario: Process-only commit produces an "unmeasurable" issue
    When I save the commit "Have weekly checkpoints with the retention squad" with priority SHOULD and category OPERATIONAL
    And I wait 1100ms for the debounce
    Then the response body's issues includes kind=unmeasurable

  @stub @happy-path
  Scenario: Could-priority multi-week project triggers "estimate_mismatch"
    When I save the commit "Migrate the monolith billing service to a new event bus" with priority COULD and category STRATEGIC
    And I wait 1100ms for the debounce
    Then the response body's issues includes kind=estimate_mismatch
    And the response body's severity is in [medium,high]

  @stub @happy-path
  Scenario: Healthy commit produces empty issues
    When I save the commit "Ship the day-7 retention email to all SMB users with experiment 4012 toggle on" with priority MUST and category STRATEGIC
    And I wait 1100ms for the debounce
    Then the response body's issues is empty
    And the CommitQualityHint is not visible

  @stub @edge
  Scenario: Hint is dismissible and stays dismissed for the session
    Given the AI returned a hint for this commit
    When I click the dismiss control on the CommitQualityHint
    Then the hint is hidden
    And re-rendering the commit row does not show the hint again

  @stub @ai-fallback
  Scenario: API failure suppresses the hint silently
    Given the Anthropic provider returns 503
    When I save a commit
    And I wait 1100ms for the debounce
    Then the CommitQualityHint is not visible
    And no error toast is shown

  @integration @happy-path
  Scenario: Real Haiku quality lint flags vague verbs
    Given the Anthropic provider is configured with a real API key
    When I save the commit "Look into churn for top accounts" with priority MUST and category STRATEGIC
    And I wait 1100ms for the debounce
    Then the response body matches schema "T7_QUALITY"
    And the response body's issues includes kind=vague
