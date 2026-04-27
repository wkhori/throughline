/// <reference types="cypress" />

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      loginAsPersona(persona: 'ic' | 'manager' | 'admin'): Chainable<void>;
      apiRequest(method: string, path: string, body?: unknown): Chainable<Cypress.Response<unknown>>;
    }
  }
}

Cypress.Commands.add('loginAsPersona', (persona) => {
  cy.visit('/');
  cy.get(`[data-testid="persona-${persona}"]`).click();
});

Cypress.Commands.add('apiRequest', (method, path, body) =>
  cy.window().then((win) => {
    const token = (
      win as unknown as { __THROUGHLINE_TOKEN__?: string }
    ).__THROUGHLINE_TOKEN__;
    return cy.request({
      method,
      url: `${Cypress.env('apiBaseUrl')}/api/v1${path}`,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body,
      failOnStatusCode: false,
    });
  }),
);

export {};
