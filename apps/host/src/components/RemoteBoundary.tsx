import { Suspense, lazy } from 'react';

// Federated remote is wired in apps/host/vite.config.ts via @module-federation/vite.
// `weekly_commit_remote/App` resolves to apps/weekly-commit-remote/src/federated-entry.tsx
// which carries its own Provider + ApiBaseUrlProvider tree.
const RemoteApp = lazy(() => import('weekly_commit_remote/App'));

export function RemoteBoundary() {
  return (
    <Suspense fallback={<p style={style.loading}>Loading weekly commit module…</p>}>
      <RemoteApp />
    </Suspense>
  );
}

const style: Record<string, React.CSSProperties> = {
  loading: { padding: 32, color: '#6b7280' },
};
