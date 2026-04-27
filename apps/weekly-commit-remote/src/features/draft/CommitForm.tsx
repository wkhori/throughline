import { useMemo, useState } from 'react';
import type {
  CommitCategory,
  CommitDto,
  CommitPriority,
  CreateCommitRequest,
  OutcomeCandidateDto,
  RcdoTreeDto,
} from '@throughline/shared-types';
import { AiSuggestionPanel } from './AiSuggestionPanel.js';
import { CommitQualityHint } from './CommitQualityHint.js';

interface CommitFormProps {
  weekId: string;
  rcdo?: RcdoTreeDto;
  initial?: CommitDto;
  submitting?: boolean;
  onSubmit: (body: CreateCommitRequest) => Promise<void> | void;
  onCancel?: () => void;
  serverError?: string | null;
}

// Phase-2 commit composer / editor. Mirrors the backend constraints (5–280 chars, requires SO,
// category/priority enum). Used inline inside DraftWeek and re-used by the future edit drawer.
export function CommitForm({
  weekId,
  rcdo,
  initial,
  submitting,
  onSubmit,
  onCancel,
  serverError,
}: CommitFormProps) {
  const [text, setText] = useState(initial?.text ?? '');
  const [supportingOutcomeId, setSO] = useState<string>(initial?.supportingOutcomeId ?? '');
  const [category, setCategory] = useState<CommitCategory>(initial?.category ?? 'OPERATIONAL');
  const [priority, setPriority] = useState<CommitPriority>(initial?.priority ?? 'SHOULD');
  const [manualSelectAt, setManualSelectAt] = useState<number | null>(null);

  const tooShort = text.trim().length < 5;
  const tooLong = text.length > 280;
  const noSO = supportingOutcomeId === '';
  const disabled = tooShort || tooLong || noSO || submitting;

  const candidates: OutcomeCandidateDto[] = useMemo(() => flattenCandidates(rcdo), [rcdo]);
  const supportingOutcomeTitle = useMemo(() => {
    const match = candidates.find((c) => c.supportingOutcomeId === supportingOutcomeId);
    return match?.title ?? null;
  }, [candidates, supportingOutcomeId]);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled) return;
    await onSubmit({
      weekId,
      text: text.trim(),
      supportingOutcomeId,
      category,
      priority,
    });
    if (!initial) {
      setText('');
      setSO('');
      setCategory('OPERATIONAL');
      setPriority('SHOULD');
    }
  };

  return (
    <form
      onSubmit={handle}
      data-testid="commit-form"
      className="space-y-4 rounded-lg border border-(--color-panel-border) bg-(--color-panel-bg) p-5"
    >
      <div>
        <label
          htmlFor="commit-text"
          className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-(--color-shell-muted)"
        >
          Commit
        </label>
        <input
          id="commit-text"
          type="text"
          value={text}
          maxLength={280}
          placeholder="A specific, ship-able commitment for the week"
          onChange={(e) => setText(e.target.value)}
          className="w-full rounded-md border border-(--color-panel-border) bg-(--color-shell-bg) px-3 py-2 text-sm text-(--color-shell-text) placeholder:text-(--color-shell-muted) focus:outline-none"
          data-testid="commit-text-input"
        />
        <p className="mt-1.5 text-xs text-(--color-shell-muted)" data-testid="commit-text-counter">
          {text.length}/280
        </p>
        <CommitQualityHint
          commitId={initial?.id ?? `draft-${weekId}`}
          commitText={text}
          category={category}
          priority={priority}
          supportingOutcomeTitle={supportingOutcomeTitle}
        />
        <AiSuggestionPanel
          draftCommitText={text}
          candidates={candidates}
          manuallySelectedAt={manualSelectAt}
          onAccept={(soId) => {
            setSO(soId);
            setManualSelectAt(null);
          }}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SelectField
          id="commit-so"
          label="Supporting Outcome"
          value={supportingOutcomeId}
          onChange={(v) => {
            setSO(v);
            setManualSelectAt(Date.now());
          }}
          options={flattenSO(rcdo)}
          testId="commit-so-select"
        />
        <SelectField
          id="commit-category"
          label="Category"
          value={category}
          onChange={(v) => setCategory(v as CommitCategory)}
          options={[
            { value: 'STRATEGIC', label: 'Strategic' },
            { value: 'OPERATIONAL', label: 'Operational' },
            { value: 'REACTIVE', label: 'Reactive' },
          ]}
          testId="commit-category-select"
        />
        <SelectField
          id="commit-priority"
          label="Priority"
          value={priority}
          onChange={(v) => setPriority(v as CommitPriority)}
          options={[
            { value: 'MUST', label: 'Must' },
            { value: 'SHOULD', label: 'Should' },
            { value: 'COULD', label: 'Could' },
          ]}
          testId="commit-priority-select"
        />
      </div>
      {serverError && (
        <p
          role="alert"
          className="text-xs text-(--color-shell-error)"
          data-testid="commit-form-error"
        >
          {serverError}
        </p>
      )}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-(--color-panel-border) bg-transparent px-3 py-1.5 text-xs font-medium text-(--color-panel-cell) hover:bg-(--color-skeleton-bg)"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={disabled}
          data-testid="commit-form-submit"
          className="rounded-md bg-(--color-shell-text) px-3 py-1.5 text-xs font-medium text-(--color-shell-bg) transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? 'Saving…' : initial ? 'Update' : 'Add commit'}
        </button>
      </div>
    </form>
  );
}

interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  testId: string;
}

function SelectField({ id, label, value, onChange, options, testId }: SelectFieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-(--color-shell-muted)"
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-(--color-panel-border) bg-(--color-shell-bg) px-3 py-2 text-sm text-(--color-shell-text)"
        data-testid={testId}
      >
        <option value="" disabled>
          Select…
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function flattenSO(tree: RcdoTreeDto | undefined): SelectOption[] {
  if (!tree) return [];
  const out: SelectOption[] = [];
  for (const rc of tree.rallyCries) {
    for (const defo of rc.definingObjectives) {
      for (const o of defo.outcomes) {
        for (const so of o.supportingOutcomes) {
          out.push({ value: so.id, label: `${rc.title} › ${o.title} › ${so.title}` });
        }
      }
    }
  }
  return out;
}

function flattenCandidates(tree: RcdoTreeDto | undefined): OutcomeCandidateDto[] {
  if (!tree) return [];
  const out: OutcomeCandidateDto[] = [];
  for (const rc of tree.rallyCries) {
    for (const defo of rc.definingObjectives) {
      for (const o of defo.outcomes) {
        for (const so of o.supportingOutcomes) {
          out.push({
            supportingOutcomeId: so.id,
            title: so.title,
            parentOutcomeTitle: o.title,
            parentDOTitle: defo.title,
            parentRallyCryTitle: rc.title,
          });
        }
      }
    }
  }
  return out;
}
