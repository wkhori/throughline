import { useEffect, useRef, useState, type ReactNode } from 'react';

export type InsightDrillDownEntityType =
  | 'commit'
  | 'supporting_outcome'
  | 'user'
  | 'team'
  | 'rally_cry'
  | 'note';

export type InsightSeverity = 'info' | 'warning' | 'critical';

export interface InsightDrillDownEntity {
  entityType: InsightDrillDownEntityType;
  entityId: string;
  /** Optional pre-resolved label so the trigger can render rich text without a separate fetch. */
  label?: string;
  /** Optional inline detail (e.g., AI reasoning) rendered in the drawer when no fetch is available. */
  detailText?: string;
  /** Visual severity: drives chip border + drawer accent stripe. Defaults to 'info'. */
  severity?: InsightSeverity;
}

export interface InsightDrillDownProps {
  entities: InsightDrillDownEntity[];
  /** Custom trigger renderer; default is a small inline pill. */
  renderTrigger?: (entity: InsightDrillDownEntity, label: string) => ReactNode;
  /** Renders the drawer body for the selected entity — typically wired to RTK Query fetches. */
  renderDetail?: (entity: InsightDrillDownEntity) => ReactNode;
}

/**
 * Every AI claim is one click away from its evidence. Each entity is rendered
 * as a chip; clicking opens a side drawer with the per-entity detail. The drawer
 * surface is opaque so it sits cleanly over text-heavy parent views.
 */
export function InsightDrillDown({ entities, renderTrigger, renderDetail }: InsightDrillDownProps) {
  const [open, setOpen] = useState<InsightDrillDownEntity | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
    };
    window.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (entities.length === 0) return null;

  return (
    <span data-testid="insight-drill-down">
      {entities.map((e, idx) => {
        const label = e.label ?? `${e.entityType}:${e.entityId}`;
        const trigger = renderTrigger ? (
          renderTrigger(e, label)
        ) : (
          <DefaultTrigger label={label} severity={e.severity ?? 'info'} />
        );
        return (
          <span
            key={`${e.entityType}:${e.entityId}:${idx}`}
            data-testid="insight-drill-trigger"
            data-entity-type={e.entityType}
            data-entity-id={e.entityId}
            data-severity={e.severity ?? 'info'}
            className="mr-1.5 mb-1 inline-block cursor-pointer"
            onClick={(ev) => {
              ev.preventDefault();
              setOpen(e);
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter' || ev.key === ' ') {
                ev.preventDefault();
                setOpen(e);
              }
            }}
          >
            {trigger}
          </span>
        );
      })}
      {open ? (
        <>
          <div
            data-testid="insight-drill-backdrop"
            aria-hidden="true"
            onClick={() => setOpen(null)}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
          />
          <div
            role="dialog"
            aria-modal="true"
            data-testid="insight-drill-drawer"
            data-severity={open.severity ?? 'info'}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-(--color-panel-border) bg-(--color-panel-bg) text-(--color-panel-cell) shadow-2xl"
          >
            <div
              aria-hidden
              className={
                'h-1 w-full ' +
                (open.severity === 'critical'
                  ? 'bg-(--color-shell-error)'
                  : open.severity === 'warning'
                    ? 'bg-(--color-ribbon-medium-bg)'
                    : 'bg-(--color-ribbon-link)')
              }
            />
            <header className="flex items-start justify-between gap-3 border-b border-(--color-panel-border) px-5 py-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-(--color-panel-muted)">
                  {open.entityType.replace(/_/g, ' ')}
                </p>
                <h3 className="mt-0.5 text-sm font-semibold text-(--color-panel-heading)">
                  {open.label ?? open.entityId}
                </h3>
              </div>
              <button
                ref={closeRef}
                type="button"
                data-testid="insight-drill-close"
                onClick={() => setOpen(null)}
                aria-label="Close"
                className="rounded-md p-1 text-(--color-panel-muted) transition-colors hover:bg-(--color-skeleton-bg) hover:text-(--color-panel-heading)"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                >
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </header>
            <div className="flex-1 overflow-auto px-5 py-4 text-xs text-(--color-panel-cell)">
              {renderDetail ? (
                renderDetail(open)
              ) : (
                <pre
                  data-testid="insight-drill-detail-default"
                  className="whitespace-pre-wrap break-all"
                >
                  {JSON.stringify(open, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </>
      ) : null}
    </span>
  );
}

function DefaultTrigger({ label, severity }: { label: string; severity: InsightSeverity }) {
  const tone =
    severity === 'critical'
      ? 'border-(--color-shell-error) text-(--color-shell-error) hover:bg-(--color-shell-error)/10'
      : severity === 'warning'
        ? 'border-(--color-ribbon-medium-fg) text-(--color-ribbon-medium-fg) hover:bg-(--color-ribbon-medium-bg)'
        : 'border-(--color-panel-border) text-(--color-panel-heading) hover:border-(--color-shell-text) hover:bg-(--color-skeleton-bg)';
  return (
    <span
      className={
        'inline-flex items-center gap-1 rounded-md border bg-(--color-panel-bg) px-1.5 py-0.5 text-[11px] font-medium transition-all hover:shadow-[0_0_0_3px_var(--color-skeleton-bg)] ' +
        tone
      }
    >
      <span>{label}</span>
      <svg
        width="9"
        height="9"
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 2 L8 6 L4 10" />
      </svg>
    </span>
  );
}
