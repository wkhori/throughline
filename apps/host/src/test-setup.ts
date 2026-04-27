import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Tests assume stub-mode auth (PersonaSwitcher visible). When the developer's `.env.local` defines
// VITE_AUTH0_DOMAIN/CLIENT_ID, Vite auto-loads them into import.meta.env even for `vitest run`,
// which flips `isAuth0Configured()` to true and hides the persona switcher → all assertions fail.
// Forcing the env vars empty here keeps the unit tests deterministic regardless of `.env.local`.
vi.stubEnv('VITE_AUTH0_DOMAIN', '');
vi.stubEnv('VITE_AUTH0_CLIENT_ID', '');
vi.stubEnv('VITE_AUTH0_AUDIENCE', '');
