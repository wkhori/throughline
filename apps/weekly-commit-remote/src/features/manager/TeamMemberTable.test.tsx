import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TeamMemberTable } from './TeamMemberTable.js';
import type { TeamRollupRow } from '../../api/managerEndpoints.js';

afterEach(cleanup);

const buildRow = (id: string, name: string, done = 3, partial = 1, notDone = 1): TeamRollupRow => ({
  teamId: id,
  weekStart: '2026-04-20',
  computedAt: '2026-04-20T12:00:00Z',
  payload: {
    teamId: id,
    teamName: name,
    weekStart: '2026-04-20',
    memberCount: 5,
    lockedCount: 5,
    reconciledCount: done + partial + notDone,
    doneCount: done,
    partialCount: partial,
    notDoneCount: notDone,
    carryForwardCount: 1,
    commitsByOutcome: [],
    starvedOutcomes: [],
    driftExceptions: [],
    exceptionRibbon: [],
  },
});

describe('TeamMemberTable', () => {
  it('renders the empty state when rows is empty', () => {
    render(<TeamMemberTable rows={[]} />);
    expect(screen.getByTestId('team-member-table-empty')).toHaveTextContent(
      'No teammates in scope',
    );
  });

  it('renders one row per teammate with done / partial / not-done counts', () => {
    render(<TeamMemberTable rows={[buildRow('t1', 'Alpha'), buildRow('t2', 'Beta', 4, 2, 0)]} />);
    const rows = screen.getAllByTestId('team-member-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]!).toHaveTextContent('Alpha');
    expect(rows[1]!).toHaveTextContent('Beta');
  });

  it('clicking a row invokes onSelectTeam with the teamId', async () => {
    const onSelectTeam = vi.fn();
    render(<TeamMemberTable rows={[buildRow('t1', 'Alpha')]} onSelectTeam={onSelectTeam} />);
    await userEvent.click(screen.getAllByTestId('team-member-row')[0]!);
    expect(onSelectTeam).toHaveBeenCalledWith('t1');
  });
});
