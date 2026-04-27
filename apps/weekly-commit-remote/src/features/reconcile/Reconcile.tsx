import { useState } from 'react';
import type { CommitDto, ReconciliationOutcome, WeekDto } from '@throughline/shared-types';
import {
  useReconcileWeekMutation,
  useStartReconcileMutation,
  type ReconcileItemBody,
} from '../../api/weeksEndpoints.js';

interface ReconcileProps {
  week: WeekDto;
}

interface RowState {
  outcome: ReconciliationOutcome | '';
  note: string;
  carryForward: boolean;
}

const OUTCOMES: ReconciliationOutcome[] = ['DONE', 'PARTIAL', 'NOT_DONE'];

// Phase-3 reconcile surface. Renders one row per commit with the three-state outcome picker, a
// 1000-char note field, and a carry-forward checkbox (disabled when outcome=DONE per the
// backend guard).
export function Reconcile({ week }: ReconcileProps) {
  const [startReconcile, startState] = useStartReconcileMutation();
  const [submit, submitState] = useReconcileWeekMutation();
  const [serverError, setServerError] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(
      week.commits.map((c) => [c.id, { outcome: '', note: '', carryForward: false }] as const),
    ),
  );

  const isReconciling = week.state === 'RECONCILING';

  const start = async () => {
    setServerError(null);
    try {
      await startReconcile(week.id).unwrap();
    } catch (err) {
      const status = (err as { status?: number }).status;
      setServerError(
        status === 409 ? 'Reconcile window not yet open.' : 'Could not start reconcile.',
      );
    }
  };

  const blank: RowState = { outcome: '', note: '', carryForward: false };
  const rowFor = (id: string): RowState => rows[id] ?? blank;
  const update = (id: string, patch: Partial<RowState>) =>
    setRows((prev) => ({ ...prev, [id]: { ...rowFor(id), ...patch } }));

  const allFilled = week.commits.every((c) => rowFor(c.id).outcome !== '');

  const send = async () => {
    if (!allFilled) {
      setServerError('Pick an outcome for every commit before submitting.');
      return;
    }
    setServerError(null);
    const items: ReconcileItemBody[] = week.commits.map((c) => {
      const r = rowFor(c.id);
      return {
        commitId: c.id,
        outcome: r.outcome as ReconciliationOutcome,
        note: r.note,
        carryForward: r.carryForward,
      };
    });
    try {
      await submit({ id: week.id, body: { items } }).unwrap();
    } catch (err) {
      const status = (err as { status?: number }).status;
      setServerError(
        status === 400
          ? 'Validation failed — check notes (≤1000 chars) and carry-forward only on PARTIAL/NOT_DONE.'
          : status === 409
            ? 'Cannot carry forward — next week is at the 7-commit cap.'
            : 'Reconcile submission failed.',
      );
    }
  };

  return (
    <section data-testid="reconcile" className="mx-auto max-w-6xl space-y-8 p-6">
      <header className="flex flex-wrap items-end justify-between gap-4 rounded-lg border border-(--color-hero-border) bg-(--color-hero-bg) p-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-(--color-hero-muted)">
            Reconcile
          </p>
          <h1 className="mt-1 text-xl font-semibold text-(--color-hero-heading)">
            Week of {week.weekStart}
          </h1>
          <p className="mt-1 text-sm text-(--color-hero-text)">
            {week.commits.length} commits to mark done, partial, or not done.
          </p>
        </div>
        {!isReconciling && (
          <button
            type="button"
            onClick={start}
            disabled={startState.isLoading}
            data-testid="start-reconcile"
            className="rounded-md bg-(--color-shell-text) px-4 py-2 text-sm font-medium text-(--color-shell-bg) hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {startState.isLoading ? 'Starting…' : 'Start reconcile'}
          </button>
        )}
      </header>

      {isReconciling && (
        <ul className="space-y-3" data-testid="reconcile-rows">
          {week.commits.map((commit) => (
            <ReconcileRow
              key={commit.id}
              commit={commit}
              row={rowFor(commit.id)}
              onChange={(patch) => update(commit.id, patch)}
            />
          ))}
        </ul>
      )}

      {serverError && (
        <p
          role="alert"
          data-testid="reconcile-error"
          className="rounded-md border border-(--color-ribbon-high-bg) bg-(--color-ribbon-high-bg) px-3 py-2 text-xs text-(--color-ribbon-high-fg)"
        >
          {serverError}
        </p>
      )}

      {isReconciling && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={send}
            disabled={!allFilled || submitState.isLoading}
            data-testid="submit-reconcile"
            className="rounded-md bg-(--color-shell-text) px-4 py-2 text-sm font-medium text-(--color-shell-bg) hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitState.isLoading ? 'Submitting…' : 'Submit reconcile'}
          </button>
        </div>
      )}
    </section>
  );
}

interface RowProps {
  commit: CommitDto;
  row: RowState;
  onChange: (patch: Partial<RowState>) => void;
}

function ReconcileRow({ commit, row, onChange }: RowProps) {
  const cfDisabled = row.outcome === '' || row.outcome === 'DONE';
  return (
    <li
      data-testid={`reconcile-row-${commit.id}`}
      className="rounded-lg border border-(--color-panel-border) bg-(--color-panel-bg) p-4"
    >
      <p className="text-sm font-medium text-(--color-panel-heading)">{commit.text}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {OUTCOMES.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() =>
              onChange({ outcome: o, carryForward: o === 'DONE' ? false : row.carryForward })
            }
            data-testid={`reconcile-outcome-${commit.id}-${o}`}
            className={
              'rounded-md px-3 py-1.5 text-xs font-medium ' +
              (row.outcome === o
                ? 'bg-(--color-shell-text) text-(--color-shell-bg)'
                : 'border border-(--color-panel-border) bg-transparent text-(--color-panel-cell) hover:bg-(--color-skeleton-bg)')
            }
          >
            {o}
          </button>
        ))}
      </div>
      <textarea
        rows={2}
        maxLength={1000}
        placeholder="Note (≤ 1000 chars)"
        value={row.note}
        onChange={(e) => onChange({ note: e.target.value })}
        data-testid={`reconcile-note-${commit.id}`}
        className="mt-3 w-full rounded-md border border-(--color-panel-border) bg-(--color-shell-bg) px-3 py-2 text-xs text-(--color-shell-text) placeholder:text-(--color-shell-muted)"
      />
      <label className="mt-3 flex items-center gap-2 text-xs text-(--color-panel-cell)">
        <input
          type="checkbox"
          disabled={cfDisabled}
          checked={row.carryForward}
          onChange={(e) => onChange({ carryForward: e.target.checked })}
          data-testid={`reconcile-cf-${commit.id}`}
        />
        Carry forward to next week
      </label>
    </li>
  );
}
