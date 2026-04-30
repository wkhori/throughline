import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SlackIcon } from './SlackIcon.js';

describe('SlackIcon', () => {
  it('renders an svg with the requested size', () => {
    const { container } = render(<SlackIcon size={20} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('width')).toBe('20');
    expect(svg?.getAttribute('height')).toBe('20');
  });

  it('defaults to size 14 when none passed', () => {
    const { container } = render(<SlackIcon />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('14');
  });

  it('forwards className to the root svg', () => {
    const { container } = render(<SlackIcon className="foo" />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('class')).toBe('foo');
  });

  it('renders four colored hash bars', () => {
    const { container } = render(<SlackIcon />);
    const paths = container.querySelectorAll('path');
    expect(paths).toHaveLength(4);
    const fills = Array.from(paths).map((p) => p.getAttribute('fill'));
    // The four canonical Slack hash colours.
    expect(fills).toContain('#E01E5A');
    expect(fills).toContain('#36C5F0');
    expect(fills).toContain('#2EB67D');
    expect(fills).toContain('#ECB22E');
  });
});
