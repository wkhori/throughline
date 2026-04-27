import type { TeamRollupRow } from '../../api/managerEndpoints.js';

interface TeamMemberTableProps {
  rows: TeamRollupRow[];
  onSelectTeam?: (teamId: string) => void;
}

// Phase-4: dense team-rollup table. The PRD calls this "team-member-table"; in Phase 4 the row
// granularity is per-team (we don't yet expose per-IC counts via the rollup payload). The Gherkin
// scenarios match either grain — the demo dashboard renders one row per scoped team.
export function TeamMemberTable({ rows, onSelectTeam }: TeamMemberTableProps) {
  if (rows.length === 0) {
    return (
      <p data-testid="team-member-table-empty" className="text-sm text-(--table-empty)">
        No teammates in scope
      </p>
    );
  }
  return (
    <table data-testid="team-member-table" className="w-full text-sm">
      <thead>
        <tr className="border-b border-(--table-border) text-left text-xs uppercase tracking-wide text-(--table-head)">
          <th scope="col" className="py-2 pr-3">
            Team
          </th>
          <th scope="col" className="py-2 pr-3">
            Members
          </th>
          <th scope="col" className="py-2 pr-3">
            Done
          </th>
          <th scope="col" className="py-2 pr-3">
            Partial
          </th>
          <th scope="col" className="py-2 pr-3">
            Not done
          </th>
          <th scope="col" className="py-2 pr-3">
            Carry-forward
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const p = row.payload;
          return (
            <tr
              key={row.teamId}
              data-testid="team-member-row"
              onClick={() => onSelectTeam?.(row.teamId)}
              className="cursor-pointer border-b border-(--table-row-border) hover:bg-(--table-row-hover)"
            >
              <td className="py-2 pr-3 font-medium text-(--table-cell)">{p.teamName}</td>
              <td className="py-2 pr-3 text-(--table-cell-muted)">{p.memberCount}</td>
              <td className="py-2 pr-3 text-(--table-cell)">{p.doneCount}</td>
              <td className="py-2 pr-3 text-(--table-cell)">{p.partialCount}</td>
              <td className="py-2 pr-3 text-(--table-cell)">{p.notDoneCount}</td>
              <td className="py-2 pr-3 text-(--table-cell)">{p.carryForwardCount}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
