package com.throughline.weeklycommit.infrastructure.seed;

import com.throughline.weeklycommit.domain.DefiningObjective;
import com.throughline.weeklycommit.domain.Org;
import com.throughline.weeklycommit.domain.Outcome;
import com.throughline.weeklycommit.domain.RallyCry;
import com.throughline.weeklycommit.domain.Role;
import com.throughline.weeklycommit.domain.SupportingOutcome;
import com.throughline.weeklycommit.domain.Team;
import com.throughline.weeklycommit.domain.User;
import com.throughline.weeklycommit.domain.repo.DefiningObjectiveRepository;
import com.throughline.weeklycommit.domain.repo.OrgRepository;
import com.throughline.weeklycommit.domain.repo.OutcomeRepository;
import com.throughline.weeklycommit.domain.repo.RallyCryRepository;
import com.throughline.weeklycommit.domain.repo.SupportingOutcomeRepository;
import com.throughline.weeklycommit.domain.repo.TeamRepository;
import com.throughline.weeklycommit.domain.repo.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * P7 + P28. Phase-1 bootstrap seed: idempotent CommandLineRunner that creates one org, three demo
 * users (IC / Manager / Admin), one team, and a small RCDO subtree (1 RC × 1 DO × 2 Outcomes × 4
 * SOs). Sufficient for {@code @phase-1} Gherkin and the federation smoke test. Phase 2 expands this
 * into the full 175-user / 12-team / 144-SO seed (split documented in docs/prd-patches.md P28).
 *
 * <p>Activates only on the {@code dev} Spring profile.
 */
@Component
@Profile("dev")
public class DemoSeeder implements CommandLineRunner {

  private static final Logger log = LoggerFactory.getLogger(DemoSeeder.class);

  private final OrgRepository orgRepo;
  private final TeamRepository teamRepo;
  private final UserRepository userRepo;
  private final RallyCryRepository rallyCryRepo;
  private final DefiningObjectiveRepository doRepo;
  private final OutcomeRepository outcomeRepo;
  private final SupportingOutcomeRepository soRepo;

  @Value("${throughline.seed.enabled:false}")
  private boolean seedEnabled;

  public DemoSeeder(
      OrgRepository orgRepo,
      TeamRepository teamRepo,
      UserRepository userRepo,
      RallyCryRepository rallyCryRepo,
      DefiningObjectiveRepository doRepo,
      OutcomeRepository outcomeRepo,
      SupportingOutcomeRepository soRepo) {
    this.orgRepo = orgRepo;
    this.teamRepo = teamRepo;
    this.userRepo = userRepo;
    this.rallyCryRepo = rallyCryRepo;
    this.doRepo = doRepo;
    this.outcomeRepo = outcomeRepo;
    this.soRepo = soRepo;
  }

  @Override
  @Transactional
  public void run(String... args) {
    if (!seedEnabled) {
      log.info("DemoSeeder skipped (throughline.seed.enabled=false)");
      return;
    }
    if (orgRepo.count() > 0) {
      log.info("DemoSeeder skipped (org already seeded)");
      return;
    }

    Org org = orgRepo.save(new Org("Throughline Demo Co"));
    Team growth = teamRepo.save(new Team(org.getId(), "Growth"));

    User admin =
        userRepo.save(
            new User(
                org.getId(),
                "auth0|mock-admin",
                "admin@demo.throughline.app",
                "Demo Admin",
                Role.ADMIN));
    User manager =
        userRepo.save(
            new User(
                org.getId(),
                "auth0|mock-manager",
                "manager@demo.throughline.app",
                "Demo Manager",
                Role.MANAGER));
    User ic =
        userRepo.save(
            new User(org.getId(), "auth0|mock-ic", "ic@demo.throughline.app", "Demo IC", Role.IC));

    manager.setTeamId(growth.getId());
    ic.setTeamId(growth.getId());
    ic.setManagerId(manager.getId());
    growth.setManagerId(manager.getId());
    userRepo.save(manager);
    userRepo.save(ic);
    teamRepo.save(growth);

    RallyCry rc = rallyCryRepo.save(new RallyCry(org.getId(), "Win the SMB segment"));
    DefiningObjective defo =
        doRepo.save(new DefiningObjective(rc.getId(), "Reduce 30-day churn by 15%"));
    Outcome o1 = outcomeRepo.save(new Outcome(defo.getId(), "Improve onboarding NPS to 50+"));
    Outcome o2 = outcomeRepo.save(new Outcome(defo.getId(), "Cut day-7 churn from 7% to 4%"));
    soRepo.save(new SupportingOutcome(o1.getId(), "Ship onboarding email sequence v2"));
    soRepo.save(new SupportingOutcome(o1.getId(), "Add in-app activation checklist"));
    soRepo.save(new SupportingOutcome(o2.getId(), "Build churn-risk dashboard"));
    soRepo.save(new SupportingOutcome(o2.getId(), "Run save offer A/B test"));

    log.info(
        "DemoSeeder bootstrap complete — org={} users=3 team=1 rcdo=1×1×2×4 (admin={}, manager={},"
            + " ic={})",
        org.getId(),
        admin.getId(),
        manager.getId(),
        ic.getId());
  }
}
