import { describe, expect, it } from 'vitest';
import {
  authReducer,
  clearToken,
  selectAuthToken,
  selectHasRole,
  selectMe,
  selectPermissions,
  setToken,
  type AuthState,
} from './authSlice.js';
import type { MeDto } from '@throughline/shared-types';

const makeMe = (permissions: MeDto['permissions']): MeDto => ({
  id: '01J0000000000000000000000A',
  orgId: '01J0000000000000000000000B',
  email: 'demo@throughline.app',
  displayName: 'Demo',
  role: permissions[0] ?? 'IC',
  permissions,
});

describe('authSlice', () => {
  it('starts cleared', () => {
    const next = authReducer(undefined, { type: '@@init' });
    expect(next.token).toBeNull();
    expect(next.user).toBeNull();
    expect(next.permissions).toEqual([]);
  });

  it('setToken populates token + user + permissions', () => {
    const me = makeMe(['IC']);
    const next = authReducer(undefined, setToken({ token: 'abc.def.ghi', user: me }));
    expect(next.token).toBe('abc.def.ghi');
    expect(next.user).toEqual(me);
    expect(next.permissions).toEqual(['IC']);
  });

  it('clearToken wipes state', () => {
    const seeded: AuthState = { token: 't', user: makeMe(['ADMIN']), permissions: ['ADMIN'] };
    const next = authReducer(seeded, clearToken());
    expect(next).toEqual({ token: null, user: null, permissions: [] });
  });

  describe('selectHasRole — role hierarchy ADMIN > MANAGER > IC (P6)', () => {
    const state = (perms: MeDto['permissions']): { auth: AuthState } => ({
      auth: { token: 't', user: makeMe(perms), permissions: perms },
    });

    it('IC user has IC, not MANAGER or ADMIN', () => {
      const s = state(['IC']);
      expect(selectHasRole('IC')(s)).toBe(true);
      expect(selectHasRole('MANAGER')(s)).toBe(false);
      expect(selectHasRole('ADMIN')(s)).toBe(false);
    });

    it('MANAGER user has IC and MANAGER, not ADMIN', () => {
      const s = state(['MANAGER']);
      expect(selectHasRole('IC')(s)).toBe(true);
      expect(selectHasRole('MANAGER')(s)).toBe(true);
      expect(selectHasRole('ADMIN')(s)).toBe(false);
    });

    it('ADMIN user has all three', () => {
      const s = state(['ADMIN']);
      expect(selectHasRole('IC')(s)).toBe(true);
      expect(selectHasRole('MANAGER')(s)).toBe(true);
      expect(selectHasRole('ADMIN')(s)).toBe(true);
    });

    it('selectAuthToken / selectMe / selectPermissions read the slice', () => {
      const s = state(['IC']);
      expect(selectAuthToken(s)).toBe('t');
      expect(selectMe(s)?.email).toBe('demo@throughline.app');
      expect(selectPermissions(s)).toEqual(['IC']);
    });
  });
});
