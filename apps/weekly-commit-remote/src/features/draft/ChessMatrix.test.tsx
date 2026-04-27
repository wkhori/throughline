import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders as render } from '../../test-utils.js';
import userEvent from '@testing-library/user-event';
import type { CommitDto } from '@throughline/shared-types';
import { ChessMatrix } from './ChessMatrix.js';

const mk = (overrides: Partial<CommitDto>): CommitDto => ({
  id: overrides.id ?? 'c',
  weekId: 'w1',
  text: overrides.text ?? 't',
  supportingOutcomeId: 'so-1',
  category: overrides.category ?? 'OPERATIONAL',
  priority: overrides.priority ?? 'SHOULD',
  displayOrder: 0,
  state: 'ACTIVE',
  parentCommitId: null,
  reconciliationOutcome: null,
  reconciliationNote: null,
  carryForwardWeeks: 0,
});

describe('ChessMatrix', () => {
  it('renders a 3x3 grid: 3 categories × 3 priorities', () => {
    render(<ChessMatrix commits={[]} weekState="DRAFT" />);
    for (const cat of ['STRATEGIC', 'OPERATIONAL', 'REACTIVE']) {
      for (const pri of ['MUST', 'SHOULD', 'COULD']) {
        expect(screen.getByTestId(`chess-cell-${cat}-${pri}`)).toBeInTheDocument();
      }
    }
  });

  it('places each commit in the cell matching its category × priority', () => {
    const commits = [
      mk({ id: 'a', text: 'first', category: 'STRATEGIC', priority: 'MUST' }),
      mk({ id: 'b', text: 'second', category: 'REACTIVE', priority: 'COULD' }),
    ];
    render(<ChessMatrix commits={commits} weekState="DRAFT" />);
    const must = screen.getByTestId('chess-cell-STRATEGIC-MUST');
    expect(must.textContent).toContain('first');
    const could = screen.getByTestId('chess-cell-REACTIVE-COULD');
    expect(could.textContent).toContain('second');
  });

  it('renders an empty-state hint in cells with no commits', () => {
    render(<ChessMatrix commits={[]} weekState="DRAFT" />);
    expect(screen.getByTestId('chess-cell-STRATEGIC-MUST').textContent).toBe('—');
  });

  it('arrow keys move focus across the grid', async () => {
    const user = userEvent.setup();
    render(<ChessMatrix commits={[]} weekState="DRAFT" />);
    const first = screen.getByTestId('chess-cell-STRATEGIC-MUST');
    first.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByTestId('chess-cell-STRATEGIC-SHOULD')).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByTestId('chess-cell-OPERATIONAL-SHOULD')).toHaveFocus();
  });

  it('Esc clears focus to first cell semantics (resets state)', async () => {
    const user = userEvent.setup();
    render(<ChessMatrix commits={[]} weekState="DRAFT" />);
    const first = screen.getByTestId('chess-cell-STRATEGIC-MUST');
    first.focus();
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Escape}');
    // After escape, the originally-first cell becomes tab-target again.
    expect(first).toHaveAttribute('tabindex', '0');
  });
});
