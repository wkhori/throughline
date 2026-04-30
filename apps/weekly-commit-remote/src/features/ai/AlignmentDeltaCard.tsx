import { useRtkSubscriptionKick } from '@throughline/shared-ui';
import { useGetAlignmentDeltaQuery } from '../../api/aiEndpoints.js';
import type {
  AlignmentDeltaCarryForward,
  AlignmentDeltaPayload,
  AlignmentDeltaShipped,
  AlignmentDeltaSlipped,
} from '@throughline/shared-types';

/**
 * T4 alignment delta — rendered on the reconciled-week surface. Renders nothing
 * when the AFTER_COMMIT consumer has not yet posted an insight (HTTP 204);
 * the cron/retry will fill it in and RTK Query refetches via the AIInsight tag.
 */
export function AlignmentDeltaCard({ weekId }: { weekId: string }) {
  useRtkSubscriptionKick();
  const { data, isLoading } = useGetAlignmentDeltaQuery(weekId);
  if (isLoading && !data) {
    return (
      <div
        data-testid="alignment-delta-loading"
        className="space-y-4 rounded-lg border border-(--color-hero-border) bg-(--color-hero-bg) p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="h-3 w-28 animate-pulse rounded-md bg-(--color-skeleton-bg)/10" />
            <div className="h-5 w-72 animate-pulse rounded-md bg-(--color-skeleton-bg)/10" />
          </div>
          <div className="h-5 w-20 animate-pulse rounded-sm bg-(--color-skeleton-bg)/10" />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-16 animate-pulse rounded-md bg-(--color-skeleton-bg)/10" />
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-4 w-full animate-pulse rounded-md bg-(--color-skeleton-bg)/10"
            />
          ))}
        </div>
        <div className="space-y-2">
          <div className="h-3 w-16 animate-pulse rounded-md bg-(--color-skeleton-bg)/10" />
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-4 w-5/6 animate-pulse rounded-md bg-(--color-skeleton-bg)/10"
            />
          ))}
        </div>
      </div>
    );
  }
  if (!data) return null;
  const payload = data.payload as AlignmentDeltaPayload;
  const isFallback = data.model === 'deterministic';

  return (
    <section
      data-testid="alignment-delta-card"
      data-model={data.model}
      className="space-y-4 rounded-lg border border-(--color-hero-border) bg-(--color-hero-bg) p-6"
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-(--color-hero-muted)">
            Alignment delta
          </p>
          <p className="mt-1 text-sm font-semibold text-(--color-hero-heading)">
            {payload.summary}
          </p>
        </div>
        {isFallback ? (
          <span className="rounded-sm bg-(--color-badge-bg) px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-(--color-badge-fg)">
            Deterministic
          </span>
        ) : null}
      </header>

      {payload.shipped.length > 0 ? (
        <DeltaList<AlignmentDeltaShipped>
          title="Shipped"
          items={payload.shipped}
          render={(item) => (
            <span className="font-mono text-[11px] text-(--color-hero-text)">
              {shortId(item.commitId)}
            </span>
          )}
        />
      ) : null}

      {payload.slipped.length > 0 ? (
        <DeltaList<AlignmentDeltaSlipped>
          title="Slipped"
          items={payload.slipped}
          render={(item) => (
            <span className="text-[12px] text-(--color-hero-text)">
              <span className="font-mono text-(--color-hero-muted)">{shortId(item.commitId)}</span>
              <span className="ml-2">{item.slipCause}</span>
              {item.evidence ? (
                <span className="ml-1 text-(--color-hero-muted)">— {item.evidence}</span>
              ) : null}
            </span>
          )}
        />
      ) : null}

      {payload.carryForwardRecommendations.length > 0 ? (
        <DeltaList<AlignmentDeltaCarryForward>
          title="Carry-forward"
          items={payload.carryForwardRecommendations}
          render={(item) => (
            <span className="text-[12px] text-(--color-hero-text)">
              <span className="font-mono text-(--color-hero-muted)">{shortId(item.commitId)}</span>
              <span className="ml-2 font-medium">{item.action}</span>
              <span className="ml-1 text-(--color-hero-muted)">— {item.rationale}</span>
            </span>
          )}
        />
      ) : null}
    </section>
  );
}

function DeltaList<T>({
  title,
  items,
  render,
}: {
  title: string;
  items: T[];
  render: (item: T) => React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-(--color-hero-heading)">
        {title} <span className="text-(--color-hero-muted)">({items.length})</span>
      </p>
      <ul className="mt-1 space-y-1">
        {items.map((item, idx) => (
          <li key={idx}>{render(item)}</li>
        ))}
      </ul>
    </div>
  );
}

function shortId(id: string | null | undefined): string {
  return typeof id === 'string' && id.length >= 8 ? id.slice(0, 8) : (id ?? '—');
}
