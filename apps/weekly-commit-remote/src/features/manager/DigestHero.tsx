import { useState, type ReactNode } from 'react';
import {
  InsightDrillDown,
  useRtkSubscriptionKick,
  type InsightDrillDownEntity,
} from '@throughline/shared-ui';
import {
  useGetCurrentDigestQuery,
  useGetTeamMemberCurrentWeekQuery,
  useRegenerateDigestMutation,
  useDispatchDigestToSlackMutation,
  type DigestEnvelope,
  type DigestPayload,
} from '../../api/managerEndpoints.js';

// P40 closeout — manager digest hero card.
//
// Three render variants gated on DigestEnvelope.state:
//   AWAITING_AI: backend has no T5 insight yet for this manager / week. Show empty state with a
//     manual "Generate now" button (POST /manager/digest/regenerate, throttled ≤2/day).
//   OK:         AI ran successfully, show alignmentHeadline + drill-down chips for every
//     starvedOutcome / driftException / longCarryForward / drillDown. Each ID is rendered through
//     <InsightDrillDown> so the manager can pop a Drawer with the underlying entity.
//   FALLBACK:   AI was offline, deterministic skeleton from ManagerDigestService persisted with
//     model="deterministic". Banner the FALLBACK state plus the deterministic Slack message.
//
// The "regenerate" mutation invalidates the AIInsight tag so the query refetches automatically.

type RenderVariant = DigestEnvelope['state'];

interface DigestHeroProps {
  envelope?: DigestEnvelope | null;
  isLoading?: boolean;
  /** Test seam: pass `null` to use the live RTK Query hook. */
  override?: 'live' | 'props';
}

/** Default detail renderer for drill-down entities. Wired to manager-side endpoints when the
 *  entity is a `user`; for other entity types it falls back to a JSON dump. */
function UserDetail({ userId }: { userId: string }) {
  const week = useGetTeamMemberCurrentWeekQuery(userId);
  if (week.isLoading) {
    return (
      <p data-testid="digest-detail-loading" className="text-(--color-commit-muted)">
        Loading week…
      </p>
    );
  }
  if (week.error || !week.data) {
    return (
      <p data-testid="digest-detail-error" className="text-(--color-shell-error)">
        Could not load week for this user.
      </p>
    );
  }
  return (
    <dl data-testid="digest-detail-week" className="space-y-1 text-xs">
      <div className="flex justify-between">
        <dt className="text-(--color-commit-muted)">Week</dt>
        <dd className="text-(--color-commit-text)">{week.data.weekStart}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-(--color-commit-muted)">State</dt>
        <dd className="text-(--color-commit-text)">{week.data.state}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-(--color-commit-muted)">Commits</dt>
        <dd className="text-(--color-commit-text)">{week.data.commits.length}</dd>
      </div>
    </dl>
  );
}

function defaultDetail(entity: InsightDrillDownEntity): ReactNode {
  if (entity.entityType === 'user' && entity.entityId) {
    return <UserDetail userId={entity.entityId} />;
  }
  if (entity.detailText) {
    return (
      <p data-testid="digest-detail-text" className="whitespace-pre-wrap text-xs leading-relaxed text-(--color-panel-cell)">
        {entity.detailText}
      </p>
    );
  }
  return (
    <pre data-testid="digest-detail-default" className="whitespace-pre-wrap break-all">
      {JSON.stringify(entity, null, 2)}
    </pre>
  );
}

function shortId(id: string | null | undefined): string {
  return typeof id === 'string' && id.length > 0 ? id.slice(0, 8) : '—';
}

// Sonnet emits observedShare as either a percent string ("16.7%") or a decimal
// fraction (0.1167). Normalise both into a clean "X%" label.
export function formatShare(raw: string | number | null | undefined): string {
  if (raw == null) return '';
  if (typeof raw === 'number') {
    const pct = raw <= 1 ? raw * 100 : raw;
    return `${pct.toFixed(1).replace(/\.0$/, '')}%`;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) return '';
  const numeric = Number(trimmed.replace('%', ''));
  if (Number.isFinite(numeric) && !trimmed.includes('%')) {
    const pct = numeric <= 1 ? numeric * 100 : numeric;
    return `${pct.toFixed(1).replace(/\.0$/, '')}%`;
  }
  return trimmed;
}

// Always produce a non-empty drawer body for a rally-cry drift chip — even when
// the AI omits expectedRange or direction, render whatever we do have rather
// than letting the drawer fall through to a JSON dump.
export function buildDriftDetail(observed: string, expected: string, direction: string): string {
  if (observed && expected) {
    return `Observed ${observed} vs expected ${expected}${direction ? ` (${direction})` : ''}.`;
  }
  if (observed) {
    return `Observed share ${observed}${direction ? ` (${direction})` : ''}; expected range not provided.`;
  }
  return 'Drift detected against the team priority weights — no observed share returned.';
}

// Sonnet returns several field-name variants; the production payload uses
// `outcomeId`/`outcomeTitle`, `rallyCry*` for drift, `weeksCarried`, and
// `recommendedDrillDowns` (often with userId=null). Coerce defensively so
// every chip gets a real label, a unique key, and a meaningful drawer body.
function chipsFor(payload: DigestPayload): InsightDrillDownEntity[] {
  const out: InsightDrillDownEntity[] = [];
  for (const [idx, s] of (payload.starvedOutcomes ?? []).entries()) {
    const id = s.supportingOutcomeId ?? s.outcomeId ?? `starved-${idx}`;
    const title = s.title ?? s.outcomeTitle ?? `outcome ${shortId(id)}`;
    const reason = s.reason ?? s.note;
    const weeks = s.weeksStarved && s.weeksStarved > 0 ? `${s.weeksStarved}w · ` : '';
    out.push({
      entityType: 'supporting_outcome',
      entityId: id,
      label: `${weeks}${title}`,
      detailText: reason,
    });
  }
  for (const [idx, d] of (payload.driftExceptions ?? []).entries()) {
    // Two shapes: per-user (legacy: userId/displayName) or per-rally-cry (live: rallyCryId/rallyCryTitle).
    const isRallyCryShape = Boolean(d.rallyCryId || d.rallyCryTitle);
    if (isRallyCryShape) {
      const id = d.rallyCryId ?? `drift-${idx}`;
      const title = d.rallyCryTitle ?? `Rally cry #${shortId(id)}`;
      const observed = formatShare(d.observedShare);
      const direction = d.direction ?? '';
      const expected = d.expectedRange ?? '';
      const labelTail = [observed, direction].filter(Boolean).join(' · ');
      const label = labelTail ? `${title} — ${labelTail}` : title;
      const detailText = buildDriftDetail(observed, expected, direction);
      out.push({ entityType: 'rally_cry', entityId: id, label, detailText });
    } else {
      const id = d.userId ?? `drift-${idx}`;
      out.push({
        entityType: 'user',
        entityId: id,
        label: d.displayName?.trim()
          ? d.displayName
          : d.userId
            ? `User #${shortId(d.userId)}`
            : `Direct report ${idx + 1}`,
      });
    }
  }
  for (const [idx, c] of (payload.longCarryForwards ?? []).entries()) {
    const id = c.commitId ?? `carry-${idx}`;
    const weeks = c.weeksCarried ?? c.weeks ?? 0;
    const text = c.commitText?.trim() || `Commit #${shortId(id)}`;
    const prefix = weeks > 0 ? `${weeks}w · ` : '';
    out.push({
      entityType: 'commit',
      entityId: id,
      label: `${prefix}${text}`,
      detailText: c.note,
    });
  }
  const drills = payload.recommendedDrillDowns ?? payload.drillDowns ?? [];
  for (const [idx, u] of drills.entries()) {
    const hasUser = typeof u.userId === 'string' && u.userId.length > 0;
    out.push({
      entityType: hasUser ? 'user' : 'note',
      entityId: hasUser ? (u.userId as string) : `drill-${idx}`,
      label: u.displayName?.trim()
        ? u.displayName
        : hasUser
          ? `User #${shortId(u.userId as string)}`
          : `1:1 candidate ${idx + 1}`,
      detailText: u.reason,
    });
  }
  return out;
}

export function DigestHero(props: DigestHeroProps = {}) {
  useRtkSubscriptionKick();
  const live = useGetCurrentDigestQuery(undefined, { skip: props.override === 'props' });
  const [regenerate, regen] = useRegenerateDigestMutation();
  const [dispatchSlack, dispatch] = useDispatchDigestToSlackMutation();
  const [dispatchAck, setDispatchAck] = useState<'idle' | 'sent' | 'failed'>('idle');
  const onDispatchSlack = async () => {
    try {
      await dispatchSlack().unwrap();
      setDispatchAck('sent');
    } catch {
      setDispatchAck('failed');
    }
  };
  const envelope: DigestEnvelope | null =
    props.override === 'props' ? (props.envelope ?? null) : (live.data ?? null);
  const isLoading =
    props.override === 'props' ? Boolean(props.isLoading) : live.isLoading || live.isFetching;

  const variant: RenderVariant = envelope?.state ?? 'AWAITING_AI';
  const headline =
    envelope?.digest?.alignmentHeadline ??
    (variant === 'AWAITING_AI'
      ? 'Digest will land after Friday reconciliation.'
      : 'Digest unavailable — see deterministic rollup below.');

  return (
    <header
      data-testid="manager-digest-hero"
      data-variant={variant}
      className="space-y-4 rounded-lg border border-(--color-hero-border) bg-(--color-hero-bg) p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-(--color-hero-muted)">
            Weekly digest
          </p>
          <h1
            data-testid="digest-headline"
            className="mt-1 text-base font-semibold leading-snug text-(--color-hero-heading)"
          >
            {headline}
          </h1>
        </div>
        <span
          data-testid="digest-state-badge"
          className="rounded-sm bg-(--color-badge-bg) px-1.5 py-0.5 text-xs font-medium text-(--color-badge-fg)"
        >
          {variant}
        </span>
      </div>

      {variant !== 'AWAITING_AI' ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            data-testid="digest-dispatch-slack"
            disabled={dispatch.isLoading}
            onClick={onDispatchSlack}
            className="inline-flex items-center gap-2 rounded-md border border-(--color-hero-border) bg-(--color-shell-bg) px-3 py-1.5 text-xs font-medium text-(--color-hero-heading) transition-colors hover:bg-(--color-skeleton-bg) disabled:opacity-50"
          >
            {dispatch.isLoading ? 'Sending…' : 'Send digest to Slack'}
          </button>
          {dispatchAck === 'sent' ? (
            <span
              data-testid="digest-dispatch-ack"
              className="text-xs text-(--color-hero-muted)"
            >
              Dispatched. Check the channel.
            </span>
          ) : null}
          {dispatchAck === 'failed' ? (
            <span className="text-xs text-(--color-shell-error)">
              Dispatch failed — see API logs.
            </span>
          ) : null}
        </div>
      ) : null}

      {isLoading ? (
        <p data-testid="digest-loading" className="text-sm text-(--color-hero-muted)">
          Loading digest…
        </p>
      ) : variant === 'AWAITING_AI' ? (
        <div data-testid="digest-awaiting" className="space-y-3 text-sm text-(--color-hero-muted)">
          <p>
            No T5 insight yet. The Friday cron will fire automatically — or generate one now to
            preview the digest your team will see in Slack.
          </p>
          <button
            type="button"
            data-testid="digest-regenerate"
            disabled={regen.isLoading}
            onClick={() => regenerate()}
            className="inline-flex items-center rounded-md border border-(--color-hero-border) bg-(--color-shell-bg) px-3 py-1.5 text-xs font-medium text-(--color-hero-heading) hover:bg-(--color-skeleton-bg) disabled:opacity-50"
          >
            {regen.isLoading ? 'Generating…' : 'Generate digest now'}
          </button>
          {regen.isError ? (
            <p data-testid="digest-regenerate-error" className="text-xs text-(--color-shell-error)">
              Could not generate the digest — try again in a few minutes.
            </p>
          ) : null}
        </div>
      ) : variant === 'FALLBACK' ? (
        <div data-testid="digest-fallback" className="space-y-2 text-sm text-(--color-hero-text)">
          <p className="rounded-sm bg-(--color-badge-bg) px-2 py-1 text-xs text-(--color-badge-fg)">
            Anthropic offline — showing deterministic skeleton. Re-run after the API recovers.
          </p>
          {envelope?.digest?.slackMessage ? (
            <pre className="whitespace-pre-wrap text-xs text-(--color-hero-muted)">
              {envelope.digest.slackMessage}
            </pre>
          ) : null}
        </div>
      ) : (
        <div data-testid="digest-ok" className="space-y-3 text-sm text-(--color-hero-text)">
          {envelope?.digest ? (
            <>
              <DigestSection
                title="Starved outcomes"
                count={envelope.digest.starvedOutcomes?.length ?? 0}
                entities={chipsFor({
                  ...envelope.digest,
                  driftExceptions: [],
                  longCarryForwards: [],
                  drillDowns: [],
                })}
              />
              <DigestSection
                title="Drift exceptions"
                count={envelope.digest.driftExceptions?.length ?? 0}
                entities={chipsFor({
                  ...envelope.digest,
                  starvedOutcomes: [],
                  longCarryForwards: [],
                  drillDowns: [],
                })}
              />
              <DigestSection
                title="Long carry-forwards"
                count={envelope.digest.longCarryForwards?.length ?? 0}
                entities={chipsFor({
                  ...envelope.digest,
                  starvedOutcomes: [],
                  driftExceptions: [],
                  drillDowns: [],
                })}
              />
              <DigestSection
                title="Recommended 1:1s"
                count={
                  (envelope.digest.recommendedDrillDowns?.length ??
                    envelope.digest.drillDowns?.length ??
                    0)
                }
                entities={chipsFor({
                  ...envelope.digest,
                  starvedOutcomes: [],
                  driftExceptions: [],
                  longCarryForwards: [],
                })}
              />
            </>
          ) : null}
        </div>
      )}
    </header>
  );
}

function DigestSection({
  title,
  count,
  entities,
}: {
  title: string;
  count: number;
  entities: InsightDrillDownEntity[];
}) {
  if (count === 0 && entities.length === 0) {
    return (
      <div data-testid={`digest-section-${title}`} className="text-xs text-(--color-hero-muted)">
        <span className="font-medium text-(--color-hero-heading)">{title}:</span> none this week.
      </div>
    );
  }
  return (
    <div data-testid={`digest-section-${title}`}>
      <p className="text-xs font-medium text-(--color-hero-heading)">
        {title} <span className="text-(--color-hero-muted)">({count})</span>
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-1 text-xs">
        <InsightDrillDown entities={entities} renderDetail={defaultDetail} />
      </div>
    </div>
  );
}
