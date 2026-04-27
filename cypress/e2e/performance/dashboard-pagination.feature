@phase-4 @perf
Feature: Manager dashboard pagination performance gate (P25)
  As a reviewer applying the PRD §13 performance gate
  I want the manager team-rollup endpoint to return its first page in under 200 ms
  So that the dashboard stays snappy at the brief's stated 2000-record scale

  Background:
    Given a seeded org with 2000 reconciled commits across team_rollup_cache

  @stub @perf
  Scenario: First page p95 latency
    When I issue 100 sequential calls to "GET /api/v1/manager/team-rollup?page=0&size=50"
    Then the p95 response latency is below 200 ms
    # Implemented by ManagerRollupPerformanceTest under the Gradle perfTest task.

  @stub @perf
  Scenario: Spring Pageable contract
    When I send "GET /api/v1/manager/team-rollup?page=2&size=10&sort=teamName,asc"
    Then the response status is 200
    And the response body has fields page=2, size=10
    And the content array length <= 10
    And the response body has totalElements and totalPages

  @stub @edge
  Scenario: Stale cache (older than 7 days) falls back to live compute with 503 hint
    Given the team_rollup_cache row is older than 7 days
    When I send "GET /api/v1/manager/team-rollup?page=0&size=50"
    Then the response status is 503
    And the problem detail title is "ROLLUP_RECOMPUTING"
