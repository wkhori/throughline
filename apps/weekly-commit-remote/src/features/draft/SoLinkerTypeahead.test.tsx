import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { OutcomeCandidateDto } from '@throughline/shared-types';
import { SoLinkerTypeahead } from './SoLinkerTypeahead.js';

const candidates: OutcomeCandidateDto[] = [
  {
    supportingOutcomeId: 'so-a',
    title: 'Reduce day-7 churn',
    parentOutcomeTitle: 'Retention',
    parentDOTitle: 'Grow ARR',
    parentRallyCryTitle: 'SMB',
  },
  {
    supportingOutcomeId: 'so-b',
    title: 'Expand enterprise pipeline',
    parentOutcomeTitle: 'Pipeline',
    parentDOTitle: 'Grow ARR',
    parentRallyCryTitle: 'SMB',
  },
  {
    supportingOutcomeId: 'so-c',
    title: 'Onboarding NPS',
    parentOutcomeTitle: 'Onboarding',
    parentDOTitle: 'Activate',
    parentRallyCryTitle: 'SMB',
  },
];

describe('SoLinkerTypeahead', () => {
  it('lists all candidates when query is empty', () => {
    render(<SoLinkerTypeahead candidates={candidates} onPick={vi.fn()} />);
    expect(screen.getAllByTestId('so-linker-result')).toHaveLength(3);
  });

  it('filters by title (case-insensitive)', async () => {
    const user = userEvent.setup();
    render(<SoLinkerTypeahead candidates={candidates} onPick={vi.fn()} />);
    await user.type(screen.getByTestId('so-linker-input'), 'enterprise');
    const rows = screen.getAllByTestId('so-linker-result');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.textContent).toContain('Expand enterprise pipeline');
  });

  it('arrow-down then enter selects the second row', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<SoLinkerTypeahead candidates={candidates} onPick={onPick} />);
    const input = screen.getByTestId('so-linker-input');
    input.focus();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick.mock.calls[0]![0].supportingOutcomeId).toBe('so-b');
  });

  it('arrow-up clamps at index 0', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<SoLinkerTypeahead candidates={candidates} onPick={onPick} />);
    const input = screen.getByTestId('so-linker-input');
    input.focus();
    // Already at 0, ArrowUp should stay at 0; Enter picks the first row.
    await user.keyboard('{ArrowUp}{Enter}');
    expect(onPick.mock.calls[0]![0].supportingOutcomeId).toBe('so-a');
  });

  it('Escape calls onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<SoLinkerTypeahead candidates={candidates} onPick={vi.fn()} onClose={onClose} />);
    const input = screen.getByTestId('so-linker-input');
    input.focus();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders "No matches." when query yields nothing', async () => {
    const user = userEvent.setup();
    render(<SoLinkerTypeahead candidates={candidates} onPick={vi.fn()} />);
    await user.type(screen.getByTestId('so-linker-input'), 'zzzzz');
    expect(screen.queryAllByTestId('so-linker-result')).toHaveLength(0);
    expect(screen.getByTestId('so-linker-results').textContent).toContain('No matches.');
  });
});
