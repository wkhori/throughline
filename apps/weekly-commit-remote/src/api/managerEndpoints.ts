import type { WeekDto } from '@throughline/shared-types';
import { api } from './api.js';

export interface OutcomeShare {
  outcomeId: string;
  outcomeTitle: string;
  share: number;
}

export interface StarvedOutcome {
  outcomeId: string;
  outcomeTitle: string;
  weeksStarved: number;
}

export interface PriorityDrift {
  rallyCryId: string;
  rallyCryTitle: string;
  observedShare: number;
  expectedLow: number;
  expectedHigh: number;
}

export interface RibbonEntry {
  kind: 'LONG_CARRY_FORWARD' | 'PRIORITY_DRIFT' | 'STARVED_OUTCOME' | string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | string;
  label: string;
  entityType: string;
  entityId: string;
}

export interface RollupPayload {
  teamId: string;
  teamName: string;
  weekStart: string;
  memberCount: number;
  lockedCount: number;
  reconciledCount: number;
  doneCount: number;
  partialCount: number;
  notDoneCount: number;
  carryForwardCount: number;
  commitsByOutcome: OutcomeShare[];
  starvedOutcomes: StarvedOutcome[];
  driftExceptions: PriorityDrift[];
  exceptionRibbon: RibbonEntry[];
}

export interface TeamRollupRow {
  teamId: string;
  weekStart: string;
  payload: RollupPayload;
  computedAt: string;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface DigestEnvelope {
  digest: unknown | null;
  state: string;
}

export const managerApi = api.injectEndpoints({
  endpoints: (build) => ({
    getTeamRollup: build.query<PageResponse<TeamRollupRow>, { page?: number; size?: number }>({
      query: ({ page = 0, size = 50 }) => ({
        url: `/manager/team-rollup?page=${page}&size=${size}`,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.content.map((row) => ({ type: 'TeamRollup' as const, id: row.teamId })),
              { type: 'TeamRollup' as const, id: 'PAGE' },
            ]
          : [{ type: 'TeamRollup' as const, id: 'PAGE' }],
    }),
    getTeamMemberCurrentWeek: build.query<WeekDto, string>({
      query: (userId) => ({ url: `/manager/team/${userId}/week/current` }),
      providesTags: (_res, _err, userId) => [{ type: 'Week' as const, id: userId }],
    }),
    getCurrentDigest: build.query<DigestEnvelope, void>({
      query: () => ({ url: `/manager/digest/current` }),
      providesTags: ['AIInsight'],
    }),
    regenerateDigest: build.mutation<DigestEnvelope, void>({
      query: () => ({ url: `/manager/digest/regenerate`, method: 'POST' }),
      invalidatesTags: ['AIInsight'],
    }),
    getAlignmentRisks: build.query<unknown[], void>({
      query: () => ({ url: `/manager/alignment-risks` }),
      providesTags: ['AlignmentRisk'],
    }),
  }),
});

export const {
  useGetTeamRollupQuery,
  useGetTeamMemberCurrentWeekQuery,
  useGetCurrentDigestQuery,
  useRegenerateDigestMutation,
  useGetAlignmentRisksQuery,
} = managerApi;
