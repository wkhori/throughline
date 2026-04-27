import { describe, expect, it } from 'vitest';
import { Provider } from 'react-redux';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiBaseUrlProvider } from '@throughline/shared-ui';
import { App } from './App.js';
import { store } from './store.js';

const renderApp = () =>
  render(
    <Provider store={store}>
      <ApiBaseUrlProvider value="http://localhost:8080">
        <App />
      </ApiBaseUrlProvider>
    </Provider>,
  );

describe('host App', () => {
  it('shows the persona switcher in stub mode', () => {
    renderApp();
    expect(screen.getByRole('region', { name: /Demo persona switcher/i })).toBeInTheDocument();
    expect(screen.getByTestId('persona-ic')).toBeInTheDocument();
    expect(screen.getByTestId('persona-manager')).toBeInTheDocument();
    expect(screen.getByTestId('persona-admin')).toBeInTheDocument();
  });

  it('clicking a persona populates the auth slice display name in the header', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByTestId('persona-manager'));
    expect(screen.getAllByText(/Demo Manager/).length).toBeGreaterThan(0);
  });

  it('Sign out clears the displayed identity', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByTestId('persona-admin'));
    expect(screen.getAllByText(/Demo Admin/).length).toBeGreaterThan(0);
    await user.click(screen.getByText(/Sign out/));
    expect(screen.getByText(/Not signed in/)).toBeInTheDocument();
  });
});
