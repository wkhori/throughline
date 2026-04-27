import { useState } from 'react';
import { useRtkSubscriptionKick } from '@throughline/shared-ui';
import {
  useCreateRallyCryMutation,
  useDeleteRallyCryMutation,
  useGetRcdoTreeQuery,
} from '../../api/rcdoEndpoints.js';
import type { RcdoTreeDto } from '@throughline/shared-types';

// Phase 1 RCDO admin: Linear-style outline tree editor with delete-guards.
// Supports the @phase-1 admin-rcdo Gherkin scenarios; Phase 2 extends
// drag-reorder + nested DO/Outcome/SO inline forms.
export function RcdoTreeEditor() {
  useRtkSubscriptionKick();
  const { data, isLoading, error } = useGetRcdoTreeQuery();
  const [createRallyCry, createState] = useCreateRallyCryMutation();
  const [deleteRallyCry] = useDeleteRallyCryMutation();
  const [draftTitle, setDraftTitle] = useState('');
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<{ id: string; title: string } | null>(null);

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

  if (isLoading) {
    return (
      <p className="mx-auto max-w-6xl p-6 text-sm text-(--color-shell-muted)">Loading RCDO tree…</p>
    );
  }
  if (error) {
    return (
      <p className="mx-auto max-w-6xl p-6 text-sm text-(--color-shell-error)">
        Failed to load RCDO tree.
      </p>
    );
  }

  const tree: RcdoTreeDto = data ?? { rallyCries: [] };

  return (
    <section className="mx-auto max-w-6xl space-y-6 p-6" data-testid="rcdo-tree-editor">
      <header>
        <h1 className="text-xl font-semibold text-(--color-shell-text)">RCDO Authoring</h1>
        <p className="mt-1 text-sm text-(--color-shell-muted)">
          Rally Cry → Defining Objective → Outcome → Supporting Outcome.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-(--color-panel-border) bg-(--color-panel-bg) p-4">
        <input
          type="text"
          placeholder="New Rally Cry title (min 5 chars)"
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          aria-label="New Rally Cry title"
          data-testid="new-rally-cry-input"
          className="grow rounded-md border border-(--color-panel-border) bg-(--color-shell-bg) px-3 py-2 text-sm text-(--color-shell-text) placeholder:text-(--color-shell-muted)"
        />
        <button
          type="button"
          onClick={handleCreate}
          disabled={createState.isLoading}
          data-testid="create-rally-cry"
          className="rounded-md bg-(--color-shell-text) px-4 py-2 text-sm font-medium text-(--color-shell-bg) hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {createState.isLoading ? 'Creating…' : 'Add Rally Cry'}
        </button>
      </div>
      {conflictMessage && (
        <p
          role="alert"
          data-testid="rcdo-error"
          className="rounded-md border border-(--color-ribbon-high-bg) bg-(--color-ribbon-high-bg) px-3 py-2 text-xs text-(--color-ribbon-high-fg)"
        >
          {conflictMessage}
        </p>
      )}

      {tree.rallyCries.length === 0 ? (
        <p
          data-testid="rcdo-empty"
          className="rounded-md border border-dashed border-(--color-panel-border) bg-(--color-panel-bg) p-6 text-center text-sm text-(--color-panel-muted)"
        >
          No Rally Cries yet. Author your first one above.
        </p>
      ) : (
        <ul
          data-testid="rcdo-tree-list"
          className="divide-y divide-(--color-panel-border) overflow-hidden rounded-lg border border-(--color-panel-border) bg-(--color-panel-bg)"
        >
          {tree.rallyCries.map((rc) => (
            <li key={rc.id} className="px-5 py-3">
              <details className="group">
                <summary
                  className="flex cursor-pointer list-none flex-wrap items-center gap-3 outline-none [&::-webkit-details-marker]:hidden"
                  data-testid={`rc-summary-${rc.id}`}
                >
                  <svg
                    className="h-3.5 w-3.5 shrink-0 text-(--color-panel-muted) transition-transform group-open:rotate-90"
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M4 2 L8 6 L4 10" />
                  </svg>
                  <span className="text-base font-semibold text-(--color-panel-heading)">
                    {rc.title}
                  </span>
                  <span className="text-xs text-(--color-panel-muted)">
                    {rc.definingObjectives.length} Defining Objective
                    {rc.definingObjectives.length === 1 ? '' : 's'} ·{' '}
                    {countOutcomes(rc)} Outcome{countOutcomes(rc) === 1 ? '' : 's'} ·{' '}
                    {countSupporting(rc)} Supporting
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setArchiveTarget({ id: rc.id, title: rc.title });
                    }}
                    data-testid={`archive-rc-${rc.id}`}
                    className="ml-auto rounded-md border border-(--color-panel-border) bg-transparent px-3 py-1 text-xs font-medium text-(--color-panel-cell) hover:bg-(--color-skeleton-bg)"
                  >
                    Archive
                  </button>
                </summary>
                {rc.definingObjectives.length > 0 && (
                  <ul className="mt-2 space-y-1.5 border-l border-(--color-panel-border) pl-4">
                    {rc.definingObjectives.map((defo) => (
                      <li key={defo.id} className="space-y-1.5">
                        <p className="text-sm text-(--color-panel-cell)">{defo.title}</p>
                        {defo.outcomes.length > 0 && (
                          <ul className="space-y-1 border-l border-(--color-panel-border) pl-4">
                            {defo.outcomes.map((o) => (
                              <li key={o.id} className="space-y-1">
                                <p className="text-xs text-(--color-panel-muted)">{o.title}</p>
                                {o.supportingOutcomes.length > 0 && (
                                  <ul className="space-y-1 border-l border-dashed border-(--color-panel-border) pl-4">
                                    {o.supportingOutcomes.map((so) => (
                                      <li
                                        key={so.id}
                                        className="text-[11px] text-(--color-panel-muted)"
                                      >
                                        {so.title}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </details>
            </li>
          ))}
        </ul>
      )}

      {archiveTarget ? (
        <>
          <div
            data-testid="archive-rc-backdrop"
            aria-hidden="true"
            onClick={() => setArchiveTarget(null)}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="archive-rc-title"
            data-testid="archive-rc-dialog"
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-(--color-panel-border) bg-(--color-panel-bg) p-5 shadow-2xl"
          >
            <h3
              id="archive-rc-title"
              className="text-sm font-semibold text-(--color-panel-heading)"
            >
              Archive this Rally Cry?
            </h3>
            <p className="mt-1.5 text-xs text-(--color-panel-muted)">
              "{archiveTarget.title}"
              <br />
              The Rally Cry and every Defining Objective, Outcome, and Supporting Outcome under it
              will be hidden from new commits. The backend will reject this if there are still
              active children — archive those first.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                data-testid="archive-rc-cancel"
                onClick={() => setArchiveTarget(null)}
                className="rounded-md border border-(--color-panel-border) bg-transparent px-3 py-1.5 text-xs font-medium text-(--color-panel-cell) transition-colors hover:bg-(--color-skeleton-bg)"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="archive-rc-confirm"
                onClick={async () => {
                  const target = archiveTarget;
                  setArchiveTarget(null);
                  await handleArchive(target.id);
                }}
                className="rounded-md bg-(--color-shell-error) px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
              >
                Archive Rally Cry
              </button>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}

function countOutcomes(rc: RcdoTreeDto['rallyCries'][number]): number {
  let n = 0;
  for (const dobj of rc.definingObjectives) n += dobj.outcomes.length;
  return n;
}

function countSupporting(rc: RcdoTreeDto['rallyCries'][number]): number {
  let n = 0;
  for (const dobj of rc.definingObjectives) {
    for (const o of dobj.outcomes) n += o.supportingOutcomes.length;
  }
  return n;
}
