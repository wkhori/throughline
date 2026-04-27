import type { CommandAction } from './CommandPalette.js';

// Actions surfaced in the command palette. Co-located here (rather than inline in App.tsx) so
// each callback can be exercised by unit tests — vitest's function coverage gate would otherwise
// miss the inline arrow functions.
export function buildPaletteActions(navigate: (path: string) => void): CommandAction[] {
  return [
    {
      id: 'jump-week',
      label: 'Jump to current week',
      hint: 'g w',
      perform: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
    },
    {
      id: 'jump-manager',
      label: 'Jump to manager dashboard',
      hint: 'g m',
      perform: () => navigate('/manager'),
    },
    {
      id: 'jump-admin',
      label: 'Jump to admin metrics',
      hint: 'g a',
      perform: () => navigate('/admin'),
    },
  ];
}
