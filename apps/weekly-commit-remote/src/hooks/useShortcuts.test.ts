import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useShortcuts, formatShortcut } from './useShortcuts.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fireKey(
  key: string,
  options: Partial<KeyboardEventInit> = {},
  target: EventTarget = window,
) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  target.dispatchEvent(event);
  return event;
}

// ---------------------------------------------------------------------------
// useShortcuts — basic dispatch
// ---------------------------------------------------------------------------

describe('useShortcuts', () => {
  it('fires the callback when the registered key is pressed', () => {
    const cb = vi.fn();
    renderHook(() => useShortcuts({ '?': cb }));
    fireKey('?');
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('fires the callback when mod+enter is pressed (ctrlKey on non-Mac)', () => {
    const cb = vi.fn();
    renderHook(() => useShortcuts({ 'mod+enter': cb }));
    // jsdom platform is not Mac, so ctrlKey is the mod key.
    fireKey('Enter', { ctrlKey: true });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire when enabled=false', () => {
    const cb = vi.fn();
    renderHook(() => useShortcuts({ '?': cb }, { enabled: false }));
    fireKey('?');
    expect(cb).not.toHaveBeenCalled();
  });

  it('removes the listener on unmount (no callback after unmount)', () => {
    const cb = vi.fn();
    const { unmount } = renderHook(() => useShortcuts({ '?': cb }));
    unmount();
    fireKey('?');
    expect(cb).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Input-focus exemption
  // ---------------------------------------------------------------------------

  it("does NOT fire '?' when focus is inside an INPUT", () => {
    const cb = vi.fn();
    renderHook(() => useShortcuts({ '?': cb }));

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    fireKey('?', {}, input);

    document.body.removeChild(input);
    expect(cb).not.toHaveBeenCalled();
  });

  it('DOES fire Escape even when focus is inside a TEXTAREA', () => {
    const cb = vi.fn();
    renderHook(() => useShortcuts({ escape: cb }));

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();

    fireKey('Escape', {}, textarea);

    document.body.removeChild(textarea);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('DOES fire mod+Enter even when focus is inside an INPUT', () => {
    const cb = vi.fn();
    renderHook(() => useShortcuts({ 'mod+enter': cb }));

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    fireKey('Enter', { ctrlKey: true }, input);

    document.body.removeChild(input);
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// formatShortcut
// ---------------------------------------------------------------------------

describe('formatShortcut', () => {
  it('renders mod as Ctrl on non-Mac (jsdom)', () => {
    expect(formatShortcut('mod+enter')).toBe('Ctrl+Enter');
  });

  it('renders a plain key in uppercase', () => {
    expect(formatShortcut('?')).toBe('?');
  });

  it('renders escape as Esc', () => {
    expect(formatShortcut('escape')).toBe('Esc');
  });

  it('renders mod+k correctly', () => {
    expect(formatShortcut('mod+k')).toBe('Ctrl+K');
  });
});
