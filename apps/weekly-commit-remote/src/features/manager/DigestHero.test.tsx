import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test-utils.js';
import { DigestHero } from './DigestHero.js';

const okPayload = {
  alignmentHeadline:
    'Activation work dominated (62%); enterprise expansion received 0 commits this week.',
  starvedOutcomes: [
    {
      supportingOutcomeId: '01J0SO0000000000000000000A',
      title: 'Expand enterprise pipeline Q2',
      reason: 'zero commits across team for 2 weeks',
    },
  ],
  driftExceptions: [
    { userId: '01J0USER000000000000000001', displayName: 'Sarah Mendez', avgDriftScore: 0.62 },
  ],
  longCarryForwards: [
    {
      commitId: '01J0COMMIT00000000000000A',
      weeks: 4,
      commitText: 'Refactor billing service test suite',
    },
  ],
  drillDowns: [{ userId: '01J0USER000000000000000002', displayName: 'Jordan Kim', reason: '1:1' }],
  slackMessage: '*Activation dominated* this week — see <DASHBOARD_URL>.',
  reasoning: 'derived from rollup',
  model: 'claude-sonnet-4-6',
};

const server = setupServer(
  http.get('http://localhost:8080/api/v1/manager/digest/current', () =>
    HttpResponse.json({ digest: null, state: 'AWAITING_AI' }),
  ),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('DigestHero', () => {
  it('renders the AWAITING_AI variant with a regenerate button', async () => {
    renderWithProviders(<DigestHero />, 'MANAGER');
    await waitFor(() =>
      expect(screen.getByTestId('digest-state-badge')).toHaveTextContent('AWAITING_AI'),
    );
    expect(screen.getByTestId('digest-awaiting')).toBeInTheDocument();
    expect(screen.getByTestId('digest-regenerate')).toBeEnabled();
  });

  it('renders the OK variant with chips for every drill-down section', async () => {
    server.use(
      http.get('http://localhost:8080/api/v1/manager/digest/current', () =>
        HttpResponse.json({ digest: okPayload, state: 'OK' }),
      ),
    );
    renderWithProviders(<DigestHero />, 'MANAGER');
    await waitFor(() => expect(screen.getByTestId('digest-state-badge')).toHaveTextContent('OK'));
    expect(screen.getByTestId('digest-headline')).toHaveTextContent('Activation work dominated');
    expect(screen.getByTestId('digest-section-Starved outcomes')).toHaveTextContent('(1)');
    expect(screen.getByTestId('digest-section-Drift exceptions')).toHaveTextContent('(1)');
    expect(screen.getByTestId('digest-section-Long carry-forwards')).toHaveTextContent('(1)');
    expect(screen.getByTestId('digest-section-Recommended 1:1s')).toHaveTextContent('(1)');
  });

  it('renders the FALLBACK variant with the deterministic Slack message visible', async () => {
    server.use(
      http.get('http://localhost:8080/api/v1/manager/digest/current', () =>
        HttpResponse.json({
          digest: {
            ...okPayload,
            slackMessage: '*Weekly digest unavailable* — see <DASHBOARD_URL>.',
          },
          state: 'FALLBACK',
        }),
      ),
    );
    renderWithProviders(<DigestHero />, 'MANAGER');
    await waitFor(() =>
      expect(screen.getByTestId('digest-state-badge')).toHaveTextContent('FALLBACK'),
    );
    expect(screen.getByTestId('digest-fallback')).toHaveTextContent('Weekly digest unavailable');
  });

  it('opens an InsightDrillDown drawer when a chip is clicked', async () => {
    server.use(
      http.get('http://localhost:8080/api/v1/manager/digest/current', () =>
        HttpResponse.json({ digest: okPayload, state: 'OK' }),
      ),
      http.get('http://localhost:8080/api/v1/manager/team/:userId/week/current', () =>
        HttpResponse.json({
          id: '01J0WEEK0000000000000001',
          userId: '01J0USER000000000000000001',
          orgId: '01J0ORG000000000000000001',
          weekStart: '2026-04-20',
          state: 'RECONCILED',
          lockedAt: '2026-04-23T18:00:00Z',
          reconciledAt: '2026-04-25T18:00:00Z',
          commits: [],
        }),
      ),
    );
    renderWithProviders(<DigestHero />, 'MANAGER');
    await waitFor(() => expect(screen.getByTestId('digest-state-badge')).toHaveTextContent('OK'));

    // Locate the drift-exception chip (a `user` entity) and trigger the drawer.
    const triggers = screen.getAllByTestId('insight-drill-trigger');
    const userTrigger = triggers.find((el) => el.dataset.entityType === 'user');
    expect(userTrigger).toBeDefined();
    fireEvent.click(userTrigger!);

    const drawer = await screen.findByTestId('insight-drill-drawer');
    expect(drawer).toBeInTheDocument();
    await waitFor(() =>
      expect(within(drawer).getByTestId('digest-detail-week')).toHaveTextContent('RECONCILED'),
    );
  });

  it('regenerate button posts to the regenerate endpoint and surfaces a transient error', async () => {
    let calls = 0;
    server.use(
      http.post('http://localhost:8080/api/v1/manager/digest/regenerate', () => {
        calls += 1;
        return HttpResponse.json(
          { digest: null, state: 'AWAITING_AI', message: 'rate limited' },
          { status: 429 },
        );
      }),
    );
    renderWithProviders(<DigestHero />, 'MANAGER');
    const button = await screen.findByTestId('digest-regenerate');
    await userEvent.click(button);
    await waitFor(() => expect(calls).toBe(1));
    await waitFor(() =>
      expect(screen.getByTestId('digest-regenerate-error')).toBeInTheDocument(),
    );
  });

  it('dispatch-slack button POSTs and surfaces an ack on the OK variant', async () => {
    let calls = 0;
    server.use(
      http.get('http://localhost:8080/api/v1/manager/digest/current', () =>
        HttpResponse.json({ digest: okPayload, state: 'OK' }),
      ),
      http.post('http://localhost:8080/api/v1/manager/digest/dispatch-slack', () => {
        calls += 1;
        return new HttpResponse(null, { status: 202 });
      }),
    );
    renderWithProviders(<DigestHero />, 'MANAGER');
    const button = await screen.findByTestId('digest-dispatch-slack');
    await userEvent.click(button);
    await waitFor(() => expect(calls).toBe(1));
    await waitFor(() =>
      expect(screen.getByTestId('digest-dispatch-ack')).toBeInTheDocument(),
    );
  });

  it('chipsFor coerces missing displayName + 0-week carry-forwards into clean labels', async () => {
    const oddPayload = {
      ...okPayload,
      driftExceptions: [{ userId: '01J0USER000000000000000003', displayName: '' }],
      longCarryForwards: [
        { commitId: '01J0COMMIT00000000000000B', weeks: 0, commitText: 'Edge case' },
      ],
      drillDowns: [{ userId: '01J0USER000000000000000004' }],
    };
    server.use(
      http.get('http://localhost:8080/api/v1/manager/digest/current', () =>
        HttpResponse.json({ digest: oddPayload, state: 'OK' }),
      ),
    );
    renderWithProviders(<DigestHero />, 'MANAGER');
    await waitFor(() =>
      expect(screen.getByTestId('digest-state-badge')).toHaveTextContent('OK'),
    );
    const userChips = screen.getAllByText(/User #01J0USER/);
    expect(userChips.length).toBeGreaterThan(0);
    expect(screen.getByText(/Edge case/)).toBeInTheDocument();
  });
});
