import { forwardRef, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type {
  CommitCategory,
  CommitDto,
  CommitPriority,
  CreateCommitRequest,
  RcdoTreeDto,
} from '@throughline/shared-types';
import { CommitQualityHint } from './CommitQualityHint.js';
import { SoLinker, type SoLinkerHandle } from './SoLinker.js';

export interface CommitFormHandle {
  /** Focus the SO linker (used by the mod+K shortcut). */
  focusLinker: () => void;
}

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
// category/priority enum). The legacy 4-dropdown RCDO cascade is replaced by an AI-first
// <SoLinker> that infers the SO from the commit text and falls back to typeahead.
export const CommitForm = forwardRef<CommitFormHandle, CommitFormProps>(function CommitForm(
  { weekId, rcdo, initial, submitting, onSubmit, onCancel, serverError }: CommitFormProps,
  ref,
) {
  const [text, setText] = useState(initial?.text ?? '');
  const [supportingOutcomeId, setSO] = useState<string>(initial?.supportingOutcomeId ?? '');
  const [category, setCategory] = useState<CommitCategory>(initial?.category ?? 'OPERATIONAL');
  const [priority, setPriority] = useState<CommitPriority>(initial?.priority ?? 'SHOULD');

  const linkerRef = useRef<SoLinkerHandle | null>(null);

  const tooShort = text.trim().length < 5;
  const tooLong = text.length > 280;
  const noSO = supportingOutcomeId === '';
  const disabled = tooShort || tooLong || noSO || submitting;

  const supportingOutcomeTitle = useMemo(() => {
    return findSoTitle(rcdo, supportingOutcomeId);
  }, [rcdo, supportingOutcomeId]);

  // Expose a focus method so the mod+K binding can drop the cursor straight into the linker.
  const focusLinker = useCallback(() => {
    linkerRef.current?.focus();
  }, []);
  if (ref && typeof ref === 'object') {
    ref.current = { focusLinker };
  }

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
      </div>
      <SoLinker
        ref={linkerRef}
        rcdo={rcdo}
        commitText={text}
        value={supportingOutcomeId === '' ? null : supportingOutcomeId}
        onChange={(soId) => setSO(soId ?? '')}
        disabled={submitting}
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
});

function findSoTitle(tree: RcdoTreeDto | undefined, supportingOutcomeId: string): string | null {
  if (!tree || !supportingOutcomeId) return null;
  for (const rc of tree.rallyCries) {
    for (const defo of rc.definingObjectives) {
      for (const o of defo.outcomes) {
        for (const so of o.supportingOutcomes) {
          if (so.id === supportingOutcomeId) return so.title;
        }
      }
    }
  }
  return null;
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
  placeholder?: string;
}

// Custom dropdown: trigger button + portal-less popover listbox. Replaces native <select> so the
// chevron, padding, and option styling are fully ours (instead of OS-rendered). Click-outside
// closes; full keyboard nav (Up/Down/Home/End/Enter/Escape/Space); ARIA combobox + listbox.
function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  testId,
  disabled,
  placeholder = 'Select…',
}: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const reactId = useId();
  const listboxId = `${id}-listbox-${reactId}`;
  const selectedIndex = options.findIndex((o) => o.value === value);
  const selectedLabel = selectedIndex >= 0 ? (options[selectedIndex]?.label ?? null) : null;

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', handle);
    return () => window.removeEventListener('mousedown', handle);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [open, selectedIndex]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const el = listRef.current?.querySelector<HTMLLIElement>(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [open, activeIndex]);

  const commit = useCallback(
    (idx: number) => {
      const opt = options[idx];
      if (!opt) return;
      onChange(opt.value);
      setOpen(false);
    },
    [onChange, options],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((i) => Math.min(options.length - 1, (i < 0 ? -1 : i) + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, (i < 0 ? options.length : i) - 1));
        break;
      case 'Home':
        e.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (activeIndex >= 0) commit(activeIndex);
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-(--color-shell-muted)"
      >
        {label}
      </label>
      <button
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={
          open && activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined
        }
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        data-testid={testId}
        data-state={open ? 'open' : 'closed'}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-(--color-panel-border) bg-(--color-shell-bg) px-3 py-2 text-left text-sm text-(--color-shell-text) transition-colors hover:border-(--color-shell-text)/40 focus:border-(--color-ribbon-link) focus:outline-none focus:ring-2 focus:ring-(--color-ribbon-link)/30 disabled:cursor-not-allowed disabled:opacity-40 data-[state=open]:border-(--color-ribbon-link)"
      >
        <span
          className={`truncate ${selectedLabel ? '' : 'text-(--color-shell-muted)'}`}
          data-testid={`${testId}-value`}
        >
          {selectedLabel ?? placeholder}
        </span>
        <ChevronDownIcon open={open} />
      </button>
      {open && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          tabIndex={-1}
          aria-labelledby={id}
          data-testid={`${testId}-listbox`}
          className="absolute z-20 mt-1.5 max-h-64 w-full overflow-auto rounded-md border border-(--color-panel-border) bg-(--color-shell-bg) py-1 shadow-lg shadow-black/10"
        >
          {options.length === 0 && (
            <li className="px-3 py-2 text-xs italic text-(--color-shell-muted)">
              No options available
            </li>
          )}
          {options.map((o, idx) => {
            const isSelected = idx === selectedIndex;
            const isActive = idx === activeIndex;
            return (
              <li
                key={o.value}
                id={`${listboxId}-opt-${idx}`}
                data-index={idx}
                data-value={o.value}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActiveIndex(idx)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit(idx);
                }}
                className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm ${
                  isActive
                    ? 'bg-(--color-ribbon-link)/10 text-(--color-shell-text)'
                    : 'text-(--color-shell-text)'
                }`}
              >
                <CheckIcon visible={isSelected} />
                <span className="truncate">{o.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`shrink-0 text-(--color-shell-muted) transition-transform ${open ? 'rotate-180' : ''}`}
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

function CheckIcon({ visible }: { visible: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`shrink-0 text-(--color-ribbon-link) ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      <path d="M3.5 8.5l3 3 6-6" />
    </svg>
  );
}
