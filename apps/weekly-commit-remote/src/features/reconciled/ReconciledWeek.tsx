import type { CommitDto, RcdoTreeDto, WeekDto } from '@throughline/shared-types';
import { RcdoChip, resolveRcdoTrail } from '@throughline/shared-ui';
import { useGetRcdoTreeQuery } from '../../api/rcdoEndpoints.js';
import { AlignmentDeltaCard } from '../ai/AlignmentDeltaCard.js';

interface ReconciledWeekProps {
  week: WeekDto;
}

export function ReconciledWeek({ week }: ReconciledWeekProps) {
  const { data: rcdo } = useGetRcdoTreeQuery();
  return (
    <section data-testid="reconciled-week" className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="rounded-lg border border-(--color-hero-border) bg-(--color-hero-bg) p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-(--color-hero-muted)">
          Reconciled
        </p>
        <h1 className="mt-1 text-xl font-semibold text-(--color-hero-heading)">
          Week of {week.weekStart}
        </h1>
        <p className="mt-1 text-sm text-(--color-hero-text)">
          Reconciled {formatTimestamp(week.reconciledAt)} · {week.commits.length} commits
        </p>
      </header>
      <AlignmentDeltaCard weekId={week.id} />
      <ul className="space-y-3" data-testid="reconciled-rows">
        {week.commits.map((c) => (
          <ReconciledRow key={c.id} commit={c} rcdo={rcdo} />
        ))}
      </ul>
    </section>
  );
}

function ReconciledRow({ commit, rcdo }: { commit: CommitDto; rcdo?: RcdoTreeDto }) {
  const trail = resolveRcdoTrail(rcdo, commit.supportingOutcomeId);
  return (
    <li
      data-testid={`reconciled-row-${commit.id}`}
      className="rounded-lg border border-(--color-panel-border) bg-(--color-panel-bg) p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-(--color-panel-heading)">{commit.text}</p>
        <span
          data-testid={`reconciled-outcome-${commit.id}`}
          className="rounded-sm bg-(--color-badge-bg) px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-(--color-badge-fg)"
        >
          {commit.reconciliationOutcome ?? '—'}
        </span>
      </div>
      {trail ? (
        <div className="mt-1.5" data-testid={`reconciled-trail-${commit.id}`}>
          <RcdoChip trail={trail} variant="trail" />
        </div>
      ) : null}
      {commit.reconciliationNote && (
        <p className="mt-2 text-xs text-(--color-panel-muted)">{commit.reconciliationNote}</p>
      )}
      {commit.state === 'CARRIED_FORWARD' && (
        <p
          data-testid={`reconciled-cf-badge-${commit.id}`}
          className="mt-2 inline-block rounded-sm bg-(--color-ribbon-low-bg) px-1.5 py-0.5 text-[11px] font-medium text-(--color-ribbon-low-fg)"
        >
          Carried forward · chain length {commit.carryForwardWeeks}
        </p>
      )}
    </li>
  );
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.valueOf()) ? iso : d.toLocaleString();
}
