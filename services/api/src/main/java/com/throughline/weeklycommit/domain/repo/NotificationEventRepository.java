package com.throughline.weeklycommit.domain.repo;

import com.throughline.weeklycommit.domain.NotificationEvent;
import com.throughline.weeklycommit.domain.NotificationKind;
import com.throughline.weeklycommit.domain.NotificationState;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NotificationEventRepository extends JpaRepository<NotificationEvent, String> {

  List<NotificationEvent> findByStateOrderByCreatedAtAsc(NotificationState state);

  /**
   * Idempotency probe for the digest scheduler — pairs with the partial unique index P20/P38 in V4.
   * Matches a SENT/PENDING digest for the same recipient + payload weekStart.
   */
  @Query(
      value =
          "select * from notification_event where recipient_id = :recipientId and kind ="
              + " :kind\\:\\:varchar(40) and payload_json->>'weekStart' = :weekStart and state in"
              + " ('SENT','PENDING') limit 1",
      nativeQuery = true)
  NotificationEvent findActiveDigestFor(
      @Param("recipientId") String recipientId,
      @Param("kind") String kind,
      @Param("weekStart") String weekStart);

  default NotificationEvent findActiveDigestFor(
      String recipientId, NotificationKind kind, String weekStart) {
    return findActiveDigestFor(recipientId, kind.name(), weekStart);
  }

  /** Latest SENT digest for a recipient (drives `viewed_at` stamping on first dashboard GET). */
  @Query(
      "select e from NotificationEvent e where e.recipientId = :recipientId and e.kind ="
          + " com.throughline.weeklycommit.domain.NotificationKind.WEEKLY_DIGEST and e.state ="
          + " com.throughline.weeklycommit.domain.NotificationState.SENT order by e.sentAt desc"
          + " limit 1")
  Optional<NotificationEvent> findLatestSentDigest(@Param("recipientId") String recipientId);

  /** All SENT digests for an org with their viewedAt — drives the metric. */
  @Query(
      "select e from NotificationEvent e where e.orgId = :orgId and e.kind ="
          + " com.throughline.weeklycommit.domain.NotificationKind.WEEKLY_DIGEST and e.state ="
          + " com.throughline.weeklycommit.domain.NotificationState.SENT")
  List<NotificationEvent> findSentDigestsForOrg(@Param("orgId") String orgId);
}
