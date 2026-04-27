import { describe, expect, it, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { screen, waitFor } from '@testing-library/react';
import { WeeklyCommitApp } from './WeeklyCommitApp.js';
import { renderWithProviders } from './test-utils.js';

const draftWeek = {
  id: '01HW1',
  userId: '01HU1',
  orgId: '01HO1',
  weekStart: '2026-04-20',
  state: 'DRAFT' as const,
  lockedAt: null,
  reconciledAt: null,
  commits: [],
};

const server = setupServer(
  http.get('http://localhost:8080/api/v1/rcdo/tree', () =>
    HttpResponse.json({ rallyCries: [] }),
  ),
  http.get('http://localhost:8080/api/v1/weeks/current', () => HttpResponse.json(draftWeek)),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('WeeklyCommitApp', () => {
  it('shows the sign-in gate when no user is in the auth slice', () => {
    renderWithProviders(<WeeklyCommitApp />, null);
    expect(screen.getByTestId('signed-out')).toBeInTheDocument();
  });

  it('mounts the lazy DraftWeek surface for IC users', async () => {
    renderWithProviders(<WeeklyCommitApp />, 'IC');
    await waitFor(() => expect(screen.getByTestId('draft-week')).toBeInTheDocument());
  });

  it('mounts the RCDO authoring tree for ADMIN users', async () => {
    renderWithProviders(<WeeklyCommitApp />, 'ADMIN');
    expect(await screen.findByTestId('rcdo-tree-editor')).toBeInTheDocument();
  });
});
