import type {
  DefiningObjectiveDto,
  OutcomeDto,
  RallyCryDto,
  RcdoTreeDto,
  SupportingOutcomeDto,
} from '@throughline/shared-types';
import { api } from './api.js';

interface CreateRallyCryRequest {
  title: string;
  description?: string;
  displayOrder?: number;
}
type UpdateRallyCryRequest = CreateRallyCryRequest;
interface CreateDefiningObjectiveRequest {
  rallyCryId: string;
  title: string;
  description?: string;
  displayOrder?: number;
}
interface CreateOutcomeRequest {
  definingObjectiveId: string;
  title: string;
  description?: string;
  metricStatement?: string;
  displayOrder?: number;
}
interface CreateSupportingOutcomeRequest {
  outcomeId: string;
  title: string;
  description?: string;
  displayOrder?: number;
}

export const rcdoApi = api.injectEndpoints({
  endpoints: (build) => ({
    getRcdoTree: build.query<RcdoTreeDto, void>({
      query: () => ({ url: '/rcdo/tree' }),
      providesTags: ['RcdoTree'],
    }),
    createRallyCry: build.mutation<RallyCryDto, CreateRallyCryRequest>({
      query: (body) => ({ url: '/admin/rally-cries', method: 'POST', body }),
      invalidatesTags: ['RcdoTree'],
    }),
    updateRallyCry: build.mutation<RallyCryDto, { id: string; body: UpdateRallyCryRequest }>({
      query: ({ id, body }) => ({ url: `/admin/rally-cries/${id}`, method: 'PUT', body }),
      invalidatesTags: ['RcdoTree'],
    }),
    deleteRallyCry: build.mutation<void, string>({
      query: (id) => ({ url: `/admin/rally-cries/${id}`, method: 'DELETE' }),
      invalidatesTags: ['RcdoTree'],
    }),
    createDefiningObjective: build.mutation<DefiningObjectiveDto, CreateDefiningObjectiveRequest>({
      query: (body) => ({ url: '/admin/defining-objectives', method: 'POST', body }),
      invalidatesTags: ['RcdoTree'],
    }),
    createOutcome: build.mutation<OutcomeDto, CreateOutcomeRequest>({
      query: (body) => ({ url: '/admin/outcomes', method: 'POST', body }),
      invalidatesTags: ['RcdoTree'],
    }),
    createSupportingOutcome: build.mutation<
      SupportingOutcomeDto,
      CreateSupportingOutcomeRequest
    >({
      query: (body) => ({ url: '/admin/supporting-outcomes', method: 'POST', body }),
      invalidatesTags: ['RcdoTree'],
    }),
    deleteSupportingOutcome: build.mutation<void, string>({
      query: (id) => ({ url: `/admin/supporting-outcomes/${id}`, method: 'DELETE' }),
      invalidatesTags: ['RcdoTree'],
    }),
  }),
});

export const {
  useGetRcdoTreeQuery,
  useCreateRallyCryMutation,
  useUpdateRallyCryMutation,
  useDeleteRallyCryMutation,
  useCreateDefiningObjectiveMutation,
  useCreateOutcomeMutation,
  useCreateSupportingOutcomeMutation,
  useDeleteSupportingOutcomeMutation,
} = rcdoApi;
