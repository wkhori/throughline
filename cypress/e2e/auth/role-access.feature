@phase-1 @auth
Feature: Role-based access control (P6 hierarchy ADMIN > MANAGER > IC)
  As an authenticated user
  I want my UI capabilities to match my role hierarchy
  So that I can perform actions appropriate to my permissions

  @stub @happy-path
  Scenario Outline: Users below required role see nothing they shouldn't
    Given I am signed in as the "<persona>" persona
    Then route "<route>" returns "<status>"

    Examples:
      | persona | route                       | status |
      | ic      | /admin/rally-cries          | 403    |
      | manager | /admin/rally-cries          | 403    |
      | admin   | /admin/rally-cries          | 200    |
      | ic      | /weeks/current              | 200    |
      | manager | /weeks/current              | 200    |
      | admin   | /weeks/current              | 200    |
      | ic      | /manager/team-rollup        | 403    |
      | manager | /manager/team-rollup        | 200    |
      | admin   | /manager/team-rollup        | 200    |

  @stub @manager-locks-own-week @P6
  Scenario: A MANAGER user can lock their own week (role hierarchy implies IC capability)
    Given I am signed in as a MANAGER who is also the owner of the current week
    When I attempt to lock my own week
    Then the response is 200 OK and the week state is "LOCKED"
