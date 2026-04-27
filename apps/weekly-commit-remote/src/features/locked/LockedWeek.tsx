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
    <section data-testid="locked-week" className="mx-auto max-w-6xl space-y-8 p-6">
      <header className="flex flex-wrap items-end justify-between gap-4 rounded-lg border border-(--color-hero-border) bg-(--color-hero-bg) p-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-(--color-hero-muted)">
            Locked week
          </p>
          <h1 className="mt-1 text-xl font-semibold text-(--color-hero-heading)">
            Week of {week.weekStart}
          </h1>
          <p className="mt-1 text-sm text-(--color-hero-text)">
            Locked at {week.lockedAt ?? 'unknown'} · {week.commits.length} commits
          </p>
        </div>
        <span className="rounded-sm bg-(--color-badge-bg) px-2 py-1 text-xs font-medium uppercase tracking-wide text-(--color-badge-fg)">
          Read-only
        </span>
      </header>
      <div
        className="rounded-md border border-dashed border-(--color-panel-border) bg-(--color-panel-bg) p-4 text-xs text-(--color-panel-muted)"
        data-testid="locked-portfolio-placeholder"
      >
        Portfolio review will appear here when the AI copilot lands (Phase 5b).
      </div>
      <ChessMatrix commits={week.commits} rcdo={rcdo} weekState="LOCKED" />
    </section>
  );
}
