import type {
  AIInsightDto,
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
} = aiApi;
