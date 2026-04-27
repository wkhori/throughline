import { describe, expect, it, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { screen } from '@testing-library/react';
import { WeeklyCommitApp } from './WeeklyCommitApp.js';
import { renderWithProviders } from './test-utils.js';

const server = setupServer(
  http.get('http://localhost:8080/api/v1/rcdo/tree', () =>
    HttpResponse.json({ rallyCries: [] }),
  ),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('WeeklyCommitApp', () => {
  it('shows the sign-in gate when no user is in the auth slice', () => {
    renderWithProviders(<WeeklyCommitApp />, null);
    expect(screen.getByTestId('signed-out')).toBeInTheDocument();
  });

  it('renders the IC placeholder for non-admin users', () => {
    renderWithProviders(<WeeklyCommitApp />, 'IC');
    expect(screen.getByTestId('placeholder')).toBeInTheDocument();
    expect(screen.getByText(/Demo IC/)).toBeInTheDocument();
  });

  it('mounts the RCDO authoring tree for ADMIN users', async () => {
    renderWithProviders(<WeeklyCommitApp />, 'ADMIN');
    expect(await screen.findByTestId('rcdo-tree-editor')).toBeInTheDocument();
  });
});
