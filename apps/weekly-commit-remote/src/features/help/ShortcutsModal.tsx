import { useEffect } from 'react';
import { formatShortcut } from '../../hooks/useShortcuts.js';

interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

interface ShortcutEntry {
  binding: string;
  description: string;
}

const SHORTCUTS: ShortcutEntry[] = [
  { binding: 'mod+enter', description: 'Save / add commit' },
  { binding: 'mod+k', description: 'Focus the Supporting Outcome linker' },
  { binding: 'escape', description: 'Close dialog / clear unsaved text' },
  { binding: '?', description: 'Open keyboard shortcuts' },
];

/**
 * Cheat-sheet modal that lists every registered keyboard shortcut.
 * Triggered by pressing `?` anywhere on the IC draft view.
 */
export function ShortcutsModal({ open, onClose }: ShortcutsModalProps) {
  // Close on Escape even when the modal itself is focused.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-modal-title"
      data-testid="shortcuts-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-lg border border-(--color-panel-border) bg-(--color-panel-bg) p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="shortcuts-modal-title"
            className="text-base font-semibold text-(--color-panel-heading)"
          >
            Keyboard shortcuts
          </h2>
          <button
            type="button"
            aria-label="Close shortcuts modal"
            onClick={onClose}
            className="rounded p-1 text-(--color-shell-muted) hover:bg-(--color-skeleton-bg) hover:text-(--color-shell-text)"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>

        <table className="w-full text-sm" aria-label="Keyboard shortcuts list">
          <thead>
            <tr className="border-b border-(--color-panel-border)">
              <th className="pb-2 text-left text-xs font-medium uppercase tracking-wide text-(--color-shell-muted)">
                Shortcut
              </th>
              <th className="pb-2 text-left text-xs font-medium uppercase tracking-wide text-(--color-shell-muted)">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {SHORTCUTS.map(({ binding, description }) => (
              <tr
                key={binding}
                data-testid="shortcut-row"
                className="border-b border-(--color-panel-border) last:border-0"
              >
                <td className="py-2.5 pr-4">
                  <kbd className="inline-flex items-center rounded border border-(--color-panel-border) bg-(--color-skeleton-bg) px-1.5 py-0.5 font-mono text-xs text-(--color-shell-text)">
                    {formatShortcut(binding)}
                  </kbd>
                </td>
                <td className="py-2.5 text-(--color-shell-text)">{description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
