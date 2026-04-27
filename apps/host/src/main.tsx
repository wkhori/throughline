import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { ApiBaseUrlProvider } from '@throughline/shared-ui';
import { App } from './App.js';
import { store } from './store.js';
import '@throughline/shared-ui/styles/tokens.css';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('host: #root element missing from index.html');

createRoot(rootEl).render(
  <StrictMode>
    <Provider store={store}>
      <ApiBaseUrlProvider value={apiBaseUrl}>
        <App />
      </ApiBaseUrlProvider>
    </Provider>
  </StrictMode>,
);
