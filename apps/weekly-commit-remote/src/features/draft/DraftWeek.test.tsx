import { describe, expect, it, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CommitDto, WeekDto } from '@throughline/shared-types';
import { renderWithProviders } from '../../test-utils.js';
import { DraftWeek } from './DraftWeek.js';

const so = {
  id: 'so-x',
  outcomeId: 'o',
  title: 'SO X',
  displayOrder: 0,
};

const tree = {
  rallyCries: [
    {
      id: 'rc',
      title: 'RC',
      displayOrder: 0,
      definingObjectives: [
        {
          id: 'do',
          rallyCryId: 'rc',
          title: 'DO',
          displayOrder: 0,
          outcomes: [
            {
              id: 'o',
              definingObjectiveId: 'do',
              title: 'O',
              displayOrder: 0,
              supportingOutcomes: [so],
            },
          ],
        },
      ],
    },
  ],
};

const week: WeekDto = {
  id: 'w1',
  userId: 'u1',
  orgId: 'o1',
  weekStart: '2026-04-20',
  state: 'DRAFT',
  lockedAt: null,
  reconciledAt: null,
  commits: [],
};

const commit: CommitDto = {
  id: 'c1',
  weekId: 'w1',
  text: 'Ship it',
  supportingOutcomeId: 'so-x',
  category: 'STRATEGIC',
  priority: 'MUST',
  displayOrder: 0,
  state: 'ACTIVE',
  parentCommitId: null,
  reconciliationOutcome: null,
  reconciliationNote: null,
  carryForwardWeeks: 0,
};

const server = setupServer(
  http.get('http://localhost:8080/api/v1/rcdo/tree', () => HttpResponse.json(tree)),
  http.post('http://localhost:8080/api/v1/commits', () =>
    HttpResponse.json(commit, { status: 201 }),
  ),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('DraftWeek', () => {
  it('renders the empty draft state with the lock button disabled', () => {
    renderWithProviders(<DraftWeek week={week} />);
    expect(screen.getByTestId('draft-week')).toBeInTheDocument();
    expect(screen.getByTestId('open-lock-dialog')).toBeDisabled();
  });

  it('opens the lock dialog when the lock button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DraftWeek week={{ ...week, commits: [commit] }} />);
    await user.click(screen.getByTestId('open-lock-dialog'));
    expect(screen.getByTestId('lock-week-dialog')).toBeInTheDocument();
  });

  it('hides the composer and shows the cap notice at 7 commits', () => {
    const seven = Array.from({ length: 7 }, (_, i) => ({ ...commit, id: `c${i}` }));
    renderWithProviders(<DraftWeek week={{ ...week, commits: seven }} />);
    expect(screen.getByTestId('commit-cap-notice')).toBeInTheDocument();
    expect(screen.queryByTestId('commit-form')).not.toBeInTheDocument();
  });

  it('submits a new commit through the create mutation', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DraftWeek week={week} />);
    await waitFor(() => expect(screen.getByTestId('commit-so-select')).toBeInTheDocument());
    await user.type(screen.getByTestId('commit-text-input'), 'Plan something useful');
    await user.selectOptions(screen.getByTestId('commit-so-select'), 'so-x');
    await user.click(screen.getByTestId('commit-form-submit'));
    // Successful submit clears the text input.
    await waitFor(() =>
      expect((screen.getByTestId('commit-text-input') as HTMLInputElement).value).toBe(''),
    );
  });

  it('surfaces the 7-commit cap server error', async () => {
    server.use(
      http.post('http://localhost:8080/api/v1/commits', () =>
        HttpResponse.json({ title: 'ILLEGAL_STATE' }, { status: 409 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<DraftWeek week={week} />);
    await waitFor(() => expect(screen.getByTestId('commit-so-select')).toBeInTheDocument());
    await user.type(screen.getByTestId('commit-text-input'), 'Another commit text');
    await user.selectOptions(screen.getByTestId('commit-so-select'), 'so-x');
    await user.click(screen.getByTestId('commit-form-submit'));
    await waitFor(() =>
      expect(screen.getByTestId('commit-form-error').textContent).toContain('7-commit cap'),
    );
  });
});
