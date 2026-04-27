import { useState } from 'react';
import {
  useCreateRallyCryMutation,
  useDeleteRallyCryMutation,
  useGetRcdoTreeQuery,
} from '../../api/rcdoEndpoints.js';

// Phase 1 RCDO admin: Linear-style outline tree editor with delete-guards.
// Supports the @phase-1 admin-rcdo Gherkin scenarios; Phase 2 extends
// drag-reorder + nested DO/Outcome/SO inline forms.
export function RcdoTreeEditor() {
  const { data, isLoading, error } = useGetRcdoTreeQuery();
  const [createRallyCry, createState] = useCreateRallyCryMutation();
  const [deleteRallyCry] = useDeleteRallyCryMutation();
  const [draftTitle, setDraftTitle] = useState('');
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);

  const handleCreate = async () => {
    setConflictMessage(null);
    if (draftTitle.trim().length < 5) {
      setConflictMessage('Rally Cry title must be at least 5 characters');
      return;
    }
    try {
      await createRallyCry({ title: draftTitle.trim() }).unwrap();
      setDraftTitle('');
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 409) {
        setConflictMessage('A Rally Cry with that title already exists');
      } else if (status === 403) {
        setConflictMessage('Only ADMIN users can create Rally Cries');
      } else {
        setConflictMessage('Could not create Rally Cry');
      }
    }
  };

  const handleArchive = async (id: string) => {
    setConflictMessage(null);
    try {
      await deleteRallyCry(id).unwrap();
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 409) {
        setConflictMessage(
          'This Rally Cry has active Defining Objectives — archive children first',
        );
      } else {
        setConflictMessage('Could not archive Rally Cry');
      }
    }
  };

  if (isLoading) return <p style={style.muted}>Loading RCDO tree…</p>;
  if (error) return <p style={style.error}>Failed to load RCDO tree.</p>;

  const tree = data ?? { rallyCries: [] };

  return (
    <section style={style.root} data-testid="rcdo-tree-editor">
      <header style={style.header}>
        <h1 style={style.h1}>RCDO Authoring</h1>
        <p style={style.muted}>Rally Cry → Defining Objective → Outcome → Supporting Outcome.</p>
      </header>

      <div style={style.composer}>
        <input
          type="text"
          placeholder="New Rally Cry title (min 5 chars)"
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          style={style.input}
          aria-label="New Rally Cry title"
          data-testid="new-rally-cry-input"
        />
        <button
          type="button"
          onClick={handleCreate}
          disabled={createState.isLoading}
          style={style.primaryBtn}
          data-testid="create-rally-cry"
        >
          {createState.isLoading ? 'Creating…' : 'Add Rally Cry'}
        </button>
      </div>
      {conflictMessage && (
        <p style={style.error} role="alert" data-testid="rcdo-error">
          {conflictMessage}
        </p>
      )}

      {tree.rallyCries.length === 0 ? (
        <p style={style.muted} data-testid="rcdo-empty">
          No Rally Cries yet. Author your first one above.
        </p>
      ) : (
        <ul style={style.tree} data-testid="rcdo-tree-list">
          {tree.rallyCries.map((rc) => (
            <li key={rc.id} style={style.rcRow}>
              <span style={style.rcTitle}>{rc.title}</span>
              <span style={style.muted}>
                {rc.definingObjectives.length} Defining Objective
                {rc.definingObjectives.length === 1 ? '' : 's'}
              </span>
              <button
                type="button"
                onClick={() => handleArchive(rc.id)}
                style={style.ghostBtn}
                data-testid={`archive-rc-${rc.id}`}
              >
                Archive
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const style: Record<string, React.CSSProperties> = {
  root: { padding: 32, fontFamily: 'system-ui, sans-serif', maxWidth: 960, margin: '0 auto' },
  header: { marginBottom: 16 },
  h1: { fontSize: 22, margin: 0 },
  muted: { color: '#6b7280', fontSize: 13 },
  error: { color: '#b91c1c', fontSize: 13 },
  composer: { display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0' },
  input: {
    flex: 1,
    border: '1px solid #d1d5db',
    borderRadius: 6,
    padding: '8px 10px',
    fontSize: 14,
  },
  primaryBtn: {
    background: '#0f172a',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '8px 14px',
    cursor: 'pointer',
    fontSize: 14,
  },
  ghostBtn: {
    background: 'transparent',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    padding: '4px 10px',
    cursor: 'pointer',
    fontSize: 12,
  },
  tree: { listStyle: 'none', padding: 0, margin: 0, borderTop: '1px solid #e5e7eb' },
  rcRow: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    padding: '12px 4px',
    borderBottom: '1px solid #e5e7eb',
  },
  rcTitle: { fontSize: 15, fontWeight: 500, flex: 1 },
};
