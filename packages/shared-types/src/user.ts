import type { Role, Ulid } from './common.js';

export interface UserDto {
  id: Ulid;
  orgId: Ulid;
  teamId?: Ulid | null;
  email: string;
  displayName: string;
  role: Role;
  managerId?: Ulid | null;
}

export interface MeDto extends UserDto {
  permissions: Role[];
}
