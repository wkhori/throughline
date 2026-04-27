@phase-4 @manager
Feature: Manager dashboard
  As a manager looking at my team's week
  I want a pre-digested dashboard surfacing alignment exceptions
  So that the AI does the scan and I only intervene where it matters

  Background:
    Given I am signed in as the demo persona "manager"
    And my team has 4 weeks of LOCKED+RECONCILED history with the 4 deliberate dysfunctions seeded

  @stub @happy-path
  Scenario: First paint renders the four dashboard regions
    When I open "/manager"
    Then I see a hero card region "manager-digest-hero"
    And I see a panel "starved-outcomes-panel"
    And I see a panel "drift-exceptions-panel"
    And I see a panel "exception-ribbon"
    And I see a dense roster table "team-member-table"

  @stub @happy-path
  Scenario: Hero card placeholder when AI has not yet produced a digest
    When I open "/manager"
    Then the hero card region shows "Digest will appear here when AI lands"
    And no AI request is fired
    # T5 is wired in phase/4-ai (Phase 5c). Until then /manager/digest/current returns digest=null.

  @stub @happy-path
  Scenario: Starved-outcomes panel surfaces dysfunction #1
    When I open "/manager"
    Then the starved-outcomes panel lists "Expand enterprise pipeline Q2"
    And it shows a "starved 2 weeks" badge

  @stub @happy-path
  Scenario: Drift-exceptions panel surfaces dysfunction #3
    When I open "/manager"
    Then the drift-exceptions panel lists the team "Platform Reliability"
    And it shows an observed share that exceeds the configured expected band

  @stub @happy-path
  Scenario: Exception ribbon surfaces dysfunction #2
    When I open "/manager"
    Then the exception ribbon contains an entry referencing "Sarah Mendez"
    And the entry mentions "carry-forwarded 4 weeks"

  @stub @happy-path
  Scenario: Roster table renders one row per direct/transitive report
    When I open "/manager"
    Then the team-member-table renders one row per teammate within my scope
    And every row shows name, team, last week's done/partial/not-done counts

  @stub @edge
  Scenario: Loading state shows skeleton until data resolves
    When I open "/manager" with the network throttled
    Then I see a skeleton placeholder for the roster table
    And I see a skeleton placeholder for the hero card

  @stub @edge
  Scenario: Empty state when no team data yet
    Given my team has no reports
    When I open "/manager"
    Then the dashboard renders the empty state "No teammates in scope"

  @ai @phase-5
  Scenario: T5 manager digest replaces the hero card placeholder (deferred to phase/4-ai)
    Given the AI provider is configured
    When I open "/manager"
    Then the hero card renders an AIInsight matching schema "T5_DIGEST"
    And every affected entity in the digest opens via <InsightDrillDown>
