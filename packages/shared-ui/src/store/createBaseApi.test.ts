import { configureStore } from '@reduxjs/toolkit';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { authReducer, setToken } from './authSlice.js';
import { ALL_TAG_TYPES, TagTypes, createBaseApi, createBaseQuery } from './createBaseApi.js';

describe('createBaseApi', () => {
  it('exports the canonical tagTypes', () => {
    expect(TagTypes.Week).toBe('Week');
    expect(TagTypes.Commit).toBe('Commit');
    expect(ALL_TAG_TYPES).toContain('AIInsight');
    expect(ALL_TAG_TYPES).toContain('AlignmentRisk');
    expect(ALL_TAG_TYPES.length).toBe(8);
  });

  it('builds an api slice keyed under reducerPath "api"', () => {
    const api = createBaseApi('http://localhost:8080');
    expect(api.reducerPath).toBe('api');
    expect(typeof api.middleware).toBe('function');
  });

  it('createBaseQuery is a function', () => {
    const fn = createBaseQuery('http://localhost:8080');
    expect(typeof fn).toBe('function');
  });
});

// Integration smoke: prepareHeaders attaches Bearer token from auth slice.
const server = setupServer(
  http.get('http://localhost:8080/api/v1/me', ({ request }) => {
    return HttpResponse.json({ authHeader: request.headers.get('authorization') });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('createBaseApi prepareHeaders', () => {
  it('forwards the auth token from the shared auth slice', async () => {
    const baseQuery = createBaseQuery('http://localhost:8080');
    const store = configureStore({ reducer: { auth: authReducer } });
    store.dispatch(
      setToken({
        token: 'jwt.abc',
        user: {
          id: '01J0',
          orgId: '01J1',
          email: 'a@b.com',
          displayName: 'A',
          role: 'IC',
          permissions: ['IC'],
        },
      }),
    );

    const result = await baseQuery(
      { url: '/me', method: 'GET' },
      // Minimal BaseQueryApi; only getState and signal are read by fetchBaseQuery.
      {
        getState: () => store.getState(),
        signal: new AbortController().signal,
        abort: () => {},
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        dispatch: store.dispatch as any,
        extra: undefined,
        endpoint: 't',
        type: 'query',
      },
      {},
    );
    expect((result as { data: { authHeader: string } }).data.authHeader).toBe('Bearer jwt.abc');
  });
});
