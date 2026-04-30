import { Kbd } from './Kbd.js';

interface KbdSequenceProps {
  /** Binding string like "mod+enter" or "?". Modifiers are split on "+". */
  binding: string;
  size?: 'xs' | 'sm';
}

const MOD_LABEL_MAC = '⌘';
const MOD_LABEL_OTHER = 'Ctrl';

function isMac(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

function labelFor(part: string): string {
  switch (part) {
    case 'mod':
      return isMac() ? MOD_LABEL_MAC : MOD_LABEL_OTHER;
    case 'shift':
      return isMac() ? '⇧' : 'Shift';
    case 'alt':
      return isMac() ? '⌥' : 'Alt';
    case 'enter':
      return 'Enter';
    case 'escape':
    case 'esc':
      return 'Esc';
    default:
      return part.toUpperCase();
  }
}

/**
 * Renders a binding like `mod+enter` as a sequence of separate `<Kbd>` caps with
 * thin dividers — visually closer to printed shortcut hints than a single inline string.
 */
export function KbdSequence({ binding, size = 'sm' }: KbdSequenceProps) {
  const parts = binding.toLowerCase().split('+');
  return (
    <span className="inline-flex items-center gap-1">
      {parts.map((p, i) => (
        <span key={`${p}-${i}`} className="inline-flex items-center gap-1">
          <Kbd size={size}>{labelFor(p)}</Kbd>
          {i < parts.length - 1 ? (
            <span aria-hidden className="text-[10px] text-(--color-shell-muted)">
              +
            </span>
          ) : null}
        </span>
      ))}
    </span>
  );
}
