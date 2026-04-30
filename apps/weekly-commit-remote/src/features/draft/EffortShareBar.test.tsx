import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { CommitDto } from '@throughline/shared-types';
import { EffortShareBar, PRIORITY_WEIGHT, computeEffortShares } from './EffortShareBar.js';

const baseCommit: CommitDto = {
  id: 'c0',
  weekId: 'w1',
  text: 'placeholder',
  supportingOutcomeId: 'so-a',
  category: 'STRATEGIC',
  priority: 'MUST',
  displayOrder: 0,
  state: 'ACTIVE',
  parentCommitId: null,
  reconciliationOutcome: null,
  reconciliationNote: null,
  carryForwardWeeks: 0,
};

describe('computeEffortShares', () => {
  it('weights priorities MUST=3, SHOULD=2, COULD=1', () => {
    expect(PRIORITY_WEIGHT).toEqual({ MUST: 3, SHOULD: 2, COULD: 1 });
  });

  it('groups by SO and returns shares in descending order', () => {
    const commits: CommitDto[] = [
      { ...baseCommit, id: 'c1', supportingOutcomeId: 'so-a', priority: 'MUST' },
      { ...baseCommit, id: 'c2', supportingOutcomeId: 'so-a', priority: 'SHOULD' },
      { ...baseCommit, id: 'c3', supportingOutcomeId: 'so-b', priority: 'COULD' },
    ];
    const shares = computeEffortShares(commits);
    expect(shares.map((s) => s.supportingOutcomeId)).toEqual(['so-a', 'so-b']);
    expect(shares[0]!.priorityPoints).toBe(5); // 3 + 2
    expect(shares[1]!.priorityPoints).toBe(1);
    // Sum equals 1.0.
    const total = shares.reduce((s, x) => s + x.share, 0);
    expect(Math.abs(total - 1)).toBeLessThan(1e-9);
  });

  it('treats null supportingOutcomeId as a single Unlinked bucket', () => {
    const commits: CommitDto[] = [
      { ...baseCommit, id: 'c1', supportingOutcomeId: null, priority: 'MUST' },
      { ...baseCommit, id: 'c2', supportingOutcomeId: null, priority: 'COULD' },
    ];
    const shares = computeEffortShares(commits);
    expect(shares).toHaveLength(1);
    expect(shares[0]!.supportingOutcomeId).toBeNull();
    expect(shares[0]!.count).toBe(2);
    expect(shares[0]!.priorityPoints).toBe(4);
  });

  it('returns an empty array when there are no commits', () => {
    expect(computeEffortShares([])).toEqual([]);
  });
});

describe('EffortShareBar', () => {
  it('renders one pill per segment with width proportional to share', () => {
    render(
      <EffortShareBar
        segments={[
          {
            supportingOutcomeId: 'so-a',
            label: 'A',
            count: 2,
            priorityPoints: 5,
            share: 0.625,
          },
          {
            supportingOutcomeId: 'so-b',
            label: 'B',
            count: 1,
            priorityPoints: 3,
            share: 0.375,
          },
        ]}
      />,
    );
    const pills = screen.getAllByTestId('effort-share-pill');
    expect(pills).toHaveLength(2);
    expect((pills[0] as HTMLElement).style.width).toBe('62.5%');
    expect((pills[1] as HTMLElement).style.width).toBe('37.5%');
  });

  it('shows raw counts in the pill tooltip', () => {
    render(
      <EffortShareBar
        segments={[
          {
            supportingOutcomeId: 'so-a',
            label: 'Alpha',
            count: 3,
            priorityPoints: 7,
            share: 1,
          },
        ]}
      />,
    );
    const pill = screen.getByTestId('effort-share-pill');
    expect(pill.getAttribute('title')).toContain('Alpha');
    expect(pill.getAttribute('title')).toContain('3 commits');
    expect(pill.getAttribute('title')).toContain('7 priority points');
  });

  it('renders an empty bar without pills when there are no segments', () => {
    render(<EffortShareBar segments={[]} />);
    expect(screen.getByTestId('effort-share-bar')).toBeInTheDocument();
    expect(screen.queryByTestId('effort-share-pill')).not.toBeInTheDocument();
  });

  it('floors width at 2% so tiny segments are still visible', () => {
    render(
      <EffortShareBar
        segments={[
          {
            supportingOutcomeId: 'so-a',
            label: 'A',
            count: 1,
            priorityPoints: 1,
            share: 0.001,
          },
        ]}
      />,
    );
    const pill = screen.getByTestId('effort-share-pill') as HTMLElement;
    expect(pill.style.width).toBe('2%');
  });
});
