import type { CommitDto, RcdoTreeDto } from '@throughline/shared-types';

interface CommitCardProps {
  commit: CommitDto;
  rcdo?: RcdoTreeDto;
  weekState: 'DRAFT' | 'LOCKED' | 'RECONCILING' | 'RECONCILED';
  onEdit?: (commit: CommitDto) => void;
}

// Phase-2 commit row. Drift indicator (T2) and quality-lint hint (T7) are intentionally hidden
// in Phase 2 — they wire in Phase 5a.
export function CommitCard({ commit, rcdo, weekState, onEdit }: CommitCardProps) {
  const breadcrumb = findSoBreadcrumb(rcdo, commit.supportingOutcomeId);
  const interactive = weekState === 'DRAFT' && !!onEdit;
  const className = interactive
    ? 'cursor-pointer rounded-md border border-(--commit-border) bg-(--commit-bg) p-3 hover:border-(--commit-border-hover)'
    : 'rounded-md border border-(--commit-border) bg-(--commit-bg) p-3';
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
      <p className="text-sm font-medium text-(--commit-text)">{commit.text}</p>
      {breadcrumb ? (
        <p className="mt-1 text-xs text-(--commit-muted)" data-testid="commit-breadcrumb">
          {breadcrumb}
        </p>
      ) : (
        <p className="mt-1 text-xs italic text-(--commit-warn)" data-testid="commit-no-so">
          No Supporting Outcome — required to lock
        </p>
      )}
      <div className="mt-2 flex gap-2 text-[11px] uppercase tracking-wide text-(--commit-muted)">
        <span data-testid="commit-category">{commit.category}</span>
        <span data-testid="commit-priority">{commit.priority}</span>
      </div>
    </article>
  );
}

function findSoBreadcrumb(tree: RcdoTreeDto | undefined, soId: string | null): string | null {
  if (!tree || !soId) return null;
  for (const rc of tree.rallyCries) {
    for (const defo of rc.definingObjectives) {
      for (const o of defo.outcomes) {
        for (const so of o.supportingOutcomes) {
          if (so.id === soId) {
            return `${rc.title} › ${defo.title} › ${o.title} › ${so.title}`;
          }
        }
      }
    }
  }
  return null;
}
