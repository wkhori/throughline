import { useEffect, useRef, useState } from 'react';
import type {
  CommitCategory,
  CommitDto,
  CommitPriority,
  RcdoTreeDto,
} from '@throughline/shared-types';
import { CommitCard } from './CommitCard.js';

const CATEGORIES: CommitCategory[] = ['STRATEGIC', 'OPERATIONAL', 'REACTIVE'];
const PRIORITIES: CommitPriority[] = ['MUST', 'SHOULD', 'COULD'];

interface ChessMatrixProps {
  commits: CommitDto[];
  rcdo?: RcdoTreeDto;
  weekState: 'DRAFT' | 'LOCKED' | 'RECONCILING' | 'RECONCILED';
  onEditCommit?: (commit: CommitDto) => void;
}

// Phase-2 chess matrix: 3x3 category × priority grid. Keyboard nav via arrow keys; Enter selects
// a focused cell. Drag/drop is opt-in click-fallback in Phase 2 (full keyboard parity in Phase 7).
export function ChessMatrix({ commits, rcdo, weekState, onEditCommit }: ChessMatrixProps) {
  const [focused, setFocused] = useState<{ r: number; c: number } | null>(null);
  const cellRefs = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    if (!focused) return;
    const node = cellRefs.current.get(`${focused.r}:${focused.c}`);
    if (node && node !== document.activeElement) node.focus();
  }, [focused]);

  const onKey = (e: React.KeyboardEvent) => {
    if (!focused) return;
    let { r, c } = focused;
    if (e.key === 'ArrowDown') r = Math.min(r + 1, CATEGORIES.length - 1);
    else if (e.key === 'ArrowUp') r = Math.max(r - 1, 0);
    else if (e.key === 'ArrowRight') c = Math.min(c + 1, PRIORITIES.length - 1);
    else if (e.key === 'ArrowLeft') c = Math.max(c - 1, 0);
    else if (e.key === 'Escape') {
      setFocused(null);
      return;
    } else return;
    e.preventDefault();
    setFocused({ r, c });
  };

  return (
    <div
      role="grid"
      aria-label="Commit chess matrix: category by priority"
      data-testid="chess-matrix"
      onKeyDown={onKey}
      className="grid grid-cols-[140px_repeat(3,1fr)] gap-3 text-sm"
    >
      <div />
      {PRIORITIES.map((p) => (
        <div
          key={p}
          role="columnheader"
          className="text-[11px] font-semibold uppercase tracking-wide text-(--color-panel-muted)"
        >
          {p}
        </div>
      ))}
      {CATEGORIES.map((cat, r) => (
        <RowFragment
          key={cat}
          row={r}
          category={cat}
          commits={commits}
          rcdo={rcdo}
          weekState={weekState}
          focused={focused}
          setFocused={setFocused}
          cellRefs={cellRefs.current}
          onEditCommit={onEditCommit}
        />
      ))}
    </div>
  );
}

interface RowProps {
  row: number;
  category: CommitCategory;
  commits: CommitDto[];
  rcdo?: RcdoTreeDto;
  weekState: 'DRAFT' | 'LOCKED' | 'RECONCILING' | 'RECONCILED';
  focused: { r: number; c: number } | null;
  setFocused: (v: { r: number; c: number }) => void;
  cellRefs: Map<string, HTMLElement>;
  onEditCommit?: (commit: CommitDto) => void;
}

function RowFragment({
  row,
  category,
  commits,
  rcdo,
  weekState,
  focused,
  setFocused,
  cellRefs,
  onEditCommit,
}: RowProps) {
  return (
    <>
      <div
        role="rowheader"
        className="flex items-center text-[11px] font-semibold uppercase tracking-wide text-(--color-panel-muted)"
      >
        {category}
      </div>
      {PRIORITIES.map((priority, c) => {
        const inCell = commits.filter((cm) => cm.category === category && cm.priority === priority);
        const isFocused = focused?.r === row && focused?.c === c;
        return (
          <div
            key={priority}
            role="gridcell"
            tabIndex={focused === null && row === 0 && c === 0 ? 0 : isFocused ? 0 : -1}
            data-testid={`chess-cell-${category}-${priority}`}
            ref={(node) => {
              const key = `${row}:${c}`;
              if (node) cellRefs.set(key, node);
              else cellRefs.delete(key);
            }}
            onFocus={() => setFocused({ r: row, c })}
            className={
              'min-h-28 rounded-md border bg-(--color-panel-bg) p-3 transition-colors ' +
              (isFocused ? 'border-(--color-ribbon-link)' : 'border-(--color-panel-border)')
            }
          >
            {inCell.length === 0 ? (
              <p className="text-xs text-(--color-shell-muted)" aria-hidden>
                —
              </p>
            ) : (
              <div className="space-y-2">
                {inCell.map((cm) => (
                  <CommitCard
                    key={cm.id}
                    commit={cm}
                    rcdo={rcdo}
                    weekState={weekState}
                    onEdit={onEditCommit}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
