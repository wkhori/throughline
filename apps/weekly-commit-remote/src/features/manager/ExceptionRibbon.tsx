import type { RibbonEntry } from '../../api/managerEndpoints.js';

interface ExceptionRibbonProps {
  items: RibbonEntry[];
  onDrillDown?: (entry: RibbonEntry) => void;
}

const SEVERITY_CLASS: Record<string, string> = {
  HIGH: 'bg-(--ribbon-high-bg) text-(--ribbon-high-fg)',
  MEDIUM: 'bg-(--ribbon-medium-bg) text-(--ribbon-medium-fg)',
  LOW: 'bg-(--ribbon-low-bg) text-(--ribbon-low-fg)',
};

export function ExceptionRibbon({ items, onDrillDown }: ExceptionRibbonProps) {
  if (items.length === 0) return null;
  return (
    <section data-testid="exception-ribbon" aria-label="Exception ribbon" className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-(--ribbon-heading)">
        Exceptions worth your attention
      </h2>
      <ul className="space-y-1">
        {items.map((entry, idx) => (
          <li
            key={`${entry.kind}-${entry.entityId}-${idx}`}
            data-testid="ribbon-item"
            className="flex items-center gap-3 rounded-md border border-(--ribbon-border) bg-(--ribbon-bg) px-3 py-2 text-sm"
          >
            <span
              className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-xs font-medium ${
                SEVERITY_CLASS[entry.severity] ?? ''
              }`}
              data-testid="ribbon-severity"
            >
              {entry.severity}
            </span>
            <span className="grow text-(--ribbon-label)">{entry.label}</span>
            {onDrillDown ? (
              <button
                type="button"
                onClick={() => onDrillDown(entry)}
                data-testid="ribbon-drilldown"
                className="text-xs text-(--ribbon-link) hover:underline"
              >
                Drill in →
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
