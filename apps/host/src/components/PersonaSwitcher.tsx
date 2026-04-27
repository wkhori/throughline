import { useDispatch } from 'react-redux';
import { setToken, clearToken } from '@throughline/shared-ui';
import { mockPersonas } from '../auth.js';

// Stub-mode persona switcher (Phase 1). Disappears once real Auth0 wires in.
export function PersonaSwitcher() {
  const dispatch = useDispatch();
  return (
    <div role="region" aria-label="Demo persona switcher" style={styles.bar}>
      <span style={styles.label}>Demo personas (stub mode):</span>
      {mockPersonas.map((p) => (
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
