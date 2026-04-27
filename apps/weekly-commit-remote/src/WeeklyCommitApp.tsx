import { lazy, Suspense, type ReactNode } from 'react';
import { useSelector } from 'react-redux';
import { selectHasRole, selectMe } from '@throughline/shared-ui';
import type { MeDto } from '@throughline/shared-types';
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
      <main className="grid min-h-[60vh] place-items-start justify-center bg-(--color-shell-bg) p-8">
        <section
          data-testid="signed-out"
          className="w-full max-w-md rounded-lg border border-(--color-panel-border) bg-(--color-panel-bg) p-6 text-center shadow-sm"
        >
          <div
            aria-hidden="true"
            className="mx-auto mb-3 flex h-8 w-8 -translate-y-1 items-center justify-center"
          >
            <svg
              viewBox="0 0 32 32"
              className="h-7 w-7 animate-bounce text-(--color-shell-muted)"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16 6 L16 22" />
              <path d="M9 15 L16 22 L23 15" transform="rotate(180 16 14)" />
            </svg>
          </div>
          <p className="text-sm text-(--color-shell-muted)">
            Pick a persona above to explore the lifecycle.
          </p>
        </section>
      </main>
    );
  }

  if (isAdmin) {
    return (
      <div data-testid="admin-shell" className="bg-(--color-shell-bg)">
        <RoleHeader me={me} role="ADMIN" />
        <AdminMetricsPanel />
        <RcdoTreeEditor />
      </div>
    );
  }

  if (isManager) {
    return (
      <div className="bg-(--color-shell-bg)">
        <RoleHeader me={me} role="MANAGER" />
        <Suspense
          fallback={
            <p
              data-testid="manager-shell-fallback"
              className="p-6 text-sm text-(--color-shell-muted)"
            >
              Loading manager dashboard…
            </p>
          }
        >
          <ManagerDashboard />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="bg-(--color-shell-bg)">
      <RoleHeader me={me} role="IC" />
      <Suspense
        fallback={
          <p data-testid="week-shell-fallback" className="p-6 text-sm text-(--color-shell-muted)">
            Loading week…
          </p>
        }
      >
        <WeekShell />
      </Suspense>
    </div>
  );
}

interface RoleHeaderProps {
  me: MeDto;
  role: 'IC' | 'MANAGER' | 'ADMIN';
}

// Slim shell bar under the persona switcher. Shows current role + identity at top-right so the
// reviewer can tell at a glance which persona's view is being rendered.
function RoleHeader({ me, role }: RoleHeaderProps): ReactNode {
  return (
    <header
      data-testid="role-header"
      className="flex items-center justify-between border-b border-(--color-panel-border) bg-(--color-panel-bg) px-6 py-2.5 text-xs text-(--color-shell-muted)"
    >
      <span className="font-semibold uppercase tracking-wide text-(--color-shell-text)">
        Throughline · Weekly Commit
      </span>
      <span className="flex items-center gap-2">
        <span className="rounded-sm bg-(--color-badge-bg) px-1.5 py-0.5 font-medium text-(--color-badge-fg)">
          {role}
        </span>
        <span className="text-(--color-shell-muted)">{me.email}</span>
      </span>
    </header>
  );
}

export default WeeklyCommitApp;
