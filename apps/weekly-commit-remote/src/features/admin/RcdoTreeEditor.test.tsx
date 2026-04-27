import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RcdoTreeEditor } from './RcdoTreeEditor.js';
import { renderWithProviders } from '../../test-utils.js';

const treeWithOneRC = {
  rallyCries: [
    {
      id: '01RCID000000000000000000AA',
      title: 'Win the SMB segment',
      description: '',
      displayOrder: 0,
      archivedAt: null,
      definingObjectives: [],
    },
  ],
};

const handlers = [
  http.get('http://localhost:8080/api/v1/rcdo/tree', () =>
    HttpResponse.json({ rallyCries: [] }),
  ),
];

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('RcdoTreeEditor', () => {
  it('shows empty state when no rally cries exist', async () => {
    renderWithProviders(<RcdoTreeEditor />, 'ADMIN');
    expect(await screen.findByTestId('rcdo-empty')).toBeInTheDocument();
  });

  it('renders rally cries from the API and reports DO counts', async () => {
    server.use(
      http.get('http://localhost:8080/api/v1/rcdo/tree', () =>
        HttpResponse.json(treeWithOneRC),
      ),
    );
    renderWithProviders(<RcdoTreeEditor />, 'ADMIN');
    expect(await screen.findByText('Win the SMB segment')).toBeInTheDocument();
    expect(
      screen.getByText(/0 Defining Objectives.*0 Outcomes.*0 Supporting/),
    ).toBeInTheDocument();
  });

  it('rejects titles shorter than 5 chars without hitting the API', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RcdoTreeEditor />, 'ADMIN');
    const input = await screen.findByTestId('new-rally-cry-input');
    await user.type(input, 'abc');
    await user.click(screen.getByTestId('create-rally-cry'));
    expect(await screen.findByTestId('rcdo-error')).toHaveTextContent(/at least 5 characters/);
  });

  it('surfaces a 409 conflict from the backend', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('http://localhost:8080/api/v1/admin/rally-cries', () =>
        HttpResponse.json(
          { type: 'about:blank', title: 'ILLEGAL_STATE', status: 409 },
          { status: 409 },
        ),
      ),
    );
    renderWithProviders(<RcdoTreeEditor />, 'ADMIN');
    const input = await screen.findByTestId('new-rally-cry-input');
    await user.type(input, 'A duplicate title');
    await user.click(screen.getByTestId('create-rally-cry'));
    await waitFor(() => {
      expect(screen.getByTestId('rcdo-error')).toHaveTextContent(/already exists/);
    });
  });

  it('surfaces a 403 forbidden from the backend', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('http://localhost:8080/api/v1/admin/rally-cries', () =>
        HttpResponse.json({ status: 403 }, { status: 403 }),
      ),
    );
    renderWithProviders(<RcdoTreeEditor />, 'ADMIN');
    const input = await screen.findByTestId('new-rally-cry-input');
    await user.type(input, 'Another title here');
    await user.click(screen.getByTestId('create-rally-cry'));
    await waitFor(() => {
      expect(screen.getByTestId('rcdo-error')).toHaveTextContent(/Only ADMIN users/);
    });
  });

  it('archive button triggers DELETE and reports 409 conflict', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('http://localhost:8080/api/v1/rcdo/tree', () =>
        HttpResponse.json(treeWithOneRC),
      ),
      http.delete('http://localhost:8080/api/v1/admin/rally-cries/:id', () =>
        HttpResponse.json({ status: 409 }, { status: 409 }),
      ),
    );
    renderWithProviders(<RcdoTreeEditor />, 'ADMIN');
    const archiveBtn = await screen.findByTestId('archive-rc-01RCID000000000000000000AA');
    await user.click(archiveBtn);
    await waitFor(() => {
      expect(screen.getByTestId('rcdo-error')).toHaveTextContent(
        /active Defining Objectives/,
      );
    });
  });

  it('renders an error state when the tree query fails', async () => {
    server.use(
      http.get('http://localhost:8080/api/v1/rcdo/tree', () =>
        HttpResponse.json({ status: 500 }, { status: 500 }),
      ),
    );
    renderWithProviders(<RcdoTreeEditor />, 'ADMIN');
    expect(await screen.findByText(/Failed to load RCDO tree/)).toBeInTheDocument();
  });

  it('does not blow up the loading state', async () => {
    // Slow handler so the initial render shows the spinner.
    server.use(
      http.get('http://localhost:8080/api/v1/rcdo/tree', async () => {
        await new Promise((r) => setTimeout(r, 10));
        return HttpResponse.json({ rallyCries: [] });
      }),
    );
    renderWithProviders(<RcdoTreeEditor />, 'ADMIN');
    expect(screen.getByText(/Loading RCDO tree/)).toBeInTheDocument();
    await screen.findByTestId('rcdo-empty');
  });

  it('successful create clears the input', async () => {
    const user = userEvent.setup();
    let createCount = 0;
    server.use(
      http.post('http://localhost:8080/api/v1/admin/rally-cries', () => {
        createCount += 1;
        return HttpResponse.json(
          {
            id: '01NEW00000000000000000000A',
            title: 'A brand new rally cry',
            description: null,
            displayOrder: 0,
            archivedAt: null,
            definingObjectives: [],
          },
          { status: 201 },
        );
      }),
    );
    renderWithProviders(<RcdoTreeEditor />, 'ADMIN');
    const input = await screen.findByTestId('new-rally-cry-input');
    await user.type(input, 'A brand new rally cry');
    await user.click(screen.getByTestId('create-rally-cry'));
    await waitFor(() => expect(createCount).toBe(1));
    await waitFor(() => expect((input as HTMLInputElement).value).toBe(''));
  });

  it('renders generic error message on unknown failure', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('http://localhost:8080/api/v1/admin/rally-cries', () =>
        HttpResponse.error(),
      ),
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderWithProviders(<RcdoTreeEditor />, 'ADMIN');
    const input = await screen.findByTestId('new-rally-cry-input');
    await user.type(input, 'Unknown failure title');
    await user.click(screen.getByTestId('create-rally-cry'));
    await waitFor(() => {
      expect(screen.getByTestId('rcdo-error')).toHaveTextContent(/Could not create/);
    });
  });
});
