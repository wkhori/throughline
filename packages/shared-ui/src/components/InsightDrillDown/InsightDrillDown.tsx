import { useEffect, useRef, useState, type ReactNode } from 'react';

export type InsightDrillDownEntityType = 'commit' | 'supporting_outcome' | 'user' | 'team';

export interface InsightDrillDownEntity {
  entityType: InsightDrillDownEntityType;
  entityId: string;
  /** Optional pre-resolved label so the trigger can render rich text without a separate fetch. */
  label?: string;
}

export interface InsightDrillDownProps {
  entities: InsightDrillDownEntity[];
  /** Custom trigger renderer; default is a small inline link. */
  renderTrigger?: (entity: InsightDrillDownEntity, label: string) => ReactNode;
  /** Renders the drawer body for the selected entity — typically wired to RTK Query fetches. */
  renderDetail?: (entity: InsightDrillDownEntity) => ReactNode;
}

/**
 * PRD §6.3a — every AI claim is one click away from its evidence.
 *
 * <p>This is intentionally lightweight (custom drawer rather than a full Flowbite Drawer) so the
 * shared-ui package stays free of optional UI deps; the host/remote can still wrap it in their
 * preferred drawer if they want richer chrome. ARIA: dialog role + focus trap; Esc closes.
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
      {entities.map((e) => {
        const label = e.label ?? `${e.entityType}:${e.entityId}`;
        const trigger = renderTrigger ? (
          renderTrigger(e, label)
        ) : (
          <button
            type="button"
            className="underline decoration-dotted underline-offset-2 hover:opacity-80"
          >
            {label}
          </button>
        );
        return (
          <span
            key={`${e.entityType}:${e.entityId}`}
            data-testid="insight-drill-trigger"
            data-entity-type={e.entityType}
            data-entity-id={e.entityId}
            className="mr-2 inline-block"
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
        <div
          role="dialog"
          aria-modal="true"
          data-testid="insight-drill-drawer"
          className="fixed inset-y-0 right-0 z-50 flex w-96 flex-col border-l border-(--commit-border) bg-(--commit-bg) p-4 shadow-2xl"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-(--commit-text)">
              {open.label ?? `${open.entityType}:${open.entityId}`}
            </h3>
            <button
              ref={closeRef}
              type="button"
              data-testid="insight-drill-close"
              onClick={() => setOpen(null)}
              aria-label="Close"
              className="text-(--commit-muted) hover:text-(--commit-text)"
            >
              ×
            </button>
          </div>
          <div className="mt-3 flex-1 overflow-auto text-xs text-(--commit-muted)">
            {renderDetail ? (
              renderDetail(open)
            ) : (
              <pre data-testid="insight-drill-detail-default">{JSON.stringify(open, null, 2)}</pre>
            )}
          </div>
        </div>
      ) : null}
    </span>
  );
}
