import { useState, type ReactNode } from 'react';
import {
  InsightDrillDown,
  SlackIcon,
  useRtkSubscriptionKick,
  type InsightDrillDownEntity,
  type InsightSeverity,
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

function DetailReasoning({ text }: { text: string }) {
  return (
    <section data-testid="digest-detail-text" className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-(--color-panel-muted)">
        AI reasoning
      </p>
      <p className="whitespace-pre-wrap text-xs leading-relaxed text-(--color-panel-cell)">
        {text}
      </p>
    </section>
  );
}

function NextStep({ children }: { children: ReactNode }) {
  return (
    <section
      data-testid="digest-detail-next-step"
      className="rounded-md border border-(--color-panel-border) bg-(--color-skeleton-bg) px-3 py-2"
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-(--color-panel-muted)">
        Suggested next step
      </p>
      <p className="mt-0.5 text-xs leading-relaxed text-(--color-panel-cell)">{children}</p>
    </section>
  );
}

function defaultDetail(entity: InsightDrillDownEntity): ReactNode {
  if (entity.entityType === 'user' && entity.entityId) {
    return (
      <div className="space-y-3">
        <UserDetail userId={entity.entityId} />
        {entity.detailText ? <DetailReasoning text={entity.detailText} /> : null}
        <NextStep>
          Open this person&apos;s week to align on their plan, or schedule a 1:1 — they&apos;re
          flagged for attention.
        </NextStep>
      </div>
    );
  }
  if (entity.entityType === 'supporting_outcome') {
    return (
      <div className="space-y-3">
        {entity.detailText ? (
          <DetailReasoning text={entity.detailText} />
        ) : (
          <p className="text-xs text-(--color-panel-muted)">
            No commits landed on this Supporting Outcome this week.
          </p>
        )}
        <NextStep>
          Reach out to a directly responsible IC and discuss whether the SO needs a commit next
          week, or whether priorities have shifted and the SO can be retired.
        </NextStep>
      </div>
    );
  }
  if (entity.entityType === 'rally_cry') {
    return (
      <div className="space-y-3">
        {entity.detailText ? (
          <DetailReasoning text={entity.detailText} />
        ) : (
          <p className="text-xs text-(--color-panel-muted)">
            Rally cry observed share is outside expected band.
          </p>
        )}
        <NextStep>
          Bring this drift to the next leadership sync — either the team-priority weights need to
          be adjusted, or active rebalancing is required.
        </NextStep>
      </div>
    );
  }
  if (entity.entityType === 'commit') {
    return (
      <div className="space-y-3">
        {entity.detailText ? (
          <DetailReasoning text={entity.detailText} />
        ) : (
          <p className="text-xs text-(--color-panel-muted)">
            This commit has been carried across multiple weeks.
          </p>
        )}
        <NextStep>
          Decide: is this commit blocked, deprioritised, or under-scoped? Surface the answer in the
          IC&apos;s next 1:1 and either close it out or break it down.
        </NextStep>
      </div>
    );
  }
  if (entity.detailText) {
    return <DetailReasoning text={entity.detailText} />;
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
function severityForStarved(weeks: number | undefined): InsightSeverity {
  if (typeof weeks !== 'number') return 'info';
  if (weeks >= 3) return 'critical';
  if (weeks >= 2) return 'warning';
  return 'info';
}

function severityForCarry(weeks: number | undefined): InsightSeverity {
  if (typeof weeks !== 'number') return 'info';
  if (weeks >= 4) return 'critical';
  if (weeks >= 2) return 'warning';
  return 'info';
}

function severityForDrift(observedRaw: string): InsightSeverity {
  const numeric = Number(observedRaw.replace('%', ''));
  if (!Number.isFinite(numeric)) return 'warning';
  // Drift exceptions returned by Sonnet are already past the org's expected range,
  // so the existence of a drift entry maps to ≥ warning by definition.
  return numeric >= 35 || numeric <= 5 ? 'critical' : 'warning';
}

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
      severity: severityForStarved(s.weeksStarved),
    });
  }
  for (const [idx, d] of (payload.driftExceptions ?? []).entries()) {
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
      out.push({
        entityType: 'rally_cry',
        entityId: id,
        label,
        detailText,
        severity: severityForDrift(observed),
      });
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
        severity: 'warning',
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
      severity: severityForCarry(weeks),
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
      severity: 'info',
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

  const counts =
    variant === 'OK' && envelope?.digest
      ? {
          starved: envelope.digest.starvedOutcomes?.length ?? 0,
          drift: envelope.digest.driftExceptions?.length ?? 0,
          carry: envelope.digest.longCarryForwards?.length ?? 0,
          drills:
            envelope.digest.recommendedDrillDowns?.length ??
            envelope.digest.drillDowns?.length ??
            0,
        }
      : null;

  return (
    <header
      data-testid="manager-digest-hero"
      data-variant={variant}
      className="space-y-5 rounded-lg border border-(--color-hero-border) bg-(--color-hero-bg) p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-(--color-hero-muted)">
              Weekly digest
            </p>
            <span
              data-testid="digest-state-badge"
              className="rounded-sm bg-(--color-badge-bg) px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-(--color-badge-fg)"
            >
              {variant}
            </span>
          </div>
          <h1
            data-testid="digest-headline"
            className="mt-2 text-xl font-semibold leading-tight text-(--color-hero-heading)"
          >
            {headline}
          </h1>
          {counts ? (
            <p data-testid="digest-counts" className="mt-2 text-xs text-(--color-hero-muted)">
              {counts.starved} starved · {counts.drift} drift · {counts.carry} carry-forward ·{' '}
              {counts.drills} recommended 1:1
            </p>
          ) : null}
        </div>

        {variant !== 'AWAITING_AI' ? (
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              data-testid="digest-dispatch-slack"
              disabled={dispatch.isLoading}
              onClick={onDispatchSlack}
              className="inline-flex items-center gap-2 rounded-md border border-(--color-hero-heading) bg-(--color-hero-heading) px-3.5 py-2 text-xs font-semibold text-(--color-hero-bg) shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <SlackIcon size={14} />
              {dispatch.isLoading ? 'Sending…' : 'Send to Slack'}
            </button>
            {dispatchAck === 'sent' ? (
              <span
                data-testid="digest-dispatch-ack"
                className="text-[11px] text-(--color-hero-muted)"
              >
                Dispatched · check the channel
              </span>
            ) : null}
            {dispatchAck === 'failed' ? (
              <span className="text-[11px] text-(--color-shell-error)">
                Dispatch failed — see API logs
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {isLoading && !envelope ? (
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
                  recommendedDrillDowns: [],
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
                  recommendedDrillDowns: [],
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
                  recommendedDrillDowns: [],
                })}
              />
              <DigestSection
                title="Recommended 1:1s"
                count={
                  envelope.digest.recommendedDrillDowns?.length ??
                  envelope.digest.drillDowns?.length ??
                  0
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
