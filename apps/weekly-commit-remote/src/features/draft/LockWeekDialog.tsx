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
      className="fixed inset-0 z-50 flex items-center justify-center bg-(--dialog-overlay) p-4"
    >
      <div className="max-w-md rounded-lg border border-(--dialog-border) bg-(--dialog-bg) p-6 shadow-lg">
        <h2 id="lock-dialog-title" className="text-base font-semibold text-(--dialog-text)">
          Lock this week
        </h2>
        <p className="mt-1 text-sm text-(--dialog-muted)" data-testid="lock-dialog-count">
          You&apos;re about to lock {commits.length} commit{commits.length === 1 ? '' : 's'}.
        </p>
        {blockers.length > 0 && (
          <div className="mt-3 rounded-md border border-(--dialog-warn-border) bg-(--dialog-warn-bg) p-3 text-xs text-(--dialog-warn-text)">
            <p className="font-medium">Blockers — link a Supporting Outcome to each:</p>
            <ul className="mt-2 list-disc pl-4" data-testid="lock-dialog-blockers">
              {blockers.map((b) => (
                <li key={b.id}>{b.text}</li>
              ))}
            </ul>
          </div>
        )}
        <div
          className="mt-4 rounded-md border border-dashed border-(--dialog-placeholder-border) p-3 text-xs text-(--dialog-muted)"
          data-testid="lock-dialog-portfolio-placeholder"
        >
          Portfolio review will appear here after locking. (AI insight wires in Phase 5b.)
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-(--dialog-button-border) px-3 py-1 text-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canLock}
            onClick={onConfirm}
            data-testid="lock-dialog-confirm"
            className="rounded-md bg-(--dialog-primary-bg) px-3 py-1 text-xs font-medium text-(--dialog-primary-fg) disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Locking…' : 'Lock week'}
          </button>
        </div>
      </div>
    </div>
  );
}
