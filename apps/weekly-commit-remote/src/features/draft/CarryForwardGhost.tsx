import type { CommitDto, RcdoTreeDto, WeekDto } from '@throughline/shared-types';
import { RcdoChip, resolveRcdoTrail } from '@throughline/shared-ui';

export interface CarryForwardGhostProps {
  /** The week we're rendering — we look for a CARRIED_FORWARD commit inside it. */
  week: WeekDto;
  rcdo?: RcdoTreeDto;
  /** Click handler that should navigate to the parent commit's lineage view. */
  onOpenLineage?: (commit: CommitDto) => void;
}

/**
 * Phase-5 ghost row pinned above the draft week's commit list. Surfaces the
 * carry-forward chain seeded by Phase 3: a CARRIED_FORWARD commit whose
 * `parentCommitId` is the prior week's row. The "N weeks running" badge uses
 * `carryForwardWeeks` from the API (canonical lineage length); when that field
 * is unavailable we degrade to "carry-forwarded from last week".
 *
 * Visually muted so it doesn't compete with the live week's commits.
 */
export function CarryForwardGhost({ week, rcdo, onOpenLineage }: CarryForwardGhostProps) {
  // Ghost rows are CARRIED_FORWARD commits in this week's commit list — the
  // server preserves them on the original week + spawns a fresh ACTIVE in N+1.
  // Here we render the original (the one with state CARRIED_FORWARD).
  const ghost = week.commits.find((c) => c.state === 'CARRIED_FORWARD');
  if (!ghost) return null;

  const trail = resolveRcdoTrail(rcdo, ghost.supportingOutcomeId);
  const weeksRunning = Math.max(ghost.carryForwardWeeks, 1);
  const badge =
    weeksRunning > 1 ? `carry-forwarded ${weeksRunning} weeks` : 'carry-forwarded from last week';

  return (
    <button
      type="button"
      data-testid="carry-forward-ghost"
      data-commit-id={ghost.id}
      data-parent-commit-id={ghost.parentCommitId ?? ''}
      data-weeks-running={weeksRunning}
      onClick={onOpenLineage ? () => onOpenLineage(ghost) : undefined}
      aria-label={`Open lineage for carry-forwarded commit "${ghost.text}"`}
      className="flex w-full flex-wrap items-start justify-between gap-2 rounded-md border border-dashed border-(--color-panel-border) bg-(--color-skeleton-bg) px-3 py-2 text-left opacity-70 transition-opacity hover:opacity-100"
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-(--color-shell-muted)">
          Carry-forward
        </p>
        <p className="mt-0.5 truncate text-sm italic text-(--color-commit-text)">{ghost.text}</p>
        {trail ? (
          <div className="mt-1">
            <RcdoChip trail={trail} variant="trail" />
          </div>
        ) : null}
      </div>
      <span
        data-testid="carry-forward-badge"
        className="shrink-0 rounded-sm bg-(--color-ribbon-medium-bg) px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-(--color-ribbon-medium-fg)"
      >
        {badge}
      </span>
    </button>
  );
}
