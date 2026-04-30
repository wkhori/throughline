import { useMemo, useState } from 'react';
import { ChevronRight, Compass, Flag, Goal, Search, Target } from 'lucide-react';
import { useRtkSubscriptionKick } from '@throughline/shared-ui';
import {
  useCreateRallyCryMutation,
  useDeleteRallyCryMutation,
  useGetRcdoTreeQuery,
} from '../../api/rcdoEndpoints.js';
import type { RcdoTreeDto } from '@throughline/shared-types';

type RallyCry = RcdoTreeDto['rallyCries'][number];
type DefiningObjective = RallyCry['definingObjectives'][number];
type Outcome = DefiningObjective['outcomes'][number];

// Phase 1 RCDO admin: Linear-style outline tree editor with delete-guards.
// Phase 7 polish — search filter, expand-all/collapse-all, restrained per-level
// iconography, archive demoted to the expanded summary so the closed list reads as
// a clean overview at a glance.
export function RcdoTreeEditor() {
  useRtkSubscriptionKick();
  const { data, isLoading, error } = useGetRcdoTreeQuery();
  const [createRallyCry, createState] = useCreateRallyCryMutation();
  const [deleteRallyCry] = useDeleteRallyCryMutation();
  const [draftTitle, setDraftTitle] = useState('');
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<{ id: string; title: string } | null>(null);
  const [filter, setFilter] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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

  const tree: RcdoTreeDto = data ?? { rallyCries: [] };
  const filteredRallyCries = useMemo(
    () => filterTree(tree.rallyCries, filter.trim().toLowerCase()),
    [tree, filter],
  );

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

  const allIds = tree.rallyCries.map((rc) => rc.id);
  const allExpanded = allIds.length > 0 && allIds.every((id) => expanded.has(id));

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className="mx-auto max-w-6xl space-y-6 p-6" data-testid="rcdo-tree-editor">
      <header>
        <h1 className="text-xl font-semibold text-(--color-shell-text)">RCDO Authoring</h1>
        <p className="mt-1 text-sm text-(--color-shell-muted)">
          Rally Cry → Defining Objective → Outcome → Supporting Outcome.
        </p>
      </header>

      <div className="grid gap-3 rounded-lg border border-(--color-panel-border) bg-(--color-panel-bg) p-4 sm:grid-cols-[2fr_3fr_auto] sm:items-center">
        <div className="flex items-center gap-2">
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
            className="shrink-0 rounded-md bg-(--color-shell-text) px-3 py-2 text-sm font-medium text-(--color-shell-bg) hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {createState.isLoading ? 'Adding…' : 'Add'}
          </button>
        </div>

        <label className="flex items-center gap-2 rounded-md border border-(--color-panel-border) bg-(--color-shell-bg) px-3 py-2 text-sm text-(--color-shell-text)">
          <Search size={14} aria-hidden className="shrink-0 text-(--color-panel-muted)" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search by Rally Cry, Outcome, or Supporting Outcome…"
            aria-label="Search RCDO tree"
            data-testid="rcdo-search"
            className="w-full bg-transparent text-sm text-(--color-shell-text) placeholder:text-(--color-shell-muted) focus:outline-none"
          />
        </label>

        <div className="flex justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={() =>
              setExpanded(allExpanded ? new Set() : new Set(allIds))
            }
            data-testid="rcdo-toggle-all"
            className="rounded-md border border-(--color-panel-border) bg-transparent px-2.5 py-1.5 font-medium text-(--color-panel-cell) transition-colors hover:bg-(--color-skeleton-bg)"
          >
            {allExpanded ? 'Collapse all' : 'Expand all'}
          </button>
        </div>
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
      ) : filteredRallyCries.length === 0 ? (
        <p
          data-testid="rcdo-search-empty"
          className="rounded-md border border-dashed border-(--color-panel-border) bg-(--color-panel-bg) p-6 text-center text-sm text-(--color-panel-muted)"
        >
          No matches for &ldquo;{filter}&rdquo;.
        </p>
      ) : (
        <ul
          data-testid="rcdo-tree-list"
          className="divide-y divide-(--color-panel-border) overflow-hidden rounded-lg border border-(--color-panel-border) bg-(--color-panel-bg)"
        >
          {filteredRallyCries.map((rc) => {
            const isOpen = expanded.has(rc.id);
            return (
              <li key={rc.id} className="px-5 py-3">
                <button
                  type="button"
                  onClick={() => toggle(rc.id)}
                  data-testid={`rc-summary-${rc.id}`}
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-3 text-left outline-none"
                >
                  <ChevronRight
                    size={14}
                    aria-hidden
                    className={
                      'shrink-0 text-(--color-panel-muted) transition-transform ' +
                      (isOpen ? 'rotate-90' : '')
                    }
                  />
                  <Flag
                    size={14}
                    aria-hidden
                    className="shrink-0 text-(--color-ribbon-link)"
                  />
                  <span className="text-sm font-semibold text-(--color-panel-heading)">
                    {rc.title}
                  </span>
                  <span className="text-[11px] text-(--color-panel-muted)">
                    {rc.definingObjectives.length} DO ·{' '}
                    <span data-testid={`rc-${rc.id}-outcome-count`}>{countOutcomes(rc)}</span>{' '}
                    Outcomes ·{' '}
                    <span data-testid={`rc-${rc.id}-so-count`}>{countSupporting(rc)}</span> SOs
                  </span>
                </button>
                {isOpen ? (
                  <div className="mt-3 space-y-2 border-l-2 border-(--color-ribbon-link) pl-4">
                    {rc.definingObjectives.length > 0 ? (
                      rc.definingObjectives.map((defo) => (
                        <DefiningObjectiveRow key={defo.id} defo={defo} />
                      ))
                    ) : (
                      <p className="text-xs italic text-(--color-panel-muted)">
                        No Defining Objectives yet.
                      </p>
                    )}
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setArchiveTarget({ id: rc.id, title: rc.title })}
                        data-testid={`archive-rc-${rc.id}`}
                        className="rounded-md border border-(--color-panel-border) bg-transparent px-3 py-1 text-[11px] font-medium text-(--color-panel-cell) hover:border-(--color-shell-error) hover:text-(--color-shell-error)"
                      >
                        Archive Rally Cry
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
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
            <h3 id="archive-rc-title" className="text-sm font-semibold text-(--color-panel-heading)">
              Archive this Rally Cry?
            </h3>
            <p className="mt-1.5 text-xs text-(--color-panel-muted)">
              &ldquo;{archiveTarget.title}&rdquo;
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

function DefiningObjectiveRow({ defo }: { defo: DefiningObjective }) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-sm text-(--color-panel-cell)">
        <Compass size={12} aria-hidden className="shrink-0 text-(--color-ribbon-medium-fg)" />
        <span>{defo.title}</span>
        <span className="text-[11px] text-(--color-panel-muted)">
          · {defo.outcomes.length} Outcome{defo.outcomes.length === 1 ? '' : 's'}
        </span>
      </p>
      {defo.outcomes.length > 0 ? (
        <ul className="space-y-1.5 border-l border-(--color-panel-border) pl-4">
          {defo.outcomes.map((o) => (
            <OutcomeRow key={o.id} outcome={o} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function OutcomeRow({ outcome }: { outcome: Outcome }) {
  return (
    <li className="space-y-1">
      <p className="flex items-center gap-2 text-xs text-(--color-panel-cell)">
        <Goal size={12} aria-hidden className="shrink-0 text-(--color-panel-heading)" />
        <span>{outcome.title}</span>
        <span className="text-[10px] text-(--color-panel-muted)">
          · {outcome.supportingOutcomes.length} SO
          {outcome.supportingOutcomes.length === 1 ? '' : 's'}
        </span>
      </p>
      {outcome.supportingOutcomes.length > 0 ? (
        <ul className="space-y-0.5 border-l border-dashed border-(--color-panel-border) pl-4">
          {outcome.supportingOutcomes.map((so) => (
            <li
              key={so.id}
              className="flex items-center gap-2 text-[11px] text-(--color-panel-muted)"
            >
              <Target size={10} aria-hidden className="shrink-0 opacity-60" />
              <span>{so.title}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function countOutcomes(rc: RallyCry): number {
  let n = 0;
  for (const dobj of rc.definingObjectives) n += dobj.outcomes.length;
  return n;
}

function countSupporting(rc: RallyCry): number {
  let n = 0;
  for (const dobj of rc.definingObjectives) {
    for (const o of dobj.outcomes) n += o.supportingOutcomes.length;
  }
  return n;
}

function filterTree(rallyCries: RallyCry[], q: string): RallyCry[] {
  if (q.length === 0) return rallyCries;
  return rallyCries.filter((rc) => {
    if (rc.title.toLowerCase().includes(q)) return true;
    for (const dobj of rc.definingObjectives) {
      if (dobj.title.toLowerCase().includes(q)) return true;
      for (const o of dobj.outcomes) {
        if (o.title.toLowerCase().includes(q)) return true;
        for (const so of o.supportingOutcomes) {
          if (so.title.toLowerCase().includes(q)) return true;
        }
      }
    }
    return false;
  });
}
