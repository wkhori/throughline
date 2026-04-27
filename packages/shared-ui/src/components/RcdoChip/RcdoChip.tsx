import type { RcdoTreeDto } from '@throughline/shared-types';

export interface RcdoTrail {
  rallyCryTitle: string;
  definingObjectiveTitle: string;
  outcomeTitle: string;
  supportingOutcomeTitle: string;
}

/**
 * Resolves a `supportingOutcomeId` against the loaded RCDO tree and returns the
 * full Rally Cry → Defining Objective → Outcome → Supporting Outcome trail.
 * Returns `null` when the id isn't found in the tree (e.g., archived).
 */
export function resolveRcdoTrail(
  tree: RcdoTreeDto | null | undefined,
  supportingOutcomeId: string | null | undefined,
): RcdoTrail | null {
  if (!tree || !supportingOutcomeId) return null;
  for (const rc of tree.rallyCries) {
    for (const dobj of rc.definingObjectives) {
      for (const o of dobj.outcomes) {
        for (const so of o.supportingOutcomes) {
          if (so.id === supportingOutcomeId) {
            return {
              rallyCryTitle: rc.title,
              definingObjectiveTitle: dobj.title,
              outcomeTitle: o.title,
              supportingOutcomeTitle: so.title,
            };
          }
        }
      }
    }
  }
  return null;
}

export interface RcdoChipProps {
  /** Pre-resolved trail. Use {@link resolveRcdoTrail} to build it from the tree. */
  trail: RcdoTrail | null;
  /** Render only the SO leaf (default: full trail tooltip on hover). */
  variant?: 'leaf' | 'trail';
  className?: string;
}

/**
 * Single canonical chip exposing the full RCDO lineage of a commit. The
 * landing page and architecture page claim every commit is FK-linked into the
 * graph; this chip is what makes that claim visible inside the product itself.
 */
export function RcdoChip({ trail, variant = 'leaf', className }: RcdoChipProps) {
  if (!trail) {
    return (
      <span
        className={`inline-flex items-center rounded-sm bg-(--color-skeleton-bg) px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-(--color-shell-muted) ${className ?? ''}`}
      >
        Unlinked
      </span>
    );
  }
  if (variant === 'trail') {
    return (
      <span
        className={`inline-flex flex-wrap items-center gap-1 text-[11px] text-(--color-panel-muted) ${className ?? ''}`}
      >
        <Crumb>{trail.rallyCryTitle}</Crumb>
        <Sep />
        <Crumb>{trail.definingObjectiveTitle}</Crumb>
        <Sep />
        <Crumb>{trail.outcomeTitle}</Crumb>
        <Sep />
        <Crumb emphasis>{trail.supportingOutcomeTitle}</Crumb>
      </span>
    );
  }
  const tooltip = `${trail.rallyCryTitle} → ${trail.definingObjectiveTitle} → ${trail.outcomeTitle} → ${trail.supportingOutcomeTitle}`;
  return (
    <span
      title={tooltip}
      className={`inline-flex items-center rounded-sm bg-(--color-badge-bg) px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-(--color-badge-fg) ${className ?? ''}`}
    >
      {trail.supportingOutcomeTitle}
    </span>
  );
}

function Crumb({ children, emphasis }: { children: React.ReactNode; emphasis?: boolean }) {
  return (
    <span className={emphasis ? 'font-medium text-(--color-panel-heading)' : undefined}>
      {children}
    </span>
  );
}

function Sep() {
  return <span className="text-(--color-panel-border)">›</span>;
}
