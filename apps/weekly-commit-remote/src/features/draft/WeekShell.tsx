import { useRef, useState } from 'react';
import { useRtkSubscriptionKick } from '@throughline/shared-ui';
import { useGetCurrentWeekQuery } from '../../api/weeksEndpoints.js';
import { DraftWeek } from './DraftWeek.js';
import { LockedWeek } from '../locked/LockedWeek.js';
import { Reconcile } from '../reconcile/Reconcile.js';
import { ReconciledWeek } from '../reconciled/ReconciledWeek.js';
import { ShortcutsHint } from '../help/ShortcutsHint.js';
import { ShortcutsModal } from '../help/ShortcutsModal.js';
import { useShortcuts } from '../../hooks/useShortcuts.js';
import type { CommitFormHandle } from './CommitForm.js';

// Top-level shell — switches between DRAFT / LOCKED / RECONCILING / RECONCILED views based on
// week.state from the current-week query. Owns the global shortcuts (?, mod+enter, mod+k, esc)
// and the cheat-sheet modal so they're available on every state, not just DRAFT.
export function WeekShell() {
  useRtkSubscriptionKick();
  const { data, isLoading } = useGetCurrentWeekQuery();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Refs threaded into DraftWeek so mod+Enter / mod+K stay wired to the composer when present.
  const formWrapperRef = useRef<HTMLDivElement | null>(null);
  const commitFormRef = useRef<CommitFormHandle | null>(null);

  useShortcuts(
    {
      '?': () => setShortcutsOpen(true),
      escape: () => setShortcutsOpen(false),
      'mod+enter': () => {
        const form = formWrapperRef.current?.querySelector<HTMLFormElement>('form');
        form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      },
      'mod+k': () => {
        commitFormRef.current?.focusLinker();
      },
    },
    { enabled: true },
  );

  if (isLoading && !data) {
    return (
      <div data-testid="week-shell-loading" className="space-y-4 p-6">
        <div className="h-24 animate-pulse rounded-lg bg-(--color-skeleton-bg)" />
        <div className="h-64 animate-pulse rounded-lg bg-(--color-skeleton-bg)" />
      </div>
    );
  }
  if (!data) {
    return (
      <p data-testid="week-shell-error" className="p-6 text-sm text-(--color-shell-error)">
        Could not load the current week.
      </p>
    );
  }

  let body;
  switch (data.state) {
    case 'DRAFT':
      body = (
        <DraftWeek week={data} formWrapperRef={formWrapperRef} commitFormRef={commitFormRef} />
      );
      break;
    case 'LOCKED':
      body = <LockedWeek week={data} />;
      break;
    case 'RECONCILING':
      body = <Reconcile week={data} />;
      break;
    case 'RECONCILED':
      body = <ReconciledWeek week={data} />;
      break;
    default:
      body = null;
  }

  return (
    <>
      {body}
      <ShortcutsHint onOpen={() => setShortcutsOpen(true)} />
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </>
  );
}
