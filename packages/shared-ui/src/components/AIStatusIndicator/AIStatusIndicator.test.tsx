import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AIStatusIndicator } from './AIStatusIndicator.js';
import type { AIStatusIndicatorState } from './AIStatusIndicator.js';

const ALL_STATES: AIStatusIndicatorState[] = ['idle', 'thinking', 'suggested', 'warning', 'error'];

describe('AIStatusIndicator', () => {
  it.each(ALL_STATES)('renders for state "%s"', (state) => {
    render(<AIStatusIndicator state={state} />);
    expect(screen.getByTestId('ai-status-indicator')).toBeInTheDocument();
  });

  it.each(ALL_STATES)('sets data-state="%s" on the root element', (state) => {
    render(<AIStatusIndicator state={state} />);
    expect(screen.getByTestId('ai-status-indicator')).toHaveAttribute('data-state', state);
  });

  it('renders the label when provided', () => {
    render(<AIStatusIndicator state="suggested" label="AI suggested" />);
    expect(screen.getByText('AI suggested')).toBeInTheDocument();
  });

  it('does not render a label element when label is omitted', () => {
    render(<AIStatusIndicator state="idle" />);
    const indicator = screen.getByTestId('ai-status-indicator');
    expect(indicator.querySelector('span')).not.toBeInTheDocument();
  });

  it('applies the thinking pulse class in the thinking state', () => {
    render(<AIStatusIndicator state="thinking" />);
    const indicator = screen.getByTestId('ai-status-indicator');
    const svg = indicator.querySelector('svg');
    expect(svg?.getAttribute('class')).toContain('animate-pulse');
  });

  it('applies the error class in the error state', () => {
    render(<AIStatusIndicator state="error" />);
    const indicator = screen.getByTestId('ai-status-indicator');
    const svg = indicator.querySelector('svg');
    expect(svg?.getAttribute('class')).toContain('text-red-600');
  });

  it('passes className to the root element', () => {
    render(<AIStatusIndicator state="idle" className="my-custom-class" />);
    expect(screen.getByTestId('ai-status-indicator').className).toContain('my-custom-class');
  });
});
