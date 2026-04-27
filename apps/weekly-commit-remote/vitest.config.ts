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
        'src/test-utils.tsx',
        'src/bootstrap.tsx',
        'src/WeeklyCommitRoutes.tsx',
        'src/env.d.ts',
        // RTK Query endpoint files re-export auto-generated hooks; behavior is
        // covered by the component tests that consume the hooks.
        'src/api/rcdoEndpoints.ts',
      ],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
