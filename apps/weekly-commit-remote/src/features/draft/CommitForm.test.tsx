import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RcdoTreeDto } from '@throughline/shared-types';
import { CommitForm } from './CommitForm.js';

const tree: RcdoTreeDto = {
  rallyCries: [
    {
      id: 'rc',
      title: 'RC',
      displayOrder: 0,
      definingObjectives: [
        {
          id: 'do',
          rallyCryId: 'rc',
          title: 'DO',
          displayOrder: 0,
          outcomes: [
            {
              id: 'o',
              definingObjectiveId: 'do',
              title: 'O',
              displayOrder: 0,
              supportingOutcomes: [{ id: 'so-x', outcomeId: 'o', title: 'SO X', displayOrder: 0 }],
            },
          ],
        },
      ],
    },
  ],
};

describe('CommitForm', () => {
  it('disables submit when text is shorter than 5 characters', () => {
    render(<CommitForm weekId="w1" rcdo={tree} onSubmit={vi.fn()} />);
    expect(screen.getByTestId('commit-form-submit')).toBeDisabled();
  });

  it('shows the live character counter (current/280)', async () => {
    const user = userEvent.setup();
    render(<CommitForm weekId="w1" rcdo={tree} onSubmit={vi.fn()} />);
    await user.type(screen.getByTestId('commit-text-input'), 'hello');
    expect(screen.getByTestId('commit-text-counter').textContent).toBe('5/280');
  });

  it('submit calls onSubmit with the right body', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<CommitForm weekId="w1" rcdo={tree} onSubmit={onSubmit} />);
    await user.type(screen.getByTestId('commit-text-input'), 'Ship sequence v2');
    await user.selectOptions(screen.getByTestId('commit-so-select'), 'so-x');
    await user.selectOptions(screen.getByTestId('commit-category-select'), 'STRATEGIC');
    await user.selectOptions(screen.getByTestId('commit-priority-select'), 'MUST');
    await user.click(screen.getByTestId('commit-form-submit'));
    expect(onSubmit).toHaveBeenCalledWith({
      weekId: 'w1',
      text: 'Ship sequence v2',
      supportingOutcomeId: 'so-x',
      category: 'STRATEGIC',
      priority: 'MUST',
    });
  });

  it('renders a server-error banner when serverError is set', () => {
    render(
      <CommitForm
        weekId="w1"
        rcdo={tree}
        onSubmit={vi.fn()}
        serverError="That commit failed validation."
      />,
    );
    expect(screen.getByTestId('commit-form-error').textContent).toContain('failed validation');
  });

  it('disables submit while submitting prop is true', () => {
    render(<CommitForm weekId="w1" rcdo={tree} onSubmit={vi.fn()} submitting />);
    expect(screen.getByTestId('commit-form-submit')).toBeDisabled();
  });
});
