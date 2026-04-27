import { useEffect, useMemo, useRef, useState } from 'react';
import type { OutcomeCandidateDto, SuggestOutcomePayload } from '@throughline/shared-types';
import { useSuggestOutcomeMutation } from '../../api/aiEndpoints.js';

interface AiSuggestionPanelProps {
  draftCommitText: string;
  candidates: OutcomeCandidateDto[];
  /** When the user manually picks an SO within the last 30s, T1 stays silent (per spec). */
  manuallySelectedAt?: number | null;
  /** Notified when the user accepts the AI's pick. */
  onAccept?: (supportingOutcomeId: string) => void;
}

const DEBOUNCE_MS = 800;
const MIN_LEN = 15;
const MAX_LEN = 500;
const MANUAL_SUPPRESS_MS = 30_000;

/**
 * T1 — Outcome Suggestion (Haiku, debounced 800ms). Silent-degrades on 429 / network errors per
 * docs/ai-copilot-spec.md. No suggestion is shown until the user has typed ≥15 chars and stopped.
 */
export function AiSuggestionPanel({
  draftCommitText,
  candidates,
  manuallySelectedAt,
  onAccept,
}: AiSuggestionPanelProps) {
  const [suggest, { data, isLoading, isError }] = useSuggestOutcomeMutation();
  const [dismissed, setDismissed] = useState(false);
  const lastFiredRef = useRef<string>('');

  const eligible = useMemo(() => {
    const len = draftCommitText.trim().length;
    if (len < MIN_LEN || len > MAX_LEN) return false;
    if (candidates.length === 0) return false;
    if (manuallySelectedAt && Date.now() - manuallySelectedAt < MANUAL_SUPPRESS_MS) return false;
    return true;
  }, [draftCommitText, candidates, manuallySelectedAt]);

  useEffect(() => {
    setDismissed(false);
  }, [draftCommitText]);

  useEffect(() => {
    if (!eligible) return;
    const handle = window.setTimeout(() => {
      const key = draftCommitText.trim();
      if (key === lastFiredRef.current) return;
      lastFiredRef.current = key;
      void suggest({ draftCommitText: key, candidates });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [eligible, draftCommitText, candidates, suggest]);

  if (dismissed || isError) return null;
  if (isLoading) {
    return (
      <p
        data-testid="ai-suggestion-loading"
        className="mt-2 text-xs italic text-(--color-commit-muted)"
      >
        Looking for a likely outcome…
      </p>
    );
  }
  const payload = data?.payload as SuggestOutcomePayload | undefined;
  if (!payload || !payload.supportingOutcomeId || payload.confidence < 0.6) return null;
  const candidate = candidates.find((c) => c.supportingOutcomeId === payload.supportingOutcomeId);
  if (!candidate) return null;
  return (
    <aside
      role="status"
      data-testid="ai-suggestion-panel"
      className="mt-2 rounded-md border border-(--color-commit-border) bg-(--color-commit-bg) p-3 text-xs"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-(--color-commit-text)">
            Likely outcome: <span data-testid="ai-suggestion-title">{candidate.title}</span>
          </p>
          <p className="mt-0.5 text-(--color-commit-muted)">{payload.rationale}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            data-testid="ai-suggestion-accept"
            onClick={() => onAccept?.(candidate.supportingOutcomeId)}
            className="rounded-md border border-(--color-commit-border) bg-(--color-shell-bg) px-2 py-0.5 text-xs font-medium text-(--color-commit-text) hover:border-(--color-ribbon-link)"
          >
            Use this
          </button>
          <button
            type="button"
            data-testid="ai-suggestion-dismiss"
            onClick={() => setDismissed(true)}
            className="text-(--color-commit-muted) hover:text-(--color-commit-text)"
            aria-label="Dismiss suggestion"
          >
            ×
          </button>
        </div>
      </div>
    </aside>
  );
}
