import { afterEach, describe, expect, it } from 'vitest';
import { isAuth0Configured, mockPersonas } from './auth.js';

describe('auth', () => {
  const originalDomain = import.meta.env.VITE_AUTH0_DOMAIN;
  const originalClientId = import.meta.env.VITE_AUTH0_CLIENT_ID;

  afterEach(() => {
    (import.meta.env as Record<string, unknown>).VITE_AUTH0_DOMAIN = originalDomain;
    (import.meta.env as Record<string, unknown>).VITE_AUTH0_CLIENT_ID = originalClientId;
  });

  it('exposes IC, MANAGER, and ADMIN demo personas with stable mock tokens', () => {
    expect(mockPersonas).toHaveLength(3);
    const ic = mockPersonas.find((p) => p.id === 'ic')!;
    const manager = mockPersonas.find((p) => p.id === 'manager')!;
    const admin = mockPersonas.find((p) => p.id === 'admin')!;
    expect(ic.token).toBe('mock.ic.token');
    expect(ic.user.role).toBe('IC');
    expect(manager.token).toBe('mock.manager.token');
    expect(manager.user.role).toBe('MANAGER');
    expect(admin.token).toBe('mock.admin.token');
    expect(admin.user.role).toBe('ADMIN');
  });

  it('isAuth0Configured returns false when env vars are missing', () => {
    (import.meta.env as Record<string, unknown>).VITE_AUTH0_DOMAIN = '';
    (import.meta.env as Record<string, unknown>).VITE_AUTH0_CLIENT_ID = '';
    expect(isAuth0Configured()).toBe(false);
  });

  it('isAuth0Configured returns true when both env vars are populated', () => {
    (import.meta.env as Record<string, unknown>).VITE_AUTH0_DOMAIN = 'tenant.auth0.com';
    (import.meta.env as Record<string, unknown>).VITE_AUTH0_CLIENT_ID = 'spa-client-id';
    expect(isAuth0Configured()).toBe(true);
  });
});
