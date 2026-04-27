@phase-5 @ai @ai-t2
Feature: AI Drift Warning (T2)
  As an IC writing a commit linked to a Supporting Outcome
  I want the AI to flag when my commit text drifts from the linked outcome
  So that misalignment surfaces during planning, not at reconciliation

  # T2 — Haiku 4.5; debounced 1.5s; only fires when commit ≥25 chars AND has an SO link.

  Background:
    Given I am signed in as the demo persona "ic"
    And my draft week contains a commit linked to SO "Reduce 30-day churn by 15%"

  @stub @happy-path
  Scenario: Aligned commit produces no warning
    When I edit the commit text to "Roll out the day-7 retention email campaign"
    And I wait 1600ms for the debounce
    Then a "POST /api/v1/ai/drift-check" request fires
    And the response body's driftScore is below 0.3
    And the response body's fixSuggestion is null
    And the DriftWarningBanner is not visible

  @stub @happy-path
  Scenario: Drifting commit raises a warning with a fix suggestion
    When I edit the commit text to "Refactor the billing service to clean up legacy code"
    And I wait 1600ms for the debounce
    Then the response body's driftScore is above 0.5
    And the response body's alignmentVerdict is in [tangential,unrelated]
    And the response body's fixSuggestion is non-null
    And the DriftWarningBanner shows the fix suggestion text

  @stub @edge
  Scenario: Borderline drift (0.3–0.5) produces no fix suggestion
    When I edit the commit text to "Document the churn dashboard for the analytics team"
    And I wait 1600ms for the debounce
    Then the response body's driftScore is between 0.3 and 0.5
    And the response body's fixSuggestion is null

  @stub @edge
  Scenario: Commit below 25 chars does not fire
    When I edit the commit text to "Tweak"
    And I wait 1600ms for the debounce
    Then no "POST /api/v1/ai/drift-check" request is sent

  @stub @ai-fallback
  Scenario: API failure suppresses the banner silently
    Given the Anthropic provider returns 503
    When I edit the commit text to "Roll out the day-7 retention email campaign"
    And I wait 1600ms for the debounce
    Then the DriftWarningBanner is not visible
    And no error toast is shown

  @integration @happy-path
  Scenario: Real Haiku drift check on aligned text returns low score
    Given the Anthropic provider is configured with a real API key
    When I edit the commit text to "Roll out the day-7 retention email campaign"
    And I wait 1600ms for the debounce
    Then the response body matches schema "T2_DRIFT"
    And the response body's driftScore is below 0.4

  @integration @happy-path
  Scenario: Real Haiku drift check on misaligned text returns high score and fix
    Given the Anthropic provider is configured with a real API key
    When I edit the commit text to "Refactor the billing service to clean up legacy code"
    And I wait 1600ms for the debounce
    Then the response body's driftScore is above 0.5
    And the response body's fixSuggestion is non-null
