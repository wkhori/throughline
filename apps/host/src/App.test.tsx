import { describe, expect, it } from 'vitest';
import { Provider } from 'react-redux';
import { render, screen } from '@testing-library/react';
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
  it('renders the marketing landing page at /', () => {
    window.history.pushState({}, '', '/');
    renderApp();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('exposes a Launch demo entry point on the landing page', () => {
    window.history.pushState({}, '', '/');
    renderApp();
    expect(screen.getAllByText(/Launch demo/i).length).toBeGreaterThan(0);
  });
});
