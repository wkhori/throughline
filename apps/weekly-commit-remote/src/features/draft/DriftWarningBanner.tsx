import { useEffect, useState } from 'react';
import type { DriftCheckPayload } from '@throughline/shared-types';
import { interpretDrift } from './driftRule.js';

interface DriftWarningBannerProps {
  /** Persisted T2_DRIFT payload from the batch insights cache. Undefined means no insight yet. */
  payload: DriftCheckPayload | undefined;
  /**
   * Stable identifier for the underlying insight (e.g. its `id` or `createdAt`).
   * When this changes, the banner un-dismisses itself so a freshly-persisted
   * insight is shown again.
   */
  insightKey?: string | null;
}

/**
 * T2 — Drift Warning. Renders inline beneath a commit card whenever the persisted
 * T2_DRIFT insight resolves to drifted=true under the shared interpretDrift rule.
 * The backend persists this insight on commit save and the POST /ai/drift-check
 * mutation invalidates the AIInsight tag, so the cached payload is always fresh —
 * no live re-inference happens here.
 */
export function DriftWarningBanner({ payload, insightKey }: DriftWarningBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [insightKey]);

  if (dismissed) return null;
  const { drifted, score, fixSuggestion, alignmentVerdict } = interpretDrift(payload);
  if (!drifted) return null;

  return (
    <div
      role="alert"
      data-testid="drift-warning-banner"
      className="mt-2 rounded-md border border-(--color-ribbon-medium-bg) bg-(--color-ribbon-medium-bg) p-3 text-xs"
    >
      <p className="font-medium text-(--color-ribbon-medium-fg)">
        Drift detected{' '}
        {score !== null ? (
          <>
            (<span data-testid="drift-score">{score.toFixed(2)}</span>)
          </>
        ) : null}{' '}
        {alignmentVerdict ? <>— {alignmentVerdict}</> : null}
      </p>
      {fixSuggestion ? (
        <p data-testid="drift-fix" className="mt-1 text-(--color-ribbon-medium-fg) opacity-80">
          {fixSuggestion}
        </p>
      ) : null}
      <button
        type="button"
        data-testid="drift-dismiss"
        onClick={() => setDismissed(true)}
        className="mt-1.5 text-[11px] font-medium text-(--color-ribbon-medium-fg) underline opacity-80 hover:opacity-100"
      >
        Dismiss
      </button>
    </div>
  );
}
