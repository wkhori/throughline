import type { WeekDto } from '@throughline/shared-types';
import { useGetRcdoTreeQuery } from '../../api/rcdoEndpoints.js';
import { ChessMatrix } from '../draft/ChessMatrix.js';

interface LockedWeekProps {
  week: WeekDto;
}

// Phase-2 read-only locked-week surface. Renders the same ChessMatrix as DraftWeek but the cards
// are non-interactive. Portfolio review banner is a placeholder until Phase 5b wires T3.
export function LockedWeek({ week }: LockedWeekProps) {
  const { data: rcdo } = useGetRcdoTreeQuery();
  return (
    <section data-testid="locked-week" className="space-y-6 p-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-lg font-semibold text-(--locked-heading)">
            Week of {week.weekStart} — locked
          </h1>
          <p className="text-xs text-(--locked-muted)">
            Locked at {week.lockedAt ?? 'unknown'} · {week.commits.length} commits
          </p>
        </div>
      </header>
      <div
        className="rounded-md border border-dashed border-(--locked-placeholder-border) p-3 text-xs text-(--locked-muted)"
        data-testid="locked-portfolio-placeholder"
      >
        Portfolio review will appear here when the AI copilot lands (Phase 5b).
      </div>
      <ChessMatrix commits={week.commits} rcdo={rcdo} weekState="LOCKED" />
    </section>
  );
}
