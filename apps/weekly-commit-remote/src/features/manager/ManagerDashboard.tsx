import {
  useGetCurrentDigestQuery,
  useGetTeamRollupQuery,
  type RibbonEntry,
} from '../../api/managerEndpoints.js';
import { ExceptionRibbon } from './ExceptionRibbon.js';
import { TeamMemberTable } from './TeamMemberTable.js';

interface ManagerDashboardProps {
  onSelectTeam?: (teamId: string) => void;
}

// Phase-4 manager landing page. Four regions:
// - Hero card region (placeholder until Phase 5c T5 wires the real digest).
// - Starved-outcomes panel (deterministic, derived from rollup payload).
// - Drift-exceptions panel (deterministic, derived from rollup payload).
// - Exception ribbon (LONG_CARRY_FORWARD / PRIORITY_DRIFT / STARVED_OUTCOME).
// Plus the dense team roster table beneath.
export function ManagerDashboard({ onSelectTeam }: ManagerDashboardProps) {
  const rollup = useGetTeamRollupQuery({ page: 0, size: 50 });
  const digest = useGetCurrentDigestQuery();

  if (rollup.isLoading) {
    return (
      <section data-testid="manager-dashboard-loading" className="space-y-4 p-6">
        <div
          data-testid="manager-skeleton-hero"
          className="h-32 animate-pulse rounded-md bg-(--skeleton-bg)"
        />
        <div
          data-testid="manager-skeleton-table"
          className="h-64 animate-pulse rounded-md bg-(--skeleton-bg)"
        />
      </section>
    );
  }

  if (rollup.error) {
    return (
      <p data-testid="manager-dashboard-error" className="p-6 text-sm text-(--shell-error)">
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

  const digestPayload = digest.data?.digest ?? null;

  return (
    <section data-testid="manager-dashboard" className="space-y-6 p-6">
      <header
        data-testid="manager-digest-hero"
        className="rounded-lg border border-(--hero-border) bg-(--hero-bg) p-5"
      >
        <h1 className="text-base font-semibold text-(--hero-heading)">Weekly digest</h1>
        {digestPayload === null ? (
          <p data-testid="manager-digest-placeholder" className="mt-2 text-sm text-(--hero-muted)">
            Digest will appear here when AI lands. T5 wires in phase/4-ai.
          </p>
        ) : (
          <pre className="mt-2 text-sm text-(--hero-text)">
            {JSON.stringify(digestPayload, null, 2)}
          </pre>
        )}
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <article
          data-testid="starved-outcomes-panel"
          className="space-y-2 rounded-md border border-(--panel-border) bg-(--panel-bg) p-4"
        >
          <h2 className="text-sm font-semibold text-(--panel-heading)">Starved outcomes</h2>
          {starvedList.length === 0 ? (
            <p className="text-xs text-(--panel-muted)">No starved outcomes detected.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {starvedList.map((s) => (
                <li
                  key={s.outcomeId}
                  data-testid="starved-outcome-row"
                  className="flex items-center justify-between text-(--panel-cell)"
                >
                  <span>{s.title}</span>
                  <span
                    data-testid="starved-outcome-badge"
                    className="rounded-sm bg-(--badge-bg) px-1.5 py-0.5 text-xs text-(--badge-fg)"
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
          className="space-y-2 rounded-md border border-(--panel-border) bg-(--panel-bg) p-4"
        >
          <h2 className="text-sm font-semibold text-(--panel-heading)">Priority drift</h2>
          {driftEntries.length === 0 ? (
            <p className="text-xs text-(--panel-muted)">All teams within their priority bands.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {driftEntries.map((d, i) => (
                <li
                  key={`${d.team}-${d.title}-${i}`}
                  data-testid="drift-exception-row"
                  className="text-(--panel-cell)"
                >
                  <span className="font-medium">{d.team}</span> · {d.title} — observed{' '}
                  {(d.observed * 100).toFixed(0)}% (expected {(d.low * 100).toFixed(0)}–
                  {(d.high * 100).toFixed(0)}%)
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>

      <ExceptionRibbon items={ribbonEntries} />

      <TeamMemberTable rows={rows} onSelectTeam={onSelectTeam} />
    </section>
  );
}
