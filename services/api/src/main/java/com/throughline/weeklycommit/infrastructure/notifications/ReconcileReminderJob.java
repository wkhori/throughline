package com.throughline.weeklycommit.infrastructure.notifications;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.throughline.weeklycommit.application.lifecycle.WeekStateMachine;
import com.throughline.weeklycommit.domain.NotificationChannelKind;
import com.throughline.weeklycommit.domain.NotificationKind;
import com.throughline.weeklycommit.domain.Org;
import com.throughline.weeklycommit.domain.Role;
import com.throughline.weeklycommit.domain.User;
import com.throughline.weeklycommit.domain.Week;
import com.throughline.weeklycommit.domain.WeekState;
import com.throughline.weeklycommit.domain.repo.OrgRepository;
import com.throughline.weeklycommit.domain.repo.UserRepository;
import com.throughline.weeklycommit.domain.repo.WeekRepository;
import java.time.LocalDate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Friday 09:00 cron — sends a RECONCILE_REMINDER notification to every IC whose current week is
 * still in DRAFT or LOCKED state (i.e. they have not yet entered RECONCILING/RECONCILED). PRD §8.3
 * trigger inventory + §12 Phase 6.
 *
 * <p>The reminder is a soft prompt — the underlying state machine reconcile-window logic enforces
 * the actual reconcile cutoff. ICs whose week is already RECONCILED receive no reminder.
 */
@Component
public class ReconcileReminderJob {

  private static final Logger LOG = LoggerFactory.getLogger(ReconcileReminderJob.class);
  private static final ObjectMapper MAPPER = new ObjectMapper();

  private final UserRepository userRepo;
  private final WeekRepository weekRepo;
  private final OrgRepository orgRepo;
  private final WeekStateMachine stateMachine;
  private final NotificationDispatcher dispatcher;
  private final NotificationChannelKind channelKind;

  public ReconcileReminderJob(
      UserRepository userRepo,
      WeekRepository weekRepo,
      OrgRepository orgRepo,
      WeekStateMachine stateMachine,
      NotificationDispatcher dispatcher,
      @Value("${app.notifications.channel:log}") String channel) {
    this.userRepo = userRepo;
    this.weekRepo = weekRepo;
    this.orgRepo = orgRepo;
    this.stateMachine = stateMachine;
    this.dispatcher = dispatcher;
    this.channelKind =
        "slack".equalsIgnoreCase(channel)
            ? NotificationChannelKind.SLACK
            : NotificationChannelKind.LOG;
  }

  @Scheduled(cron = "0 0 9 ? * FRI")
  @Transactional
  public void runReminderCron() {
    int sent = 0;
    for (User user : userRepo.findAll()) {
      if (user.getRole() != Role.IC) continue;
      Org org = orgRepo.findById(user.getOrgId()).orElse(null);
      if (org == null) continue;
      LocalDate weekStart = stateMachine.currentWeekStart(org);
      Week week = weekRepo.findByUserIdAndWeekStart(user.getId(), weekStart).orElse(null);
      // Remind if no week row at all (DRAFT not even started) OR week still pre-reconciliation.
      if (week == null
          || week.getState() == WeekState.DRAFT
          || week.getState() == WeekState.LOCKED) {
        try {
          dispatcher.dispatch(
              user.getOrgId(),
              NotificationKind.RECONCILE_REMINDER,
              channelKind,
              user.getId(),
              payload(weekStart, user));
          sent++;
        } catch (Exception ex) {
          LOG.warn(
              "reconcile_reminder_dispatch_failed userId={} err={}", user.getId(), ex.getMessage());
        }
      }
    }
    LOG.info("reconcile_reminder_cron_done sent={}", sent);
  }

  private String payload(LocalDate weekStart, User user) {
    ObjectNode root = MAPPER.createObjectNode();
    root.put("kind", "RECONCILE_REMINDER");
    root.put("userId", user.getId());
    root.put("weekStart", weekStart.toString());
    root.put(
        "slackMessage",
        "*Reconcile your week* — Friday cutoff. Open <DASHBOARD_URL> to mark commits done /"
            + " partial / not done.");
    try {
      return MAPPER.writeValueAsString(root);
    } catch (JsonProcessingException e) {
      throw new IllegalStateException(e);
    }
  }
}
