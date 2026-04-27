import type { Iso8601, Ulid } from './common.js';

export interface RallyCryDto {
  id: Ulid;
  title: string;
  description?: string;
  displayOrder: number;
  archivedAt?: Iso8601 | null;
  definingObjectives: DefiningObjectiveDto[];
}

export interface DefiningObjectiveDto {
  id: Ulid;
  rallyCryId: Ulid;
  title: string;
  description?: string;
  displayOrder: number;
  archivedAt?: Iso8601 | null;
  outcomes: OutcomeDto[];
}

export interface OutcomeDto {
  id: Ulid;
  definingObjectiveId: Ulid;
  title: string;
  description?: string;
  metricStatement?: string;
  displayOrder: number;
  archivedAt?: Iso8601 | null;
  supportingOutcomes: SupportingOutcomeDto[];
}

export interface SupportingOutcomeDto {
  id: Ulid;
  outcomeId: Ulid;
  title: string;
  description?: string;
  displayOrder: number;
  archivedAt?: Iso8601 | null;
}

export interface RcdoTreeDto {
  rallyCries: RallyCryDto[];
}
