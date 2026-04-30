import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RcdoTreeDto } from '@throughline/shared-types';
import { SoLinker } from './SoLinker.js';

interface SuggestResult {
  payload: { supportingOutcomeId: string | null; confidence: number; rationale?: string } | null;
}

let suggestUnwrapResult: SuggestResult | Error = { payload: null };
const suggestMock = vi.fn();

vi.mock('../../api/aiEndpoints.js', () => ({
  useSuggestOutcomeMutation: () => [
    (...args: unknown[]) => {
      suggestMock(...args);
      return {
        unwrap: () =>
          suggestUnwrapResult instanceof Error
            ? Promise.reject(suggestUnwrapResult)
            : Promise.resolve(suggestUnwrapResult),
      };
    },
    { isLoading: false, isError: false, data: undefined },
  ],
}));

const tree: RcdoTreeDto = {
  rallyCries: [
    {
      id: 'rc',
      title: 'SMB',
      displayOrder: 0,
      definingObjectives: [
        {
          id: 'do',
          rallyCryId: 'rc',
          title: 'Grow ARR',
          displayOrder: 0,
          outcomes: [
            {
              id: 'o',
              definingObjectiveId: 'do',
              title: 'Pipeline',
              displayOrder: 0,
              supportingOutcomes: [
                { id: 'so-a', outcomeId: 'o', title: 'Reduce day-7 churn', displayOrder: 0 },
                {
                  id: 'so-b',
                  outcomeId: 'o',
                  title: 'Expand enterprise pipeline',
                  displayOrder: 1,
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

beforeEach(() => {
  suggestMock.mockReset();
  suggestUnwrapResult = { payload: null };
});

describe('SoLinker', () => {
  it('starts in INITIAL with no value; opens typeahead by default', () => {
    render(<SoLinker rcdo={tree} commitText="" value={null} onChange={vi.fn()} />);
    const root = screen.getByTestId('so-linker');
    expect(root.getAttribute('data-state')).toBe('INITIAL');
    expect(screen.getByTestId('so-linker-input')).toBeInTheDocument();
  });

  it('typing → debounce 500ms → THINKING → SUGGESTED with chip', async () => {
    vi.useFakeTimers();
    suggestUnwrapResult = {
      payload: { supportingOutcomeId: 'so-a', confidence: 0.92 },
    };
    const onChange = vi.fn();
    const { rerender } = render(
      <SoLinker
        rcdo={tree}
        commitText="ship onboarding emails to reduce churn"
        value={null}
        onChange={onChange}
      />,
    );
    // Before debounce settles: not yet fired.
    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(suggestMock).not.toHaveBeenCalled();

    // Advance past debounce; the inflight promise resolves on next microtask flush.
    await act(async () => {
      vi.advanceTimersByTime(2);
      // Drain any pending microtasks.
      await Promise.resolve();
    });
    expect(suggestMock).toHaveBeenCalledTimes(1);

    // Switch back to real timers so the awaited unwrap can settle and React re-renders.
    vi.useRealTimers();
    rerender(
      <SoLinker
        rcdo={tree}
        commitText="ship onboarding emails to reduce churn"
        value="so-a"
        onChange={onChange}
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId('so-linker-chip')).toBeInTheDocument();
    });
    expect(onChange).toHaveBeenCalledWith('so-a');
    expect(screen.getByTestId('so-linker').getAttribute('data-state')).toBe('SUGGESTED');
  });

  it('low-confidence response falls back to TYPEAHEAD_OPEN', async () => {
    suggestUnwrapResult = {
      payload: { supportingOutcomeId: 'so-a', confidence: 0.2 },
    };
    render(
      <SoLinker
        rcdo={tree}
        commitText="some plausible commit text here"
        value={null}
        onChange={vi.fn()}
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId('so-linker').getAttribute('data-state')).toBe('TYPEAHEAD_OPEN');
    });
    expect(screen.getByTestId('so-linker-input')).toBeInTheDocument();
  });

  it('error from T1 falls back to TYPEAHEAD_OPEN (silent-degrade)', async () => {
    suggestUnwrapResult = new Error('429 BUDGET_EXHAUSTED');
    render(
      <SoLinker
        rcdo={tree}
        commitText="some plausible commit text here"
        value={null}
        onChange={vi.fn()}
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId('so-linker').getAttribute('data-state')).toBe('TYPEAHEAD_OPEN');
    });
  });

  it('clicking "Change" on a filled chip opens the typeahead', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SoLinker rcdo={tree} commitText="" value="so-a" onChange={onChange} />);
    expect(screen.getByTestId('so-linker-chip')).toBeInTheDocument();
    await user.click(screen.getByTestId('so-linker-chip-change'));
    expect(screen.getByTestId('so-linker-input')).toBeInTheDocument();
    expect(screen.getByTestId('so-linker').getAttribute('data-state')).toBe('TYPEAHEAD_OPEN');
  });

  it('selecting a row from the typeahead transitions to FILLED', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <SoLinker rcdo={tree} commitText="" value={null} onChange={onChange} />,
    );
    const rows = await screen.findAllByTestId('so-linker-result');
    await user.click(rows[1]!); // pick "Expand enterprise pipeline"
    expect(onChange).toHaveBeenCalledWith('so-b');

    // Parent rerenders with the new value — chip appears.
    rerender(<SoLinker rcdo={tree} commitText="" value="so-b" onChange={onChange} />);
    expect(screen.getByTestId('so-linker-chip')).toBeInTheDocument();
    expect(screen.getByTestId('so-linker').getAttribute('data-state')).toBe('FILLED');
  });
});
