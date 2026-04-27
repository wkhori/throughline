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

  @stub @ai @phase-5 @ai-t5
  Scenario: T5 manager digest renders in the hero card from /manager/digest/current
    Given the AI provider is configured (stub mode)
    And a T5_DIGEST AIInsight has been written for me
    When I open "/manager"
    Then the hero card renders an AIInsight matching schema "T5_DIGEST"
    And every affected entity in the digest opens via <InsightDrillDown>

  @stub @happy-path @phase-5 @ai-t5
  Scenario: /manager/digest/current returns null when no digest has been generated
    Given no T5_DIGEST AIInsight exists for me
    When I send "GET /api/v1/manager/digest/current"
    Then the response status is 200
    And the response body's digest is null

  @stub @happy-path @phase-5 @ai-t5
  Scenario: On-demand digest regeneration enforces ≤2/day per manager
    Given I have already triggered "POST /manager/digest/regenerate" twice today
    When I send "POST /api/v1/manager/digest/regenerate" again
    Then the response status is 429

  @integration @ai @phase-5 @ai-t5
  Scenario: Real Sonnet digest produces a Slack-shaped string
    Given the Anthropic provider is configured with a real API key
    And the seeded org contains the four deliberate dysfunctions
    When I send "POST /api/v1/manager/digest/regenerate"
    Then the response body matches schema "T5_DIGEST" within 25 seconds
    And the slackMessage is at most 900 chars
    And the slackMessage starts with the alignmentHeadline verbatim
    And the slackMessage contains "<DASHBOARD_URL>"
    And the slackMessage uses Slack mrkdwn (bullets `•`, `*bold*`, no `**bold**`)
    And the AIInsight row's model is "claude-sonnet-4-6"
