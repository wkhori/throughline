import { configureStore } from '@reduxjs/toolkit';
import { authReducer, type AuthState } from '@throughline/shared-ui';

// Host owns the auth slice (singleton via federation), the remote reads from it.
// Phase 1 keeps the store small; Phase 2 wires the remote's RTK Query api slice
// into this same store via store.replaceReducer or middleware extension.
export const store = configureStore({
  reducer: { auth: authReducer },
  middleware: (g) => g({ serializableCheck: { ignoredActions: ['auth/setToken'] } }),
});

export type HostState = ReturnType<typeof store.getState> & { auth: AuthState };
export type HostDispatch = typeof store.dispatch;
