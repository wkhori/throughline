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
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * Phase 6 — verifies the retry scanner re-dispatches FAILED rows whose backoff window has elapsed
 * and skips rows that are too fresh OR whose attempts cap has been hit.
 *
 * <p>{@code created_at} is annotated {@code updatable = false}; we backdate via a native UPDATE so
 * the time-window logic can be exercised deterministically without freezing {@link
 * java.time.Clock}.
 */
@Transactional
class NotificationRetryScannerTest extends PostgresIntegrationTestBase {

  @Autowired NotificationRetryScanner scanner;
  @Autowired NotificationEventRepository repo;
  @Autowired OrgRepository orgRepo;
  @Autowired UserRepository userRepo;
  @Autowired TestDatabaseCleaner cleaner;
  @PersistenceContext EntityManager em;

  String orgId;
  String recipientId;

  @BeforeEach
  void seed() {
    cleaner.clean();
    Org org = orgRepo.save(new Org("RetryOrg"));
    orgId = org.getId();
    User u = userRepo.save(new User(orgId, "auth0|retry-user", "r@x", "Retry", Role.IC));
    recipientId = u.getId();
  }

  @Test
  void retries_failed_event_after_backoff_elapses() {
    NotificationEvent event = makeFailed(1);
    backdateCreatedAt(event.getId(), Instant.now().minusSeconds(60 * 60));

    scanner.scan();

    NotificationEvent reloaded = repo.findById(event.getId()).orElseThrow();
    assertThat(reloaded.getState()).isIn(NotificationState.SENT, NotificationState.PENDING);
  }

  @Test
  void leaves_failed_event_in_FAILED_when_attempts_cap_reached() {
    NotificationEvent event = makeFailed(3);
    backdateCreatedAt(event.getId(), Instant.now().minusSeconds(60 * 60 * 24));

    scanner.scan();

    NotificationEvent reloaded = repo.findById(event.getId()).orElseThrow();
    assertThat(reloaded.getState()).isEqualTo(NotificationState.FAILED);
    assertThat(reloaded.getAttempts()).isEqualTo(3);
  }

  @Test
  void leaves_failed_event_alone_when_within_backoff_window() {
    NotificationEvent event = makeFailed(1);
    backdateCreatedAt(event.getId(), Instant.now().minusSeconds(60));

    scanner.scan();

    NotificationEvent reloaded = repo.findById(event.getId()).orElseThrow();
    assertThat(reloaded.getState()).isEqualTo(NotificationState.FAILED);
  }

  private NotificationEvent makeFailed(int attempts) {
    NotificationEvent event =
        new NotificationEvent(
            orgId,
            NotificationKind.RECONCILE_REMINDER,
            NotificationChannelKind.LOG,
            recipientId,
            "{\"slackMessage\":\"retry me\"}");
    event.setState(NotificationState.FAILED);
    event.setAttempts(attempts);
    event.setLastError("synthetic-failure");
    return repo.saveAndFlush(event);
  }

  /** Force {@code created_at} via a native UPDATE — the column is {@code updatable=false}. */
  private void backdateCreatedAt(String id, Instant when) {
    em.createNativeQuery("update notification_event set created_at = :ts where id = :id")
        .setParameter("ts", java.sql.Timestamp.from(when))
        .setParameter("id", id)
        .executeUpdate();
    em.flush();
    em.clear();
  }
}
