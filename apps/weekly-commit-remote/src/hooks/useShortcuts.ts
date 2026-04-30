import { useEffect } from 'react';

type ShortcutMap = Record<string, () => void>;

interface UseShortcutsOptions {
  enabled?: boolean;
}

/** Returns true when the event originates from an editable element. */
function isEditableTarget(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement | null;
  if (!target) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
  if (target.isContentEditable) return true;
  return false;
}

/** True on macOS / iOS, false elsewhere. */
function isMac(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

/**
 * Resolves the modifier key: metaKey on Mac, ctrlKey elsewhere.
 */
function hasMod(e: KeyboardEvent): boolean {
  return isMac() ? e.metaKey : e.ctrlKey;
}

/**
 * Parse a binding string like "mod+enter", "mod+k", "escape", "?" into a
 * predicate that returns true when a KeyboardEvent matches.
 */
function buildMatcher(binding: string): (e: KeyboardEvent) => boolean {
  const parts = binding.toLowerCase().split('+');
  const hasMod_ = parts.includes('mod');
  const hasShift = parts.includes('shift');
  const hasAlt = parts.includes('alt');
  const keyPart = parts[parts.length - 1];

  // Normalise a few common aliases.
  const normalise = (k: string) => {
    if (k === 'enter') return 'enter';
    if (k === 'escape' || k === 'esc') return 'escape';
    return k;
  };

  const expected = normalise(keyPart ?? '');

  return (e: KeyboardEvent): boolean => {
    const key = e.key.toLowerCase();
    if (normalise(key) !== expected) return false;
    if (hasMod_ !== hasMod(e)) return false;
    if (hasShift !== e.shiftKey) return false;
    if (hasAlt !== e.altKey) return false;
    return true;
  };
}

/**
 * Returns true when this event+binding combo should be processed even though
 * the focus is inside an editable element. Only Escape and mod+Enter pass through.
 */
function isAllowedInEditable(binding: string): boolean {
  const lower = binding.toLowerCase();
  return lower === 'escape' || lower === 'esc' || lower === 'mod+enter';
}

/**
 * Registry hook for keyboard shortcuts.
 *
 * @param shortcuts  Map of binding string → callback.
 *                   Supported modifiers: `mod` (⌘ on Mac, Ctrl elsewhere),
 *                   `shift`, `alt`. Keys are case-insensitive.
 * @param options    `enabled` defaults to `true`.
 *
 * @example
 *   useShortcuts({ 'mod+enter': () => save(), 'mod+k': () => focus(), 'escape': () => close(), '?': () => openHelp() });
 */
export function useShortcuts(shortcuts: ShortcutMap, options: UseShortcutsOptions = {}): void {
  const { enabled = true } = options;

  useEffect(() => {
    if (!enabled) return;

    const entries = Object.entries(shortcuts).map(([binding, cb]) => ({
      binding,
      matcher: buildMatcher(binding),
      allowedInEditable: isAllowedInEditable(binding),
      cb,
    }));

    const handler = (e: KeyboardEvent) => {
      const inEditable = isEditableTarget(e);

      for (const { matcher, allowedInEditable, cb } of entries) {
        if (!matcher(e)) continue;
        if (inEditable && !allowedInEditable) continue;
        e.preventDefault();
        cb();
        break; // first match wins
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcuts, enabled]);
}

/**
 * Renders a binding string in a human-readable pretty form.
 *
 * @example
 *   formatShortcut('mod+enter') // → '⌘+Enter' on Mac, 'Ctrl+Enter' elsewhere
 *   formatShortcut('mod+k')     // → '⌘+K' on Mac
 *   formatShortcut('escape')    // → 'Esc'
 *   formatShortcut('?')         // → '?'
 */
export function formatShortcut(key: string): string {
  const parts = key.toLowerCase().split('+');
  const result: string[] = [];

  for (const part of parts) {
    switch (part) {
      case 'mod':
        result.push(isMac() ? '⌘' : 'Ctrl');
        break;
      case 'shift':
        result.push(isMac() ? '⇧' : 'Shift');
        break;
      case 'alt':
        result.push(isMac() ? '⌥' : 'Alt');
        break;
      case 'enter':
        result.push('Enter');
        break;
      case 'escape':
      case 'esc':
        result.push('Esc');
        break;
      default:
        result.push(part.toUpperCase());
        break;
    }
  }

  return result.join('+');
}
