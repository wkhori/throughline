@phase-7 @metrics @admin
Feature: Org metrics admin endpoint
  As the org admin
  I want a single read-only view of the four impact metrics from the brief
  So that I can verify the rollout is producing the manager-burden reduction we promised

  # PRD §10.5 (P1) — planningCompletionRate, reconciliationStrictPct, reconciliationWeightedPct,
  # avgManagerDigestViewMinutesAfterDeliver, planningSessionMinutesP50.

  Background:
    Given the seeded org has 4 weeks of LOCKED+RECONCILED history
    And at least one manager has received a WEEKLY_DIGEST and viewed it

  @stub @happy-path
  Scenario: Admin reads /metrics/org and sees the seeded values within expected ranges
    Given I am signed in as the demo persona "admin"
    When I GET "/api/v1/metrics/org"
    Then the response status is 200
    And planningCompletionRate is between 0.5 and 1.0
    And reconciliationStrictPct is between 0.4 and 0.7
    And reconciliationWeightedPct is between 0.6 and 0.85
    And avgManagerDigestViewMinutesAfterDeliver is >= 0
    And planningSessionMinutesP50 is >= 0

  @stub @scope
  Scenario: Manager cannot read the endpoint
    Given I am signed in as the demo persona "manager"
    When I GET "/api/v1/metrics/org"
    Then the response status is 403

  @stub @scope
  Scenario: Anonymous request is rejected with 401
    Given I am not signed in
    When I GET "/api/v1/metrics/org"
    Then the response status is 401

  @stub @ui
  Scenario: Admin Settings screen renders the metrics read-only
    Given I am signed in as the demo persona "admin"
    When I open "/admin/settings"
    Then I see a metric card for "Planning completion rate"
    And I see a metric card for "Reconciliation accuracy (strict)"
    And I see a metric card for "Reconciliation accuracy (weighted)"
    And I see a metric card for "Manager digest read latency"
    And I see a metric card for "Planning session length P50"
    And no field on the screen is editable
