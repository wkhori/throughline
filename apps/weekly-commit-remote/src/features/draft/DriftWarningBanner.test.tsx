import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DriftCheckPayload } from '@throughline/shared-types';
import { DriftWarningBanner } from './DriftWarningBanner.js';

const driftedPayload: DriftCheckPayload = {
  driftScore: 0.78,
  alignmentVerdict: 'tangential',
  fixSuggestion: 'Re-link to enterprise expansion outcome.',
  suggestedRelink: null,
  reasoning: 'r',
  model: 'claude-haiku-4-5-20251001',
};

const alignedPayload: DriftCheckPayload = {
  driftScore: 0.2,
  alignmentVerdict: 'aligned',
  fixSuggestion: null,
  suggestedRelink: null,
  reasoning: 'r',
  model: 'claude-haiku-4-5-20251001',
};

describe('DriftWarningBanner', () => {
  it('does not render when payload is undefined', () => {
    render(<DriftWarningBanner payload={undefined} />);
    expect(screen.queryByTestId('drift-warning-banner')).not.toBeInTheDocument();
  });

  it('renders when payload verdict is tangential', () => {
    render(<DriftWarningBanner payload={driftedPayload} />);
    expect(screen.getByTestId('drift-warning-banner')).toBeInTheDocument();
    expect(screen.getByTestId('drift-score').textContent).toBe('0.78');
    expect(screen.getByTestId('drift-fix').textContent).toContain('enterprise expansion');
  });

  it('renders when verdict is unrelated even if score < 0.5', () => {
    const payload: DriftCheckPayload = {
      ...alignedPayload,
      alignmentVerdict: 'unrelated',
      driftScore: 0.3,
    };
    render(<DriftWarningBanner payload={payload} />);
    expect(screen.getByTestId('drift-warning-banner')).toBeInTheDocument();
  });

  it('renders when driftScore is exactly 0.5', () => {
    const payload: DriftCheckPayload = {
      ...alignedPayload,
      alignmentVerdict: 'indirect',
      driftScore: 0.5,
    };
    render(<DriftWarningBanner payload={payload} />);
    expect(screen.getByTestId('drift-warning-banner')).toBeInTheDocument();
  });

  it('does not render when verdict is aligned and score < 0.5', () => {
    render(<DriftWarningBanner payload={alignedPayload} />);
    expect(screen.queryByTestId('drift-warning-banner')).not.toBeInTheDocument();
  });

  it('Dismiss button hides the banner', async () => {
    const user = userEvent.setup();
    render(<DriftWarningBanner payload={driftedPayload} insightKey="i1" />);
    await user.click(screen.getByTestId('drift-dismiss'));
    expect(screen.queryByTestId('drift-warning-banner')).not.toBeInTheDocument();
  });

  it('un-dismisses when the underlying insight key changes', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <DriftWarningBanner payload={driftedPayload} insightKey="i1" />,
    );
    await user.click(screen.getByTestId('drift-dismiss'));
    expect(screen.queryByTestId('drift-warning-banner')).not.toBeInTheDocument();
    rerender(<DriftWarningBanner payload={driftedPayload} insightKey="i2" />);
    expect(screen.getByTestId('drift-warning-banner')).toBeInTheDocument();
  });
});
