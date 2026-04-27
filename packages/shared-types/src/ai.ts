import type { CommitCategory, CommitPriority } from './week.js';
import type { Ulid } from './common.js';

// AI insight kinds — mirrors AIInsightKind on the backend.
export type AIInsightKind =
  | 'T1_SUGGESTION'
  | 'T2_DRIFT'
  | 'T3_PORTFOLIO'
  | 'T4_DELTA'
  | 'T5_DIGEST'
  | 'T6_ALERT'
  | 'T7_QUALITY';

export interface AIInsightDto<P = unknown> {
  id: Ulid;
  kind: AIInsightKind;
  model: string;
  payload: P;
  latencyMs: number;
  costCents: string;
}

// ---------------- T1 Outcome Suggestion ----------------
export interface OutcomeCandidateDto {
  supportingOutcomeId: Ulid;
  title: string;
  parentOutcomeTitle: string;
  parentDOTitle: string;
  parentRallyCryTitle: string;
}
export interface SuggestOutcomeRequest {
  draftCommitText: string;
  candidates: OutcomeCandidateDto[];
  recentUserCommits?: Array<{ text: string; supportingOutcomeId: string }>;
}
export interface SuggestOutcomePayload {
  supportingOutcomeId: Ulid | null;
  confidence: number;
  rationale: string;
  reasoning: string;
  model: string;
}

// ---------------- T2 Drift Warning ----------------
export interface DriftCheckLinkedOutcome {
  supportingOutcomeId: Ulid;
  title: string;
  parentOutcomeTitle: string;
  parentDOTitle: string;
  metricStatement?: string | null;
}
export interface DriftCheckRequest {
  commitId: Ulid;
  commitText: string;
  linkedOutcome: DriftCheckLinkedOutcome;
  alternativeOutcomes: Array<{ supportingOutcomeId: Ulid; title: string }>;
}
export interface DriftCheckPayload {
  driftScore: number;
  alignmentVerdict: 'aligned' | 'indirect' | 'tangential' | 'unrelated';
  fixSuggestion: string | null;
  suggestedRelink: Ulid | null;
  reasoning: string;
  model: string;
}

// ---------------- T7 Commit Quality Lint ----------------
export interface QualityLintRequest {
  commitId: Ulid;
  commitText: string;
  category: CommitCategory;
  priority: CommitPriority;
  supportingOutcomeTitle: string;
}
export interface QualityLintIssue {
  kind: 'vague' | 'unmeasurable' | 'estimate_mismatch';
  message: string;
}
export interface QualityLintPayload {
  issues: QualityLintIssue[];
  severity: 'low' | 'medium' | 'high';
  reasoning: string;
  model: string;
}
