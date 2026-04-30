import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShortcutsModal } from './ShortcutsModal.js';

describe('ShortcutsModal', () => {
  it('renders nothing when open=false', () => {
    const onClose = vi.fn();
    render(<ShortcutsModal open={false} onClose={onClose} />);
    expect(screen.queryByTestId('shortcuts-modal')).not.toBeInTheDocument();
  });

  it('renders the modal with four shortcut rows when open=true', () => {
    const onClose = vi.fn();
    render(<ShortcutsModal open={true} onClose={onClose} />);
    expect(screen.getByTestId('shortcuts-modal')).toBeInTheDocument();
    const rows = screen.getAllByTestId('shortcut-row');
    expect(rows).toHaveLength(4);
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<ShortcutsModal open={true} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close shortcuts modal/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking the backdrop overlay', () => {
    const onClose = vi.fn();
    render(<ShortcutsModal open={true} onClose={onClose} />);
    // The backdrop is the outermost dialog element.
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(<ShortcutsModal open={true} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders pretty shortcut labels in kbd elements', () => {
    const onClose = vi.fn();
    render(<ShortcutsModal open={true} onClose={onClose} />);
    // KbdSequence renders one <kbd> per modifier; on non-Mac (jsdom), mod → Ctrl.
    const kbdElements = document.querySelectorAll('kbd');
    const texts = Array.from(kbdElements).map((el) => el.textContent);
    expect(texts).toContain('Ctrl');
    expect(texts).toContain('Enter');
    expect(texts).toContain('K');
    expect(texts).toContain('Esc');
    expect(texts).toContain('?');
  });
});
