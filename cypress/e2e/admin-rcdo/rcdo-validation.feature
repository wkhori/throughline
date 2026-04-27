@phase-1 @rcdo @admin
Feature: RCDO admin validation
  As an admin
  I want strict validation on the RCDO tree
  So that the strategy graph stays well-formed and the AI copilot has reliable input

  Background:
    Given I am signed in as the "admin" persona

  @stub @edge
  Scenario: Title length 5–500 chars enforced
    When I attempt to create a Rally Cry with title "a"
    Then the response is 400 with field error "title"

  @stub @edge
  Scenario: Duplicate non-archived titles within the same parent are rejected
    Given a Rally Cry "Win the SMB segment" exists
    When I attempt to create another Rally Cry with the same title
    Then the response is 409

  @stub @edge
  Scenario: Cannot delete a Rally Cry that has Defining Objectives — must archive instead
    Given a Rally Cry "Win the SMB segment" with at least one Defining Objective
    When I attempt to delete the Rally Cry
    Then the response is 409 with title "ILLEGAL_STATE"
    And the response suggests archiving

  @stub @edge
  Scenario: Defining Objective can only attach to a non-archived Rally Cry
    Given a Rally Cry that is archived
    When I attempt to create a Defining Objective under that Rally Cry
    Then the response is 409
