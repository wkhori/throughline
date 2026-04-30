import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import type { OutcomeCandidateDto } from '@throughline/shared-types';

interface SoLinkerTypeaheadProps {
  candidates: OutcomeCandidateDto[];
  onPick: (candidate: OutcomeCandidateDto) => void;
  onClose?: () => void;
  /** Optional initial query (e.g., the commit text). */
  initialQuery?: string;
  disabled?: boolean;
}

/**
 * Search-and-pick listbox over every Supporting Outcome in the org's RCDO tree.
 * Each row shows the full breadcrumb so the IC sees the strategic anchor. Keyboard
 * driven: ArrowUp/Down move the active row, Enter picks, Esc closes.
 */
export const SoLinkerTypeahead = forwardRef<HTMLInputElement, SoLinkerTypeaheadProps>(
  function SoLinkerTypeahead(
    { candidates, onPick, onClose, initialQuery = '', disabled }: SoLinkerTypeaheadProps,
    ref,
  ) {
    const [query, setQuery] = useState(initialQuery);
    const [activeIndex, setActiveIndex] = useState(0);
    const listRef = useRef<HTMLUListElement>(null);

    const filtered = useMemo(() => filterCandidates(candidates, query), [candidates, query]);

    // Reset active row whenever the result set changes.
    useEffect(() => {
      setActiveIndex(0);
    }, [query, candidates]);

    // Keep the active row scrolled into view.
    useEffect(() => {
      const el = listRef.current?.querySelector<HTMLLIElement>(`[data-index="${activeIndex}"]`);
      el?.scrollIntoView?.({ block: 'nearest' });
    }, [activeIndex]);

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return;
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((i) => Math.min(filtered.length - 1, i + 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((i) => Math.max(0, i - 1));
          break;
        case 'Enter': {
          e.preventDefault();
          const picked = filtered[activeIndex];
          if (picked) onPick(picked);
          break;
        }
        case 'Escape':
          e.preventDefault();
          onClose?.();
          break;
        case 'Home':
          e.preventDefault();
          setActiveIndex(0);
          break;
        case 'End':
          e.preventDefault();
          setActiveIndex(Math.max(0, filtered.length - 1));
          break;
      }
    };

    return (
      <div
        data-testid="so-linker-typeahead"
        className="rounded-md border border-(--color-panel-border) bg-(--color-shell-bg) p-2"
      >
        <input
          ref={ref}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          autoComplete="off"
          aria-label="Search Supporting Outcomes"
          placeholder="Search Supporting Outcomes…"
          data-testid="so-linker-input"
          className="w-full rounded-md border border-(--color-panel-border) bg-(--color-shell-bg) px-3 py-2 text-sm text-(--color-shell-text) placeholder:text-(--color-shell-muted) focus:border-(--color-ribbon-link) focus:outline-none focus:ring-2 focus:ring-(--color-ribbon-link)/30 disabled:cursor-not-allowed disabled:opacity-40"
        />
        <ul
          ref={listRef}
          role="listbox"
          aria-label="Supporting Outcome results"
          data-testid="so-linker-results"
          className="mt-1.5 max-h-64 overflow-auto"
        >
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-xs italic text-(--color-shell-muted)">No matches.</li>
          )}
          {filtered.map((c, idx) => {
            const isActive = idx === activeIndex;
            return (
              <li
                key={c.supportingOutcomeId}
                data-index={idx}
                data-value={c.supportingOutcomeId}
                role="option"
                aria-selected={isActive}
                data-testid="so-linker-result"
                onMouseEnter={() => setActiveIndex(idx)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onPick(c);
                }}
                className={`flex cursor-pointer flex-col gap-0.5 rounded-md px-3 py-2 text-xs ${
                  isActive
                    ? 'bg-(--color-ribbon-link)/10 text-(--color-shell-text)'
                    : 'text-(--color-shell-text)'
                }`}
              >
                <span className="font-semibold">{c.title}</span>
                <span className="truncate text-(--color-shell-muted)">
                  {c.parentRallyCryTitle} › {c.parentDOTitle} › {c.parentOutcomeTitle}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  },
);

function filterCandidates(candidates: OutcomeCandidateDto[], query: string): OutcomeCandidateDto[] {
  const q = query.trim().toLowerCase();
  if (!q) return candidates;
  return candidates.filter((c) => {
    const hay =
      `${c.title} ${c.parentOutcomeTitle} ${c.parentDOTitle} ${c.parentRallyCryTitle}`.toLowerCase();
    return hay.includes(q);
  });
}
