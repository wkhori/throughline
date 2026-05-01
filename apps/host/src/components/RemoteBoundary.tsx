import { Suspense, lazy, type ComponentType } from 'react';

// Phase 0: the remote isn't loaded yet — we resolve a placeholder. Phase 2
// flips the dynamic import to the federation-exposed module.
const PlaceholderRemote: ComponentType = () => (
  <section style={style.placeholder}>
    <h2>Weekly Commit (remote placeholder)</h2>
    <p>The federated remote will mount here in Phase 2.</p>
  </section>
);

const RemoteApp = lazy<ComponentType>(async () => ({ default: PlaceholderRemote }));

export function RemoteBoundary() {
  return (
    <Suspense fallback={<p style={style.loading}>Loading weekly commit module…</p>}>
      <RemoteApp />
    </Suspense>
  );
}

const style: Record<string, React.CSSProperties> = {
  placeholder: { padding: 32, fontFamily: 'system-ui, sans-serif', color: '#374151' },
  loading: { padding: 32, color: '#6b7280' },
};
