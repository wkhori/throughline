import type { Iso8601, IsoDate, Ulid } from './common.js';

export type WeekState = 'DRAFT' | 'LOCKED' | 'RECONCILING' | 'RECONCILED';
export type CommitState = 'ACTIVE' | 'CARRIED_FORWARD' | 'DROPPED';
export type CommitCategory = 'STRATEGIC' | 'OPERATIONAL' | 'REACTIVE';
export type CommitPriority = 'MUST' | 'SHOULD' | 'COULD';
export type ReconciliationOutcome = 'DONE' | 'PARTIAL' | 'NOT_DONE';

export interface CommitDto {
  id: Ulid;
  weekId: Ulid;
  text: string;
  supportingOutcomeId: Ulid | null;
  category: CommitCategory;
  priority: CommitPriority;
  displayOrder: number;
  state: CommitState;
  parentCommitId: Ulid | null;
  reconciliationOutcome: ReconciliationOutcome | null;
  reconciliationNote: string | null;
  carryForwardWeeks: number;
}

export interface WeekDto {
  id: Ulid;
  userId: Ulid;
  orgId: Ulid;
  weekStart: IsoDate;
  state: WeekState;
  lockedAt: Iso8601 | null;
  reconciledAt: Iso8601 | null;
  commits: CommitDto[];
}

export interface LockResponseDto {
  week: WeekDto;
  /** Phase 5b wires the real T3 portfolio review; null in Phase 2. */
  portfolioReview: unknown | null;
}

export interface CreateCommitRequest {
  weekId: Ulid;
  text: string;
  supportingOutcomeId: Ulid | null;
  category: CommitCategory;
  priority: CommitPriority;
}

export interface UpdateCommitRequest {
  text: string;
  supportingOutcomeId: Ulid | null;
  category: CommitCategory;
  priority: CommitPriority;
}
