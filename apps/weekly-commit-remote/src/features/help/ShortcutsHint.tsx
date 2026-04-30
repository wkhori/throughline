import { Kbd } from '@throughline/shared-ui';

interface ShortcutsHintProps {
  onOpen: () => void;
}

/**
 * Small persistent hint anchored to the shell. Reads "Press ? for shortcuts"
 * with the `?` rendered as a key cap. Click opens the shortcut cheat-sheet so
 * pointer users get parity with keyboard users.
 */
export function ShortcutsHint({ onOpen }: ShortcutsHintProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid="shortcuts-hint"
      aria-label="Open keyboard shortcuts"
      className="fixed bottom-4 right-4 z-30 inline-flex items-center gap-2 rounded-full border border-(--color-panel-border) bg-(--color-shell-bg)/95 px-3 py-1.5 text-[11px] text-(--color-shell-muted) shadow-sm backdrop-blur transition-colors hover:text-(--color-shell-text) hover:bg-(--color-shell-bg)"
    >
      <span>Press</span>
      <Kbd size="xs">?</Kbd>
      <span>for shortcuts</span>
    </button>
  );
}
