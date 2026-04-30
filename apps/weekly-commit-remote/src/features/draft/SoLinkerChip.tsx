import type { OutcomeCandidateDto } from '@throughline/shared-types';

interface SoLinkerChipProps {
  candidate: OutcomeCandidateDto;
  /** Render with a subtle "AI suggested" tint until the user touches the chip. */
  aiSuggested?: boolean;
  /** Click "change" → caller opens the typeahead. */
  onChange: () => void;
  disabled?: boolean;
}

/**
 * Breadcrumb chip "Rally Cry > Defining Objective > Outcome > Supporting Outcome".
 * Renders the full path so the audience sees the depth of the structured graph.
 * The chip's leaf segment (SO title) is bolded; ancestor segments are muted and
 * truncated when they would overflow.
 */
export function SoLinkerChip({ candidate, aiSuggested, onChange, disabled }: SoLinkerChipProps) {
  const tintClass = aiSuggested
    ? 'border-(--color-ai-suggest)/40 bg-(--color-ai-suggest)/5'
    : 'border-(--color-commit-border) bg-(--color-shell-bg)';

  return (
    <div
      data-testid="so-linker-chip"
      data-ai-suggested={aiSuggested ? 'true' : 'false'}
      className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 ${tintClass}`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5 text-xs">
        <Crumb text={candidate.parentRallyCryTitle} muted />
        <Sep />
        <Crumb text={candidate.parentDOTitle} muted />
        <Sep />
        <Crumb text={candidate.parentOutcomeTitle} muted />
        <Sep />
        <span
          className="truncate font-semibold text-(--color-shell-text)"
          data-testid="so-linker-chip-leaf"
          title={candidate.title}
        >
          {candidate.title}
        </span>
      </div>
      <button
        type="button"
        onClick={onChange}
        disabled={disabled}
        data-testid="so-linker-chip-change"
        className="shrink-0 rounded-md border border-(--color-panel-border) bg-transparent px-2 py-0.5 text-xs font-medium text-(--color-panel-cell) hover:border-(--color-ribbon-link) disabled:cursor-not-allowed disabled:opacity-40"
      >
        Change
      </button>
    </div>
  );
}

function Crumb({ text, muted }: { text: string; muted?: boolean }) {
  return (
    <span
      className={`max-w-[12ch] truncate ${muted ? 'text-(--color-shell-muted)' : 'text-(--color-shell-text)'}`}
      title={text}
    >
      {text}
    </span>
  );
}

function Sep() {
  return (
    <span aria-hidden className="shrink-0 text-(--color-shell-muted)">
      ›
    </span>
  );
}
