import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { CommandPalette } from './CommandPalette.js';

function dispatch(key: string, opts: KeyboardEventInit = {}) {
  act(() => {
    // tinykeys matches on `event.code` for letter shortcuts ($mod+KeyK), so set code explicitly.
    const code = opts.code ?? (key.length === 1 ? 'Key' + key.toUpperCase() : key);
    window.dispatchEvent(new KeyboardEvent('keydown', { key, code, ...opts }));
  });
}

describe('CommandPalette', () => {
  it('is hidden by default', () => {
    render(<CommandPalette actions={[]} />);
    expect(screen.queryByTestId('command-palette')).toBeNull();
  });

  it('opens on the platform $mod+K and renders provided actions', () => {
    const perform = vi.fn();
    render(
      <CommandPalette
        actions={[{ id: 'open-manager', label: 'Open manager dashboard', perform }]}
      />,
    );
    // jsdom resolves tinykeys' $mod to ctrlKey; real browsers prefer metaKey on Mac. Cover both
    // to keep the test platform-agnostic.
    // tinykeys resolves $mod to metaKey on Mac, ctrlKey elsewhere. Try metaKey first; if the
    // jsdom navigator.platform is e.g. 'linux' that path is a no-op so we then fire ctrlKey.
    dispatch('k', { metaKey: true });
    if (!document.querySelector('[data-testid="command-palette"]')) {
      dispatch('k', { ctrlKey: true });
    }
    expect(screen.getByTestId('command-palette')).toBeInTheDocument();
    expect(screen.getByTestId('palette-item-open-manager')).toBeInTheDocument();
  });

  it('closes when Escape is pressed', () => {
    render(<CommandPalette actions={[]} />);
    dispatch('k', { ctrlKey: true });
    expect(screen.getByTestId('command-palette')).toBeInTheDocument();
    dispatch('Escape');
    expect(screen.queryByTestId('command-palette')).toBeNull();
  });
});
