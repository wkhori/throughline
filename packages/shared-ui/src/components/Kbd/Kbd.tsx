import type { ReactNode } from 'react';

interface KbdProps {
  children: ReactNode;
  size?: 'xs' | 'sm';
}

/**
 * Single key cap rendered as a `<kbd>`. Uses a slightly raised, dual-tone style so
 * a sequence of keys reads as a tactile chord rather than inline text.
 */
export function Kbd({ children, size = 'sm' }: KbdProps) {
  const sizing =
    size === 'xs' ? 'min-w-5 px-1 py-0 text-[10px]' : 'min-w-[1.5rem] px-1.5 py-0.5 text-[11px]';
  return (
    <kbd
      className={
        'inline-flex items-center justify-center rounded-md border border-(--color-panel-border) ' +
        'bg-(--color-shell-bg) font-mono font-medium text-(--color-shell-text) ' +
        'shadow-[inset_0_-1px_0_0_var(--color-panel-border)] ' +
        sizing
      }
    >
      {children}
    </kbd>
  );
}
