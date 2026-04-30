import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CommitDto, RcdoTreeDto, WeekDto } from '@throughline/shared-types';
import { renderWithProviders as render } from '../../test-utils.js';
import { CarryForwardGhost } from './CarryForwardGhost.js';

const tree: RcdoTreeDto = {
  rallyCries: [
    {
      id: 'rc1',
      title: 'Win the SMB segment',
      displayOrder: 0,
      definingObjectives: [
        {
          id: 'do1',
          rallyCryId: 'rc1',
          title: 'Reduce churn',
          displayOrder: 0,
          outcomes: [
            {
              id: 'o1',
              definingObjectiveId: 'do1',
              title: 'Improve onboarding',
              displayOrder: 0,
              supportingOutcomes: [
                { id: 'so-1', outcomeId: 'o1', title: 'Auth migration', displayOrder: 0 },
              ],
            },
          ],
        },
      ],
    },
  ],
};

const ghostCommit: CommitDto = {
  id: 'ghost-1',
  weekId: 'w1',
  text: 'Migrate legacy auth provider to Auth0',
  supportingOutcomeId: 'so-1',
  category: 'STRATEGIC',
  priority: 'MUST',
  displayOrder: 0,
  state: 'CARRIED_FORWARD',
  parentCommitId: 'parent-x',
  reconciliationOutcome: null,
  reconciliationNote: null,
  carryForwardWeeks: 4,
};

const week: WeekDto = {
  id: 'w1',
  userId: 'u1',
  orgId: 'o1',
  weekStart: '2026-04-27',
  state: 'DRAFT',
  lockedAt: null,
  reconciledAt: null,
  commits: [ghostCommit],
};

describe('CarryForwardGhost', () => {
  it('renders the parent commit text and N-weeks-running badge', () => {
    render(<CarryForwardGhost week={week} rcdo={tree} />);
    expect(screen.getByTestId('carry-forward-ghost')).toBeInTheDocument();
    expect(screen.getByText('Migrate legacy auth provider to Auth0')).toBeInTheDocument();
    expect(screen.getByTestId('carry-forward-badge').textContent).toContain('4 weeks');
  });

  it('falls back to "from last week" when carryForwardWeeks is missing/1', () => {
    const w = { ...week, commits: [{ ...ghostCommit, carryForwardWeeks: 1 }] };
    render(<CarryForwardGhost week={w} rcdo={tree} />);
    expect(screen.getByTestId('carry-forward-badge').textContent).toContain('last week');
  });

  it('renders nothing when no CARRIED_FORWARD commit exists in the week', () => {
    const w: WeekDto = {
      ...week,
      commits: [{ ...ghostCommit, state: 'ACTIVE', id: 'active-1' }],
    };
    const { container } = render(<CarryForwardGhost week={w} rcdo={tree} />);
    expect(container.firstChild).toBeNull();
  });

  it('invokes onOpenLineage with the ghost commit on click', async () => {
    const onOpenLineage = vi.fn();
    const user = userEvent.setup();
    render(<CarryForwardGhost week={week} rcdo={tree} onOpenLineage={onOpenLineage} />);
    await user.click(screen.getByTestId('carry-forward-ghost'));
    expect(onOpenLineage).toHaveBeenCalledWith(ghostCommit);
  });
});
