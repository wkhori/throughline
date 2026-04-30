@phase-5 @ai @ai-t1
Feature: AI Outcome Suggestion (T1)
  As an IC drafting a weekly commit
  I want the AI to suggest the most-likely Supporting Outcome from my team's RCDO subtree
  So that I can link the commit to a strategic anchor without scanning the tree manually

  # T1 — Haiku 4.5; debounced 800ms; suppressed if user manually picked an SO in the last 30s.
  # Full prompt + schema in docs/ai-copilot-spec.md.

  Background:
    Given I am signed in as the demo persona "ic"
    And my team's RCDO subtree contains 12 candidate Supporting Outcomes
    And I am on the DraftWeek view with no commits yet

  @stub @happy-path
  Scenario: Stub provider returns a deterministic suggestion within 800ms of last keystroke
    When I type the commit text "Ship the new onboarding email sequence to reduce day-7 churn"
    And I wait 900ms for the debounce
    Then a "POST /api/v1/ai/suggest-outcome" request fires exactly once
    And the request body lists 12 candidates and the recent-user-commits array
    And the response body matches schema "T1_SUGGESTION"
    And the SO linker chip renders the candidate's title with an "AI suggested" badge and confidence ≥0.8
    And the chip's breadcrumb shows the full Rally Cry › Defining Objective › Outcome › Supporting Outcome path
    And clicking the chip's "Change" action opens the typeahead so the IC can override the AI's pick

  @stub @edge
  Scenario: Suggestion suppressed within 30 seconds of a manual SO pick
    Given I picked an SO manually 5 seconds ago
    When I edit the commit text "Refine the welcome sequence subject lines"
    And I wait 900ms for the debounce
    Then no "POST /api/v1/ai/suggest-outcome" request is sent

  @stub @edge
  Scenario: Text below 15 chars does not fire a suggestion
    When I type the commit text "ship onb"
    And I wait 900ms for the debounce
    Then no "POST /api/v1/ai/suggest-outcome" request is sent

  @stub @ai-fallback
  Scenario: 429 BUDGET_EXHAUSTED degrades silently
    Given the per-user-per-hour T1 cap is reached
    When I type the commit text "Ship the new onboarding email sequence"
    And I wait 900ms for the debounce
    Then the suggestion panel renders nothing
    And no error toast is shown

  @stub @ai-fallback
  Scenario: Null-match returns confidence 0 and renders nothing
    Given the candidates contain no semantic match
    When I type the commit text "Renew the office plant subscription"
    And I wait 900ms for the debounce
    Then the response body's supportingOutcomeId is null
    And the suggestion panel renders nothing

  @integration @happy-path
  Scenario: Real Haiku call returns a schema-valid suggestion
    Given the Anthropic provider is configured with a real API key
    When I type the commit text "Ship the new onboarding email sequence to reduce day-7 churn"
    And I wait 900ms for the debounce
    Then a "POST /api/v1/ai/suggest-outcome" request fires
    And the response body matches schema "T1_SUGGESTION"
    And the response body's model is "claude-haiku-4-5-20251001"
    And the response body's confidence is between 0 and 1
    And the cost-cents accrued for the call is below 0.2
    And an AIInsight row is persisted with kind=T1_SUGGESTION

  @integration @ai-fallback
  Scenario: Cache hit on identical input within 60s persists a zero-cost AIInsight
    Given I just received a T1 suggestion 5 seconds ago for "Ship onboarding email sequence"
    When I edit and re-type the same commit text
    And I wait 900ms for the debounce
    Then the response body's model starts with "cache:"
    And the AIInsight row written for this call has cost_cents=0
    And the AIBudget row's costCentsAccrued was not incremented
