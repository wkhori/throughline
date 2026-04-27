import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CommitDto } from '@throughline/shared-types';
import { LockWeekDialog } from './LockWeekDialog.js';

const mk = (overrides: Partial<CommitDto>): CommitDto => ({
  id: 'c',
  weekId: 'w1',
  text: 't',
  supportingOutcomeId: 'so-1',
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

describe('LockWeekDialog', () => {
  it('does not render when closed', () => {
    render(<LockWeekDialog open={false} commits={[]} onConfirm={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByTestId('lock-week-dialog')).not.toBeInTheDocument();
  });

  it('renders the count of commits about to be locked', () => {
    render(
      <LockWeekDialog
        open
        commits={[mk({ id: 'a' }), mk({ id: 'b' })]}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId('lock-dialog-count').textContent).toContain('2 commits');
  });

  it('lists commits missing an SO as blockers and disables lock', () => {
    render(
      <LockWeekDialog
        open
        commits={[mk({ id: 'a', supportingOutcomeId: null, text: 'orphan one' })]}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId('lock-dialog-blockers').textContent).toContain('orphan one');
    expect(screen.getByTestId('lock-dialog-confirm')).toBeDisabled();
  });

  it('enables the lock button when no blockers exist', () => {
    render(
      <LockWeekDialog open commits={[mk({ id: 'a' })]} onConfirm={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.getByTestId('lock-dialog-confirm')).not.toBeDisabled();
  });

  it('clicking lock fires onConfirm', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <LockWeekDialog open commits={[mk({ id: 'a' })]} onConfirm={onConfirm} onClose={vi.fn()} />,
    );
    await user.click(screen.getByTestId('lock-dialog-confirm'));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('Esc closes the dialog', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <LockWeekDialog open commits={[mk({ id: 'a' })]} onConfirm={vi.fn()} onClose={onClose} />,
    );
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('shows the portfolio-review hint pointing at the locked-week surface', () => {
    render(
      <LockWeekDialog open commits={[mk({ id: 'a' })]} onConfirm={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.getByTestId('lock-dialog-portfolio-hint')).toBeInTheDocument();
  });
});
