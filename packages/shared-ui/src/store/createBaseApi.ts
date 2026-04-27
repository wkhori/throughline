import { createApi, fetchBaseQuery, type BaseQueryFn } from '@reduxjs/toolkit/query/react';
import type { AuthRootSlice } from './authSlice.js';

// Centralised RTK Query factory. The remote consumes this so the JWT push
// from the host's Auth0 SDK propagates cleanly. No raw fetch / axios anywhere
// in app code (lint rule enforces this).
export const TagTypes = {
  Week: 'Week',
  Commit: 'Commit',
  RcdoTree: 'RcdoTree',
  TeamRollup: 'TeamRollup',
  AIInsight: 'AIInsight',
  AlignmentRisk: 'AlignmentRisk',
  Notification: 'Notification',
  User: 'User',
} as const;

export type TagType = (typeof TagTypes)[keyof typeof TagTypes];

export const ALL_TAG_TYPES = Object.values(TagTypes);

export const createBaseQuery = (apiBaseUrl: string): BaseQueryFn =>
  fetchBaseQuery({
    baseUrl: `${apiBaseUrl}/api/v1`,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as AuthRootSlice).auth.token;
      if (token) headers.set('Authorization', `Bearer ${token}`);
      headers.set('Accept', 'application/json');
      return headers;
    },
  });

export const createBaseApi = (apiBaseUrl: string) =>
  createApi({
    reducerPath: 'api',
    baseQuery: createBaseQuery(apiBaseUrl),
    tagTypes: ALL_TAG_TYPES,
    endpoints: () => ({}),
  });
