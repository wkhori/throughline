import type { CommitDto, WeekDto } from '@throughline/shared-types';

interface ReconciledWeekProps {
  week: WeekDto;
}

// Phase-3 reconciled-week surface — renders the lineage timeline (each commit with its outcome,
// note, and carry-forward badge if the chain continues into next week).
export function ReconciledWeek({ week }: ReconciledWeekProps) {
  return (
    <section data-testid="reconciled-week" className="space-y-6 p-6">
      <header>
        <h1 className="text-lg font-semibold text-(--reconciled-heading)">
          Week of {week.weekStart} — reconciled
        </h1>
        <p className="text-xs text-(--reconciled-muted)">
          Reconciled at {week.reconciledAt ?? 'unknown'} · {week.commits.length} commits
        </p>
      </header>
      <div
        className="rounded-md border border-dashed border-(--reconciled-placeholder-border) p-3 text-xs text-(--reconciled-muted)"
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
      className="rounded-md border border-(--reconciled-row-border) bg-(--reconciled-row-bg) p-3"
    >
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium text-(--reconciled-row-text)">{commit.text}</p>
        <span
          data-testid={`reconciled-outcome-${commit.id}`}
          className="text-[11px] uppercase tracking-wide text-(--reconciled-row-outcome)"
        >
          {commit.reconciliationOutcome ?? '—'}
        </span>
      </div>
      {commit.reconciliationNote && (
        <p className="mt-1 text-xs text-(--reconciled-row-note)">{commit.reconciliationNote}</p>
      )}
      {commit.state === 'CARRIED_FORWARD' && (
        <p
          data-testid={`reconciled-cf-badge-${commit.id}`}
          className="mt-1 text-[11px] text-(--reconciled-row-cf)"
        >
          Carried forward · chain length {commit.carryForwardWeeks}
        </p>
      )}
    </li>
  );
}
