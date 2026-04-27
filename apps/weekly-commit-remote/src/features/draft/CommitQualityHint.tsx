import { useEffect, useRef, useState } from 'react';
import type { CommitCategory, CommitPriority, QualityLintPayload } from '@throughline/shared-types';
import { useQualityLintMutation } from '../../api/aiEndpoints.js';

interface CommitQualityHintProps {
  commitId: string;
  commitText: string;
  category: CommitCategory;
  priority: CommitPriority;
  supportingOutcomeTitle: string | null;
}

const DEBOUNCE_MS = 1000;
const MIN_LEN = 5;

/**
 * T7 — Commit Quality Lint (Haiku, debounced 1s). Inline subtle hint; non-blocking and
 * dismissible. Healthy commits show no hint.
 */
export function CommitQualityHint({
  commitId,
  commitText,
  category,
  priority,
  supportingOutcomeTitle,
}: CommitQualityHintProps) {
  const [lint, { data, isError, isLoading }] = useQualityLintMutation();
  const [dismissed, setDismissed] = useState(false);
  const lastKeyRef = useRef('');

  useEffect(() => {
    setDismissed(false);
  }, [commitText, supportingOutcomeTitle]);

  useEffect(() => {
    if (!supportingOutcomeTitle) return;
    if (commitText.trim().length < MIN_LEN) return;
    const handle = window.setTimeout(() => {
      const key = `${commitId}|${commitText.trim()}|${category}|${priority}`;
      if (key === lastKeyRef.current) return;
      lastKeyRef.current = key;
      void lint({
        commitId,
        commitText: commitText.trim(),
        category,
        priority,
        supportingOutcomeTitle,
      });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [commitId, commitText, category, priority, supportingOutcomeTitle, lint]);

  if (dismissed || isError || isLoading) return null;
  const payload = data?.payload as QualityLintPayload | undefined;
  const firstIssue = payload?.issues[0];
  if (!payload || !firstIssue) return null;

  return (
    <p
      role="note"
      data-testid="quality-hint"
      className="mt-1 flex items-start gap-2 text-xs text-(--commit-muted)"
    >
      <span aria-hidden>•</span>
      <span className="flex-1">
        <span data-testid="quality-hint-message">{firstIssue.message}</span>{' '}
        <button
          type="button"
          data-testid="quality-hint-dismiss"
          onClick={() => setDismissed(true)}
          className="underline hover:text-(--commit-text)"
        >
          dismiss
        </button>
      </span>
    </p>
  );
}
