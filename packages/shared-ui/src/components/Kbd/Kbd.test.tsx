import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Kbd } from './Kbd.js';
import { KbdSequence } from './KbdSequence.js';

describe('Kbd', () => {
  it('renders a kbd element with the given child', () => {
    render(<Kbd>K</Kbd>);
    const kbd = screen.getByText('K');
    expect(kbd.tagName.toLowerCase()).toBe('kbd');
  });

  it('respects size="xs"', () => {
    render(<Kbd size="xs">?</Kbd>);
    const kbd = screen.getByText('?');
    expect(kbd.className).toContain('text-[10px]');
  });

  it('defaults to size="sm" with the larger sizing tokens', () => {
    render(<Kbd>Esc</Kbd>);
    const kbd = screen.getByText('Esc');
    expect(kbd.className).toContain('text-[11px]');
  });
});

describe('KbdSequence', () => {
  it('splits "mod+enter" into two kbd caps with a separator', () => {
    render(<KbdSequence binding="mod+enter" />);
    // jsdom platform isn't Mac, so mod => Ctrl
    expect(screen.getByText('Ctrl').tagName.toLowerCase()).toBe('kbd');
    expect(screen.getByText('Enter').tagName.toLowerCase()).toBe('kbd');
  });

  it('renders escape as Esc (alias)', () => {
    render(<KbdSequence binding="escape" />);
    expect(screen.getByText('Esc')).toBeInTheDocument();
  });

  it('uppercases plain alpha keys', () => {
    render(<KbdSequence binding="mod+k" />);
    expect(screen.getByText('K')).toBeInTheDocument();
  });

  it('passes through size to inner Kbd caps', () => {
    render(<KbdSequence binding="?" size="xs" />);
    expect(screen.getByText('?').className).toContain('text-[10px]');
  });

  it('renders shift / alt aliases on non-Mac', () => {
    const { rerender } = render(<KbdSequence binding="shift+alt+a" />);
    expect(screen.getByText('Shift')).toBeInTheDocument();
    expect(screen.getByText('Alt')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
    rerender(<KbdSequence binding="enter" />);
    expect(screen.getByText('Enter')).toBeInTheDocument();
  });
});
