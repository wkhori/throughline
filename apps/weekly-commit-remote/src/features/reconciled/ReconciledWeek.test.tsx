import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import type { CommitDto, WeekDto } from '@throughline/shared-types';
import { renderWithProviders } from '../../test-utils.js';
import { ReconciledWeek } from './ReconciledWeek.js';

const commit = (overrides: Partial<CommitDto>): CommitDto => ({
  id: 'c',
  weekId: 'w1',
  text: 't',
  supportingOutcomeId: 'so',
  category: 'OPERATIONAL',
  priority: 'SHOULD',
  displayOrder: 0,
  state: 'ACTIVE',
  parentCommitId: null,
  reconciliationOutcome: null,
  reconciliationNote: null,
  carryForwardWeeks: 0,
  ...overrides,
});

const week: WeekDto = {
  id: 'w1',
  userId: 'u1',
  orgId: 'o1',
  weekStart: '2026-04-20',
  state: 'RECONCILED',
  lockedAt: '2026-04-22T17:00:00Z',
  reconciledAt: '2026-04-25T17:00:00Z',
  commits: [
    commit({ id: 'c1', text: 'Shipped Tuesday', reconciliationOutcome: 'DONE' }),
    commit({
      id: 'c2',
      text: 'Carried forward',
      reconciliationOutcome: 'NOT_DONE',
      reconciliationNote: 'blocked on Auth0',
      state: 'CARRIED_FORWARD',
      carryForwardWeeks: 2,
    }),
  ],
};

describe('ReconciledWeek', () => {
  it('renders one row per commit with the outcome pill', () => {
    renderWithProviders(<ReconciledWeek week={week} />);
    expect(screen.getByTestId('reconciled-row-c1')).toBeInTheDocument();
    expect(screen.getByTestId('reconciled-outcome-c1').textContent).toBe('DONE');
    expect(screen.getByTestId('reconciled-outcome-c2').textContent).toBe('NOT_DONE');
  });

  it('shows the carry-forward badge with chain length on CARRIED_FORWARD commits', () => {
    renderWithProviders(<ReconciledWeek week={week} />);
    expect(screen.getByTestId('reconciled-cf-badge-c2').textContent).toContain('chain length 2');
  });

  it('renders the alignment-delta placeholder pane', () => {
    renderWithProviders(<ReconciledWeek week={week} />);
    expect(screen.getByTestId('reconciled-alignment-placeholder')).toBeInTheDocument();
  });
});
