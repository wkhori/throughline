import type { MeDto, Role } from '@throughline/shared-types';

// MockAuth0Provider — activates when VITE_AUTH0_DOMAIN is unset (continue-and-defer).
// Returns a deterministic synthetic JWT + user. Backend's MockJwtDecoder accepts it
// under the `dev` profile. Real Auth0Provider replaces this once the domain lands
// in `.env.local`.
const MOCK_TOKEN_BY_PERSONA: Record<string, string> = {
  ic: 'mock.ic.token',
  manager: 'mock.manager.token',
  admin: 'mock.admin.token',
};

export interface MockPersona {
  id: 'ic' | 'manager' | 'admin';
  user: MeDto;
  token: string;
}

const personaUser = (id: 'ic' | 'manager' | 'admin', role: Role): MeDto => ({
  id: `01J0000000000000000000000${id === 'ic' ? 'A' : id === 'manager' ? 'B' : 'C'}`,
  orgId: '01J0000000000000000000000Z',
  email: `${id}@demo.throughline.app`,
  displayName: id === 'ic' ? 'Demo IC' : id === 'manager' ? 'Demo Manager' : 'Demo Admin',
  role,
  permissions: [role],
});

export const mockPersonas: MockPersona[] = [
  { id: 'ic', user: personaUser('ic', 'IC'), token: MOCK_TOKEN_BY_PERSONA.ic! },
  { id: 'manager', user: personaUser('manager', 'MANAGER'), token: MOCK_TOKEN_BY_PERSONA.manager! },
  { id: 'admin', user: personaUser('admin', 'ADMIN'), token: MOCK_TOKEN_BY_PERSONA.admin! },
];

export const isAuth0Configured = (): boolean =>
  Boolean(import.meta.env.VITE_AUTH0_DOMAIN && import.meta.env.VITE_AUTH0_CLIENT_ID);
