import { useGetOrgMetricsQuery } from '../../api/metricsEndpoints.js';

// Phase 7 — read-only metrics surface for ADMIN. Renders the four impact metrics from PRD §10.5
// (planning completion rate, reconciliation accuracy strict + weighted, manager digest view
// latency) plus the derived planning-session P50 ("time-to-plan").
//
// All metrics are reads — no editable controls. Backend enforces ADMIN scope via @PreAuthorize.
export function AdminMetricsPanel() {
  const { data, isLoading, error } = useGetOrgMetricsQuery();

  if (isLoading) {
    return (
      <p data-testid="metrics-loading" className="p-4 text-sm text-(--panel-muted)">
        Loading metrics…
      </p>
    );
  }
  if (error || !data) {
    return (
      <p data-testid="metrics-error" className="p-4 text-sm text-(--shell-error)">
        Could not load org metrics.
      </p>
    );
  }

  const cards: Array<{ id: string; label: string; value: string; help: string }> = [
    {
      id: 'planning-completion',
      label: 'Planning completion rate',
      value: pct(data.planningCompletionRate),
      help: 'Share of ICs whose current week is locked or beyond.',
    },
    {
      id: 'reconciliation-strict',
      label: 'Reconciliation accuracy (strict)',
      value: pct(data.reconciliationStrictPct),
      help: 'DONE / total reconciled commits, last 4 weeks.',
    },
    {
      id: 'reconciliation-weighted',
      label: 'Reconciliation accuracy (weighted)',
      value: pct(data.reconciliationWeightedPct),
      help: 'DONE × 1.0 + PARTIAL × 0.5, last 4 weeks.',
    },
    {
      id: 'digest-read-latency',
      label: 'Manager digest read latency',
      value: minutes(data.avgManagerDigestViewMinutesAfterDeliver),
      help: 'Average minutes between Slack digest and manager dashboard view.',
    },
    {
      id: 'planning-session-p50',
      label: 'Planning session length P50',
      value: minutes(data.planningSessionMinutesP50),
      help: 'P50 minutes between week opened and week locked.',
    },
  ];

  return (
    <section
      data-testid="admin-metrics-panel"
      aria-label="Org metrics"
      className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {cards.map((card) => (
        <article
          key={card.id}
          data-testid={`metric-card-${card.id}`}
          className="rounded-md border border-(--panel-border) bg-(--panel-bg) p-3"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-(--panel-muted)">
            {card.label}
          </p>
          <p className="mt-1 text-xl font-semibold text-(--panel-heading)">{card.value}</p>
          <p className="mt-1 text-xs text-(--panel-muted)">{card.help}</p>
        </article>
      ))}
    </section>
  );
}

function pct(rate: number): string {
  return `${(rate * 100).toFixed(0)}%`;
}

function minutes(value: number): string {
  if (value <= 0) return '—';
  if (value < 60) return `${Math.round(value)}m`;
  return `${(value / 60).toFixed(1)}h`;
}
