import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test-utils.js';
import { ExceptionRibbon } from './ExceptionRibbon.js';
import type { RibbonEntry } from '../../api/managerEndpoints.js';

const items: RibbonEntry[] = [
  {
    kind: 'LONG_CARRY_FORWARD',
    severity: 'HIGH',
    label: 'Sarah Mendez carry-forwarded 4 weeks',
    entityType: 'commit',
    entityId: 'c1',
    alignmentRiskId: '01J0RISK0000000000000000A',
  },
  {
    kind: 'PRIORITY_DRIFT',
    severity: 'MEDIUM',
    label: 'Platform Reliability concentrated 65%',
    entityType: 'rally_cry',
    entityId: 'rc1',
  },
];

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());

describe('ExceptionRibbon', () => {
  it('renders nothing when items is empty', () => {
    const { container } = renderWithProviders(<ExceptionRibbon items={[]} />, 'MANAGER');
    expect(container.querySelector('[data-testid="exception-ribbon"]')).toBeNull();
  });

  it('renders one row per item with severity pill', () => {
    renderWithProviders(<ExceptionRibbon items={items} />, 'MANAGER');
    expect(screen.getAllByTestId('ribbon-item')).toHaveLength(2);
    expect(screen.getAllByTestId('ribbon-severity')[0]).toHaveTextContent('HIGH');
  });

  it('invokes onDrillDown with the entry on click', async () => {
    const onDrillDown = vi.fn();
    renderWithProviders(<ExceptionRibbon items={items} onDrillDown={onDrillDown} />, 'MANAGER');
    await userEvent.click(screen.getAllByTestId('ribbon-drilldown')[0]!);
    expect(onDrillDown).toHaveBeenCalledWith(items[0]);
  });

  it('omits the drill-down button when no callback is supplied', () => {
    renderWithProviders(<ExceptionRibbon items={items} />, 'MANAGER');
    expect(screen.queryByTestId('ribbon-drilldown')).toBeNull();
  });

  it('acks the alignment risk on success and clears the error state', async () => {
    let calls = 0;
    server.use(
      http.post(
        'http://localhost:8080/api/v1/manager/alignment-risks/01J0RISK0000000000000000A/ack',
        () => {
          calls += 1;
          return new HttpResponse(null, { status: 204 });
        },
      ),
    );
    renderWithProviders(<ExceptionRibbon items={items} />, 'MANAGER');
    await userEvent.click(screen.getByTestId('ribbon-ack'));
    await waitFor(() => expect(calls).toBe(1));
    expect(screen.queryByTestId('ribbon-ack-error')).toBeNull();
  });

  it('shows a 4xx ack-error toast when the ack endpoint rejects', async () => {
    server.use(
      http.post(
        'http://localhost:8080/api/v1/manager/alignment-risks/01J0RISK0000000000000000A/ack',
        () => HttpResponse.json({ title: 'forbidden' }, { status: 403 }),
      ),
    );
    renderWithProviders(<ExceptionRibbon items={items} />, 'MANAGER');
    await userEvent.click(screen.getByTestId('ribbon-ack'));
    await waitFor(() =>
      expect(screen.getByTestId('ribbon-ack-error')).toHaveTextContent('Ack failed'),
    );
  });
});
