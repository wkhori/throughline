package com.throughline.weeklycommit.infrastructure.seed;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeast;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.throughline.weeklycommit.domain.Commit;
import com.throughline.weeklycommit.domain.Org;
import com.throughline.weeklycommit.domain.Role;
import com.throughline.weeklycommit.domain.SupportingOutcome;
import com.throughline.weeklycommit.domain.User;
import com.throughline.weeklycommit.domain.Week;
import com.throughline.weeklycommit.domain.WeekState;
import com.throughline.weeklycommit.domain.repo.CommitRepository;
import com.throughline.weeklycommit.domain.repo.OrgRepository;
import com.throughline.weeklycommit.domain.repo.SupportingOutcomeRepository;
import com.throughline.weeklycommit.domain.repo.UserRepository;
import com.throughline.weeklycommit.domain.repo.WeekRepository;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

/**
 * Unit tests for {@link DemoLockedWeekBootstrap}. Uses Mockito mocks — no Postgres required.
 *
 * <p>Covers: idempotency guard, LOCKED state assignment, commit count (8 target), and skipping
 * non-demo users.
 */
class DemoLockedWeekBootstrapTest {

  OrgRepository orgRepo = mock(OrgRepository.class);
  UserRepository userRepo = mock(UserRepository.class);
  WeekRepository weekRepo = mock(WeekRepository.class);
  CommitRepository commitRepo = mock(CommitRepository.class);
  SupportingOutcomeRepository soRepo = mock(SupportingOutcomeRepository.class);

  DemoLockedWeekBootstrap bootstrap =
      new DemoLockedWeekBootstrap(orgRepo, userRepo, weekRepo, commitRepo, soRepo);

  Org org;
  User demoIc;
  LocalDate lockedWeekStart;

  @BeforeEach
  void setup() {
    org = new Org("ACME");
    org.setId("org-1");
    org.setTimezone("UTC");
    org.setWeekStartDay("MONDAY");

    demoIc = new User("org-1", "auth0|demo-ic", "ic@demo.throughline.app", "Demo IC", Role.IC);
    demoIc.setId("user-1");

    LocalDate today = LocalDate.now();
    LocalDate currentWeekStart = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    lockedWeekStart = currentWeekStart.minusWeeks(1);

    when(orgRepo.findAll()).thenReturn(List.of(org));
    when(userRepo.findAll()).thenReturn(List.of(demoIc));

    // Build SOs covering every soTitleContains used in SEEDS.
    SupportingOutcome soWorkflow = makeSo("so-1", "Ship Deliver workflow builder GA v1");
    SupportingOutcome soTriggers = makeSo("so-2", "Ship Enable third-party triggers v1");
    SupportingOutcome soTemplates = makeSo("so-3", "Ship Add 30 prebuilt templates v1");
    SupportingOutcome soFlake = makeSo("so-4", "Ship Reduce flake rate below 1% v1");
    SupportingOutcome soAuto = makeSo("so-5", "Ship Automate end-to-end suite v1");

    when(soRepo.findAll())
        .thenReturn(List.of(soWorkflow, soTriggers, soTemplates, soFlake, soAuto));

    Week savedWeek = new Week("user-1", "org-1", lockedWeekStart);
    savedWeek.setId("week-locked");
    savedWeek.setState(WeekState.LOCKED);
    when(weekRepo.save(any(Week.class))).thenReturn(savedWeek);
    when(commitRepo.save(any(Commit.class))).thenAnswer(inv -> inv.getArgument(0));
  }

  @Test
  void skips_when_no_org() throws Exception {
    when(orgRepo.findAll()).thenReturn(List.of());
    bootstrap.run();
    verify(weekRepo, never()).save(any());
  }

  @Test
  void skips_non_demo_user() throws Exception {
    User nonDemo = new User("org-1", "auth0|x", "real@company.com", "Real IC", Role.IC);
    nonDemo.setId("user-2");
    when(userRepo.findAll()).thenReturn(List.of(nonDemo));
    when(weekRepo.findByUserIdAndWeekStart(any(), any())).thenReturn(Optional.empty());

    bootstrap.run();

    verify(weekRepo, never()).save(any());
    verify(commitRepo, never()).save(any());
  }

  @Test
  void idempotent_when_week_already_exists() throws Exception {
    Week existing = new Week("user-1", "org-1", lockedWeekStart);
    existing.setId("existing-week");
    when(weekRepo.findByUserIdAndWeekStart(eq("user-1"), eq(lockedWeekStart)))
        .thenReturn(Optional.of(existing));

    bootstrap.run();

    verify(weekRepo, never()).save(any());
    verify(commitRepo, never()).save(any());
  }

  @Test
  void seeds_locked_week_with_correct_state() throws Exception {
    when(weekRepo.findByUserIdAndWeekStart(any(), any())).thenReturn(Optional.empty());

    bootstrap.run();

    ArgumentCaptor<Week> weekCaptor = ArgumentCaptor.forClass(Week.class);
    verify(weekRepo).save(weekCaptor.capture());
    Week saved = weekCaptor.getValue();
    assertThat(saved.getState()).isEqualTo(WeekState.LOCKED);
    assertThat(saved.getLockedAt()).isNotNull();
    assertThat(saved.getWeekStart()).isEqualTo(lockedWeekStart);
  }

  @Test
  void seeds_eight_commits() throws Exception {
    when(weekRepo.findByUserIdAndWeekStart(any(), any())).thenReturn(Optional.empty());

    bootstrap.run();

    // Eight seeds defined — verify commit saves.
    verify(commitRepo, atLeast(8)).save(any(Commit.class));
  }

  @Test
  void skips_manager_users() throws Exception {
    User mgr = new User("org-1", "auth0|mgr", "manager@demo.throughline.app", "Mgr", Role.MANAGER);
    mgr.setId("mgr-1");
    when(userRepo.findAll()).thenReturn(List.of(mgr));
    when(weekRepo.findByUserIdAndWeekStart(any(), any())).thenReturn(Optional.empty());

    bootstrap.run();

    verify(weekRepo, never()).save(any());
  }

  private static SupportingOutcome makeSo(String id, String title) {
    SupportingOutcome so = new SupportingOutcome("outcome-1", title);
    so.setId(id);
    return so;
  }
}
