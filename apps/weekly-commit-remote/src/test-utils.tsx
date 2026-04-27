import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { ApiBaseUrlProvider, setToken } from '@throughline/shared-ui';
import type { ReactNode } from 'react';
import type { MeDto, Role } from '@throughline/shared-types';
import { buildRemoteStore } from './store.js';

export const seededStore = (role: Role | null = 'IC') => {
  const store = buildRemoteStore();
  if (role) {
    const me: MeDto = {
      id: '01J0000000000000000000000A',
      orgId: '01J0000000000000000000000Z',
      email: `${role.toLowerCase()}@demo.throughline.app`,
      displayName: `Demo ${role}`,
      role,
      permissions: [role],
    };
    store.dispatch(setToken({ token: `mock.${role.toLowerCase()}.token`, user: me }));
  }
  return store;
};

export const renderWithProviders = (ui: ReactNode, role: Role | null = 'IC') => {
  const store = seededStore(role);
  return {
    store,
    ...render(
      <Provider store={store}>
        <ApiBaseUrlProvider value="http://localhost:8080">{ui}</ApiBaseUrlProvider>
      </Provider>,
    ),
  };
};
