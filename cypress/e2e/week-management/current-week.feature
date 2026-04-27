@phase-2 @week-management
Feature: Current week resolution
  As an IC
  I want to land on the current week's draft when I open the app
  So that I can plan without picking a date manually

  Background:
    Given I am signed in as the demo persona "ic"
    And the seeded org timezone is "America/New_York"

  @stub @happy-path
  Scenario: First visit creates a DRAFT week in the user's org TZ
    When I navigate to "/weekly-commit"
    Then "GET /api/v1/weeks/current" returns 200
    And the response body has state "DRAFT"
    And the response body's weekStart is the most recent Monday at 00:00 in "America/New_York"
    And the response body's userId equals my user id
    And the response body's commits array is empty

  @stub @happy-path
  Scenario: Repeat visit same week is idempotent
    Given I have already loaded the current week once today
    When I navigate to "/weekly-commit" again
    Then "GET /api/v1/weeks/current" returns 200 with the same week id as the prior request
    And no new week row is created in the database

  @stub @edge
  Scenario: Org with non-default timezone resolves to local Monday
    Given my org timezone is "Asia/Tokyo"
    When I navigate to "/weekly-commit" at 22:00 UTC on Sunday
    Then the response body's weekStart is the next Monday in "Asia/Tokyo"

  @stub @edge
  Scenario: DST spring-forward boundary picks the right Monday
    Given the org timezone is "America/New_York"
    And the wall clock is the second Sunday of March at 02:30 local time
    When I request the current week
    Then the response body's weekStart is the prior Monday in local time
    And the request does not raise a DateTimeException

  @stub @auth
  Scenario: Anonymous request rejected
    Given I am not signed in
    When I send "GET /api/v1/weeks/current" with no Authorization header
    Then the response status is 401
