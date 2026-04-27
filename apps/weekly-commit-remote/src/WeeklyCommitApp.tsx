import type { ReactNode } from 'react';
import { useSelector } from 'react-redux';
import { selectHasRole, selectMe } from '@throughline/shared-ui';
import { RcdoTreeEditor } from './features/admin/RcdoTreeEditor.js';

// Phase 1 surface: ADMIN sees the RCDO authoring tree; IC/MANAGER see a
// placeholder until Phase 2 wires the DraftWeek surface.
export function WeeklyCommitApp(): ReactNode {
  const me = useSelector(selectMe);
  const isAdmin = useSelector(selectHasRole('ADMIN'));

  if (!me) {
    return (
      <section style={style.gate} data-testid="signed-out">
        <h2 style={style.h2}>Sign in to continue</h2>
        <p style={style.muted}>Pick a demo persona above (stub mode) or sign in via Auth0.</p>
      </section>
    );
  }

  if (isAdmin) {
    return <RcdoTreeEditor />;
  }

  return (
    <section style={style.gate} data-testid="placeholder">
      <h2 style={style.h2}>Weekly Commit (placeholder)</h2>
      <p style={style.muted}>
        Signed in as <strong>{me.displayName}</strong> ({me.role}). The Phase-2 DraftWeek
        surface mounts here.
      </p>
    </section>
  );
}

const style: Record<string, React.CSSProperties> = {
  gate: { padding: 32, fontFamily: 'system-ui, sans-serif', color: '#374151' },
  h2: { margin: 0, fontSize: 18 },
  muted: { color: '#6b7280', fontSize: 13, marginTop: 8 },
};

export default WeeklyCommitApp;
