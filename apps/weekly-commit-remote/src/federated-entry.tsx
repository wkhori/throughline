import { Provider } from 'react-redux';
import { ApiBaseUrlProvider } from '@throughline/shared-ui';
import { WeeklyCommitApp } from './WeeklyCommitApp.js';
import { PersonaSwitcher } from './PersonaSwitcher.js';
import { buildRemoteStore } from './store.js';
import '@throughline/shared-ui/styles/tokens.css';

const store = buildRemoteStore();

export default function WeeklyCommitFederatedApp() {
  return (
    <Provider store={store}>
      <ApiBaseUrlProvider value={import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'}>
        <PersonaSwitcher />
        <WeeklyCommitApp />
      </ApiBaseUrlProvider>
    </Provider>
  );
}
