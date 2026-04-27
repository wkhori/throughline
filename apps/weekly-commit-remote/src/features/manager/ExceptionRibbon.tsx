import { useState } from 'react';
import { useAckAlignmentRiskMutation, type RibbonEntry } from '../../api/managerEndpoints.js';

interface ExceptionRibbonProps {
  items: RibbonEntry[];
  onDrillDown?: (entry: RibbonEntry) => void;
}

const SEVERITY_CLASS: Record<string, string> = {
  HIGH: 'bg-(--color-ribbon-high-bg) text-(--color-ribbon-high-fg)',
  MEDIUM: 'bg-(--color-ribbon-medium-bg) text-(--color-ribbon-medium-fg)',
  LOW: 'bg-(--color-ribbon-low-bg) text-(--color-ribbon-low-fg)',
};

export function ExceptionRibbon({ items, onDrillDown }: ExceptionRibbonProps) {
  const [ack, ackState] = useAckAlignmentRiskMutation();
  const [errorIds, setErrorIds] = useState<Record<string, string>>({});

  if (items.length === 0) return null;

  const handleAck = async (riskId: string) => {
    try {
      await ack(riskId).unwrap();
      setErrorIds((prev) => {
        const next = { ...prev };
        delete next[riskId];
        return next;
      });
    } catch (e) {
      const message =
        e && typeof e === 'object' && 'status' in e
          ? `Ack failed (status ${(e as { status?: number }).status ?? '?'})`
          : 'Ack failed — try again.';
      setErrorIds((prev) => ({ ...prev, [riskId]: message }));
    }
  };

  return (
    <section data-testid="exception-ribbon" aria-label="Exception ribbon" className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-(--color-ribbon-heading)">
        Exceptions worth your attention
      </h2>
      <ul className="space-y-2">
        {items.map((entry, idx) => {
          const riskId = entry.alignmentRiskId;
          const ackError = riskId ? errorIds[riskId] : undefined;
          const ackInFlight = ackState.isLoading && ackState.originalArgs === riskId;
          return (
            <li
              key={`${entry.kind}-${entry.entityId}-${idx}`}
              data-testid="ribbon-item"
              className="flex flex-col gap-1.5 rounded-md border border-(--color-ribbon-border) bg-(--color-ribbon-bg) px-4 py-3 text-sm"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                    SEVERITY_CLASS[entry.severity] ?? ''
                  }`}
                  data-testid="ribbon-severity"
                >
                  {entry.severity}
                </span>
                <span className="grow text-(--color-ribbon-label)">{entry.label}</span>
                {onDrillDown ? (
                  <button
                    type="button"
                    onClick={() => onDrillDown(entry)}
                    data-testid="ribbon-drilldown"
                    className="text-xs font-medium text-(--color-ribbon-link) hover:underline"
                  >
                    Drill in →
                  </button>
                ) : null}
                {riskId ? (
                  <button
                    type="button"
                    onClick={() => handleAck(riskId)}
                    disabled={ackInFlight}
                    data-testid="ribbon-ack"
                    aria-label="Acknowledge alignment risk"
                    className="text-xs font-medium text-(--color-ribbon-link) hover:underline disabled:opacity-50"
                  >
                    {ackInFlight ? 'Acking…' : 'Ack'}
                  </button>
                ) : null}
              </div>
              {ackError ? (
                <p
                  data-testid="ribbon-ack-error"
                  role="alert"
                  className="text-xs text-(--color-shell-error)"
                >
                  {ackError}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
