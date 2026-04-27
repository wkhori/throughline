import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
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
        react: { singleton: true, requiredVersion: requiredVersion('react') },
        'react-dom': { singleton: true, requiredVersion: requiredVersion('react-dom') },
        'react-router-dom': { singleton: true, requiredVersion: requiredVersion('react-router-dom') },
        '@reduxjs/toolkit': { singleton: true, requiredVersion: requiredVersion('@reduxjs/toolkit') },
        'react-redux': { singleton: true, requiredVersion: requiredVersion('react-redux') },
        '@auth0/auth0-react': { singleton: true, requiredVersion: requiredVersion('@auth0/auth0-react') },
        '@throughline/shared-ui': { singleton: true, requiredVersion: requiredVersion('@throughline/shared-ui') },
        '@throughline/shared-types': { singleton: true, requiredVersion: requiredVersion('@throughline/shared-types') },
      },
    }),
  ],
  server: { port: 5173, host: '127.0.0.1' },
  build: { target: 'esnext', modulePreload: false, cssCodeSplit: false },
});
