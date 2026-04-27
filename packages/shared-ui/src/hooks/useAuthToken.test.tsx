import { configureStore } from '@reduxjs/toolkit';
import { renderHook } from '@testing-library/react';
import { Provider } from 'react-redux';
import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { authReducer, setToken } from '../store/authSlice.js';
import { useAuthToken } from './useAuthToken.js';

const buildStore = () => configureStore({ reducer: { auth: authReducer } });

const wrap = (store: ReturnType<typeof buildStore>) => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
  Wrapper.displayName = 'TestWrapper';
  return Wrapper;
};

describe('useAuthToken', () => {
  it('returns null when no token is set', () => {
    const store = buildStore();
    const { result } = renderHook(() => useAuthToken(), { wrapper: wrap(store) });
    expect(result.current).toBeNull();
  });

  it('returns the token after setToken dispatch', () => {
    const store = buildStore();
    store.dispatch(
      setToken({
        token: 'jwt.abc.def',
        user: {
          id: '01J0',
          orgId: '01J1',
          email: 'a@b.com',
          displayName: 'A',
          role: 'IC',
          permissions: ['IC'],
        },
      }),
    );
    const { result } = renderHook(() => useAuthToken(), { wrapper: wrap(store) });
    expect(result.current).toBe('jwt.abc.def');
  });
});
