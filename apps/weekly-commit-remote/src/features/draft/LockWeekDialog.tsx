import { useEffect } from 'react';
import type { CommitDto } from '@throughline/shared-types';

interface LockWeekDialogProps {
  open: boolean;
  commits: CommitDto[];
  submitting?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

// Phase-2 confirm-and-lock modal. Lists commits missing an SO as blockers; disables the lock
// button until they're resolved. The "portfolio review preview" pane is a placeholder in Phase 2;
// Phase 5b wires the real T3 output.
export function LockWeekDialog({
  open,
  commits,
  submitting,
  onConfirm,
  onClose,
}: LockWeekDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: { key: string }) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const blockers = commits.filter((c) => !c.supportingOutcomeId);
  const canLock = blockers.length === 0 && commits.length > 0 && !submitting;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lock-dialog-title"
      data-testid="lock-week-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-lg border border-(--color-panel-border) bg-(--color-panel-bg) p-6 shadow-xl">
        <h2 id="lock-dialog-title" className="text-base font-semibold text-(--color-panel-heading)">
          Lock this week
        </h2>
        <p className="mt-1.5 text-sm text-(--color-panel-muted)" data-testid="lock-dialog-count">
          You&apos;re about to lock {commits.length} commit{commits.length === 1 ? '' : 's'}.
        </p>
        {blockers.length > 0 && (
          <div className="mt-4 rounded-md border border-(--color-ribbon-medium-bg) bg-(--color-ribbon-medium-bg) p-3 text-xs text-(--color-ribbon-medium-fg)">
            <p className="font-medium">Blockers — link a Supporting Outcome to each:</p>
            <ul className="mt-2 list-disc pl-4" data-testid="lock-dialog-blockers">
              {blockers.map((b) => (
                <li key={b.id}>{b.text}</li>
              ))}
            </ul>
          </div>
        )}
        <div
          className="mt-4 rounded-md border border-dashed border-(--color-panel-border) p-3 text-xs text-(--color-panel-muted)"
          data-testid="lock-dialog-portfolio-placeholder"
        >
          Portfolio review will appear here after locking. (AI insight wires in Phase 5b.)
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-(--color-panel-border) bg-transparent px-3 py-1.5 text-xs font-medium text-(--color-panel-cell) hover:bg-(--color-skeleton-bg)"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canLock}
            onClick={onConfirm}
            data-testid="lock-dialog-confirm"
            className="rounded-md bg-(--color-shell-text) px-3 py-1.5 text-xs font-medium text-(--color-shell-bg) transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? 'Locking…' : 'Lock week'}
          </button>
        </div>
      </div>
    </div>
  );
}
