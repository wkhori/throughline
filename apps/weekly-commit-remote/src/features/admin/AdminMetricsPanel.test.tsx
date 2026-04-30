import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test-utils.js';
import { AdminMetricsPanel } from './AdminMetricsPanel.js';

const server = setupServer(
  http.get('http://localhost:8080/api/v1/metrics/org', () =>
    HttpResponse.json({
      planningCompletionRate: 0.72,
      reconciliationStrictPct: 0.55,
      reconciliationWeightedPct: 0.71,
      avgManagerDigestViewMinutesAfterDeliver: 14.4,
      planningSessionMinutesP50: 38,
    }),
  ),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('AdminMetricsPanel', () => {
  it('renders five metric cards from /metrics/org', async () => {
    renderWithProviders(<AdminMetricsPanel />, 'ADMIN');
    await waitFor(() => expect(screen.getByTestId('admin-metrics-panel')).toBeInTheDocument());
    expect(screen.getByTestId('metric-card-planning-completion')).toHaveTextContent('72%');
    expect(screen.getByTestId('metric-card-reconciliation-strict')).toHaveTextContent('55%');
    expect(screen.getByTestId('metric-card-reconciliation-weighted')).toHaveTextContent('71%');
    expect(screen.getByTestId('metric-card-digest-read-latency')).toHaveTextContent('14m');
    expect(screen.getByTestId('metric-card-planning-session-p50')).toHaveTextContent('38m');
  });

  it('renders an error banner when /metrics/org fails', async () => {
    server.use(
      http.get('http://localhost:8080/api/v1/metrics/org', () =>
        HttpResponse.json({ title: 'BOOM' }, { status: 500 }),
      ),
    );
    renderWithProviders(<AdminMetricsPanel />, 'ADMIN');
    await waitFor(() => expect(screen.getByTestId('metrics-error')).toBeInTheDocument());
  });

  it('renders an empty-state label when digest latency is zero', async () => {
    server.use(
      http.get('http://localhost:8080/api/v1/metrics/org', () =>
        HttpResponse.json({
          planningCompletionRate: 0.5,
          reconciliationStrictPct: 0.5,
          reconciliationWeightedPct: 0.5,
          avgManagerDigestViewMinutesAfterDeliver: 0,
          planningSessionMinutesP50: 0,
        }),
      ),
    );
    renderWithProviders(<AdminMetricsPanel />, 'ADMIN');
    await waitFor(() =>
      expect(screen.getByTestId('metric-card-digest-read-latency')).toHaveTextContent(
        'No data yet',
      ),
    );
  });
});
