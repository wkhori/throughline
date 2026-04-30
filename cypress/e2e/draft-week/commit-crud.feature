@phase-2 @draft-week
Feature: Commit CRUD in DRAFT
  As an IC drafting my week
  I want to add, edit, and remove commits with chess-layer placement
  So that I can plan a focused week of work linked to Supporting Outcomes

  Background:
    Given I am signed in as the demo persona "ic"
    And I have a DRAFT week for the current week
    And the org has a populated RCDO tree with at least 4 Supporting Outcomes

  @stub @happy-path
  Scenario: Add a commit with text + SO + category + priority
    When I send "POST /api/v1/commits" with body
      | weekId             | <my draft week id>             |
      | text               | Ship onboarding email sequence |
      | supportingOutcomeId| <SO #1 id>                     |
      | category           | STRATEGIC                      |
      | priority           | MUST                           |
    Then the response status is 201
    And the response body has id, displayOrder, and state "ACTIVE"
    And the week now contains one commit

  @stub @happy-path
  Scenario: Edit commit text in DRAFT
    Given my draft week contains one commit "Build churn dashboard"
    When I send "PUT /api/v1/commits/{id}" with text "Build churn dashboard v2"
    Then the response status is 200
    And the response body's text is "Build churn dashboard v2"

  @stub @happy-path
  Scenario: Delete commit in DRAFT removes the row
    Given my draft week contains one commit
    When I send "DELETE /api/v1/commits/{id}"
    Then the response status is 204
    And the week now contains zero commits

  @stub @edge
  Scenario Outline: Commit text validation
    When I send "POST /api/v1/commits" with text "<text>"
    Then the response status is <status>
    Examples:
      | text                                                            | status |
      | abcd                                                            | 400    |
      | ab                                                              | 400    |
      |                                                                 | 400    |
      | aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa | 400    |

  @stub @edge
  Scenario: Seven-commit-per-week soft cap
    Given my draft week already contains 7 commits
    When I send "POST /api/v1/commits" with valid body
    Then the response status is 409
    And the problem detail title is "ILLEGAL_STATE"
    And the problem detail mentions the 7-commit cap

  @stub @edge
  Scenario: SupportingOutcome reference must exist + not be archived
    When I send "POST /api/v1/commits" with supportingOutcomeId "01H_DOES_NOT_EXIST"
    Then the response status is 404

  @stub @auth
  Scenario: Cannot create commit on another user's week
    Given another IC owns a draft week W
    When I send "POST /api/v1/commits" with weekId "<W>"
    Then the response status is 403

  @stub @happy-path
  Scenario: Chess-layer category × priority placement persists
    When I add a commit with category "REACTIVE" and priority "COULD"
    And I add a commit with category "STRATEGIC" and priority "MUST"
    Then the chess matrix returns from "GET /api/v1/weeks/{id}" with both commits in the correct cells

  @ui @happy-path
  Scenario: drift warning shows on misaligned commit row
    Given my draft week contains a commit whose linked Supporting Outcome does not match its text
    And the AI Copilot has classified that commit as "unrelated" via T2 drift check
    When I view the grouped commits list
    Then the misaligned row carries a "drift-badge" indicator with the verdict
    And the row is visually emphasised with an amber border
    And no other row in the same Supporting Outcome group carries the drift indicator

  @ui @happy-path
  Scenario: carry-forward ghost shows above current week
    Given my prior week reconciled with one commit marked carry-forward
    And the same commit text has been carry-forwarded for 4 consecutive weeks
    When I open the current draft week
    Then a "carry-forward-ghost" row renders above the grouped commits list
    And the ghost row displays the parent commit text and a "4 weeks" running badge
    And clicking the ghost row navigates to the parent commit's lineage view

  @ui @ai-t1
  Scenario: typing a commit auto-suggests a Supporting Outcome via the linker chip
    Given my draft week contains no commits
    And the org's RCDO subtree contains 12 candidate Supporting Outcomes
    When I type the commit text "Ship the new onboarding email sequence to reduce day-7 churn"
    And I wait for the SO linker debounce (500ms) to settle
    Then the so-linker transitions through THINKING into SUGGESTED
    And the so-linker-chip renders the full Rally Cry › Defining Objective › Outcome › Supporting Outcome breadcrumb
    And the so-linker-chip carries the "AI suggested" tint until the IC touches it

  @ui @happy-path
  Scenario: clicking "Change" on the linker chip opens the typeahead
    Given my draft week contains no commits
    And the AI has populated the so-linker-chip with a high-confidence Supporting Outcome
    When I click the "Change" button on the so-linker-chip
    Then the so-linker-input is rendered and focused
    And the so-linker-results list shows every Supporting Outcome with a breadcrumb context line
    And the so-linker transitions into TYPEAHEAD_OPEN

  @ui @happy-path
  Scenario: arrow-key navigation in the typeahead picks an SO
    Given my draft week contains no commits
    And the so-linker-input is open and focused
    When I type "enterprise" into the so-linker-input
    And I press the ArrowDown key once
    And I press the Enter key
    Then the second so-linker-result is selected
    And the so-linker chip renders the picked Supporting Outcome with no AI-suggested tint
    And the so-linker transitions into FILLED
