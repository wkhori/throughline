import type {
  AIInsightDto,
  DriftCheckPayload,
  DriftCheckRequest,
  QualityLintPayload,
  QualityLintRequest,
  SuggestOutcomePayload,
  SuggestOutcomeRequest,
} from '@throughline/shared-types';
import { api } from './api.js';

// Phase 5a — IC-side AI surface (T1 / T2 / T7). The endpoints are POST because every call carries
// a per-call dynamic body. Cost guard refusals surface as 429 BUDGET_EXHAUSTED — components
// silent-degrade per docs/ai-copilot-spec.md.
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
  }),
});

export const { useSuggestOutcomeMutation, useDriftCheckMutation, useQualityLintMutation } = aiApi;
