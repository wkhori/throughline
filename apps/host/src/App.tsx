import { AppShell } from './components/AppShell.js';
import { CommandPalette } from './components/CommandPalette.js';
import { buildPaletteActions } from './components/paletteActions.js';
import { PersonaSwitcher } from './components/PersonaSwitcher.js';
import { RemoteBoundary } from './components/RemoteBoundary.js';
import { isAuth0Configured } from './auth.js';

const actions = buildPaletteActions((path) => window.location.assign(path));

export function App() {
  return (
    <>
      {!isAuth0Configured() && <PersonaSwitcher />}
      <CommandPalette actions={actions} />
      <AppShell>
        <RemoteBoundary />
      </AppShell>
    </>
  );
}
