import { describe, expect, it, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('opens the shortcuts modal on "?" and closes on Escape', async () => {
    server.use(
      http.get('http://localhost:8080/api/v1/weeks/current', () => HttpResponse.json(draft)),
    );
    renderWithProviders(<WeekShell />);
    await waitFor(() => expect(screen.getByTestId('draft-week')).toBeInTheDocument());
    expect(screen.queryByTestId('shortcuts-modal')).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: '?' });
    expect(await screen.findByTestId('shortcuts-modal')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('shortcuts-modal')).not.toBeInTheDocument());
  });

  it('exposes the persistent shortcuts hint on the LOCKED state', async () => {
    server.use(
      http.get('http://localhost:8080/api/v1/weeks/current', () => HttpResponse.json(locked)),
      http.post('http://localhost:8080/api/v1/ai/insights/batch', () =>
        HttpResponse.json({ insights: [] }),
      ),
    );
    renderWithProviders(<WeekShell />);
    await waitFor(() => expect(screen.getByTestId('locked-week')).toBeInTheDocument());
    const hint = await screen.findByTestId('shortcuts-hint');
    expect(hint).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(hint);
    expect(await screen.findByTestId('shortcuts-modal')).toBeInTheDocument();
  });
});
