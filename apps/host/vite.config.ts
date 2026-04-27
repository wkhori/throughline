import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { federation } from '@module-federation/vite';
import sharedDeps from '../../packages/shared-deps-versions.json';

// Module Federation host. Singletons read from packages/shared-deps-versions.json
// — single source of truth (P22). Don't edit version numbers here; edit there.
const requiredVersion = (name: keyof typeof sharedDeps): string => {
  const v = sharedDeps[name];
  if (typeof v !== 'string') throw new Error(`shared-deps-versions.json missing ${name}`);
  return v;
};

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    federation({
      name: 'host',
      remotes: {
        weeklyCommit: {
          type: 'module',
          name: 'weeklyCommit',
          entry: process.env.VITE_WEEKLY_COMMIT_REMOTE_URL ?? 'http://localhost:5174/remoteEntry.js',
          entryGlobalName: 'weeklyCommit',
          shareScope: 'default',
        },
      },
      shared: {
        // eager: true avoids @module-federation/vite 1.14.5 circular hang where the
        // shared-package chunk imports the loadShare proxy, which itself awaits
        // loadShare(name) and re-imports the same chunk. With eager, the package
        // is bundled into the host entry directly, no proxy cycle.
        react: { singleton: true, eager: true, requiredVersion: requiredVersion('react') },
        'react-dom': { singleton: true, eager: true, requiredVersion: requiredVersion('react-dom') },
        'react-router-dom': { singleton: true, eager: true, requiredVersion: requiredVersion('react-router-dom') },
        '@reduxjs/toolkit': { singleton: true, eager: true, requiredVersion: requiredVersion('@reduxjs/toolkit') },
        'react-redux': { singleton: true, eager: true, requiredVersion: requiredVersion('react-redux') },
        '@auth0/auth0-react': { singleton: true, eager: true, requiredVersion: requiredVersion('@auth0/auth0-react') },
        '@throughline/shared-ui': { singleton: true, eager: true, requiredVersion: requiredVersion('@throughline/shared-ui') },
        '@throughline/shared-types': { singleton: true, eager: true, requiredVersion: requiredVersion('@throughline/shared-types') },
      },
    }),
  ],
  server: { port: 5173, host: '127.0.0.1' },
  build: { target: 'esnext', modulePreload: false, cssCodeSplit: false },
});
