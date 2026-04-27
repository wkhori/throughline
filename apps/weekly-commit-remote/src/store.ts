import { configureStore } from '@reduxjs/toolkit';
import { authReducer } from '@throughline/shared-ui';
import { api } from './api/api.js';
import './api/rcdoEndpoints.js';

export const buildRemoteStore = () =>
  configureStore({
    reducer: {
      auth: authReducer,
      [api.reducerPath]: api.reducer,
    },
    middleware: (g) => g().concat(api.middleware),
  });

export type RemoteState = ReturnType<ReturnType<typeof buildRemoteStore>['getState']>;
