import { Sparkles } from 'lucide-react';

export type AIStatusIndicatorState = 'idle' | 'thinking' | 'suggested' | 'warning' | 'error';

export interface AIStatusIndicatorProps {
  state: AIStatusIndicatorState;
  label?: string;
  className?: string;
}

const STATE_CLASSES: Record<AIStatusIndicatorState, string> = {
  idle: 'text-(--color-shell-muted) opacity-40',
  thinking: 'text-(--color-ai-suggest) animate-pulse',
  suggested: 'text-(--color-ai-suggest)',
  warning: 'text-(--color-ai-warn)',
  error: 'text-red-600',
};

/**
 * Single AI activity glyph shared across every AI-touching surface.
 * Renders a Sparkles icon from lucide-react in one of five semantic states.
 */
export function AIStatusIndicator({ state, label, className }: AIStatusIndicatorProps) {
  const iconClass = STATE_CLASSES[state];

  return (
    <span
      data-testid="ai-status-indicator"
      data-state={state}
      className={`inline-flex items-center gap-1 ${className ?? ''}`}
    >
      <Sparkles size={14} aria-hidden="true" className={iconClass} />
      {label && <span className="text-xs leading-none">{label}</span>}
    </span>
  );
}
