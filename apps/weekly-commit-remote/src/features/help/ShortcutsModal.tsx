import { useEffect, useMemo, useState } from 'react';
import { KbdSequence } from '@throughline/shared-ui';

interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

interface ShortcutEntry {
  binding: string;
  description: string;
  scope: 'Editing' | 'Navigation' | 'Help';
}

const SHORTCUTS: ShortcutEntry[] = [
  { binding: 'mod+enter', description: 'Save commit', scope: 'Editing' },
  { binding: 'mod+k', description: 'Focus SO linker', scope: 'Editing' },
  { binding: 'escape', description: 'Close · cancel edit', scope: 'Navigation' },
  { binding: '?', description: 'Open this cheat-sheet', scope: 'Help' },
];

const SECTIONS: Array<ShortcutEntry['scope']> = ['Editing', 'Navigation', 'Help'];

export function ShortcutsModal({ open, onClose }: ShortcutsModalProps) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SHORTCUTS;
    return SHORTCUTS.filter(
      (s) =>
        s.description.toLowerCase().includes(q) ||
        s.binding.toLowerCase().includes(q) ||
        s.scope.toLowerCase().includes(q),
    );
  }, [query]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-modal-title"
      data-testid="shortcuts-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-xl border border-(--color-panel-border) bg-(--color-panel-bg) shadow-2xl">
        <div className="flex items-center justify-between border-b border-(--color-panel-border) px-6 py-4">
          <div>
            <h2
              id="shortcuts-modal-title"
              className="text-sm font-semibold text-(--color-panel-heading)"
            >
              Keyboard shortcuts
            </h2>
            <p className="mt-0.5 text-xs text-(--color-shell-muted)">
              Anywhere in Throughline. Press <KbdSequence binding="escape" size="xs" /> to close.
            </p>
          </div>
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

        <div className="border-b border-(--color-panel-border) px-6 py-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search shortcuts…"
            data-testid="shortcuts-search"
            className="w-full rounded-md border border-(--color-panel-border) bg-(--color-shell-bg) px-3 py-1.5 text-xs text-(--color-shell-text) placeholder:text-(--color-shell-muted) focus:border-(--color-ribbon-link) focus:outline-none"
          />
        </div>

        <div className="grid max-h-[60vh] grid-cols-1 gap-x-8 gap-y-5 overflow-y-auto px-6 py-5 sm:grid-cols-2">
          {SECTIONS.map((section) => {
            const rows = filtered.filter((s) => s.scope === section);
            if (rows.length === 0) return null;
            return (
              <div key={section} data-testid={`shortcuts-section-${section}`}>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-(--color-shell-muted)">
                  {section}
                </p>
                <ul className="space-y-2">
                  {rows.map(({ binding, description }) => (
                    <li
                      key={binding}
                      data-testid="shortcut-row"
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="text-xs text-(--color-shell-text)">{description}</span>
                      <KbdSequence binding={binding} size="xs" />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          {filtered.length === 0 ? (
            <p
              data-testid="shortcuts-empty"
              className="col-span-full text-center text-xs text-(--color-shell-muted)"
            >
              No shortcuts match &ldquo;{query}&rdquo;.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
