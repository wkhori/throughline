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
      <p
        data-testid="team-member-table-empty"
        className="rounded-md border border-dashed border-(--color-panel-border) bg-(--color-panel-bg) p-4 text-sm text-(--color-panel-muted)"
      >
        No teammates in scope
      </p>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-(--color-panel-border) bg-(--color-panel-bg)">
      <table data-testid="team-member-table" className="w-full text-sm">
        <thead>
          <tr className="border-b border-(--color-panel-border) text-left text-[11px] font-semibold uppercase tracking-wide text-(--color-panel-muted)">
            <th scope="col" className="px-4 py-3">
              Team
            </th>
            <th scope="col" className="px-4 py-3">
              Members
            </th>
            <th scope="col" className="px-4 py-3">
              Done
            </th>
            <th scope="col" className="px-4 py-3">
              Partial
            </th>
            <th scope="col" className="px-4 py-3">
              Not done
            </th>
            <th scope="col" className="px-4 py-3">
              Carry-forward
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const p = row.payload;
            const interactive = Boolean(onSelectTeam);
            return (
              <tr
                key={row.teamId}
                data-testid="team-member-row"
                role={interactive ? 'button' : undefined}
                tabIndex={interactive ? 0 : undefined}
                onClick={interactive ? () => onSelectTeam!(row.teamId) : undefined}
                onKeyDown={
                  interactive
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelectTeam!(row.teamId);
                        }
                      }
                    : undefined
                }
                className={
                  'border-b border-(--color-panel-border) transition-colors last:border-0 ' +
                  (interactive
                    ? 'cursor-pointer hover:bg-(--color-skeleton-bg)'
                    : '')
                }
              >
                <td className="px-4 py-3 font-medium text-(--color-panel-heading)">{p.teamName}</td>
                <td className="px-4 py-3 text-(--color-panel-muted)">{p.memberCount}</td>
                <td className="px-4 py-3 text-(--color-panel-cell)">{p.doneCount}</td>
                <td className="px-4 py-3 text-(--color-panel-cell)">{p.partialCount}</td>
                <td className="px-4 py-3 text-(--color-panel-cell)">{p.notDoneCount}</td>
                <td className="px-4 py-3 text-(--color-panel-cell)">{p.carryForwardCount}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
