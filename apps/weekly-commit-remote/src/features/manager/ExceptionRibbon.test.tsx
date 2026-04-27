import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExceptionRibbon } from './ExceptionRibbon.js';
import type { RibbonEntry } from '../../api/managerEndpoints.js';

afterEach(cleanup);

const items: RibbonEntry[] = [
  {
    kind: 'LONG_CARRY_FORWARD',
    severity: 'HIGH',
    label: 'Sarah Mendez carry-forwarded 4 weeks',
    entityType: 'commit',
    entityId: 'c1',
  },
  {
    kind: 'PRIORITY_DRIFT',
    severity: 'MEDIUM',
    label: 'Platform Reliability concentrated 65%',
    entityType: 'rally_cry',
    entityId: 'rc1',
  },
];

describe('ExceptionRibbon', () => {
  it('renders nothing when items is empty', () => {
    const { container } = render(<ExceptionRibbon items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders one row per item with severity pill', () => {
    render(<ExceptionRibbon items={items} />);
    expect(screen.getAllByTestId('ribbon-item')).toHaveLength(2);
    expect(screen.getAllByTestId('ribbon-severity')[0]).toHaveTextContent('HIGH');
  });

  it('invokes onDrillDown with the entry on click', async () => {
    const onDrillDown = vi.fn();
    render(<ExceptionRibbon items={items} onDrillDown={onDrillDown} />);
    await userEvent.click(screen.getAllByTestId('ribbon-drilldown')[0]!);
    expect(onDrillDown).toHaveBeenCalledWith(items[0]);
  });

  it('omits the drill-down button when no callback is supplied', () => {
    render(<ExceptionRibbon items={items} />);
    expect(screen.queryByTestId('ribbon-drilldown')).toBeNull();
  });
});
