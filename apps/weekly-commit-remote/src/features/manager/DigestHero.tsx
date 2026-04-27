import { useState, type ReactNode } from 'react';
import { InsightDrillDown, type InsightDrillDownEntity } from '@throughline/shared-ui';
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
  if (entity.entityType === 'user') return <UserDetail userId={entity.entityId} />;
  return (
    <pre data-testid="digest-detail-default" className="whitespace-pre-wrap break-all">
      {JSON.stringify(entity, null, 2)}
    </pre>
  );
}

function shortId(id: string | null | undefined): string {
  return typeof id === 'string' && id.length > 0 ? id.slice(0, 8) : '—';
}

// Sonnet's JSON shape varies — sometimes `outcomeId`/`outcomeTitle`, sometimes
// `supportingOutcomeId`/`title`. Coerce defensively so a missing field never
// crashes the dashboard.
function chipsFor(payload: DigestPayload): InsightDrillDownEntity[] {
  const out: InsightDrillDownEntity[] = [];
  for (const s of payload.starvedOutcomes ?? []) {
    const id =
      s.supportingOutcomeId ??
      (s as unknown as { outcomeId?: string }).outcomeId ??
      '';
    const title =
      s.title ??
      (s as unknown as { outcomeTitle?: string }).outcomeTitle ??
      `outcome ${shortId(id)}`;
    out.push({ entityType: 'supporting_outcome', entityId: id, label: title });
  }
  for (const d of payload.driftExceptions ?? []) {
    const id = d.userId ?? '';
    if (!id && !d.displayName) continue;
    out.push({
      entityType: 'user',
      entityId: id,
      label: d.displayName?.trim() ? d.displayName : `User #${shortId(id)}`,
    });
  }
  for (const c of payload.longCarryForwards ?? []) {
    const id = c.commitId ?? '';
    if (!id) continue;
    const weeks = c.weeks ?? 0;
    const text = c.commitText?.trim() || `Commit #${shortId(id)}`;
    const prefix = weeks > 0 ? `${weeks}w · ` : '';
    out.push({ entityType: 'commit', entityId: id, label: `${prefix}${text}` });
  }
  for (const u of payload.drillDowns ?? []) {
    const id = u.userId ?? '';
    if (!id && !u.displayName) continue;
    out.push({
      entityType: 'user',
      entityId: id,
      label: u.displayName?.trim() ? u.displayName : `User #${shortId(id)}`,
    });
  }
  return out;
}

export function DigestHero(props: DigestHeroProps = {}) {
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
                count={envelope.digest.drillDowns?.length ?? 0}
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
