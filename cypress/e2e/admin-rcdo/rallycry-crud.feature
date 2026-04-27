@phase-1 @rcdo @admin
Feature: RCDO admin authoring — Rally Cry CRUD
  As an admin
  I want to create, edit, reorder, and archive Rally Cries
  So that ICs can link weekly commits to a current strategic shape

  Background:
    Given I am signed in as the "admin" persona
    And the RCDO tree starts empty

  @stub @happy-path
  Scenario: Create a Rally Cry
    When I create a Rally Cry titled "Win the SMB segment"
    Then the RCDO tree contains exactly one Rally Cry titled "Win the SMB segment"
    And the response is 201 with a 26-char ULID id

  @stub @happy-path
  Scenario: Edit a Rally Cry title
    Given a Rally Cry "Win the SMB segment" exists
    When I rename it to "Win the mid-market"
    Then the RCDO tree shows the new title
    And the previous title is no longer present

  @stub @happy-path
  Scenario: Soft-archive a Rally Cry
    Given a Rally Cry "Old initiative" exists
    When I archive that Rally Cry
    Then "GET /rcdo/tree" no longer includes "Old initiative"
    And the row remains in the database with archived_at set

  @stub @edge
  Scenario: ADMIN-only — IC and MANAGER cannot create
    Given I am signed in as the "ic" persona
    When I attempt to create a Rally Cry
    Then the response is 403 Forbidden

  @integration @auth0
  Scenario: A real Auth0 ADMIN user can create a Rally Cry end-to-end
    Given a real Auth0 ADMIN session is established
    When I POST /admin/rally-cries with title "Win the SMB segment"
    Then the response is 201 and the row exists in Postgres
