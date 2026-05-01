import { Suspense, lazy } from 'react';

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
