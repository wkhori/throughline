@phase-1 @auth
Feature: Login
  As a user of Throughline
  I want to authenticate against Auth0 (or the stub provider in dev mode)
  So that the host shell can propagate my JWT into the federated remote

  Background:
    Given the host shell is loaded at "/"

  @stub @happy-path
  Scenario: Stub-mode IC login establishes JWT and identity
    When I select the demo persona "ic"
    Then the auth slice contains a token
    And "GET /api/v1/me" returns 200 with role "IC"
    And the persona switcher reports "Demo IC · IC"

  @stub @happy-path
  Scenario: Stub-mode Manager login establishes MANAGER role
    When I select the demo persona "manager"
    Then the auth slice contains a token
    And "GET /api/v1/me" returns 200 with role "MANAGER"

  @stub @happy-path
  Scenario: Stub-mode Admin login establishes ADMIN role
    When I select the demo persona "admin"
    Then the auth slice contains a token
    And "GET /api/v1/me" returns 200 with role "ADMIN"

  @stub @edge
  Scenario: Sign out clears the auth slice
    Given I am signed in as the "ic" persona
    When I click "Sign out"
    Then the auth slice token is null
    And "GET /api/v1/me" returns 401

  @integration @auth0
  Scenario: Real Auth0 login completes the SPA flow
    Given AUTH0_ISSUER_URI is configured
    When I complete the Auth0 universal-login flow as the seeded IC user
    Then the auth slice contains a real JWT
    And "GET /api/v1/me" returns 200 with role "IC"
