// Standalone dev entry — `vite --port 5174` mounts the remote on its own
// route so it's testable in isolation. The host federates this same module.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { ApiBaseUrlProvider } from '@throughline/shared-ui';
import { WeeklyCommitApp } from './WeeklyCommitApp.js';
import { PersonaSwitcher } from './PersonaSwitcher.js';
import { buildRemoteStore } from './store.js';
import '@throughline/shared-ui/styles/tokens.css';

const store = buildRemoteStore();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('weekly-commit-remote: #root element missing');

createRoot(rootEl).render(
  <StrictMode>
    <Provider store={store}>
      <ApiBaseUrlProvider value={import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'}>
        <PersonaSwitcher />
        <WeeklyCommitApp />
      </ApiBaseUrlProvider>
    </Provider>
  </StrictMode>,
);
