@phase-4 @manager
Feature: Manager drill-down to a team member's current week
  As a manager who saw an exception flagged on the dashboard
  I want to click into that teammate's current week
  So that I can see the underlying commits and reconciliation outcomes

  Background:
    Given I am signed in as the demo persona "manager"

  @stub @happy-path
  Scenario: Click a roster row to open that teammate's current week (read-only)
    Given my team includes IC "Demo IC" with the persona sub "auth0|mock-ic"
    When I open "/manager"
    And I click the roster row for "Demo IC"
    Then I navigate to "/manager/team/{userId}/week/current"
    And I see the IC's commits in their current week
    And every commit row is read-only (no edit / delete affordance)

  @stub @auth
  Scenario: Manager outside the scope chain cannot view a teammate's week
    Given another manager owns IC "Other IC"
    When I send "GET /api/v1/manager/team/{otherIcId}/week/current"
    Then the response status is 403
    And the problem detail title is "FORBIDDEN"

  @stub @auth
  Scenario: ADMIN bypasses scope and can view any week
    Given I am signed in as the demo persona "admin"
    When I send "GET /api/v1/manager/team/{anyIcId}/week/current"
    Then the response status is 200

  @stub @edge
  Scenario: Drill into an IC who has not yet visited current week — DRAFT auto-creation suppressed
    Given IC "Sleepy IC" has never opened the app
    When I send "GET /api/v1/manager/team/{sleepyIcId}/week/current"
    Then the response status is 200
    And the response body's commits is empty
    And no Week row was created (manager view is non-mutating)
