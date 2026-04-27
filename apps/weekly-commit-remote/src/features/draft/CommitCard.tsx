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
      {breadcrumb ? (
        <p className="mt-1 text-xs text-(--color-commit-muted)" data-testid="commit-breadcrumb">
          {breadcrumb}
        </p>
      ) : (
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
