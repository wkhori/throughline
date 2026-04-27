import { useState } from 'react';
import { useRtkSubscriptionKick } from '@throughline/shared-ui';
import {
  useGetTeamRollupQuery,
  type RibbonEntry,
  type TeamRollupRow,
} from '../../api/managerEndpoints.js';
import { DigestHero } from './DigestHero.js';
import { ExceptionRibbon } from './ExceptionRibbon.js';
import { TeamMemberTable } from './TeamMemberTable.js';

interface ManagerDashboardProps {
  onSelectTeam?: (teamId: string) => void;
}

// Phase-4 manager landing page. Four regions:
// - DigestHero (P40 closeout): consumes /manager/digest/current; AWAITING_AI / OK / FALLBACK.
// - Starved-outcomes panel (deterministic, derived from rollup payload).
// - Drift-exceptions panel (deterministic, derived from rollup payload).
// - Exception ribbon (LONG_CARRY_FORWARD / PRIORITY_DRIFT / STARVED_OUTCOME) with Ack action.
// Plus the dense team roster table beneath.
export function ManagerDashboard({ onSelectTeam }: ManagerDashboardProps) {
  useRtkSubscriptionKick();
  const rollup = useGetTeamRollupQuery({ page: 0, size: 50 });
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const handleSelectTeam = (teamId: string) => {
    setSelectedTeamId(teamId);
    onSelectTeam?.(teamId);
  };

  // Only block on the skeleton if we genuinely have no data yet. Once the
  // cache holds a fulfilled response, render the dashboard even if RTK Query
  // is mid-refetch — `isLoading` can stay sticky-true under StrictMode-driven
  // re-subscriptions, which left the manager view permanently in skeleton.
  if (rollup.isLoading && !rollup.data) {
    return (
      <section data-testid="manager-dashboard-loading" className="mx-auto max-w-6xl space-y-4 p-6">
        <div
          data-testid="manager-skeleton-hero"
          className="h-32 animate-pulse rounded-lg bg-(--color-skeleton-bg)"
        />
        <div
          data-testid="manager-skeleton-table"
          className="h-64 animate-pulse rounded-lg bg-(--color-skeleton-bg)"
        />
      </section>
    );
  }

  if (rollup.error && !rollup.data) {
    return (
      <p data-testid="manager-dashboard-error" className="p-6 text-sm text-(--color-shell-error)">
        Could not load the manager dashboard.
      </p>
    );
  }

  const rows = rollup.data?.content ?? [];
  const starvedSet = new Map<string, { title: string; weeks: number }>();
  const driftEntries: Array<{
    team: string;
    title: string;
    observed: number;
    low: number;
    high: number;
  }> = [];
  const ribbonEntries: RibbonEntry[] = [];
  for (const row of rows) {
    for (const s of row.payload.starvedOutcomes) {
      starvedSet.set(s.outcomeId, { title: s.outcomeTitle, weeks: s.weeksStarved });
    }
    for (const d of row.payload.driftExceptions) {
      driftEntries.push({
        team: row.payload.teamName,
        title: d.rallyCryTitle,
        observed: d.observedShare,
        low: d.expectedLow,
        high: d.expectedHigh,
      });
    }
    for (const r of row.payload.exceptionRibbon) ribbonEntries.push(r);
  }
  const starvedList = Array.from(starvedSet.entries()).map(([outcomeId, v]) => ({
    outcomeId,
    title: v.title,
    weeks: v.weeks,
  }));

  return (
    <section data-testid="manager-dashboard" className="mx-auto max-w-6xl space-y-8 p-6">
      <DigestHero />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <article
          data-testid="starved-outcomes-panel"
          className="space-y-3 rounded-lg border border-(--color-panel-border) bg-(--color-panel-bg) p-5"
        >
          <h2 className="text-sm font-semibold text-(--color-panel-heading)">Starved outcomes</h2>
          {starvedList.length === 0 ? (
            <p className="text-xs text-(--color-panel-muted)">No starved outcomes detected.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {starvedList.map((s) => (
                <li
                  key={s.outcomeId}
                  data-testid="starved-outcome-row"
                  className="flex items-center justify-between gap-3 text-(--color-panel-cell)"
                >
                  <span className="truncate">{s.title}</span>
                  <span
                    data-testid="starved-outcome-badge"
                    className="shrink-0 rounded-sm bg-(--color-ribbon-medium-bg) px-1.5 py-0.5 text-xs font-medium text-(--color-ribbon-medium-fg)"
                  >
                    starved {s.weeks} weeks
                  </span>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article
          data-testid="drift-exceptions-panel"
          className="space-y-3 rounded-lg border border-(--color-panel-border) bg-(--color-panel-bg) p-5"
        >
          <h2 className="text-sm font-semibold text-(--color-panel-heading)">Priority drift</h2>
          {driftEntries.length === 0 ? (
            <p className="text-xs text-(--color-panel-muted)">
              All teams within their priority bands.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {driftEntries.map((d, i) => (
                <li
                  key={`${d.team}-${d.title}-${i}`}
                  data-testid="drift-exception-row"
                  className="text-(--color-panel-cell)"
                >
                  <span className="font-medium text-(--color-panel-heading)">{d.team}</span> ·{' '}
                  {d.title} — observed {(d.observed * 100).toFixed(0)}% (expected{' '}
                  {(d.low * 100).toFixed(0)}–{(d.high * 100).toFixed(0)}%)
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>

      <ExceptionRibbon items={ribbonEntries} />

      <TeamMemberTable rows={rows} onSelectTeam={handleSelectTeam} />

      {selectedTeamId ? (
        <TeamDetailDrawer
          row={rows.find((r) => r.teamId === selectedTeamId) ?? null}
          onClose={() => setSelectedTeamId(null)}
        />
      ) : null}
    </section>
  );
}

function TeamDetailDrawer({
  row,
  onClose,
}: {
  row: TeamRollupRow | null;
  onClose: () => void;
}) {
  if (!row) return null;
  const p = row.payload;
  return (
    <>
      <div
        data-testid="team-detail-backdrop"
        aria-hidden="true"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        data-testid="team-detail-drawer"
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-(--color-panel-border) bg-(--color-panel-bg) text-(--color-panel-cell) shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-(--color-panel-border) px-5 py-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-(--color-panel-muted)">
              team
            </p>
            <h3 className="mt-0.5 text-sm font-semibold text-(--color-panel-heading)">
              {p.teamName}
            </h3>
          </div>
          <button
            type="button"
            data-testid="team-detail-close"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-(--color-panel-muted) hover:bg-(--color-skeleton-bg) hover:text-(--color-panel-heading)"
          >
            ×
          </button>
        </header>
        <div className="flex-1 space-y-3 overflow-auto px-5 py-4 text-xs">
          <dl className="grid grid-cols-3 gap-2">
            <Stat label="Members" value={p.memberCount} />
            <Stat label="Locked" value={p.lockedCount} />
            <Stat label="Reconciled" value={p.reconciledCount} />
            <Stat label="Done" value={p.doneCount} />
            <Stat label="Partial" value={p.partialCount} />
            <Stat label="Not done" value={p.notDoneCount} />
            <Stat label="Carry-forward" value={p.carryForwardCount} />
          </dl>
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-(--color-panel-muted)">
              Drift
            </p>
            {p.driftExceptions.length === 0 ? (
              <p className="mt-1 text-(--color-panel-muted)">None this week.</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {p.driftExceptions.map((d) => (
                  <li key={d.rallyCryId}>
                    <span className="font-medium text-(--color-panel-heading)">
                      {d.rallyCryTitle}
                    </span>{' '}
                    — {(d.observedShare * 100).toFixed(0)}% vs {(d.expectedLow * 100).toFixed(0)}–
                    {(d.expectedHigh * 100).toFixed(0)}%
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-(--color-panel-muted)">
              Starved outcomes
            </p>
            {p.starvedOutcomes.length === 0 ? (
              <p className="mt-1 text-(--color-panel-muted)">None this week.</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {p.starvedOutcomes.map((s) => (
                  <li key={s.outcomeId}>
                    <span className="font-medium text-(--color-panel-heading)">
                      {s.outcomeTitle}
                    </span>{' '}
                    — {s.weeksStarved}w
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-(--color-panel-border) bg-(--color-shell-bg) px-2 py-1.5">
      <dt className="text-[10px] uppercase tracking-wide text-(--color-panel-muted)">{label}</dt>
      <dd className="mt-0.5 font-semibold text-(--color-panel-heading)">{value}</dd>
    </div>
  );
}
