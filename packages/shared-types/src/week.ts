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
  /** Server-attached T3 portfolio review when the AI ran in-band; null when it
   *  fell back to async retry. The IC view should fall back to the GET endpoint
   *  in that case. */
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
