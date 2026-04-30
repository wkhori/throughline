import type {
  AIInsightDto,
  AIInsightKind,
  AlignmentDeltaPayload,
  DriftCheckPayload,
  DriftCheckRequest,
  PortfolioReviewPayload,
  QualityLintPayload,
  QualityLintRequest,
  SuggestOutcomePayload,
  SuggestOutcomeRequest,
} from '@throughline/shared-types';
import { api } from './api.js';

export interface BatchInsightsArgs {
  commitIds: string[];
  /** Logical kinds; mapped to backend AIInsightKind enums below. */
  kinds: Array<'drift' | 'lint' | 'suggestion'>;
}

export interface BatchInsightsResult {
  /** Latest insight per (commitId, kind) tuple. */
  byCommit: Record<string, Partial<Record<AIInsightKind, AIInsightDto>>>;
}

const KIND_TO_ENUM: Record<'drift' | 'lint' | 'suggestion', AIInsightKind> = {
  drift: 'T2_DRIFT',
  lint: 'T7_QUALITY',
  suggestion: 'T1_SUGGESTION',
};

export const aiApi = api.injectEndpoints({
  endpoints: (build) => ({
    suggestOutcome: build.mutation<AIInsightDto<SuggestOutcomePayload>, SuggestOutcomeRequest>({
      query: (body) => ({ url: '/ai/suggest-outcome', method: 'POST', body }),
      invalidatesTags: ['AIInsight'],
    }),
    driftCheck: build.mutation<AIInsightDto<DriftCheckPayload>, DriftCheckRequest>({
      query: (body) => ({ url: '/ai/drift-check', method: 'POST', body }),
      invalidatesTags: (_res, _err, body) => [{ type: 'AIInsight', id: `commit:${body.commitId}` }],
    }),
    qualityLint: build.mutation<AIInsightDto<QualityLintPayload>, QualityLintRequest>({
      query: (body) => ({ url: '/ai/quality-lint', method: 'POST', body }),
      invalidatesTags: (_res, _err, body) => [{ type: 'AIInsight', id: `commit:${body.commitId}` }],
    }),
    // T4 — fetched after the IC reconciles the week. 204 means the AFTER_COMMIT consumer hasn't
    // posted the insight yet (or fell back to deterministic mode). RTK Query treats 204 as null.
    getAlignmentDelta: build.query<AIInsightDto<AlignmentDeltaPayload> | null, string>({
      query: (weekId) => ({ url: `/ai/alignment-delta/${weekId}` }),
      transformResponse: (response: unknown) =>
        (response as AIInsightDto<AlignmentDeltaPayload> | null | undefined) ?? null,
      providesTags: (_res, _err, weekId) => [{ type: 'AIInsight', id: `week:${weekId}:T4` }],
    }),
    runAlignmentDelta: build.mutation<AIInsightDto<AlignmentDeltaPayload>, string>({
      query: (weekId) => ({ url: `/ai/alignment-delta/${weekId}`, method: 'POST' }),
      invalidatesTags: (_res, _err, weekId) => [{ type: 'AIInsight', id: `week:${weekId}:T4` }],
    }),
    getPortfolioReview: build.query<AIInsightDto<PortfolioReviewPayload> | null, string>({
      query: (weekId) => ({ url: `/ai/portfolio-review/${weekId}` }),
      transformResponse: (response: unknown) =>
        (response as AIInsightDto<PortfolioReviewPayload> | null | undefined) ?? null,
      providesTags: (_res, _err, weekId) => [{ type: 'AIInsight', id: `week:${weekId}:T3` }],
    }),
    runPortfolioReview: build.mutation<AIInsightDto<PortfolioReviewPayload>, string>({
      query: (weekId) => ({ url: `/ai/portfolio-review/${weekId}`, method: 'POST' }),
      invalidatesTags: (_res, _err, weekId) => [{ type: 'AIInsight', id: `week:${weekId}:T3` }],
    }),
    /**
     * Phase-5 batch hydration. Fans out one request per requested logical kind
     * (the backend endpoint is keyed by a single AIInsightKind) and merges the
     * results into a `commitId → kind → insight` lookup. We use queryFn so the
     * caller still gets a single hook with single loading/error semantics.
     */
    getBatchInsights: build.query<BatchInsightsResult, BatchInsightsArgs>({
      async queryFn({ commitIds, kinds }, _api, _extra, baseQuery) {
        const byCommit: BatchInsightsResult['byCommit'] = {};
        if (!commitIds.length || !kinds.length) {
          return { data: { byCommit } };
        }
        const responses = await Promise.all(
          kinds.map((k) =>
            baseQuery({
              url: '/ai/insights/batch',
              method: 'POST',
              body: { commitIds, kind: KIND_TO_ENUM[k] },
            }),
          ),
        );
        for (const res of responses) {
          if (res.error) return { error: res.error };
          const body = res.data as { insights: AIInsightDto[] } | undefined;
          for (const insight of body?.insights ?? []) {
            const commitId = insight.entityId;
            if (!commitId) continue;
            const slot = byCommit[commitId] ?? {};
            slot[insight.kind] = insight;
            byCommit[commitId] = slot;
          }
        }
        return { data: { byCommit } };
      },
      providesTags: (_res, _err, { commitIds }) =>
        commitIds.map((id) => ({ type: 'AIInsight' as const, id: `commit:${id}` })),
    }),
  }),
});

export const {
  useSuggestOutcomeMutation,
  useDriftCheckMutation,
  useQualityLintMutation,
  useGetAlignmentDeltaQuery,
  useRunAlignmentDeltaMutation,
  useGetPortfolioReviewQuery,
  useRunPortfolioReviewMutation,
  useGetBatchInsightsQuery,
} = aiApi;
