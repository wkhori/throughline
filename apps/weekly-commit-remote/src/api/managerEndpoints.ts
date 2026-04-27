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
  /** Optional alignment_risk row id — present when ribbon row originates from a T6 risk so the FE
   *  can call the ack endpoint. Phase-4 deterministic ribbons leave this undefined. */
  alignmentRiskId?: string;
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

/** T5 manager digest payload — matches docs/ai-copilot-spec.md §T5 output schema. */
export interface DigestPayload {
  alignmentHeadline: string;
  starvedOutcomes: Array<{ supportingOutcomeId: string; title?: string; reason?: string }>;
  driftExceptions: Array<{ userId: string; displayName?: string; avgDriftScore?: number }>;
  longCarryForwards: Array<{ commitId: string; weeks: number; commitText?: string }>;
  drillDowns: Array<{ userId: string; displayName?: string; reason: string }>;
  slackMessage: string;
  reasoning?: string;
  model?: string;
}

export type DigestState = 'AWAITING_AI' | 'OK' | 'FALLBACK';

export interface DigestEnvelope {
  digest: DigestPayload | null;
  state: DigestState;
}

export interface DigestRegenerateResponse {
  digest: DigestPayload | null;
  state: DigestState;
  message: string;
}

export interface AlignmentRisk {
  id: string;
  rule: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | string;
  entityType: string;
  entityId: string;
  weekStart: string;
  createdAt: string;
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
      providesTags: [{ type: 'AIInsight', id: 'CURRENT_DIGEST' }],
    }),
    regenerateDigest: build.mutation<DigestRegenerateResponse, void>({
      query: () => ({ url: `/manager/digest/regenerate`, method: 'POST' }),
      invalidatesTags: [
        { type: 'AIInsight', id: 'CURRENT_DIGEST' },
        { type: 'AIInsight', id: 'LIST' },
      ],
    }),
    getAlignmentRisks: build.query<AlignmentRisk[], void>({
      query: () => ({ url: `/manager/alignment-risks` }),
      providesTags: (result) =>
        result
          ? [
              ...result.map((r) => ({ type: 'AlignmentRisk' as const, id: r.id })),
              { type: 'AlignmentRisk' as const, id: 'LIST' },
            ]
          : [{ type: 'AlignmentRisk' as const, id: 'LIST' }],
    }),
    ackAlignmentRisk: build.mutation<void, string>({
      query: (id) => ({ url: `/manager/alignment-risks/${id}/ack`, method: 'POST' }),
      invalidatesTags: (_res, _err, id) => [
        { type: 'AlignmentRisk', id },
        { type: 'AlignmentRisk', id: 'LIST' },
        { type: 'TeamRollup', id: 'PAGE' },
      ],
    }),
  }),
});

export const {
  useGetTeamRollupQuery,
  useGetTeamMemberCurrentWeekQuery,
  useGetCurrentDigestQuery,
  useRegenerateDigestMutation,
  useGetAlignmentRisksQuery,
  useAckAlignmentRiskMutation,
} = managerApi;
