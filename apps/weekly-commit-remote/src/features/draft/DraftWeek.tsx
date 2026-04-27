import { useState } from 'react';
import { useRtkSubscriptionKick } from '@throughline/shared-ui';
import type { CommitDto, CreateCommitRequest, WeekDto } from '@throughline/shared-types';
import { useGetRcdoTreeQuery } from '../../api/rcdoEndpoints.js';
import { useCreateCommitMutation, useDeleteCommitMutation } from '../../api/commitsEndpoints.js';
import { useLockWeekMutation } from '../../api/weeksEndpoints.js';
import { ChessMatrix } from './ChessMatrix.js';
import { CommitForm } from './CommitForm.js';
import { LockWeekDialog } from './LockWeekDialog.js';

interface DraftWeekProps {
  week: WeekDto;
}

const MAX_COMMITS = 7;

// Phase-2 IC draft surface. Hosts the chess matrix + composer + lock dialog. All server
// interactions go through RTK Query mutations with tag invalidation; no raw fetch anywhere.
export function DraftWeek({ week }: DraftWeekProps) {
  useRtkSubscriptionKick();
  const { data: rcdo } = useGetRcdoTreeQuery();
  const [createCommit, createState] = useCreateCommitMutation();
  const [deleteCommit] = useDeleteCommitMutation();
  const [lockWeek, lockState] = useLockWeekMutation();
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const submit = async (body: CreateCommitRequest) => {
    setServerError(null);
    try {
      await createCommit(body).unwrap();
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 409) setServerError('You have hit the 7-commit cap for this week.');
      else if (status === 400)
        setServerError('That commit failed validation. Check the text and SO.');
      else setServerError('Could not save the commit. Try again.');
    }
  };

  const remove = async (commit: CommitDto) => {
    await deleteCommit({ id: commit.id, weekId: week.id })
      .unwrap()
      .catch(() => undefined);
  };

  const lock = async () => {
    setServerError(null);
    try {
      await lockWeek(week.id).unwrap();
      setConfirmOpen(false);
    } catch (err) {
      const status = (err as { status?: number }).status;
      setServerError(
        status === 400 ? 'Resolve the blockers above before locking.' : 'Lock failed.',
      );
    }
  };

  const atCap = week.commits.length >= MAX_COMMITS;

  return (
    <section data-testid="draft-week" className="mx-auto max-w-6xl space-y-8 p-6">
      <header className="flex flex-wrap items-end justify-between gap-4 rounded-lg border border-(--color-hero-border) bg-(--color-hero-bg) p-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-(--color-hero-muted)">
            Draft week
          </p>
          <h1 className="mt-1 text-xl font-semibold text-(--color-hero-heading)">
            Week of {week.weekStart}
          </h1>
          <p className="mt-1 text-sm text-(--color-hero-text)">
            {week.commits.length}/{MAX_COMMITS} commits placed on the chess matrix.
          </p>
        </div>
        <button
          type="button"
          disabled={week.commits.length === 0}
          onClick={() => setConfirmOpen(true)}
          data-testid="open-lock-dialog"
          className="rounded-md bg-(--color-shell-text) px-4 py-2 text-sm font-medium text-(--color-shell-bg) transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Lock week
        </button>
      </header>

      <aside
        data-testid="ai-copilot-banner"
        className="rounded-md border border-(--color-commit-border) bg-(--color-commit-bg) px-4 py-3 text-xs text-(--color-commit-text)"
      >
        <p className="font-semibold">AI Copilot is live on this draft.</p>
        <p className="mt-0.5 text-(--color-commit-muted)">
          Outcome suggestions and quality lint fire as you type a commit (≥15 chars). Drift warnings
          surface beneath any saved commit whose Supporting Outcome looks off.
        </p>
      </aside>

      <ChessMatrix commits={week.commits} rcdo={rcdo} weekState="DRAFT" onEditCommit={remove} />

      {atCap ? (
        <p
          className="rounded-md border border-(--color-ribbon-medium-bg) bg-(--color-ribbon-medium-bg) px-3 py-2 text-xs text-(--color-ribbon-medium-fg)"
          data-testid="commit-cap-notice"
        >
          At the 7-commit cap. Remove or rephrase before adding more.
        </p>
      ) : (
        <CommitForm
          weekId={week.id}
          rcdo={rcdo}
          submitting={createState.isLoading}
          onSubmit={submit}
          serverError={serverError}
        />
      )}

      <LockWeekDialog
        open={confirmOpen}
        commits={week.commits}
        submitting={lockState.isLoading}
        onConfirm={lock}
        onClose={() => setConfirmOpen(false)}
      />
    </section>
  );
}
