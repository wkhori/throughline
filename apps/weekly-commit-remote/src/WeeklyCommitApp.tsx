import { lazy, Suspense, type ReactNode } from 'react';
import { useSelector } from 'react-redux';
import { selectHasRole, selectMe } from '@throughline/shared-ui';
import { AdminMetricsPanel } from './features/admin/AdminMetricsPanel.js';
import { RcdoTreeEditor } from './features/admin/RcdoTreeEditor.js';

// PRD §7 sub-second initial render gate — heavy IC surfaces lazy-load so the host shell ships
// only the auth + role-routing on first paint.
const WeekShell = lazy(() =>
  import('./features/draft/WeekShell.js').then((m) => ({ default: m.WeekShell })),
);

const ManagerDashboard = lazy(() =>
  import('./features/manager/ManagerDashboard.js').then((m) => ({ default: m.ManagerDashboard })),
);

export function WeeklyCommitApp(): ReactNode {
  const me = useSelector(selectMe);
  const isAdmin = useSelector(selectHasRole('ADMIN'));
  const isManager = useSelector(selectHasRole('MANAGER'));

  if (!me) {
    return (
      <section style={style.gate} data-testid="signed-out">
        <h2 style={style.h2}>Sign in to continue</h2>
        <p style={style.muted}>Pick a demo persona above (stub mode) or sign in via Auth0.</p>
      </section>
    );
  }

  if (isAdmin) {
    return (
      <div data-testid="admin-shell">
        <AdminMetricsPanel />
        <RcdoTreeEditor />
      </div>
    );
  }

  if (isManager) {
    return (
      <Suspense
        fallback={
          <p data-testid="manager-shell-fallback" style={style.muted}>
            Loading manager dashboard…
          </p>
        }
      >
        <ManagerDashboard />
      </Suspense>
    );
  }

  return (
    <Suspense
      fallback={
        <p data-testid="week-shell-fallback" style={style.muted}>
          Loading week…
        </p>
      }
    >
      <WeekShell />
    </Suspense>
  );
}

const style: Record<string, React.CSSProperties> = {
  gate: { padding: 32, fontFamily: 'system-ui, sans-serif', color: '#374151' },
  h2: { margin: 0, fontSize: 18 },
  muted: { color: '#6b7280', fontSize: 13, marginTop: 8 },
};

export default WeeklyCommitApp;
