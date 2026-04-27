import { useMemo, useState } from 'react';
import type {
  CommitDto,
  DriftCheckLinkedOutcome,
  RcdoTreeDto,
} from '@throughline/shared-types';
import { RcdoChip, resolveRcdoTrail } from '@throughline/shared-ui';
import { DriftWarningBanner } from './DriftWarningBanner.js';

interface CommitCardProps {
  commit: CommitDto;
  rcdo?: RcdoTreeDto;
  weekState: 'DRAFT' | 'LOCKED' | 'RECONCILING' | 'RECONCILED';
  onEdit?: (commit: CommitDto) => void;
}

export function CommitCard({ commit, rcdo, weekState, onEdit }: CommitCardProps) {
  const trail = resolveRcdoTrail(rcdo, commit.supportingOutcomeId);
  const canRemove = weekState === 'DRAFT' && !!onEdit;
  const linkedOutcome = useMemo<DriftCheckLinkedOutcome | null>(
    () => buildLinkedOutcome(rcdo, commit.supportingOutcomeId),
    [rcdo, commit.supportingOutcomeId],
  );
  const alternatives = useMemo(
    () => buildAlternatives(rcdo, commit.supportingOutcomeId),
    [rcdo, commit.supportingOutcomeId],
  );
  const [confirming, setConfirming] = useState(false);
  const className =
    'rounded-md border border-(--color-commit-border) bg-(--color-commit-bg) p-3';
  return (
    <article
      data-testid="commit-card"
      data-commit-id={commit.id}
      className={className}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-(--color-commit-text)">{commit.text}</p>
        {canRemove ? (
          <button
            type="button"
            data-testid="commit-remove"
            aria-label="Remove commit"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setConfirming(true);
            }}
            className="-mr-1 -mt-1 shrink-0 rounded-md p-1 text-(--color-commit-muted) transition-colors hover:bg-(--color-skeleton-bg) hover:text-(--color-shell-error)"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M4 4l6 6M10 4l-6 6" />
            </svg>
          </button>
        ) : null}
      </div>
      {trail ? (
        <div className="mt-1.5" data-testid="commit-breadcrumb">
          <RcdoChip trail={trail} variant="trail" />
        </div>
      ) : commit.supportingOutcomeId ? null : (
        <p className="mt-1 text-xs italic text-(--color-shell-error)" data-testid="commit-no-so">
          No Supporting Outcome — required to lock
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span
          data-testid="commit-category"
          className="rounded-sm bg-(--color-badge-bg) px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-(--color-badge-fg)"
        >
          {commit.category}
        </span>
        <span
          data-testid="commit-priority"
          className="rounded-sm bg-(--color-badge-bg) px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-(--color-badge-fg)"
        >
          {commit.priority}
        </span>
      </div>
      {weekState === 'DRAFT' && linkedOutcome ? (
        <DriftWarningBanner
          commitId={commit.id}
          commitText={commit.text}
          linkedOutcome={linkedOutcome}
          alternativeOutcomes={alternatives}
        />
      ) : null}
      {confirming ? (
        <>
          <div
            data-testid="commit-remove-backdrop"
            aria-hidden="true"
            onClick={() => setConfirming(false)}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="commit-remove-title"
            data-testid="commit-remove-dialog"
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-(--color-panel-border) bg-(--color-panel-bg) p-5 shadow-2xl"
          >
            <h3
              id="commit-remove-title"
              className="text-sm font-semibold text-(--color-panel-heading)"
            >
              Remove this commit?
            </h3>
            <p className="mt-1.5 text-xs text-(--color-panel-muted)">
              "{commit.text.length > 80 ? `${commit.text.slice(0, 80)}…` : commit.text}"
              <br />
              This cannot be undone — the commit and any AI insights linked to it will be deleted.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                data-testid="commit-remove-cancel"
                onClick={() => setConfirming(false)}
                className="rounded-md border border-(--color-panel-border) bg-transparent px-3 py-1.5 text-xs font-medium text-(--color-panel-cell) transition-colors hover:bg-(--color-skeleton-bg)"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="commit-remove-confirm"
                onClick={() => {
                  setConfirming(false);
                  onEdit?.(commit);
                }}
                className="rounded-md bg-(--color-shell-error) px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
              >
                Remove commit
              </button>
            </div>
          </div>
        </>
      ) : null}
    </article>
  );
}

function buildLinkedOutcome(
  tree: RcdoTreeDto | undefined,
  supportingOutcomeId: string | null | undefined,
): DriftCheckLinkedOutcome | null {
  if (!tree || !supportingOutcomeId) return null;
  for (const rc of tree.rallyCries) {
    for (const defo of rc.definingObjectives) {
      for (const o of defo.outcomes) {
        for (const so of o.supportingOutcomes) {
          if (so.id === supportingOutcomeId) {
            return {
              supportingOutcomeId: so.id,
              title: so.title,
              parentOutcomeTitle: o.title,
              parentDOTitle: defo.title,
              metricStatement: null,
            };
          }
        }
      }
    }
  }
  return null;
}

function buildAlternatives(
  tree: RcdoTreeDto | undefined,
  exclude: string | null | undefined,
): Array<{ supportingOutcomeId: string; title: string }> {
  if (!tree) return [];
  const out: Array<{ supportingOutcomeId: string; title: string }> = [];
  for (const rc of tree.rallyCries) {
    for (const defo of rc.definingObjectives) {
      for (const o of defo.outcomes) {
        for (const so of o.supportingOutcomes) {
          if (so.id !== exclude) out.push({ supportingOutcomeId: so.id, title: so.title });
        }
      }
    }
  }
  return out.slice(0, 6);
}
