import { useEffect, useMemo, useState } from 'react';
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
      <RcdoCascade
        tree={rcdo}
        value={supportingOutcomeId}
        onChange={(v) => {
          setSO(v);
          setManualSelectAt(Date.now());
        }}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
  disabled?: boolean;
}

function SelectField({ id, label, value, onChange, options, testId, disabled }: SelectFieldProps) {
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
        disabled={disabled}
        className="w-full rounded-md border border-(--color-panel-border) bg-(--color-shell-bg) px-3 py-2 text-sm text-(--color-shell-text) disabled:cursor-not-allowed disabled:opacity-40"
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

interface RcdoCascadeProps {
  tree: RcdoTreeDto | undefined;
  value: string;
  onChange: (supportingOutcomeId: string) => void;
}

// Cascading 4-step picker (Rally Cry → DO → Outcome → Supporting Outcome). Each level is only
// enabled once its parent is chosen. Replaces the flat 144-option dropdown — manageable scan,
// no hunting through repeated prefixes.
function RcdoCascade({ tree, value, onChange }: RcdoCascadeProps) {
  const ancestry = useMemo(() => findAncestry(tree, value), [tree, value]);
  const [rcId, setRcId] = useState<string>(ancestry?.rcId ?? '');
  const [doId, setDoId] = useState<string>(ancestry?.doId ?? '');
  const [outcomeId, setOutcomeId] = useState<string>(ancestry?.outcomeId ?? '');

  useEffect(() => {
    if (ancestry) {
      setRcId(ancestry.rcId);
      setDoId(ancestry.doId);
      setOutcomeId(ancestry.outcomeId);
    }
  }, [ancestry]);

  const rallyCries = tree?.rallyCries ?? [];
  const rc = rallyCries.find((r) => r.id === rcId);
  const dos = rc?.definingObjectives ?? [];
  const defo = dos.find((d) => d.id === doId);
  const outcomes = defo?.outcomes ?? [];
  const outcome = outcomes.find((o) => o.id === outcomeId);
  const sos = outcome?.supportingOutcomes ?? [];

  return (
    <div data-testid="commit-so-cascade" className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SelectField
          id="commit-rc"
          label="Rally Cry"
          value={rcId}
          onChange={(v) => {
            setRcId(v);
            setDoId('');
            setOutcomeId('');
            onChange('');
          }}
          options={rallyCries.map((r) => ({ value: r.id, label: r.title }))}
          testId="commit-rc-select"
        />
        <SelectField
          id="commit-do"
          label="Defining Objective"
          value={doId}
          onChange={(v) => {
            setDoId(v);
            setOutcomeId('');
            onChange('');
          }}
          options={dos.map((d) => ({ value: d.id, label: d.title }))}
          testId="commit-do-select"
          disabled={!rcId}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SelectField
          id="commit-outcome"
          label="Outcome"
          value={outcomeId}
          onChange={(v) => {
            setOutcomeId(v);
            onChange('');
          }}
          options={outcomes.map((o) => ({ value: o.id, label: o.title }))}
          testId="commit-outcome-select"
          disabled={!doId}
        />
        <SelectField
          id="commit-so"
          label="Supporting Outcome"
          value={value}
          onChange={onChange}
          options={sos.map((so) => ({ value: so.id, label: so.title }))}
          testId="commit-so-select"
          disabled={!outcomeId}
        />
      </div>
    </div>
  );
}

function findAncestry(
  tree: RcdoTreeDto | undefined,
  supportingOutcomeId: string,
): { rcId: string; doId: string; outcomeId: string } | null {
  if (!tree || !supportingOutcomeId) return null;
  for (const rc of tree.rallyCries) {
    for (const defo of rc.definingObjectives) {
      for (const o of defo.outcomes) {
        if (o.supportingOutcomes.some((so) => so.id === supportingOutcomeId)) {
          return { rcId: rc.id, doId: defo.id, outcomeId: o.id };
        }
      }
    }
  }
  return null;
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
