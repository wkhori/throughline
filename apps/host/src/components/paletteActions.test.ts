import { describe, expect, it, vi, beforeEach } from 'vitest';
import { buildPaletteActions } from './paletteActions.js';

describe('buildPaletteActions', () => {
  beforeEach(() => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  });

  it('returns three actions in the documented order', () => {
    const actions = buildPaletteActions(() => {});
    expect(actions.map((a) => a.id)).toEqual(['jump-week', 'jump-manager', 'jump-admin']);
  });

  it('Jump to current week scrolls to top', () => {
    const actions = buildPaletteActions(() => {});
    actions[0]!.perform();
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('Jump to manager dashboard delegates to the navigator', () => {
    const navigate = vi.fn();
    const actions = buildPaletteActions(navigate);
    actions[1]!.perform();
    expect(navigate).toHaveBeenCalledWith('/manager');
  });

  it('Jump to admin metrics delegates to the navigator', () => {
    const navigate = vi.fn();
    const actions = buildPaletteActions(navigate);
    actions[2]!.perform();
    expect(navigate).toHaveBeenCalledWith('/admin');
  });
});
