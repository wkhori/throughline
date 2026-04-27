import type { CommitDto, RcdoTreeDto } from '@throughline/shared-types';
import { RcdoChip, resolveRcdoTrail } from '@throughline/shared-ui';

interface CommitCardProps {
  commit: CommitDto;
  rcdo?: RcdoTreeDto;
  weekState: 'DRAFT' | 'LOCKED' | 'RECONCILING' | 'RECONCILED';
  onEdit?: (commit: CommitDto) => void;
}

export function CommitCard({ commit, rcdo, weekState, onEdit }: CommitCardProps) {
  const trail = resolveRcdoTrail(rcdo, commit.supportingOutcomeId);
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
    </article>
  );
}
