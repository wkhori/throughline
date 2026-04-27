// 26-character Crockford base32 ULID string. Identifier shape used everywhere.
export type Ulid = string;

export type Iso8601 = string;
export type IsoDate = string;

export type Role = 'IC' | 'MANAGER' | 'ADMIN';

export interface PageRequest {
  page: number;
  size: number;
  sort?: string;
}

export interface Page<T> {
  content: T[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail?: string;
  errors?: { field: string; message: string }[];
}
