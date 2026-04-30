import type { CommitDto, CommitPriority } from '@throughline/shared-types';

export const PRIORITY_WEIGHT: Record<CommitPriority, number> = {
  MUST: 3,
  SHOULD: 2,
  COULD: 1,
};

export interface EffortShareSegment {
  supportingOutcomeId: string | null;
  /** Display label — typically the SO leaf title. "Unlinked" for null SO. */
  label: string;
  count: number;
  /** Sum of priority weights for commits in this group. */
  priorityPoints: number;
  /** 0..1 share of total priority points across all groups. */
  share: number;
}

/**
 * Compute the priority-weighted effort share per Supporting Outcome group.
 * Returned segments are sorted in descending share so callers can render groups
 * (and the bar) in the same order without a second pass.
 *
 * Priority weights: MUST=3, SHOULD=2, COULD=1 — matches PRD §"Effort share math".
 */
export function computeEffortShares(commits: CommitDto[]): EffortShareSegment[] {
  if (!commits.length) return [];
  const buckets = new Map<
    string,
    { id: string | null; label: string; count: number; priorityPoints: number }
  >();
  for (const c of commits) {
    const key = c.supportingOutcomeId ?? '__unlinked__';
    const existing = buckets.get(key) ?? {
      id: c.supportingOutcomeId,
      label: '',
      count: 0,
      priorityPoints: 0,
    };
    existing.count += 1;
    existing.priorityPoints += PRIORITY_WEIGHT[c.priority];
    buckets.set(key, existing);
  }
  const total = Array.from(buckets.values()).reduce((s, b) => s + b.priorityPoints, 0) || 1;
  return Array.from(buckets.values())
    .map((b) => ({
      supportingOutcomeId: b.id,
      label: b.label,
      count: b.count,
      priorityPoints: b.priorityPoints,
      share: b.priorityPoints / total,
    }))
    .sort((a, b) => b.share - a.share);
}

export interface EffortShareBarProps {
  /** Pre-computed segments. Caller owns SO label resolution. */
  segments: EffortShareSegment[];
  className?: string;
}

/**
 * Horizontal stacked-pill bar — one pill per Supporting Outcome group, width
 * proportional to the group's priority-weighted share of the week. Hover shows
 * raw counts. The bar is purely presentational; sort order is the caller's
 * responsibility (use {@link computeEffortShares}).
 */
export function EffortShareBar({ segments, className }: EffortShareBarProps) {
  if (!segments.length) {
    return (
      <div
        data-testid="effort-share-bar"
        className={`flex h-2 w-full items-center rounded-full bg-(--color-skeleton-bg) ${className ?? ''}`}
      />
    );
  }
  return (
    <div
      data-testid="effort-share-bar"
      role="img"
      aria-label="Priority-weighted effort share by Supporting Outcome"
      className={`flex h-2 w-full overflow-hidden rounded-full bg-(--color-skeleton-bg) ${className ?? ''}`}
    >
      {segments.map((seg, idx) => {
        const widthPct = Math.max(seg.share * 100, 2);
        const tooltip = `${seg.label || 'Unlinked'} — ${seg.count} commit${
          seg.count === 1 ? '' : 's'
        }, ${seg.priorityPoints} priority points (${Math.round(seg.share * 100)}%)`;
        return (
          <span
            key={seg.supportingOutcomeId ?? `__unlinked__:${idx}`}
            data-testid="effort-share-pill"
            data-so-id={seg.supportingOutcomeId ?? ''}
            data-share={seg.share.toFixed(4)}
            title={tooltip}
            style={{ width: `${widthPct}%` }}
            className={`h-full ${PILL_TINTS[idx % PILL_TINTS.length]} transition-[width] duration-200`}
          />
        );
      })}
    </div>
  );
}

// Cycle through a small palette so adjacent pills are distinguishable; tokens
// already exist in shared-ui's design palette.
const PILL_TINTS = [
  'bg-(--color-ai-suggest)',
  'bg-(--color-badge-fg)',
  'bg-(--color-panel-heading)',
  'bg-(--color-ai-warn)',
  'bg-(--color-shell-muted)',
];
