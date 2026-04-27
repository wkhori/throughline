package com.throughline.weeklycommit.domain.repo;

import com.throughline.weeklycommit.domain.NotificationEvent;
import com.throughline.weeklycommit.domain.NotificationKind;
import com.throughline.weeklycommit.domain.NotificationState;
import java.util.List;
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
}
