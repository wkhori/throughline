import { useState } from 'react';
import type {
  CommitCategory,
  CommitDto,
  CommitPriority,
  CreateCommitRequest,
  RcdoTreeDto,
} from '@throughline/shared-types';

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

  const tooShort = text.trim().length < 5;
  const tooLong = text.length > 280;
  const noSO = supportingOutcomeId === '';
  const disabled = tooShort || tooLong || noSO || submitting;

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
      className="space-y-3 rounded-md border border-(--form-border) bg-(--form-bg) p-4"
    >
      <div>
        <label
          htmlFor="commit-text"
          className="mb-1 block text-xs font-semibold uppercase text-(--form-label)"
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
          className="w-full rounded-md border border-(--form-input-border) bg-(--form-input-bg) px-3 py-2 text-sm"
          data-testid="commit-text-input"
        />
        <p className="mt-1 text-xs text-(--form-help)" data-testid="commit-text-counter">
          {text.length}/280
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <SelectField
          id="commit-so"
          label="Supporting Outcome"
          value={supportingOutcomeId}
          onChange={setSO}
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
        <p role="alert" className="text-xs text-(--form-error)" data-testid="commit-form-error">
          {serverError}
        </p>
      )}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-(--form-input-border) px-3 py-1 text-xs"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={disabled}
          data-testid="commit-form-submit"
          className="rounded-md bg-(--form-primary-bg) px-3 py-1 text-xs font-medium text-(--form-primary-fg) disabled:cursor-not-allowed disabled:opacity-50"
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
        className="mb-1 block text-xs font-semibold uppercase text-(--form-label)"
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-(--form-input-border) bg-(--form-input-bg) px-3 py-2 text-sm"
        data-testid={testId}
      >
        <option value="">Select…</option>
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
