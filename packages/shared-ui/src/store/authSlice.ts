import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { MeDto, Role } from '@throughline/shared-types';

export interface AuthState {
  token: string | null;
  user: MeDto | null;
  permissions: Role[];
}

const initialState: AuthState = { token: null, user: null, permissions: [] };

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setToken(state, action: PayloadAction<{ token: string; user: MeDto }>) {
      state.token = action.payload.token;
      state.user = action.payload.user;
      state.permissions = action.payload.user.permissions;
    },
    clearToken(state) {
      state.token = null;
      state.user = null;
      state.permissions = [];
    },
  },
});

export const { setToken, clearToken } = authSlice.actions;
export const authReducer = authSlice.reducer;

// State shape this slice contributes; consumers wire into their root store.
export interface AuthRootSlice {
  auth: AuthState;
}

export const selectAuthToken = (s: AuthRootSlice): string | null => s.auth.token;
export const selectMe = (s: AuthRootSlice): MeDto | null => s.auth.user;
export const selectPermissions = (s: AuthRootSlice): Role[] => s.auth.permissions;
export const selectHasRole = (role: Role) => (s: AuthRootSlice): boolean =>
  s.auth.permissions.includes(role) ||
  // ADMIN > MANAGER > IC implies higher roles satisfy lower-role checks (P6).
  (role === 'IC' && (s.auth.permissions.includes('MANAGER') || s.auth.permissions.includes('ADMIN'))) ||
  (role === 'MANAGER' && s.auth.permissions.includes('ADMIN'));
