import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { useRtkSubscriptionKick } from './useRtkSubscriptionKick.js';

describe('useRtkSubscriptionKick', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('schedules three staggered re-renders after mount', () => {
    const renderSpy = vi.fn();
    const { rerender, unmount } = renderHook(() => {
      renderSpy();
      useRtkSubscriptionKick();
    });

    // Initial render only — kicks haven't fired yet.
    expect(renderSpy).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(80));
    expect(renderSpy).toHaveBeenCalledTimes(2);

    act(() => vi.advanceTimersByTime(520));
    // 600 ms total — second kick.
    expect(renderSpy).toHaveBeenCalledTimes(3);

    act(() => vi.advanceTimersByTime(900));
    // 1500 ms total — third kick.
    expect(renderSpy).toHaveBeenCalledTimes(4);

    // No further kicks past the configured schedule.
    act(() => vi.advanceTimersByTime(5_000));
    expect(renderSpy).toHaveBeenCalledTimes(4);

    rerender();
    unmount();
  });

  it('clears every pending kick on unmount so a dead component never sets state', () => {
    const renderSpy = vi.fn();
    const { unmount } = renderHook(() => {
      renderSpy();
      useRtkSubscriptionKick();
    });

    expect(renderSpy).toHaveBeenCalledTimes(1);
    unmount();

    // After unmount, advancing past every scheduled delay must not trigger
    // any further re-renders (would manifest as a React act() warning if the
    // setState ever fired on the unmounted instance).
    act(() => vi.advanceTimersByTime(5_000));
    expect(renderSpy).toHaveBeenCalledTimes(1);
  });
});
