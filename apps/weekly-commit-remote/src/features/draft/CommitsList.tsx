import { useMemo } from 'react';
import type { CommitDto, RcdoTreeDto } from '@throughline/shared-types';
import { AIStatusIndicator, RcdoChip, resolveRcdoTrail } from '@throughline/shared-ui';
import { useGetBatchInsightsQuery } from '../../api/aiEndpoints.js';
import { EffortShareBar, computeEffortShares, type EffortShareSegment } from './EffortShareBar.js';

interface CommitsListProps {
  commits: CommitDto[];
  rcdo?: RcdoTreeDto;
  weekState: 'DRAFT' | 'LOCKED' | 'RECONCILING' | 'RECONCILED';
  /** Optional row click handler; current Phase 5 demo uses it for re-link flow. */
  onCommitClick?: (commit: CommitDto) => void;
}

interface SOGroup {
  segment: EffortShareSegment;
  commits: CommitDto[];
}

/**
 * Phase-5 IC view of the draft week. Replaces the flat list with a
 * group-by-Supporting-Outcome layout that mirrors what T3 will show after the
 * week is locked: priority-weighted effort share per SO, with the highest-share
 * group rendered first. Drift verdicts (T2) and quality lint hits (T7) are
 * hydrated in a single batch call so we don't fan out N round-trips.
 */
export function CommitsList({ commits, rcdo, weekState, onCommitClick }: CommitsListProps) {
  // Only ACTIVE commits render here — the carry-forward ghost is its own pinned row.
  const visibleCommits = useMemo(() => commits.filter((c) => c.state === 'ACTIVE'), [commits]);

  const commitIds = useMemo(() => visibleCommits.map((c) => c.id), [visibleCommits]);

  const { data: insights } = useGetBatchInsightsQuery(
    { commitIds, kinds: ['drift', 'lint'] },
    { skip: commitIds.length === 0 },
  );

  const groups = useMemo<SOGroup[]>(() => {
    const segments = computeEffortShares(visibleCommits);
    // Resolve labels on the segments using the RCDO tree.
    const labelled = segments.map((seg) => {
      const trail = resolveRcdoTrail(rcdo, seg.supportingOutcomeId);
      return {
        ...seg,
        label: trail?.supportingOutcomeTitle ?? 'Unlinked',
      };
    });
    return labelled.map((seg) => ({
      segment: seg,
      commits: visibleCommits.filter(
        (c) => (c.supportingOutcomeId ?? null) === seg.supportingOutcomeId,
      ),
    }));
  }, [visibleCommits, rcdo]);

  const segmentsForBar = useMemo(() => groups.map((g) => g.segment), [groups]);

  if (!visibleCommits.length) {
    return (
      <section data-testid="commits-list" className="space-y-2">
        <p className="text-sm text-(--color-shell-muted)">No commits in this week yet.</p>
      </section>
    );
  }

  return (
    <section data-testid="commits-list" className="space-y-4">
      <EffortShareBar segments={segmentsForBar} />
      <div className="space-y-4">
        {groups.map((group) => {
          const trail = resolveRcdoTrail(rcdo, group.segment.supportingOutcomeId);
          const sharePct = Math.round(group.segment.share * 100);
          return (
            <article
              key={group.segment.supportingOutcomeId ?? '__unlinked__'}
              data-testid="so-group"
              data-so-id={group.segment.supportingOutcomeId ?? ''}
              data-share={group.segment.share.toFixed(4)}
              className="rounded-md border border-(--color-panel-border) bg-(--color-panel-bg) p-3"
            >
              <header className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <RcdoChip trail={trail} variant="trail" />
                </div>
                <span
                  data-testid="so-group-share"
                  className="shrink-0 rounded-sm bg-(--color-badge-bg) px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-(--color-badge-fg)"
                  title={`${group.segment.count} commits · ${group.segment.priorityPoints} priority points`}
                >
                  {group.commits.length} commits · {sharePct}%
                </span>
              </header>
              <ul className="mt-2 space-y-1.5">
                {group.commits.map((commit) => {
                  const driftPayload = insights?.byCommit[commit.id]?.T2_DRIFT?.payload as
                    | { alignmentVerdict?: string; driftScore?: number }
                    | undefined;
                  const drifted =
                    !!driftPayload &&
                    (driftPayload.alignmentVerdict === 'tangential' ||
                      driftPayload.alignmentVerdict === 'unrelated' ||
                      (typeof driftPayload.driftScore === 'number' &&
                        driftPayload.driftScore >= 0.5));
                  const isClickable = weekState === 'DRAFT' && !!onCommitClick;
                  return (
                    <li
                      key={commit.id}
                      data-testid="commit-row"
                      data-commit-id={commit.id}
                      data-drift={drifted ? 'true' : 'false'}
                      onClick={isClickable ? () => onCommitClick?.(commit) : undefined}
                      className={`flex items-start justify-between gap-2 rounded-md border px-2.5 py-2 text-sm ${
                        drifted
                          ? 'border-amber-300 bg-(--color-commit-bg)'
                          : 'border-(--color-commit-border) bg-(--color-commit-bg)'
                      } ${isClickable ? 'cursor-pointer hover:opacity-90' : ''}`}
                    >
                      <span className="min-w-0 flex-1 text-(--color-commit-text)">
                        {commit.text}
                      </span>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className="rounded-sm bg-(--color-badge-bg) px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-(--color-badge-fg)">
                          {commit.priority}
                        </span>
                        {drifted ? (
                          <span
                            data-testid="drift-badge"
                            title={
                              (driftPayload as { fixSuggestion?: string | null } | undefined)
                                ?.fixSuggestion ?? 'Drift detected for this commit'
                            }
                            className="inline-flex items-center gap-1 rounded-sm border border-amber-300 bg-(--color-ribbon-medium-bg) px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-(--color-ai-warn)"
                          >
                            <AIStatusIndicator state="warning" />
                            Drift
                          </span>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </article>
          );
        })}
      </div>
    </section>
  );
}
