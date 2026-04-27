import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setToken, clearToken, selectMe, useApiBaseUrl } from '@throughline/shared-ui';
import type { MeDto, Role } from '@throughline/shared-types';

const personas = [
  { id: 'ic' as const, label: 'IC', role: 'IC' as Role },
  { id: 'manager' as const, label: 'Manager', role: 'MANAGER' as Role },
  { id: 'admin' as const, label: 'Admin', role: 'ADMIN' as Role },
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
  const me = useSelector(selectMe);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoTried = useRef(false);

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

  // Default-load the IC persona on first mount so the app never shows an empty
  // sign-in card. The user can swap personas at any time using the bar.
  useEffect(() => {
    if (!me && !autoTried.current) {
      autoTried.current = true;
      void signIn('ic', 'IC');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  return (
    <div role="region" aria-label="Persona switcher" className="persona-bar">
      <span className="persona-bar-label">Personas</span>
      {personas.map((p) => {
        const isActive = me?.role === p.role;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => void signIn(p.id, p.role)}
            className={isActive ? 'persona-btn persona-btn-active' : 'persona-btn'}
            disabled={pending !== null}
            data-testid={`persona-${p.id}`}
            aria-pressed={isActive}
          >
            {pending === p.id ? 'Switching…' : p.label}
          </button>
        );
      })}
      {me ? (
        <button
          type="button"
          onClick={() => dispatch(clearToken())}
          className="persona-btn-ghost"
        >
          Sign out
        </button>
      ) : null}
      {error ? (
        <span role="alert" className="persona-error">
          {error}
        </span>
      ) : null}
    </div>
  );
}
