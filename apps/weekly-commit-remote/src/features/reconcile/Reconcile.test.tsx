import { describe, expect, it, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CommitDto, WeekDto } from '@throughline/shared-types';
import { renderWithProviders } from '../../test-utils.js';
import { Reconcile } from './Reconcile.js';

const mkCommit = (id: string, text: string): CommitDto => ({
  id,
  weekId: 'w1',
  text,
  supportingOutcomeId: 'so-x',
  category: 'OPERATIONAL',
  priority: 'SHOULD',
  displayOrder: 0,
  state: 'ACTIVE',
  parentCommitId: null,
  reconciliationOutcome: null,
  reconciliationNote: null,
  carryForwardWeeks: 0,
});

const lockedWeek: WeekDto = {
  id: 'w1',
  userId: 'u1',
  orgId: 'o1',
  weekStart: '2026-04-20',
  state: 'LOCKED',
  lockedAt: '2026-04-22T17:00:00Z',
  reconciledAt: null,
  commits: [mkCommit('c1', 'Ship A'), mkCommit('c2', 'Ship B')],
};

const reconcilingWeek: WeekDto = { ...lockedWeek, state: 'RECONCILING' };

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Reconcile', () => {
  it('shows the start-reconcile button when week is LOCKED', () => {
    renderWithProviders(<Reconcile week={lockedWeek} />);
    expect(screen.getByTestId('start-reconcile')).toBeInTheDocument();
    expect(screen.queryByTestId('reconcile-rows')).not.toBeInTheDocument();
  });

  it('renders one row per commit when week is RECONCILING', () => {
    renderWithProviders(<Reconcile week={reconcilingWeek} />);
    expect(screen.getByTestId('reconcile-row-c1')).toBeInTheDocument();
    expect(screen.getByTestId('reconcile-row-c2')).toBeInTheDocument();
  });

  it('disables the carry-forward checkbox until an outcome is selected', () => {
    renderWithProviders(<Reconcile week={reconcilingWeek} />);
    expect(screen.getByTestId('reconcile-cf-c1')).toBeDisabled();
  });

  it('enables CF after PARTIAL/NOT_DONE selection but disables it on DONE', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Reconcile week={reconcilingWeek} />);
    await user.click(screen.getByTestId('reconcile-outcome-c1-PARTIAL'));
    expect(screen.getByTestId('reconcile-cf-c1')).not.toBeDisabled();
    await user.click(screen.getByTestId('reconcile-outcome-c1-DONE'));
    expect(screen.getByTestId('reconcile-cf-c1')).toBeDisabled();
  });

  it('blocks submit until every commit has an outcome', () => {
    renderWithProviders(<Reconcile week={reconcilingWeek} />);
    expect(screen.getByTestId('submit-reconcile')).toBeDisabled();
  });

  it('submits the reconcile body with selected outcomes', async () => {
    let received: unknown;
    server.use(
      http.put('http://localhost:8080/api/v1/weeks/w1/reconcile', async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({
          week: { ...reconcilingWeek, state: 'RECONCILED' },
          alignmentDelta: null,
        });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<Reconcile week={reconcilingWeek} />);
    await user.click(screen.getByTestId('reconcile-outcome-c1-DONE'));
    await user.click(screen.getByTestId('reconcile-outcome-c2-PARTIAL'));
    await user.click(screen.getByTestId('reconcile-cf-c2'));
    await user.click(screen.getByTestId('submit-reconcile'));
    await waitFor(() => expect(received).toBeDefined());
    expect(received).toEqual({
      items: [
        { commitId: 'c1', outcome: 'DONE', note: '', carryForward: false },
        { commitId: 'c2', outcome: 'PARTIAL', note: '', carryForward: true },
      ],
    });
  });

  it('surfaces the 409 carry-forward cap error', async () => {
    server.use(
      http.put('http://localhost:8080/api/v1/weeks/w1/reconcile', () =>
        HttpResponse.json({ title: 'ILLEGAL_STATE' }, { status: 409 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<Reconcile week={reconcilingWeek} />);
    await user.click(screen.getByTestId('reconcile-outcome-c1-NOT_DONE'));
    await user.click(screen.getByTestId('reconcile-outcome-c2-NOT_DONE'));
    await user.click(screen.getByTestId('reconcile-cf-c1'));
    await user.click(screen.getByTestId('submit-reconcile'));
    await waitFor(() =>
      expect(screen.getByTestId('reconcile-error').textContent).toContain('7-commit cap'),
    );
  });

  it('starts reconcile against the LOCKED week', async () => {
    let called = false;
    server.use(
      http.post('http://localhost:8080/api/v1/weeks/w1/reconcile-start', () => {
        called = true;
        return HttpResponse.json({ ...lockedWeek, state: 'RECONCILING' });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<Reconcile week={lockedWeek} />);
    await user.click(screen.getByTestId('start-reconcile'));
    await waitFor(() => expect(called).toBe(true));
  });
});
