import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders as render } from '../../test-utils.js';
import userEvent from '@testing-library/user-event';
import type { CommitDto, RcdoTreeDto } from '@throughline/shared-types';
import { CommitCard } from './CommitCard.js';

const baseCommit: CommitDto = {
  id: 'c1',
  weekId: 'w1',
  text: 'Ship onboarding email v2',
  supportingOutcomeId: 'so-1',
  category: 'STRATEGIC',
  priority: 'MUST',
  displayOrder: 0,
  state: 'ACTIVE',
  parentCommitId: null,
  reconciliationOutcome: null,
  reconciliationNote: null,
  carryForwardWeeks: 0,
};

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
                {
                  id: 'so-1',
                  outcomeId: 'o1',
                  title: 'Email v2',
                  displayOrder: 0,
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe('CommitCard', () => {
  it('renders the commit text and SO breadcrumb', () => {
    render(<CommitCard commit={baseCommit} rcdo={tree} weekState="DRAFT" />);
    expect(screen.getByText('Ship onboarding email v2')).toBeInTheDocument();
    expect(screen.getByTestId('commit-breadcrumb').textContent).toContain('Email v2');
  });

  it('shows category and priority pills', () => {
    render(<CommitCard commit={baseCommit} rcdo={tree} weekState="DRAFT" />);
    expect(screen.getByTestId('commit-category').textContent).toBe('STRATEGIC');
    expect(screen.getByTestId('commit-priority').textContent).toBe('MUST');
  });

  it('shows missing-SO warning when supportingOutcomeId is null', () => {
    render(
      <CommitCard
        commit={{ ...baseCommit, supportingOutcomeId: null }}
        rcdo={tree}
        weekState="DRAFT"
      />,
    );
    expect(screen.getByTestId('commit-no-so')).toBeInTheDocument();
  });

  it('shows an explicit remove button that opens a confirmation dialog before deleting', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<CommitCard commit={baseCommit} rcdo={tree} weekState="DRAFT" onEdit={onEdit} />);
    await user.click(screen.getByTestId('commit-remove'));
    // The mutation must NOT have fired yet — the dialog needs explicit confirm.
    expect(onEdit).not.toHaveBeenCalled();
    expect(screen.getByTestId('commit-remove-dialog')).toBeInTheDocument();
    await user.click(screen.getByTestId('commit-remove-confirm'));
    expect(onEdit).toHaveBeenCalledWith(baseCommit);
  });

  it('cancel in the confirmation dialog leaves the commit intact', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<CommitCard commit={baseCommit} rcdo={tree} weekState="DRAFT" onEdit={onEdit} />);
    await user.click(screen.getByTestId('commit-remove'));
    await user.click(screen.getByTestId('commit-remove-cancel'));
    expect(onEdit).not.toHaveBeenCalled();
    expect(screen.queryByTestId('commit-remove-dialog')).not.toBeInTheDocument();
  });

  it('is read-only in LOCKED state — no remove button rendered', () => {
    const onEdit = vi.fn();
    render(<CommitCard commit={baseCommit} rcdo={tree} weekState="LOCKED" onEdit={onEdit} />);
    expect(screen.queryByTestId('commit-remove')).not.toBeInTheDocument();
  });

  it('clicking anywhere on the card body does not delete the commit', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<CommitCard commit={baseCommit} rcdo={tree} weekState="DRAFT" onEdit={onEdit} />);
    await user.click(screen.getByText(baseCommit.text));
    expect(onEdit).not.toHaveBeenCalled();
  });
});
