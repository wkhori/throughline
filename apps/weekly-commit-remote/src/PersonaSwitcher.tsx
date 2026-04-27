import { useDispatch } from 'react-redux';
import { setToken, clearToken } from '@throughline/shared-ui';
import type { MeDto, Role } from '@throughline/shared-types';

const personaUser = (id: 'ic' | 'manager' | 'admin', role: Role): MeDto => ({
  id: `01J0000000000000000000000${id === 'ic' ? 'A' : id === 'manager' ? 'B' : 'C'}`,
  orgId: '01J0000000000000000000000Z',
  email: `${id}@demo.throughline.app`,
  displayName: id === 'ic' ? 'Demo IC' : id === 'manager' ? 'Demo Manager' : 'Demo Admin',
  role,
  permissions: [role],
});

const personas = [
  { id: 'ic' as const, user: personaUser('ic', 'IC'), token: 'mock.ic.token' },
  { id: 'manager' as const, user: personaUser('manager', 'MANAGER'), token: 'mock.manager.token' },
  { id: 'admin' as const, user: personaUser('admin', 'ADMIN'), token: 'mock.admin.token' },
];

export function PersonaSwitcher() {
  const dispatch = useDispatch();
  return (
    <div role="region" aria-label="Demo persona switcher" style={styles.bar}>
      <span style={styles.label}>Demo personas (stub mode):</span>
      {personas.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => dispatch(setToken({ token: p.token, user: p.user }))}
          style={styles.btn}
          data-testid={`persona-${p.id}`}
        >
          {p.user.displayName}
        </button>
      ))}
      <button type="button" onClick={() => dispatch(clearToken())} style={styles.btnGhost}>
        Sign out
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    display: 'flex',
    gap: 8,
    padding: '8px 16px',
    background: '#0f172a',
    color: '#e2e8f0',
    fontFamily: 'system-ui, sans-serif',
    fontSize: 13,
    alignItems: 'center',
  },
  label: { opacity: 0.7, marginRight: 8 },
  btn: {
    background: '#1e293b',
    color: '#e2e8f0',
    border: '1px solid #334155',
    borderRadius: 4,
    padding: '4px 8px',
    cursor: 'pointer',
  },
  btnGhost: {
    background: 'transparent',
    color: '#cbd5e1',
    border: '1px solid #334155',
    borderRadius: 4,
    padding: '4px 8px',
    cursor: 'pointer',
    marginLeft: 'auto',
  },
};
