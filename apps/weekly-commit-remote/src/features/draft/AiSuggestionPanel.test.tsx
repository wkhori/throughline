import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { OutcomeCandidateDto } from '@throughline/shared-types';
import { AiSuggestionPanel } from './AiSuggestionPanel.js';

const suggestMock = vi.fn();
let mockData: unknown = undefined;
let mockState = { isLoading: false, isError: false };

vi.mock('../../api/aiEndpoints.js', () => ({
  useSuggestOutcomeMutation: () => [suggestMock, { ...mockState, data: mockData }],
}));

const candidates: OutcomeCandidateDto[] = [
  {
    supportingOutcomeId: '01HXSO1',
    title: 'Reduce 30-day churn',
    parentOutcomeTitle: 'Churn',
    parentDOTitle: 'Retention',
    parentRallyCryTitle: 'SMB',
  },
];

beforeEach(() => {
  suggestMock.mockReset();
  suggestMock.mockResolvedValue({ data: undefined });
  mockData = undefined;
  mockState = { isLoading: false, isError: false };
  vi.useFakeTimers();
});

describe('AiSuggestionPanel', () => {
  it('does not call the mutation while text is below the minimum length', async () => {
    render(<AiSuggestionPanel draftCommitText="too short" candidates={candidates} />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(suggestMock).not.toHaveBeenCalled();
  });

  it('debounces the call and fires once 800ms after typing stops', () => {
    const { rerender } = render(
      <AiSuggestionPanel
        draftCommitText="initial draft text long enough"
        candidates={candidates}
      />,
    );
    rerender(
      <AiSuggestionPanel
        draftCommitText="initial draft text long enough now"
        candidates={candidates}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(799);
    });
    expect(suggestMock).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(suggestMock).toHaveBeenCalledTimes(1);
  });

  it('renders the suggestion when payload confidence ≥ 0.6 and matching candidate exists', () => {
    mockData = {
      payload: {
        supportingOutcomeId: '01HXSO1',
        confidence: 0.92,
        rationale: 'verb+object align with churn outcome',
        reasoning: 'r',
        model: 'claude-haiku-4-5-20251001',
      },
    };
    render(
      <AiSuggestionPanel
        draftCommitText="ship onboarding emails to reduce churn"
        candidates={candidates}
      />,
    );
    expect(screen.getByTestId('ai-suggestion-title').textContent).toBe('Reduce 30-day churn');
  });

  it('silent-fails on error (no panel rendered)', () => {
    mockState = { isLoading: false, isError: true };
    render(
      <AiSuggestionPanel
        draftCommitText="ship onboarding emails to reduce churn"
        candidates={candidates}
      />,
    );
    expect(screen.queryByTestId('ai-suggestion-panel')).not.toBeInTheDocument();
  });

  it('suppresses suggestion when manuallySelectedAt is recent (<30s)', () => {
    render(
      <AiSuggestionPanel
        draftCommitText="ship onboarding emails to reduce churn"
        candidates={candidates}
        manuallySelectedAt={Date.now()}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(suggestMock).not.toHaveBeenCalled();
  });

  it('Use this button calls onAccept with the SO id', async () => {
    vi.useRealTimers();
    mockData = {
      payload: {
        supportingOutcomeId: '01HXSO1',
        confidence: 0.92,
        rationale: 'r',
        reasoning: 'r',
        model: 'claude-haiku-4-5-20251001',
      },
    };
    const user = userEvent.setup();
    const onAccept = vi.fn();
    render(
      <AiSuggestionPanel
        draftCommitText="ship onboarding emails"
        candidates={candidates}
        onAccept={onAccept}
      />,
    );
    await waitFor(() => screen.getByTestId('ai-suggestion-accept'));
    await user.click(screen.getByTestId('ai-suggestion-accept'));
    expect(onAccept).toHaveBeenCalledWith('01HXSO1');
  });
});
