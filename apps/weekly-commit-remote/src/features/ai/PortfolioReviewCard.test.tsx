import { describe, expect, it, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test-utils.js';
import { PortfolioReviewCard } from './PortfolioReviewCard.js';

const okPayload = {
  id: 'i1',
  kind: 'T3_PORTFOLIO',
  model: 'sonnet-4.6',
  payload: {
    headline: 'SMB starved this week.',
    overallSeverity: 'warning',
    findings: [
      {
        dimension: 'outcome_concentration',
        severity: 'warning',
        message: '60% of commits target a single SO.',
      },
    ],
  },
  latencyMs: 18,
  costCents: '1.43',
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('PortfolioReviewCard', () => {
  it('shows the empty state with a generate CTA when the API returns null', async () => {
    server.use(
      http.get('http://localhost:8080/api/v1/ai/portfolio-review/:weekId', () =>
        HttpResponse.json(null),
      ),
    );
    renderWithProviders(<PortfolioReviewCard weekId="w1" />);
    await waitFor(() => expect(screen.getByTestId('portfolio-review-empty')).toBeInTheDocument());
    expect(screen.getByText(/Generate review/)).toBeInTheDocument();
  });

  it('renders the headline and findings when the insight is present', async () => {
    server.use(
      http.get('http://localhost:8080/api/v1/ai/portfolio-review/:weekId', () =>
        HttpResponse.json(okPayload),
      ),
    );
    renderWithProviders(<PortfolioReviewCard weekId="w1" />);
    await waitFor(() =>
      expect(screen.getByTestId('portfolio-review-card')).toBeInTheDocument(),
    );
    expect(screen.getByText('SMB starved this week.')).toBeInTheDocument();
    expect(screen.getByText(/60% of commits/)).toBeInTheDocument();
  });
});
