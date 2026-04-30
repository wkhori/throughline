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
  /** Entity the insight is keyed on (commit id for T1/T2/T7, week id for T3/T4/T5). */
  entityId?: string;
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

// ---------------- T3 Portfolio Review ----------------
export type PortfolioReviewSeverity = 'info' | 'notice' | 'warning';
export interface PortfolioReviewFinding {
  dimension:
    | 'outcome_concentration'
    | 'rally_cry_coverage'
    | 'chess_grid'
    | 'team_alignment'
    | 'carry_forward'
    | string;
  severity: PortfolioReviewSeverity;
  message: string;
  affectedEntityIds?: Ulid[];
}
export interface PortfolioReviewPayload {
  headline: string;
  overallSeverity: PortfolioReviewSeverity;
  findings: PortfolioReviewFinding[];
  chessGridSummary?: Record<string, number>;
  reasoning?: string;
  model?: string;
}

// ---------------- T4 Alignment Delta ----------------
export interface AlignmentDeltaShipped {
  commitId: Ulid;
  parentOutcomeId: Ulid | null;
}
export interface AlignmentDeltaSlipped {
  commitId: Ulid;
  slipCause: string;
  evidence: string;
}
export interface AlignmentDeltaCarryForward {
  commitId: Ulid;
  action: 'carry_forward' | 're-scope' | 'drop';
  rationale: string;
}
export interface AlignmentDeltaPayload {
  summary: string;
  shipped: AlignmentDeltaShipped[];
  slipped: AlignmentDeltaSlipped[];
  carryForwardRecommendations: AlignmentDeltaCarryForward[];
  outcomeTractionDelta?: Array<{
    supportingOutcomeId: Ulid;
    delta: 'gained' | 'held' | 'lost';
  }>;
  reasoning?: string;
  model?: string;
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
