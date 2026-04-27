import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InsightDrillDown } from './InsightDrillDown.js';

describe('InsightDrillDown', () => {
  it('renders nothing when entities is empty', () => {
    render(<InsightDrillDown entities={[]} />);
    expect(screen.queryByTestId('insight-drill-down')).not.toBeInTheDocument();
  });

  it('renders a trigger per entity with the right data attributes', () => {
    render(
      <InsightDrillDown
        entities={[
          { entityType: 'commit', entityId: 'c1', label: 'Ship onboarding emails' },
          { entityType: 'supporting_outcome', entityId: 'so1', label: 'Reduce churn' },
        ]}
      />,
    );
    const triggers = screen.getAllByTestId('insight-drill-trigger');
    expect(triggers).toHaveLength(2);
    expect(triggers[0]?.getAttribute('data-entity-type')).toBe('commit');
    expect(triggers[1]?.getAttribute('data-entity-id')).toBe('so1');
  });

  it('clicking a trigger opens the drawer with the entity detail', async () => {
    const user = userEvent.setup();
    render(
      <InsightDrillDown
        entities={[{ entityType: 'commit', entityId: 'c1', label: 'Ship onboarding' }]}
      />,
    );
    expect(screen.queryByTestId('insight-drill-drawer')).not.toBeInTheDocument();
    await user.click(screen.getAllByTestId('insight-drill-trigger')[0]!);
    expect(screen.getByTestId('insight-drill-drawer')).toBeInTheDocument();
    expect(screen.getByTestId('insight-drill-detail-default').textContent).toContain('"c1"');
  });

  it('Escape closes the drawer', async () => {
    const user = userEvent.setup();
    render(
      <InsightDrillDown
        entities={[{ entityType: 'commit', entityId: 'c1', label: 'Ship onboarding' }]}
      />,
    );
    await user.click(screen.getAllByTestId('insight-drill-trigger')[0]!);
    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('insight-drill-drawer')).not.toBeInTheDocument();
  });

  it('uses renderDetail for custom drawer body', async () => {
    const user = userEvent.setup();
    render(
      <InsightDrillDown
        entities={[{ entityType: 'user', entityId: 'u1', label: 'Sarah Mendez' }]}
        renderDetail={(e) => <div data-testid="custom-detail">Detail for {e.entityId}</div>}
      />,
    );
    await user.click(screen.getAllByTestId('insight-drill-trigger')[0]!);
    expect(screen.getByTestId('custom-detail').textContent).toContain('Detail for u1');
  });

  it('uses renderTrigger for custom trigger element', () => {
    render(
      <InsightDrillDown
        entities={[{ entityType: 'team', entityId: 't1', label: 'Growth Eng' }]}
        renderTrigger={(_e, label) => <span data-testid="custom-trigger">{label}</span>}
      />,
    );
    expect(screen.getByTestId('custom-trigger').textContent).toBe('Growth Eng');
  });
});
