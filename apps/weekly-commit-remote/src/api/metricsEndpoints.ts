import { api } from './api.js';

export interface OrgMetrics {
  planningCompletionRate: number;
  reconciliationStrictPct: number;
  reconciliationWeightedPct: number;
  avgManagerDigestViewMinutesAfterDeliver: number;
  planningSessionMinutesP50: number;
}

export const metricsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getOrgMetrics: build.query<OrgMetrics, void>({
      query: () => ({ url: '/metrics/org' }),
    }),
  }),
});

export const { useGetOrgMetricsQuery } = metricsApi;
