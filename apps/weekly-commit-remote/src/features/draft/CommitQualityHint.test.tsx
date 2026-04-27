import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommitQualityHint } from './CommitQualityHint.js';

const lintMock = vi.fn();
let mockData: unknown = undefined;
let mockState = { isLoading: false, isError: false };

vi.mock('../../api/aiEndpoints.js', () => ({
  useQualityLintMutation: () => [lintMock, { ...mockState, data: mockData }],
}));

beforeEach(() => {
  lintMock.mockReset();
  lintMock.mockResolvedValue({ data: undefined });
  mockData = undefined;
  mockState = { isLoading: false, isError: false };
  vi.useFakeTimers();
});

describe('CommitQualityHint', () => {
  it('does not call the mutation when no SO is linked', () => {
    render(
      <CommitQualityHint
        commitId="c1"
        commitText="ship onboarding emails"
        category="OPERATIONAL"
        priority="SHOULD"
        supportingOutcomeTitle={null}
      />,
    );
    act(() => vi.advanceTimersByTime(2000));
    expect(lintMock).not.toHaveBeenCalled();
  });

  it('debounces 1s before firing the mutation', () => {
    render(
      <CommitQualityHint
        commitId="c1"
        commitText="ship onboarding emails v2"
        category="OPERATIONAL"
        priority="SHOULD"
        supportingOutcomeTitle="Reduce churn"
      />,
    );
    act(() => vi.advanceTimersByTime(999));
    expect(lintMock).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(2));
    expect(lintMock).toHaveBeenCalledTimes(1);
  });

  it('renders nothing for healthy commits (issues empty)', () => {
    mockData = {
      payload: {
        issues: [],
        severity: 'low',
        reasoning: 'r',
        model: 'claude-haiku-4-5-20251001',
      },
    };
    render(
      <CommitQualityHint
        commitId="c1"
        commitText="ship onboarding emails v2"
        category="OPERATIONAL"
        priority="SHOULD"
        supportingOutcomeTitle="Reduce churn"
      />,
    );
    expect(screen.queryByTestId('quality-hint')).not.toBeInTheDocument();
  });

  it('renders the first issue message when issues are present', () => {
    mockData = {
      payload: {
        issues: [{ kind: 'vague', message: 'Verb is fuzzy — name a specific deliverable.' }],
        severity: 'medium',
        reasoning: 'r',
        model: 'claude-haiku-4-5-20251001',
      },
    };
    render(
      <CommitQualityHint
        commitId="c1"
        commitText="work on onboarding"
        category="OPERATIONAL"
        priority="MUST"
        supportingOutcomeTitle="Reduce churn"
      />,
    );
    expect(screen.getByTestId('quality-hint-message').textContent).toContain('Verb is fuzzy');
  });

  it('silent-fails on error', () => {
    mockState = { isLoading: false, isError: true };
    render(
      <CommitQualityHint
        commitId="c1"
        commitText="ship onboarding emails v2"
        category="OPERATIONAL"
        priority="SHOULD"
        supportingOutcomeTitle="Reduce churn"
      />,
    );
    expect(screen.queryByTestId('quality-hint')).not.toBeInTheDocument();
  });

  it('dismiss link hides the hint', async () => {
    vi.useRealTimers();
    mockData = {
      payload: {
        issues: [{ kind: 'vague', message: 'fuzzy' }],
        severity: 'low',
        reasoning: 'r',
        model: 'claude-haiku-4-5-20251001',
      },
    };
    const user = userEvent.setup();
    render(
      <CommitQualityHint
        commitId="c1"
        commitText="work on onboarding"
        category="OPERATIONAL"
        priority="MUST"
        supportingOutcomeTitle="Reduce churn"
      />,
    );
    await user.click(screen.getByTestId('quality-hint-dismiss'));
    expect(screen.queryByTestId('quality-hint')).not.toBeInTheDocument();
  });
});
