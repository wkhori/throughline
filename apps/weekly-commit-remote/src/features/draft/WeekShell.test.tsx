import { describe, expect, it, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test-utils.js';
import { WeekShell } from './WeekShell.js';

const draft = {
  id: 'w1',
  userId: 'u1',
  orgId: 'o1',
  weekStart: '2026-04-20',
  state: 'DRAFT' as const,
  lockedAt: null,
  reconciledAt: null,
  commits: [],
};

const locked = { ...draft, state: 'LOCKED' as const, lockedAt: '2026-04-22T17:00:00Z' };

const server = setupServer(
  http.get('http://localhost:8080/api/v1/rcdo/tree', () => HttpResponse.json({ rallyCries: [] })),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('WeekShell', () => {
  it('renders DraftWeek when week.state is DRAFT', async () => {
    server.use(
      http.get('http://localhost:8080/api/v1/weeks/current', () => HttpResponse.json(draft)),
    );
    renderWithProviders(<WeekShell />);
    await waitFor(() => expect(screen.getByTestId('draft-week')).toBeInTheDocument());
  });

  it('renders LockedWeek when week.state is LOCKED', async () => {
    server.use(
      http.get('http://localhost:8080/api/v1/weeks/current', () => HttpResponse.json(locked)),
    );
    renderWithProviders(<WeekShell />);
    await waitFor(() => expect(screen.getByTestId('locked-week')).toBeInTheDocument());
  });

  it('shows an error fallback when the current-week query fails', async () => {
    server.use(
      http.get('http://localhost:8080/api/v1/weeks/current', () =>
        HttpResponse.json({ title: 'NOT_FOUND' }, { status: 500 }),
      ),
    );
    renderWithProviders(<WeekShell />);
    await waitFor(() => expect(screen.getByTestId('week-shell-error')).toBeInTheDocument());
  });
});
