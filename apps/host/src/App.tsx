import { AppShell } from './components/AppShell.js';
import { PersonaSwitcher } from './components/PersonaSwitcher.js';
import { RemoteBoundary } from './components/RemoteBoundary.js';
import { isAuth0Configured } from './auth.js';

export function App() {
  return (
    <>
      {!isAuth0Configured() && <PersonaSwitcher />}
      <AppShell>
        <RemoteBoundary />
      </AppShell>
    </>
  );
}
