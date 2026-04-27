import { describe, expect, it, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test-utils.js';
import { AlignmentDeltaCard } from './AlignmentDeltaCard.js';

const okPayload = {
  id: 'i1',
  kind: 'T4_DELTA',
  model: 'sonnet-4.6',
  payload: {
    summary: '4 done, 1 partial',
    shipped: [{ commitId: 'cccccccc-1', parentOutcomeId: null }],
    slipped: [{ commitId: 'cccccccc-2', slipCause: 'capacity', evidence: 'partial — short week' }],
    carryForwardRecommendations: [
      { commitId: 'cccccccc-2', action: 'carry_forward', rationale: 'first slip' },
    ],
  },
  latencyMs: 12,
  costCents: '1.97',
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('AlignmentDeltaCard', () => {
  it('renders nothing when the API returns null (insight not yet posted)', async () => {
    server.use(
      http.get('http://localhost:8080/api/v1/ai/alignment-delta/:weekId', () =>
        HttpResponse.json(null),
      ),
    );
    const { container } = renderWithProviders(<AlignmentDeltaCard weekId="w1" />);
    await waitFor(() =>
      expect(screen.queryByTestId('alignment-delta-loading')).not.toBeInTheDocument(),
    );
    expect(screen.queryByTestId('alignment-delta-card')).not.toBeInTheDocument();
    expect(container.querySelector('[data-testid="alignment-delta-card"]')).toBeNull();
  });

  it('renders the headline and lists when the insight is present', async () => {
    server.use(
      http.get('http://localhost:8080/api/v1/ai/alignment-delta/:weekId', () =>
        HttpResponse.json(okPayload),
      ),
    );
    renderWithProviders(<AlignmentDeltaCard weekId="w1" />);
    await waitFor(() =>
      expect(screen.getByTestId('alignment-delta-card')).toBeInTheDocument(),
    );
    expect(screen.getByText(/4 done, 1 partial/)).toBeInTheDocument();
    expect(screen.getByText(/Shipped/)).toBeInTheDocument();
    expect(screen.getByText(/Slipped/)).toBeInTheDocument();
    expect(screen.getByText(/Carry-forward/)).toBeInTheDocument();
  });
});
