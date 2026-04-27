import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DriftCheckLinkedOutcome } from '@throughline/shared-types';
import { DriftWarningBanner } from './DriftWarningBanner.js';

const checkMock = vi.fn();
let mockData: unknown = undefined;
let mockState = { isLoading: false, isError: false };

vi.mock('../../api/aiEndpoints.js', () => ({
  useDriftCheckMutation: () => [checkMock, { ...mockState, data: mockData }],
}));

const linked: DriftCheckLinkedOutcome = {
  supportingOutcomeId: '01HXSO1',
  title: 'Reduce 30-day churn',
  parentOutcomeTitle: 'Churn',
  parentDOTitle: 'Retention',
};

beforeEach(() => {
  checkMock.mockReset();
  checkMock.mockResolvedValue({ data: undefined });
  mockData = undefined;
  mockState = { isLoading: false, isError: false };
  vi.useFakeTimers();
});

describe('DriftWarningBanner', () => {
  it('does not render when no linked outcome', () => {
    render(
      <DriftWarningBanner
        commitId="c1"
        commitText="something something something something"
        linkedOutcome={null}
        alternativeOutcomes={[]}
      />,
    );
    expect(screen.queryByTestId('drift-warning-banner')).not.toBeInTheDocument();
  });

  it('does not call the mutation when commit text < 25 chars', () => {
    render(
      <DriftWarningBanner
        commitId="c1"
        commitText="too short"
        linkedOutcome={linked}
        alternativeOutcomes={[]}
      />,
    );
    act(() => vi.advanceTimersByTime(3000));
    expect(checkMock).not.toHaveBeenCalled();
  });

  it('debounces 1.5s before firing the mutation', () => {
    render(
      <DriftWarningBanner
        commitId="c1"
        commitText="enough characters here for the rule"
        linkedOutcome={linked}
        alternativeOutcomes={[]}
      />,
    );
    act(() => vi.advanceTimersByTime(1499));
    expect(checkMock).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(2));
    expect(checkMock).toHaveBeenCalledTimes(1);
  });

  it('renders banner only when driftScore > 0.5', () => {
    mockData = {
      payload: {
        driftScore: 0.78,
        alignmentVerdict: 'tangential',
        fixSuggestion: 'Re-link to enterprise expansion outcome.',
        suggestedRelink: null,
        reasoning: 'r',
        model: 'claude-haiku-4-5-20251001',
      },
    };
    render(
      <DriftWarningBanner
        commitId="c1"
        commitText="enough characters here for the rule"
        linkedOutcome={linked}
        alternativeOutcomes={[]}
      />,
    );
    expect(screen.getByTestId('drift-warning-banner')).toBeInTheDocument();
    expect(screen.getByTestId('drift-score').textContent).toBe('0.78');
    expect(screen.getByTestId('drift-fix').textContent).toContain('enterprise expansion');
  });

  it('does not render when driftScore ≤ 0.5', () => {
    mockData = {
      payload: {
        driftScore: 0.2,
        alignmentVerdict: 'aligned',
        fixSuggestion: null,
        suggestedRelink: null,
        reasoning: 'r',
        model: 'claude-haiku-4-5-20251001',
      },
    };
    render(
      <DriftWarningBanner
        commitId="c1"
        commitText="enough characters here for the rule"
        linkedOutcome={linked}
        alternativeOutcomes={[]}
      />,
    );
    expect(screen.queryByTestId('drift-warning-banner')).not.toBeInTheDocument();
  });

  it('silent-fails on error', () => {
    mockState = { isLoading: false, isError: true };
    render(
      <DriftWarningBanner
        commitId="c1"
        commitText="enough characters here for the rule"
        linkedOutcome={linked}
        alternativeOutcomes={[]}
      />,
    );
    expect(screen.queryByTestId('drift-warning-banner')).not.toBeInTheDocument();
  });

  it('Dismiss button hides the banner', async () => {
    vi.useRealTimers();
    mockData = {
      payload: {
        driftScore: 0.78,
        alignmentVerdict: 'tangential',
        fixSuggestion: null,
        suggestedRelink: null,
        reasoning: 'r',
        model: 'claude-haiku-4-5-20251001',
      },
    };
    const user = userEvent.setup();
    render(
      <DriftWarningBanner
        commitId="c1"
        commitText="enough characters here for the rule"
        linkedOutcome={linked}
        alternativeOutcomes={[]}
      />,
    );
    await user.click(screen.getByTestId('drift-dismiss'));
    expect(screen.queryByTestId('drift-warning-banner')).not.toBeInTheDocument();
  });
});
