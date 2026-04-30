import { Lock } from 'lucide-react';
import type { WeekDto } from '@throughline/shared-types';
import { useRtkSubscriptionKick } from '@throughline/shared-ui';
import { useGetRcdoTreeQuery } from '../../api/rcdoEndpoints.js';
import { ChessMatrix } from '../draft/ChessMatrix.js';
import { PortfolioReviewCard } from '../ai/PortfolioReviewCard.js';

interface LockedWeekProps {
  week: WeekDto;
}

export function LockedWeek({ week }: LockedWeekProps) {
  useRtkSubscriptionKick();
  const { data: rcdo } = useGetRcdoTreeQuery();
  return (
    <section data-testid="locked-week" className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-4 rounded-lg border border-(--color-hero-border) bg-(--color-hero-bg) p-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-(--color-hero-muted)">
            Locked
          </p>
          <h1 className="mt-1 text-xl font-semibold text-(--color-hero-heading)">
            Week of {week.weekStart}
          </h1>
          <p className="mt-1 text-sm text-(--color-hero-text)">
            Locked {formatTimestamp(week.lockedAt)} · {week.commits.length} commits · reconcile by
            Friday
          </p>
        </div>
        <span className="rounded-sm bg-(--color-badge-bg) px-2 py-1 text-xs font-medium uppercase tracking-wide text-(--color-badge-fg)">
          Read-only
        </span>
      </header>
      <div
        data-testid="locked-week-banner"
        role="status"
        className="flex items-center gap-3 rounded-md border border-(--color-ribbon-low-bg) bg-(--color-ribbon-low-bg) px-4 py-3 text-xs text-(--color-ribbon-low-fg)"
      >
        <Lock size={14} aria-hidden="true" className="shrink-0" />
        <span>
          This week is locked — no plan edits allowed. Start reconciliation on Friday to mark each
          commit done, partial, or not done.
        </span>
      </div>
      <PortfolioReviewCard weekId={week.id} />
      <ChessMatrix commits={week.commits} rcdo={rcdo} weekState="LOCKED" />
    </section>
  );
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.valueOf()) ? iso : d.toLocaleString();
}
