import type { DriftCheckPayload } from '@throughline/shared-types';

export interface DriftInterpretation {
  drifted: boolean;
  score: number | null;
  fixSuggestion: string | null;
  alignmentVerdict: string | null;
}

/**
 * Single source of truth for "is this commit drifted?". CommitsList (top-panel
 * badge) and DriftWarningBanner (chess-matrix banner) both read from the same
 * persisted T2_DRIFT insight via useGetBatchInsightsQuery and run the result
 * through this helper, so the two surfaces can never disagree.
 *
 * Rule: alignmentVerdict is tangential or unrelated, OR driftScore >= 0.5.
 */
export function interpretDrift(
  payload: DriftCheckPayload | undefined | null,
): DriftInterpretation {
  if (!payload) {
    return { drifted: false, score: null, fixSuggestion: null, alignmentVerdict: null };
  }
  const verdict = payload.alignmentVerdict ?? null;
  const score = typeof payload.driftScore === 'number' ? payload.driftScore : null;
  const drifted =
    verdict === 'tangential' || verdict === 'unrelated' || (score !== null && score >= 0.5);
  return {
    drifted,
    score,
    fixSuggestion: payload.fixSuggestion ?? null,
    alignmentVerdict: verdict,
  };
}
