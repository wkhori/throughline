import { useMemo } from 'react';
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
  const interactive = weekState === 'DRAFT' && !!onEdit;
  const linkedOutcome = useMemo<DriftCheckLinkedOutcome | null>(
    () => buildLinkedOutcome(rcdo, commit.supportingOutcomeId),
    [rcdo, commit.supportingOutcomeId],
  );
  const alternatives = useMemo(
    () => buildAlternatives(rcdo, commit.supportingOutcomeId),
    [rcdo, commit.supportingOutcomeId],
  );
  const className = interactive
    ? 'cursor-pointer rounded-md border border-(--color-commit-border) bg-(--color-commit-bg) p-3 transition-colors hover:border-(--color-ribbon-link)'
    : 'rounded-md border border-(--color-commit-border) bg-(--color-commit-bg) p-3';
  return (
    <article
      data-testid="commit-card"
      data-commit-id={commit.id}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? () => onEdit?.(commit) : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onEdit?.(commit);
              }
            }
          : undefined
      }
      className={className}
    >
      <p className="text-sm font-medium text-(--color-commit-text)">{commit.text}</p>
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
