import type { CommitDto, WeekDto } from '@throughline/shared-types';

interface ReconciledWeekProps {
  week: WeekDto;
}

// Phase-3 reconciled-week surface — renders the lineage timeline (each commit with its outcome,
// note, and carry-forward badge if the chain continues into next week).
export function ReconciledWeek({ week }: ReconciledWeekProps) {
  return (
    <section data-testid="reconciled-week" className="mx-auto max-w-6xl space-y-8 p-6">
      <header className="rounded-lg border border-(--color-hero-border) bg-(--color-hero-bg) p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-(--color-hero-muted)">
          Reconciled
        </p>
        <h1 className="mt-1 text-xl font-semibold text-(--color-hero-heading)">
          Week of {week.weekStart}
        </h1>
        <p className="mt-1 text-sm text-(--color-hero-text)">
          Reconciled at {week.reconciledAt ?? 'unknown'} · {week.commits.length} commits
        </p>
      </header>
      <div
        className="rounded-md border border-dashed border-(--color-panel-border) bg-(--color-panel-bg) p-4 text-xs text-(--color-panel-muted)"
        data-testid="reconciled-alignment-placeholder"
      >
        Alignment delta will appear here when the AI copilot lands (Phase 5b).
      </div>
      <ul className="space-y-3" data-testid="reconciled-rows">
        {week.commits.map((c) => (
          <ReconciledRow key={c.id} commit={c} />
        ))}
      </ul>
    </section>
  );
}

function ReconciledRow({ commit }: { commit: CommitDto }) {
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
