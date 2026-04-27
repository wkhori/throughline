import { useState } from 'react';
import {
  useAckAlignmentRiskMutation,
  type RibbonEntry,
} from '../../api/managerEndpoints.js';

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
    <section data-testid="exception-ribbon" aria-label="Exception ribbon" className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-(--ribbon-heading)">
        Exceptions worth your attention
      </h2>
      <ul className="space-y-1">
        {items.map((entry, idx) => {
          const riskId = entry.alignmentRiskId;
          const ackError = riskId ? errorIds[riskId] : undefined;
          const ackInFlight = ackState.isLoading && ackState.originalArgs === riskId;
          return (
            <li
              key={`${entry.kind}-${entry.entityId}-${idx}`}
              data-testid="ribbon-item"
              className="flex flex-col gap-1 rounded-md border border-(--ribbon-border) bg-(--ribbon-bg) px-3 py-2 text-sm"
            >
              <div className="flex items-center gap-3">
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
                {riskId ? (
                  <button
                    type="button"
                    onClick={() => handleAck(riskId)}
                    disabled={ackInFlight}
                    data-testid="ribbon-ack"
                    aria-label="Acknowledge alignment risk"
                    className="text-xs text-(--ribbon-link) hover:underline disabled:opacity-50"
                  >
                    {ackInFlight ? 'Acking…' : 'Ack'}
                  </button>
                ) : null}
              </div>
              {ackError ? (
                <p
                  data-testid="ribbon-ack-error"
                  role="alert"
                  className="text-xs text-(--shell-error)"
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
