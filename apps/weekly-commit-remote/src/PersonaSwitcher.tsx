import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { setToken, clearToken, useApiBaseUrl } from '@throughline/shared-ui';
import type { MeDto, Role } from '@throughline/shared-types';

const personas = [
  { id: 'ic' as const, label: 'Demo IC', role: 'IC' as Role },
  { id: 'manager' as const, label: 'Demo Manager', role: 'MANAGER' as Role },
  { id: 'admin' as const, label: 'Demo Admin', role: 'ADMIN' as Role },
];

const placeholderUser = (id: 'ic' | 'manager' | 'admin', role: Role): MeDto => ({
  id: `01J0000000000000000000000${id === 'ic' ? 'A' : id === 'manager' ? 'B' : 'C'}`,
  orgId: '01J0000000000000000000000Z',
  email: `${id}@demo.throughline.app`,
  displayName: id === 'ic' ? 'Demo IC' : id === 'manager' ? 'Demo Manager' : 'Demo Admin',
  role,
  permissions: [role],
});

export function PersonaSwitcher() {
  const dispatch = useDispatch();
  const apiBase = useApiBaseUrl();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn(personaId: 'ic' | 'manager' | 'admin', role: Role) {
    setPending(personaId);
    setError(null);
    try {
      const r = await fetch(`${apiBase}/api/v1/auth/demo-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona: personaId }),
      });
      if (!r.ok) {
        // 503 means demo secret isn't configured server-side — fall back to legacy mock token so
        // local dev / partial-config envs still work.
        if (r.status === 503) {
          dispatch(
            setToken({
              token: `mock.${personaId}.token`,
              user: placeholderUser(personaId, role),
            }),
          );
          return;
        }
        throw new Error(`demo-login failed: ${r.status}`);
      }
      const body = (await r.json()) as { accessToken: string; expiresIn: number };
      dispatch(
        setToken({
          token: body.accessToken,
          user: placeholderUser(personaId, role),
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setPending(null);
    }
  }

  return (
    <div role="region" aria-label="Demo persona switcher" className="persona-bar">
      <span className="persona-bar-label">Demo personas</span>
      {personas.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => void signIn(p.id, p.role)}
          className="persona-btn"
          disabled={pending !== null}
          data-testid={`persona-${p.id}`}
        >
          {pending === p.id ? 'Signing in…' : p.label}
        </button>
      ))}
      <button
        type="button"
        onClick={() => dispatch(clearToken())}
        className="persona-btn-ghost"
      >
        Sign out
      </button>
      {error ? (
        <span role="alert" className="persona-error">
          {error}
        </span>
      ) : null}
    </div>
  );
}
