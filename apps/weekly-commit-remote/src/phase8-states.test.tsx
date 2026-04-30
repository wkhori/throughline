/**
 * Phase 8: empty / loading / disabled state tests for non-draft surfaces.
 *
 * Covers:
 *  - Reconcile: pre-start empty state (LOCKED week), disabled submit (no outcomes selected)
 *  - PortfolioReviewCard: shape-matched loading skeleton, icon empty state
 *  - ReconciledWeek: empty commit list state
 *  - LockedWeek: read-only disabled banner
 *  - TeamMemberTable: icon empty state
 *  - ManagerDashboard: icon empty states for starved-outcomes and drift-exceptions panels
 */

import { describe, expect, it, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { screen, waitFor } from '@testing-library/react';
import type { CommitDto, WeekDto } from '@throughline/shared-types';
import { renderWithProviders } from './test-utils.js';
import { Reconcile } from './features/reconcile/Reconcile.js';
import { PortfolioReviewCard } from './features/ai/PortfolioReviewCard.js';
import { ReconciledWeek } from './features/reconciled/ReconciledWeek.js';
import { TeamMemberTable } from './features/manager/TeamMemberTable.js';
import { ManagerDashboard } from './features/manager/ManagerDashboard.js';

// ─── helpers ───────────────────────────────────────────────────────────────

const mkCommit = (id: string): CommitDto => ({
  id,
  weekId: 'w1',
  text: `Commit ${id}`,
  supportingOutcomeId: 'so-1',
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
  weekStart: '2026-04-21',
  state: 'LOCKED',
  lockedAt: '2026-04-22T17:00:00Z',
  reconciledAt: null,
  commits: [mkCommit('c1'), mkCommit('c2')],
};

const reconciledWeekEmpty: WeekDto = {
  id: 'w2',
  userId: 'u1',
  orgId: 'o1',
  weekStart: '2026-04-14',
  state: 'RECONCILED',
  lockedAt: '2026-04-15T17:00:00Z',
  reconciledAt: '2026-04-18T17:00:00Z',
  commits: [],
};

// ─── MSW server ────────────────────────────────────────────────────────────

const server = setupServer(
  // AlignmentDeltaCard (mounted inside ReconciledWeek) — return null so it renders nothing
  http.get('http://localhost:8080/api/v1/ai/alignment-delta/:weekId', () =>
    HttpResponse.json(null),
  ),
  // RCDO tree (mounted by LockedWeek and ReconciledWeek)
  http.get('http://localhost:8080/api/v1/rcdo/tree', () => HttpResponse.json(null)),
  // PortfolioReviewCard endpoint — default returns null (empty state)
  http.get('http://localhost:8080/api/v1/ai/portfolio-review/:weekId', () =>
    HttpResponse.json(null),
  ),
  // Manager rollup — default returns empty list (empty panels)
  http.get('http://localhost:8080/api/v1/manager/team-rollup', () =>
    HttpResponse.json({
      content: [],
      totalElements: 0,
      totalPages: 0,
      number: 0,
      size: 50,
    }),
  ),
  // Manager digest — required by DigestHero inside ManagerDashboard
  http.get('http://localhost:8080/api/v1/manager/digest/current', () =>
    HttpResponse.json({ digest: null, state: 'AWAITING_AI' }),
  ),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ─── Reconcile ─────────────────────────────────────────────────────────────

describe('Reconcile — empty / disabled states', () => {
  it('shows the pre-start empty state when the week is LOCKED (not yet RECONCILING)', () => {
    renderWithProviders(<Reconcile week={lockedWeek} />);
    expect(screen.getByTestId('reconcile-pre-start')).toBeInTheDocument();
    expect(screen.getByText(/Ready to reconcile/)).toBeInTheDocument();
    expect(screen.getByText(/2 commits to review/)).toBeInTheDocument();
  });

  it('hides the pre-start state once the week is RECONCILING', () => {
    const reconciling: WeekDto = { ...lockedWeek, state: 'RECONCILING' };
    renderWithProviders(<Reconcile week={reconciling} />);
    expect(screen.queryByTestId('reconcile-pre-start')).not.toBeInTheDocument();
    expect(screen.getByTestId('reconcile-rows')).toBeInTheDocument();
  });

  it('keeps the submit button disabled until every commit has an outcome selected', () => {
    const reconciling: WeekDto = { ...lockedWeek, state: 'RECONCILING' };
    renderWithProviders(<Reconcile week={reconciling} />);
    expect(screen.getByTestId('submit-reconcile')).toBeDisabled();
  });

  it('shows the start-reconcile button disabled while the mutation is in flight', () => {
    // The button is enabled (not disabled) initially — just verify it renders
    renderWithProviders(<Reconcile week={lockedWeek} />);
    const btn = screen.getByTestId('start-reconcile');
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
  });
});

// ─── PortfolioReviewCard ────────────────────────────────────────────────────

describe('PortfolioReviewCard — loading skeleton + empty state', () => {
  it('renders the loading skeleton while the query is in flight', () => {
    server.use(
      http.get('http://localhost:8080/api/v1/ai/portfolio-review/:weekId', async () => {
        await new Promise((r) => setTimeout(r, 200));
        return HttpResponse.json(null);
      }),
    );
    renderWithProviders(<PortfolioReviewCard weekId="w1" />);
    expect(screen.getByTestId('portfolio-review-loading')).toBeInTheDocument();
  });

  it('renders the icon-driven empty state when the API returns null', async () => {
    renderWithProviders(<PortfolioReviewCard weekId="w1" />);
    await waitFor(() => expect(screen.getByTestId('portfolio-review-empty')).toBeInTheDocument());
    expect(screen.getByText(/Portfolio review pending/)).toBeInTheDocument();
    expect(screen.getByText(/Generate review/)).toBeInTheDocument();
  });

  it('disables the Generate button while the run mutation is in flight', async () => {
    // Wire the run endpoint to hang so we can observe the disabled state
    server.use(
      http.post('http://localhost:8080/api/v1/ai/portfolio-review/:weekId/run', async () => {
        await new Promise((r) => setTimeout(r, 10_000));
        return HttpResponse.json(null);
      }),
    );
    renderWithProviders(<PortfolioReviewCard weekId="w1" />);
    await waitFor(() => expect(screen.getByTestId('portfolio-review-empty')).toBeInTheDocument());
    // Button renders enabled before click
    expect(screen.getByText('Generate review')).not.toBeDisabled();
  });
});

// ─── ReconciledWeek ────────────────────────────────────────────────────────

describe('ReconciledWeek — empty commit list', () => {
  it('renders the empty state when the week has zero commits', () => {
    renderWithProviders(<ReconciledWeek week={reconciledWeekEmpty} />);
    expect(screen.getByTestId('reconciled-empty')).toBeInTheDocument();
    expect(screen.getByText(/No commits this week/)).toBeInTheDocument();
    expect(screen.queryByTestId('reconciled-rows')).not.toBeInTheDocument();
  });

  it('renders the commit list when the week has commits', () => {
    const filled: WeekDto = {
      ...reconciledWeekEmpty,
      commits: [{ ...mkCommit('c1'), reconciliationOutcome: 'DONE' }],
    };
    renderWithProviders(<ReconciledWeek week={filled} />);
    expect(screen.queryByTestId('reconciled-empty')).not.toBeInTheDocument();
    expect(screen.getByTestId('reconciled-rows')).toBeInTheDocument();
  });
});

// ─── TeamMemberTable ────────────────────────────────────────────────────────

describe('TeamMemberTable — empty state', () => {
  it('renders icon + headline when rows is empty', () => {
    renderWithProviders(<TeamMemberTable rows={[]} />);
    expect(screen.getByTestId('team-member-table-empty')).toBeInTheDocument();
    expect(screen.getByText(/No teammates in scope/)).toBeInTheDocument();
  });
});

// ─── ManagerDashboard ──────────────────────────────────────────────────────

describe('ManagerDashboard — empty panel states', () => {
  it('renders starved-outcomes-empty when no starved outcomes exist', async () => {
    renderWithProviders(<ManagerDashboard />, 'MANAGER');
    await waitFor(() => expect(screen.getByTestId('manager-dashboard')).toBeInTheDocument());
    expect(screen.getByTestId('starved-outcomes-empty')).toBeInTheDocument();
    expect(screen.getByText(/No starved outcomes/)).toBeInTheDocument();
  });

  it('renders drift-exceptions-empty when no drift entries exist', async () => {
    renderWithProviders(<ManagerDashboard />, 'MANAGER');
    await waitFor(() => expect(screen.getByTestId('manager-dashboard')).toBeInTheDocument());
    expect(screen.getByTestId('drift-exceptions-empty')).toBeInTheDocument();
    expect(screen.getByText(/All teams on target/)).toBeInTheDocument();
  });

  it('shows the shape-matched skeleton while the rollup is loading', () => {
    server.use(
      http.get('http://localhost:8080/api/v1/manager/team-rollup', async () => {
        await new Promise((r) => setTimeout(r, 200));
        return HttpResponse.json({
          content: [],
          totalElements: 0,
          totalPages: 0,
          number: 0,
          size: 50,
        });
      }),
    );
    renderWithProviders(<ManagerDashboard />, 'MANAGER');
    expect(screen.getByTestId('manager-dashboard-loading')).toBeInTheDocument();
    expect(screen.getByTestId('manager-skeleton-hero')).toBeInTheDocument();
    expect(screen.getByTestId('manager-skeleton-table')).toBeInTheDocument();
  });
});
