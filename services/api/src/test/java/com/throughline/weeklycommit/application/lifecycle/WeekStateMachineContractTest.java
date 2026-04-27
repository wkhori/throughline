package com.throughline.weeklycommit.application.lifecycle;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;

/**
 * Phase-2 / Phase-3 lifecycle state-machine contract test.
 *
 * <p>Documents the transition guards from PRD §5.1 as test-name placeholders. Each test ships in a
 * follow-up commit alongside the {@code WeekStateMachine} implementation. The {@code @Disabled}
 * marker ensures these don't show as failures while the impl is in flight; once the impl lands the
 * agent removes {@code @Disabled} as each transition is wired.
 */
@Disabled("Phase 2/3 impl pending — see WeekStateMachine commit on phase/2-lifecycle")
class WeekStateMachineContractTest {

  @Test
  void DRAFT_to_LOCKED_requires_at_least_one_commit() {}

  @Test
  void DRAFT_to_LOCKED_requires_every_commit_has_supportingOutcome() {}

  @Test
  void DRAFT_to_LOCKED_emits_WeekLockedEvent_AFTER_COMMIT() {}

  @Test
  void LOCKED_rejects_addCommit_with_IllegalStateException() {}

  @Test
  void LOCKED_rejects_editCommit_with_IllegalStateException() {}

  @Test
  void LOCKED_rejects_deleteCommit_with_IllegalStateException() {}

  @Test
  void LOCKED_idempotent_replay_returns_existing_lockedAt_no_new_event() {}

  @Test
  void LOCKED_to_RECONCILING_requires_week_end_at_or_past_now_in_org_tz() {}

  @Test
  void RECONCILING_to_RECONCILED_requires_every_commit_has_outcome() {}

  @Test
  void RECONCILING_to_RECONCILED_caps_reconciliationNote_at_1000_chars() {}

  @Test
  void RECONCILED_emits_WeekReconciledEvent_AFTER_COMMIT() {}

  @Test
  void RECONCILED_rejects_any_edit_with_IllegalStateException() {}

  @Test
  void carryForward_marks_original_CARRIED_FORWARD_terminal() {}

  @Test
  void carryForward_spawns_new_commit_in_week_Nplus1_with_parentCommitId() {}

  @Test
  void carryForward_increments_carry_forward_weeks_counter() {}

  @Test
  void carryForward_into_full_next_week_returns_409() {}

  @Test
  void weekN_plus_1_derivation_is_DST_safe_using_atZone_plusDays_truncatedTo_DAY() {}
}
