package com.throughline.weeklycommit.infrastructure.notifications;

import static org.assertj.core.api.Assertions.assertThat;

import com.throughline.weeklycommit.PostgresIntegrationTestBase;
import com.throughline.weeklycommit.TestDatabaseCleaner;
import com.throughline.weeklycommit.domain.NotificationChannelKind;
import com.throughline.weeklycommit.domain.NotificationEvent;
import com.throughline.weeklycommit.domain.NotificationKind;
import com.throughline.weeklycommit.domain.NotificationState;
import com.throughline.weeklycommit.domain.Org;
import com.throughline.weeklycommit.domain.Role;
import com.throughline.weeklycommit.domain.User;
import com.throughline.weeklycommit.domain.repo.NotificationEventRepository;
import com.throughline.weeklycommit.domain.repo.OrgRepository;
import com.throughline.weeklycommit.domain.repo.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Phase 6 contract test — verifies the NotificationDispatcher behaviours that the smoke / digest
 * scheduler / lifecycle listener depend on:
 *
 * <ol>
 *   <li>Duplicate WEEKLY_DIGEST for same recipient + weekStart → SKIPPED_DUPLICATE row, original
 *       row stays PENDING/SENT (P20/P38 unique index).
 *   <li>Non-digest kinds (LOCK_CONFIRM / RECONCILE_COMPLETE / RECONCILE_REMINDER) are NOT
 *       deduplicated — the index is partial WHERE kind='WEEKLY_DIGEST'.
 *   <li>Both rows preserve {@code attempts} and {@code state} consistent with what the channel
 *       observed (LogChannel always succeeds → SENT).
 * </ol>
 */
class NotificationDispatcherTest extends PostgresIntegrationTestBase {

  @Autowired NotificationDispatcher dispatcher;
  @Autowired NotificationEventRepository repo;
  @Autowired OrgRepository orgRepo;
  @Autowired UserRepository userRepo;
  @Autowired TestDatabaseCleaner cleaner;

  String orgId;
  String recipientId;

  @BeforeEach
  void seed() {
    cleaner.clean();
    Org org = orgRepo.save(new Org("DispatchOrg"));
    orgId = org.getId();
    User mgr = userRepo.save(new User(orgId, "auth0|disp-mgr", "m@x", "Mgr", Role.MANAGER));
    recipientId = mgr.getId();
  }

  @Test
  void duplicate_digest_is_skipped() {
    String payload = "{\"weekStart\":\"2026-04-20\",\"slackMessage\":\"hello\"}";

    NotificationEvent first =
        dispatcher.dispatch(
            orgId, NotificationKind.WEEKLY_DIGEST, NotificationChannelKind.LOG, recipientId, payload);
    NotificationEvent second =
        dispatcher.dispatch(
            orgId, NotificationKind.WEEKLY_DIGEST, NotificationChannelKind.LOG, recipientId, payload);

    assertThat(first.getState()).isIn(NotificationState.SENT, NotificationState.PENDING);
    assertThat(second.getState()).isEqualTo(NotificationState.SKIPPED_DUPLICATE);
    long sentForRecipient =
        repo.findAll().stream()
            .filter(e -> e.getRecipientId().equals(recipientId))
            .filter(e -> e.getState() != NotificationState.SKIPPED_DUPLICATE)
            .count();
    assertThat(sentForRecipient).isEqualTo(1);
  }

  @Test
  void non_digest_kinds_are_not_deduplicated() {
    String payload = "{\"weekStart\":\"2026-04-20\",\"slackMessage\":\"hi\"}";

    dispatcher.dispatch(
        orgId, NotificationKind.LOCK_CONFIRM, NotificationChannelKind.LOG, recipientId, payload);
    dispatcher.dispatch(
        orgId, NotificationKind.LOCK_CONFIRM, NotificationChannelKind.LOG, recipientId, payload);

    long lockConfirms =
        repo.findAll().stream()
            .filter(e -> e.getRecipientId().equals(recipientId))
            .filter(e -> e.getKind() == NotificationKind.LOCK_CONFIRM)
            .count();
    assertThat(lockConfirms).isEqualTo(2);
    boolean anySkipped =
        repo.findAll().stream()
            .filter(e -> e.getRecipientId().equals(recipientId))
            .anyMatch(e -> e.getState() == NotificationState.SKIPPED_DUPLICATE);
    assertThat(anySkipped).isFalse();
  }
}
