import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test-utils.js';
import { ManagerDashboard } from './ManagerDashboard.js';

const samplePayload = {
  teamId: 't1',
  teamName: 'Growth Eng',
  weekStart: '2026-04-20',
  memberCount: 6,
  lockedCount: 5,
  reconciledCount: 30,
  doneCount: 18,
  partialCount: 8,
  notDoneCount: 4,
  carryForwardCount: 2,
  commitsByOutcome: [{ outcomeId: 'o1', outcomeTitle: 'Improve activation', share: 1 }],
  starvedOutcomes: [
    { outcomeId: 'o9', outcomeTitle: 'Expand enterprise pipeline Q2', weeksStarved: 2 },
  ],
  driftExceptions: [
    {
      rallyCryId: 'rc1',
      rallyCryTitle: 'Operate at enterprise reliability bar',
      observedShare: 0.65,
      expectedLow: 0.3,
      expectedHigh: 0.5,
    },
  ],
  exceptionRibbon: [
    {
      kind: 'LONG_CARRY_FORWARD',
      severity: 'HIGH',
      label: 'Sarah Mendez carry-forwarded 4 weeks running',
      entityType: 'commit',
      entityId: 'c1',
    },
  ],
};

const server = setupServer(
  http.get('http://localhost:8080/api/v1/manager/team-rollup', () =>
    HttpResponse.json({
      content: [
        {
          teamId: 't1',
          weekStart: '2026-04-20',
          payload: samplePayload,
          computedAt: '2026-04-20T12:00:00Z',
        },
      ],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 50,
    }),
  ),
  http.get('http://localhost:8080/api/v1/manager/digest/current', () =>
    HttpResponse.json({ digest: null, state: 'AWAITING_AI' }),
  ),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('ManagerDashboard', () => {
  it('renders the four dashboard regions on success', async () => {
    renderWithProviders(<ManagerDashboard />, 'MANAGER');
    await waitFor(() => expect(screen.getByTestId('manager-dashboard')).toBeInTheDocument());
    expect(screen.getByTestId('manager-digest-hero')).toBeInTheDocument();
    expect(screen.getByTestId('starved-outcomes-panel')).toBeInTheDocument();
    expect(screen.getByTestId('drift-exceptions-panel')).toBeInTheDocument();
    expect(screen.getByTestId('exception-ribbon')).toBeInTheDocument();
    expect(screen.getByTestId('team-member-table')).toBeInTheDocument();
  });

  it('shows the placeholder when digest is null', async () => {
    renderWithProviders(<ManagerDashboard />, 'MANAGER');
    await waitFor(() =>
      expect(screen.getByTestId('manager-digest-placeholder')).toBeInTheDocument(),
    );
  });

  it('starved-outcomes panel surfaces seeded dysfunction', async () => {
    renderWithProviders(<ManagerDashboard />, 'MANAGER');
    await waitFor(() =>
      expect(screen.getByTestId('starved-outcome-row')).toHaveTextContent(
        'Expand enterprise pipeline Q2',
      ),
    );
    expect(screen.getByTestId('starved-outcome-badge')).toHaveTextContent('starved 2 weeks');
  });

  it('drift-exceptions panel renders observed vs expected band', async () => {
    renderWithProviders(<ManagerDashboard />, 'MANAGER');
    await waitFor(() => expect(screen.getByTestId('drift-exception-row')).toBeInTheDocument());
    expect(screen.getByTestId('drift-exception-row')).toHaveTextContent(
      'Operate at enterprise reliability bar',
    );
  });

  it('exception ribbon includes long-carry-forward entries', async () => {
    renderWithProviders(<ManagerDashboard />, 'MANAGER');
    await waitFor(() =>
      expect(screen.getByTestId('ribbon-item')).toHaveTextContent('carry-forwarded 4 weeks'),
    );
  });

  it('shows skeleton placeholders while loading', async () => {
    server.use(
      http.get('http://localhost:8080/api/v1/manager/team-rollup', async () => {
        await new Promise((r) => setTimeout(r, 50));
        return HttpResponse.json({
          content: [],
          totalElements: 0,
          totalPages: 0,
          number: 0,
          size: 50,
        });
      }),
    );
    renderWithProviders(<ManagerDashboard />, 'MANAGER');
    expect(screen.getByTestId('manager-dashboard-loading')).toBeInTheDocument();
  });

  it('renders an error banner when the team-rollup query fails', async () => {
    server.use(
      http.get('http://localhost:8080/api/v1/manager/team-rollup', () =>
        HttpResponse.json({ title: 'BOOM' }, { status: 500 }),
      ),
    );
    renderWithProviders(<ManagerDashboard />, 'MANAGER');
    await waitFor(() => expect(screen.getByTestId('manager-dashboard-error')).toBeInTheDocument());
  });
});
