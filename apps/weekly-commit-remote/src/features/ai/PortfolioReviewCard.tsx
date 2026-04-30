import { Sparkles } from 'lucide-react';
import { useRtkSubscriptionKick } from '@throughline/shared-ui';
import {
  useGetPortfolioReviewQuery,
  useRunPortfolioReviewMutation,
} from '../../api/aiEndpoints.js';
import type { PortfolioReviewFinding, PortfolioReviewPayload } from '@throughline/shared-types';

const SEVERITY_BADGE: Record<string, string> = {
  info: 'bg-(--color-badge-bg) text-(--color-badge-fg)',
  notice: 'bg-(--color-ribbon-low-bg) text-(--color-ribbon-low-fg)',
  warning: 'bg-(--color-ribbon-high-bg) text-(--color-ribbon-high-fg)',
};

/**
 * T3 portfolio review — rendered on the locked-week surface. Falls back to a
 * "generate now" CTA when the AFTER_COMMIT consumer has not posted yet, so the
 * IC can resync rather than seeing a placeholder.
 */
export function PortfolioReviewCard({ weekId }: { weekId: string }) {
  useRtkSubscriptionKick();
  const { data, isLoading } = useGetPortfolioReviewQuery(weekId);
  const [run, runState] = useRunPortfolioReviewMutation();

  if (isLoading && !data) {
    return (
      <div
        data-testid="portfolio-review-loading"
        className="space-y-4 rounded-lg border border-(--color-panel-border) bg-(--color-panel-bg) p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="h-3 w-28 animate-pulse rounded-md bg-(--color-skeleton-bg)/10" />
            <div className="h-5 w-64 animate-pulse rounded-md bg-(--color-skeleton-bg)/10" />
          </div>
          <div className="h-5 w-16 animate-pulse rounded-sm bg-(--color-skeleton-bg)/10" />
        </div>
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-md border border-(--color-panel-border) p-3"
            >
              <div className="h-5 w-14 animate-pulse rounded-sm bg-(--color-skeleton-bg)/10" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-40 animate-pulse rounded-md bg-(--color-skeleton-bg)/10" />
                <div className="h-3 w-full animate-pulse rounded-md bg-(--color-skeleton-bg)/10" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div
        data-testid="portfolio-review-empty"
        className="flex flex-col items-center gap-4 rounded-lg border border-(--color-panel-border) bg-(--color-panel-bg) p-8 text-center"
      >
        <Sparkles size={28} className="text-(--color-panel-muted) opacity-40" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-(--color-panel-heading)">
            Portfolio review pending
          </p>
          <p className="mt-1 text-xs text-(--color-panel-muted)">
            The AI fires on lock. Generate now to resync if it hasn&apos;t appeared yet.
          </p>
        </div>
        <button
          type="button"
          disabled={runState.isLoading}
          onClick={() => void run(weekId)}
          className="inline-flex items-center gap-2 rounded-md border border-(--color-panel-border) bg-(--color-shell-bg) px-4 py-2 text-xs font-medium text-(--color-shell-text) hover:bg-(--color-skeleton-bg) disabled:opacity-50"
        >
          <Sparkles size={13} aria-hidden="true" />
          {runState.isLoading ? 'Generating…' : 'Generate review'}
        </button>
      </div>
    );
  }

  const payload = data.payload as PortfolioReviewPayload;
  const isFallback = data.model === 'deterministic';

  return (
    <section
      data-testid="portfolio-review-card"
      data-severity={payload.overallSeverity}
      className="space-y-4 rounded-lg border border-(--color-hero-border) bg-(--color-hero-bg) p-6"
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-(--color-hero-muted)">
            Portfolio review
          </p>
          <p className="mt-1 text-sm font-semibold text-(--color-hero-heading)">
            {payload.headline}
          </p>
        </div>
        <span
          className={`rounded-sm px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${SEVERITY_BADGE[payload.overallSeverity] ?? SEVERITY_BADGE.info}`}
        >
          {isFallback ? 'Deterministic' : payload.overallSeverity}
        </span>
      </header>

      {payload.findings.length > 0 ? (
        <ul className="space-y-2">
          {payload.findings.map((f, idx) => (
            <FindingRow key={idx} finding={f} />
          ))}
        </ul>
      ) : (
        <p className="text-xs text-(--color-hero-muted)">
          Clean portfolio — no findings this week.
        </p>
      )}
    </section>
  );
}

function FindingRow({ finding }: { finding: PortfolioReviewFinding }) {
  const tone = SEVERITY_BADGE[finding.severity] ?? SEVERITY_BADGE.info;
  return (
    <li className="flex items-start gap-3 rounded-md border border-(--color-panel-border) bg-(--color-panel-bg) p-3 text-xs text-(--color-panel-cell)">
      <span
        className={`rounded-sm px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${tone}`}
      >
        {finding.severity}
      </span>
      <div className="space-y-1">
        <p className="font-medium text-(--color-panel-heading)">
          {finding.dimension.replace(/_/g, ' ')}
        </p>
        <p className="text-(--color-panel-muted)">{finding.message}</p>
      </div>
    </li>
  );
}
