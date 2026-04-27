import type { ReactNode } from 'react';

export type StateBadgeTone = 'neutral' | 'ok' | 'low' | 'medium' | 'high' | 'muted';

export interface StateBadgeProps {
  tone?: StateBadgeTone;
  children: ReactNode;
  className?: string;
}

/**
 * Single source of truth for state, severity, and lifecycle pills across the
 * app. Tone names map to semantic intent rather than colour so the visual
 * language stays consistent if the palette shifts.
 */
export function StateBadge({ tone = 'neutral', children, className }: StateBadgeProps) {
  return (
    <span data-tone={tone} className={className ? `tl-state-badge ${className}` : 'tl-state-badge'}>
      {children}
    </span>
  );
}
