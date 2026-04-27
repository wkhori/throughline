import { useGetPortfolioReviewQuery, useRunPortfolioReviewMutation } from '../../api/aiEndpoints.js';
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
  const { data, isLoading } = useGetPortfolioReviewQuery(weekId);
  const [run, runState] = useRunPortfolioReviewMutation();

  if (isLoading) {
    return (
      <div
        data-testid="portfolio-review-loading"
        className="rounded-lg border border-(--color-panel-border) bg-(--color-panel-bg) p-5 text-xs text-(--color-panel-muted)"
      >
        Generating portfolio review…
      </div>
    );
  }

  if (!data) {
    return (
      <div
        data-testid="portfolio-review-empty"
        className="flex items-center justify-between gap-3 rounded-lg border border-(--color-panel-border) bg-(--color-panel-bg) p-5 text-sm text-(--color-panel-muted)"
      >
        <span>Portfolio review pending. The AI consumer fires on lock — generate now if you want to resync.</span>
        <button
          type="button"
          disabled={runState.isLoading}
          onClick={() => void run(weekId)}
          className="inline-flex items-center rounded-md border border-(--color-panel-border) bg-(--color-shell-bg) px-3 py-1.5 text-xs font-medium text-(--color-shell-text) hover:bg-(--color-skeleton-bg) disabled:opacity-50"
        >
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
        <p className="text-xs text-(--color-hero-muted)">Clean portfolio — no findings this week.</p>
      )}
    </section>
  );
}

function FindingRow({ finding }: { finding: PortfolioReviewFinding }) {
  const tone = SEVERITY_BADGE[finding.severity] ?? SEVERITY_BADGE.info;
  return (
    <li className="flex items-start gap-3 rounded-md border border-(--color-panel-border) bg-(--color-panel-bg) p-3 text-xs text-(--color-panel-cell)">
      <span className={`rounded-sm px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${tone}`}>
        {finding.severity}
      </span>
      <div className="space-y-1">
        <p className="font-medium text-(--color-panel-heading)">{finding.dimension.replace(/_/g, ' ')}</p>
        <p className="text-(--color-panel-muted)">{finding.message}</p>
      </div>
    </li>
  );
}
