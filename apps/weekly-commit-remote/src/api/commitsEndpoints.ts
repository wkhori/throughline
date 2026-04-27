import type {
  CommitDto,
  CreateCommitRequest,
  UpdateCommitRequest,
} from '@throughline/shared-types';
import { api } from './api.js';

export const commitsApi = api.injectEndpoints({
  endpoints: (build) => ({
    createCommit: build.mutation<CommitDto, CreateCommitRequest>({
      query: (body) => ({ url: '/commits', method: 'POST', body }),
      invalidatesTags: (_res, _err, body) => [{ type: 'Week', id: body.weekId }, 'Commit'],
    }),
    updateCommit: build.mutation<
      CommitDto,
      { id: string; body: UpdateCommitRequest; weekId: string }
    >({
      query: ({ id, body }) => ({ url: `/commits/${id}`, method: 'PUT', body }),
      invalidatesTags: (_res, _err, { id, weekId }) => [
        { type: 'Commit', id },
        { type: 'Week', id: weekId },
      ],
    }),
    deleteCommit: build.mutation<void, { id: string; weekId: string }>({
      query: ({ id }) => ({ url: `/commits/${id}`, method: 'DELETE' }),
      invalidatesTags: (_res, _err, { id, weekId }) => [
        { type: 'Commit', id },
        { type: 'Week', id: weekId },
      ],
    }),
  }),
});

export const { useCreateCommitMutation, useUpdateCommitMutation, useDeleteCommitMutation } =
  commitsApi;
