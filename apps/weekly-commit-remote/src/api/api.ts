import { createBaseApi } from '@throughline/shared-ui';

// Phase-1 placeholder: the remote builds its own RTK Query API on top of the
// shared base factory. Phase 2 onwards adds endpoints (commits, weeks, rcdo,
// manager, ai, notifications).
const fallbackBase =
  typeof window !== 'undefined' && (window as { __THROUGHLINE_API_BASE__?: string }).__THROUGHLINE_API_BASE__
    ? (window as { __THROUGHLINE_API_BASE__?: string }).__THROUGHLINE_API_BASE__!
    : 'http://localhost:8080';

export const api = createBaseApi(import.meta.env?.VITE_API_BASE_URL ?? fallbackBase);
