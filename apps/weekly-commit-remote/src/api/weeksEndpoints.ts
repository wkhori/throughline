import type { LockResponseDto, ReconciliationOutcome, WeekDto } from '@throughline/shared-types';
import { api } from './api.js';

export interface ReconcileItemBody {
  commitId: string;
  outcome: ReconciliationOutcome;
  note: string;
  carryForward: boolean;
}

export interface ReconcileBody {
  items: ReconcileItemBody[];
}

export interface ReconcileResponseDto {
  week: WeekDto;
  alignmentDelta: unknown | null;
}

export const weeksApi = api.injectEndpoints({
  endpoints: (build) => ({
    getCurrentWeek: build.query<WeekDto, void>({
      query: () => ({ url: '/weeks/current' }),
      providesTags: (week) =>
        week
          ? [
              { type: 'Week', id: week.id },
              ...week.commits.map((c) => ({ type: 'Commit' as const, id: c.id })),
            ]
          : ['Week'],
    }),
    getWeekById: build.query<WeekDto, string>({
      query: (id) => ({ url: `/weeks/${id}` }),
      providesTags: (week, _err, id) => [{ type: 'Week', id }],
    }),
    lockWeek: build.mutation<LockResponseDto, string>({
      query: (id) => ({ url: `/weeks/${id}/lock`, method: 'POST' }),
      invalidatesTags: (_res, _err, id) => [{ type: 'Week', id }, 'Commit', 'AIInsight'],
    }),
    startReconcile: build.mutation<WeekDto, string>({
      query: (id) => ({ url: `/weeks/${id}/reconcile-start`, method: 'POST' }),
      invalidatesTags: (_res, _err, id) => [{ type: 'Week', id }],
    }),
    reconcileWeek: build.mutation<ReconcileResponseDto, { id: string; body: ReconcileBody }>({
      query: ({ id, body }) => ({ url: `/weeks/${id}/reconcile`, method: 'PUT', body }),
      invalidatesTags: (_res, _err, { id }) => [
        { type: 'Week', id },
        'Commit',
        'Week',
        'AIInsight',
      ],
    }),
  }),
});

export const {
  useGetCurrentWeekQuery,
  useGetWeekByIdQuery,
  useLockWeekMutation,
  useStartReconcileMutation,
  useReconcileWeekMutation,
} = weeksApi;
