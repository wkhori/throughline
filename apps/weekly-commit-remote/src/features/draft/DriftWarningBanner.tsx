import { useEffect, useRef, useState } from 'react';
import type { DriftCheckLinkedOutcome, DriftCheckPayload } from '@throughline/shared-types';
import { useDriftCheckMutation } from '../../api/aiEndpoints.js';

interface DriftWarningBannerProps {
  commitId: string;
  commitText: string;
  linkedOutcome: DriftCheckLinkedOutcome | null;
  alternativeOutcomes: Array<{ supportingOutcomeId: string; title: string }>;
}

const DEBOUNCE_MS = 1500;
const MIN_LEN = 25;

/**
 * T2 — Drift Warning (Haiku, debounced 1.5s). Surfaces only when drift > 0.5; silent-degrades on
 * any error per spec. The banner appears under the commit row in the editor.
 */
export function DriftWarningBanner({
  commitId,
  commitText,
  linkedOutcome,
  alternativeOutcomes,
}: DriftWarningBannerProps) {
  const [check, { data, isError, isLoading }] = useDriftCheckMutation();
  const [dismissed, setDismissed] = useState(false);
  const lastKeyRef = useRef('');

  useEffect(() => {
    setDismissed(false);
  }, [commitText, linkedOutcome?.supportingOutcomeId]);

  useEffect(() => {
    if (!linkedOutcome) return;
    if (commitText.trim().length < MIN_LEN) return;
    const handle = window.setTimeout(() => {
      const key = `${commitId}|${linkedOutcome.supportingOutcomeId}|${commitText.trim()}`;
      if (key === lastKeyRef.current) return;
      lastKeyRef.current = key;
      void check({
        commitId,
        commitText: commitText.trim(),
        linkedOutcome,
        alternativeOutcomes,
      });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [commitId, commitText, linkedOutcome, alternativeOutcomes, check]);

  if (dismissed || isError || isLoading) return null;
  const payload = data?.payload as DriftCheckPayload | undefined;
  if (!payload || payload.driftScore <= 0.5) return null;

  return (
    <div
      role="alert"
      data-testid="drift-warning-banner"
      className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs"
    >
      <p className="font-medium text-amber-700 dark:text-amber-400">
        Drift detected (<span data-testid="drift-score">{payload.driftScore.toFixed(2)}</span>) —{' '}
        {payload.alignmentVerdict}
      </p>
      {payload.fixSuggestion ? (
        <p data-testid="drift-fix" className="mt-1 text-amber-700/80 dark:text-amber-400/80">
          {payload.fixSuggestion}
        </p>
      ) : null}
      <button
        type="button"
        data-testid="drift-dismiss"
        onClick={() => setDismissed(true)}
        className="mt-1 text-[11px] text-amber-700/80 hover:text-amber-700"
      >
        Dismiss
      </button>
    </div>
  );
}
