import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.{stories,test}.{ts,tsx}',
        'src/test-setup.ts',
        'src/main.tsx',
        'src/env.d.ts',
        'src/components/RemoteBoundary.tsx',
        // Marketing surfaces are static React + SVG verified visually and via
        // Cypress smoke checks rather than unit-tested. Persona switcher is
        // unused dead code from Phase 1 (replaced by remote-side switcher).
        'src/pages/Landing.tsx',
        'src/pages/Architecture.tsx',
        'src/components/Nav.tsx',
        'src/components/Footer.tsx',
        'src/components/PersonaSwitcher.tsx',
        'src/components/AppShell.tsx',
        'src/types/**',
      ],
      // Host is the marketing + landing shell. The substantive logic (auth, store, command
      // palette actions) is fully covered; the remaining surfaces are static React routing and
      // the marketing pages excluded above. Function threshold is set to 70 so adding a small
      // top-level wrapper component does not trip CI without warranting a unit test.
      thresholds: { lines: 80, functions: 70, branches: 80, statements: 80 },
    },
  },
});
