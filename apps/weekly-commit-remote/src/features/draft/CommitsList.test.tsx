import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { screen, waitFor } from '@testing-library/react';
import type { CommitDto, RcdoTreeDto } from '@throughline/shared-types';
import { renderWithProviders as render } from '../../test-utils.js';
import { CommitsList } from './CommitsList.js';

const tree: RcdoTreeDto = {
  rallyCries: [
    {
      id: 'rc1',
      title: 'Win the SMB segment',
      displayOrder: 0,
      definingObjectives: [
        {
          id: 'do1',
          rallyCryId: 'rc1',
          title: 'Grow ARR',
          displayOrder: 0,
          outcomes: [
            {
              id: 'o1',
              definingObjectiveId: 'do1',
              title: 'Pipeline',
              displayOrder: 0,
              supportingOutcomes: [
                { id: 'so-a', outcomeId: 'o1', title: 'Outcome A', displayOrder: 0 },
                { id: 'so-b', outcomeId: 'o1', title: 'Outcome B', displayOrder: 1 },
              ],
            },
          ],
        },
      ],
    },
  ],
};

const c = (id: string, soId: string | null, priority: 'MUST' | 'SHOULD' | 'COULD'): CommitDto => ({
  id,
  weekId: 'w1',
  text: `commit ${id}`,
  supportingOutcomeId: soId,
  category: 'STRATEGIC',
  priority,
  displayOrder: 0,
  state: 'ACTIVE',
  parentCommitId: null,
  reconciliationOutcome: null,
  reconciliationNote: null,
  carryForwardWeeks: 0,
});

const URL = 'http://localhost:8080/api/v1/ai/insights/batch';

const server = setupServer(http.post(URL, () => HttpResponse.json({ insights: [] })));

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('CommitsList', () => {
  it('renders one group per Supporting Outcome with the breadcrumb header', async () => {
    const commits = [c('1', 'so-a', 'MUST'), c('2', 'so-b', 'COULD')];
    render(<CommitsList commits={commits} rcdo={tree} weekState="DRAFT" />);
    const groups = await screen.findAllByTestId('so-group');
    expect(groups).toHaveLength(2);
    // Outcome A group rendered first (higher priority share).
    expect(groups[0]!.getAttribute('data-so-id')).toBe('so-a');
    expect(groups[1]!.getAttribute('data-so-id')).toBe('so-b');
  });

  it('sorts groups by descending priority-weighted effort share', () => {
    // Group X = 2 MUST = 6 points; Group Y = 3 COULD = 3 points.
    const commits = [
      c('x1', 'so-b', 'MUST'),
      c('x2', 'so-b', 'MUST'),
      c('y1', 'so-a', 'COULD'),
      c('y2', 'so-a', 'COULD'),
      c('y3', 'so-a', 'COULD'),
    ];
    render(<CommitsList commits={commits} rcdo={tree} weekState="DRAFT" />);
    const groups = screen.getAllByTestId('so-group');
    expect(groups[0]!.getAttribute('data-so-id')).toBe('so-b');
    expect(groups[1]!.getAttribute('data-so-id')).toBe('so-a');
  });

  it('renders a drift badge on rows where the batch endpoint returned a drift verdict', async () => {
    server.use(
      http.post(URL, () =>
        HttpResponse.json({
          insights: [
            {
              id: 'i1',
              kind: 'T2_DRIFT',
              model: 'haiku',
              latencyMs: 12,
              costCents: '0.0001',
              entityId: '1',
              payload: {
                alignmentVerdict: 'unrelated',
                driftScore: 0.9,
                fixSuggestion: 'Re-link to Outcome B',
              },
            },
          ],
        }),
      ),
    );
    const commits = [c('1', 'so-a', 'MUST'), c('2', 'so-a', 'MUST')];
    render(<CommitsList commits={commits} rcdo={tree} weekState="DRAFT" />);
    await waitFor(() => {
      const driftBadges = screen.getAllByTestId('drift-badge');
      expect(driftBadges).toHaveLength(1);
    });
    const driftedRow = screen
      .getAllByTestId('commit-row')
      .find((r) => r.getAttribute('data-commit-id') === '1');
    expect(driftedRow?.getAttribute('data-drift')).toBe('true');
  });

  it('filters out CARRIED_FORWARD commits — they are owned by the ghost row', () => {
    const commits = [
      c('a', 'so-a', 'MUST'),
      { ...c('ghost', 'so-a', 'MUST'), state: 'CARRIED_FORWARD' as const },
    ];
    render(<CommitsList commits={commits} rcdo={tree} weekState="DRAFT" />);
    const rows = screen.getAllByTestId('commit-row');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.getAttribute('data-commit-id')).toBe('a');
  });

  it('shows an empty state when there are no active commits', () => {
    render(<CommitsList commits={[]} rcdo={tree} weekState="DRAFT" />);
    expect(screen.getByTestId('commits-list').textContent).toMatch(/no commits/i);
  });
});
