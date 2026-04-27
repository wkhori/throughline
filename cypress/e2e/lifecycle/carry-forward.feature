@phase-3 @lifecycle @carry-forward
Feature: Carry forward an unfinished commit
  As an IC reconciling a week
  I want PARTIAL/NOT_DONE commits to spawn linked DRAFTs in week N+1
  So that the alignment graph preserves lineage and the AI can flag long carry chains

  Background:
    Given I am signed in as the demo persona "ic"
    And my week is in state "RECONCILED"

  @stub @happy-path
  Scenario: Submitting reconcile with carryForward=true spawns a new DRAFT in week N+1
    Given a NOT_DONE commit "c3" with carryForward=true was submitted in the previous step
    Then a new commit exists in week N+1 with parentCommitId = "c3"
    And the new commit's text matches the original
    And the new commit's carry_forward_weeks equals 1
    And the original commit "c3" is in state "CARRIED_FORWARD"

  @stub @happy-path
  Scenario: Carry-forward chain length increments across weeks
    Given a commit has been carry-forwarded 3 weeks running
    When I reconcile the 4th week with that commit set to carryForward=true
    Then the new commit's carry_forward_weeks equals 4

  @stub @edge
  Scenario: Carry-forward into a week already at the 7-commit cap returns 409
    Given week N+1 already contains 7 commits
    When I submit reconcile with a carry-forward item
    Then the response status is 409
    And the problem detail mentions "next week is at the 7-commit cap"

  @stub @happy-path
  Scenario: Carry-forward creates week N+1 as DRAFT if it does not yet exist
    Given week N+1 does not exist for me yet
    When I submit reconcile with one carry-forward item
    Then a new Week row is created in state "DRAFT" with weekStart = (current weekStart + 7 days in org TZ)

  @stub @edge
  Scenario: Lineage query returns the full chain via recursive CTE
    Given the carry-forward chain length is 4
    When I query the lineage of the latest commit
    Then the chain returns the original + 3 carried-forward generations
    And every link's parentCommitId references the prior commit
