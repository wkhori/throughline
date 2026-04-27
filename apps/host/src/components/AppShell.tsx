import { useSelector } from 'react-redux';
import { selectMe, selectPermissions } from '@throughline/shared-ui';
import type { ReactNode } from 'react';

export function AppShell({ children }: { children: ReactNode }) {
  const me = useSelector(selectMe);
  const perms = useSelector(selectPermissions);

  return (
    <div style={styles.root}>
      <header style={styles.header}>
        <strong style={styles.brand}>Throughline</strong>
        <span style={styles.muted}>
          {me ? `${me.displayName} · ${perms.join(', ')}` : 'Not signed in'}
        </span>
      </header>
      <main style={styles.main}>{children}</main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#fafafa' },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 24px',
    borderBottom: '1px solid #e5e7eb',
    background: '#fff',
    fontFamily: 'system-ui, sans-serif',
  },
  brand: { fontSize: 16 },
  muted: { color: '#6b7280', fontSize: 13 },
  main: { flex: 1 },
};
