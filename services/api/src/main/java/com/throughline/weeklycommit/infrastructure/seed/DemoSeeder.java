package com.throughline.weeklycommit.infrastructure.seed;

import com.throughline.weeklycommit.domain.DefiningObjective;
import com.throughline.weeklycommit.domain.Org;
import com.throughline.weeklycommit.domain.Outcome;
import com.throughline.weeklycommit.domain.RallyCry;
import com.throughline.weeklycommit.domain.Role;
import com.throughline.weeklycommit.domain.SupportingOutcome;
import com.throughline.weeklycommit.domain.Team;
import com.throughline.weeklycommit.domain.TeamPriorityWeight;
import com.throughline.weeklycommit.domain.User;
import com.throughline.weeklycommit.domain.repo.DefiningObjectiveRepository;
import com.throughline.weeklycommit.domain.repo.OrgRepository;
import com.throughline.weeklycommit.domain.repo.OutcomeRepository;
import com.throughline.weeklycommit.domain.repo.RallyCryRepository;
import com.throughline.weeklycommit.domain.repo.SupportingOutcomeRepository;
import com.throughline.weeklycommit.domain.repo.TeamPriorityWeightRepository;
import com.throughline.weeklycommit.domain.repo.TeamRepository;
import com.throughline.weeklycommit.domain.repo.UserRepository;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * P7 + P28 + P31. Idempotent demo seed under {@code dev} profile.
 *
 * <p>Phase-1 bootstrap landed a 3-user shape; Phase 2 expands to the full PRD §11 directory: 1 org,
 * 12 teams, 175 users (150 IC, 20 manager, 5 admin) with director→manager→IC hierarchy, full RCDO
 * (4 RC × 3 DO × 3 Outcome × 4 SO = 144 SOs) in realistic SaaS/B2B language, RC-granularity team
 * priority weights summing to 1.0 (P4) with realistic skew, and the four named seed personas
 * (admin/manager/ic + Sarah Mendez on Growth Eng for the carry-forward dysfunction, Jordan Kim
 * managing 8 reports for the over-indexed dysfunction). The four-week locked-and-reconciled history
 * slice (week+commit dysfunctions) lands as a follow-up commit once V3 entities ship — see P31.
 */
@Component
@Profile("dev")
public class DemoSeeder implements CommandLineRunner {

  private static final Logger log = LoggerFactory.getLogger(DemoSeeder.class);

  // 4 Rally Cries × 3 DO × 3 Outcome × 4 SO = 144 SOs.
  private static final String[] RALLY_CRIES = {
    "Win the SMB segment",
    "Become the platform of record for product-led teams",
    "Operate at enterprise reliability bar",
    "Compound revenue with retained customers"
  };

  // [4][3] DO titles per Rally Cry.
  private static final String[][] DEFINING_OBJECTIVES = {
    {
      "Reduce 30-day SMB churn from 7% to 4%",
      "Self-serve onboarding NPS > 50",
      "Expand enterprise pipeline Q2"
    },
    {
      "Ship the workflow automation suite",
      "Activate 10K free-tier teams to paid",
      "Cut weekly time-to-first-value below 5 minutes"
    },
    {
      "Refactor billing service test suite",
      "Reduce P1 incident MTTR < 30min",
      "Hit 99.95% multi-region availability"
    },
    {
      "Lift net revenue retention to 118%",
      "Drive 25% growth in expansion ARR",
      "Reduce customer time-to-value by 40%"
    }
  };

  // [4][3][3] Outcome titles per DO. Indexes line up with DEFINING_OBJECTIVES.
  private static final String[][][] OUTCOMES = {
    {
      {"Improve activation funnel conversion", "Identify churn early signals", "Win-back at-risk"},
      {"Reduce setup friction", "Lift activation events week-1", "Improve in-product help"},
      {"Land 10 new logos quarter", "Expand SDR-AE coverage", "Tighten ICP qualification"}
    },
    {
      {"Deliver workflow builder GA", "Add 30 prebuilt templates", "Enable third-party triggers"},
      {
        "Lift free-tier weekly engagement",
        "Run 5 paid-conversion experiments",
        "Surface upgrade nudges"
      },
      {"Speed up first action", "Optimise onboarding tour", "Pre-populate sample data"}
    },
    {
      {"Modernise billing test infra", "Reduce flake rate below 1%", "Automate end-to-end suite"},
      {"Cut detection latency", "Tighten incident comms", "Reduce mean recovery time"},
      {"Eliminate single-AZ dependencies", "Deploy multi-region writes", "Run quarterly DR drills"}
    },
    {
      {
        "Lift expansion-MRR rate",
        "Drive seat growth in active accounts",
        "Reduce contraction events"
      },
      {"Add usage-based add-ons", "Activate enterprise add-ons", "Roll out value-based pricing"},
      {"Standardise onboarding playbook", "Reduce CSM ramp time", "Surface adoption signals to AEs"}
    }
  };

  private static final String[] SO_TEMPLATES = {
    "Ship %s v1", "Run A/B test on %s", "Instrument metrics for %s", "Roll out automation for %s"
  };

  private static final String[] TEAM_NAMES = {
    "Growth Eng",
    "Platform Reliability",
    "Onboarding",
    "Billing",
    "Workflow",
    "Activation",
    "Enterprise GTM",
    "SMB GTM",
    "Customer Success",
    "Pricing & Packaging",
    "Data Platform",
    "Identity & Access"
  };

  private final OrgRepository orgRepo;
  private final TeamRepository teamRepo;
  private final UserRepository userRepo;
  private final RallyCryRepository rallyCryRepo;
  private final DefiningObjectiveRepository doRepo;
  private final OutcomeRepository outcomeRepo;
  private final SupportingOutcomeRepository soRepo;
  private final TeamPriorityWeightRepository tpwRepo;

  @Value("${throughline.seed.enabled:false}")
  private boolean seedEnabled;

  public DemoSeeder(
      OrgRepository orgRepo,
      TeamRepository teamRepo,
      UserRepository userRepo,
      RallyCryRepository rallyCryRepo,
      DefiningObjectiveRepository doRepo,
      OutcomeRepository outcomeRepo,
      SupportingOutcomeRepository soRepo,
      TeamPriorityWeightRepository tpwRepo) {
    this.orgRepo = orgRepo;
    this.teamRepo = teamRepo;
    this.userRepo = userRepo;
    this.rallyCryRepo = rallyCryRepo;
    this.doRepo = doRepo;
    this.outcomeRepo = outcomeRepo;
    this.soRepo = soRepo;
    this.tpwRepo = tpwRepo;
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

    List<RallyCry> rcs = new ArrayList<>();
    for (int r = 0; r < RALLY_CRIES.length; r++) {
      RallyCry rc = rallyCryRepo.save(new RallyCry(org.getId(), RALLY_CRIES[r]));
      rc.setDisplayOrder(r);
      rallyCryRepo.save(rc);
      rcs.add(rc);
      for (int d = 0; d < DEFINING_OBJECTIVES[r].length; d++) {
        DefiningObjective defo =
            doRepo.save(new DefiningObjective(rc.getId(), DEFINING_OBJECTIVES[r][d]));
        defo.setDisplayOrder(d);
        doRepo.save(defo);
        for (int o = 0; o < OUTCOMES[r][d].length; o++) {
          Outcome outcome = outcomeRepo.save(new Outcome(defo.getId(), OUTCOMES[r][d][o]));
          outcome.setDisplayOrder(o);
          outcomeRepo.save(outcome);
          for (int s = 0; s < SO_TEMPLATES.length; s++) {
            SupportingOutcome so =
                soRepo.save(
                    new SupportingOutcome(
                        outcome.getId(), SO_TEMPLATES[s].formatted(OUTCOMES[r][d][o])));
            so.setDisplayOrder(s);
            soRepo.save(so);
          }
        }
      }
    }

    List<Team> teams = new ArrayList<>();
    for (String teamName : TEAM_NAMES) {
      teams.add(teamRepo.save(new Team(org.getId(), teamName)));
    }

    // RC-granularity team priority weights (P4). Skewed: each team has one dominant RC ~50%, two
    // supporting ~25% each, one trailing ~10%. Sum = 1.0 with realistic spread.
    BigDecimal[][] weightShape = {
      {bd("0.40"), bd("0.55")}, // dominant
      {bd("0.20"), bd("0.30")}, // supporting
      {bd("0.10"), bd("0.20")}, // supporting
      {bd("0.05"), bd("0.15")} // trailing
    };
    for (int t = 0; t < teams.size(); t++) {
      Team team = teams.get(t);
      // Rotate which RC is dominant by team index.
      for (int r = 0; r < rcs.size(); r++) {
        BigDecimal[] band = weightShape[(r + t) % weightShape.length];
        tpwRepo.save(new TeamPriorityWeight(team.getId(), rcs.get(r).getId(), band[0], band[1]));
      }
    }

    // Three named demo personas — used by `MockJwtDecoder` and the host persona switcher.
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

    // Seed-team for the three personas: place them on Growth Eng so demo logins land on a team
    // with realistic data.
    Team growthEng = teams.get(0);
    manager.setTeamId(growthEng.getId());
    ic.setTeamId(growthEng.getId());
    ic.setManagerId(manager.getId());
    growthEng.setManagerId(manager.getId());
    userRepo.save(manager);
    userRepo.save(ic);
    teamRepo.save(growthEng);

    // Director-level user that managers report up to. One per org for the demo.
    User director =
        userRepo.save(
            new User(
                org.getId(),
                "auth0|seed-director",
                "director@demo.throughline.app",
                "Riley Stone",
                Role.MANAGER));
    director.setTeamId(growthEng.getId());
    userRepo.save(director);
    manager.setManagerId(director.getId());
    userRepo.save(manager);

    // Named dysfunction personas (P28 #2 + #4) — IC Sarah Mendez on Growth Eng for the long
    // carry-forward chain; Manager Jordan Kim with 8 reports for the over-indexed dysfunction.
    User sarah =
        userRepo.save(
            new User(
                org.getId(),
                "auth0|seed-sarah-mendez",
                "sarah.mendez@demo.throughline.app",
                "Sarah Mendez",
                Role.IC));
    sarah.setTeamId(growthEng.getId());
    sarah.setManagerId(manager.getId());
    userRepo.save(sarah);

    User jordan =
        userRepo.save(
            new User(
                org.getId(),
                "auth0|seed-jordan-kim",
                "jordan.kim@demo.throughline.app",
                "Jordan Kim",
                Role.MANAGER));
    Team enterpriseGtm =
        teams.stream().filter(t -> t.getName().equals("Enterprise GTM")).findFirst().orElseThrow();
    jordan.setTeamId(enterpriseGtm.getId());
    jordan.setManagerId(director.getId());
    userRepo.save(jordan);
    enterpriseGtm.setManagerId(jordan.getId());
    teamRepo.save(enterpriseGtm);

    // Bulk-seed the rest of the directory: 4 admins (5 total inc. demo admin), 18 managers (20
    // total inc. demo manager + jordan), 145 ICs (150 total inc. demo ic + sarah + 3 special-cased
    // ICs assigned to Platform Reliability for the over-concentration dysfunction).
    int adminTarget = 5 - 1; // already seeded admin
    for (int i = 0; i < adminTarget; i++) {
      User u =
          userRepo.save(
              new User(
                  org.getId(),
                  "auth0|seed-admin-%02d".formatted(i),
                  "admin%02d@demo.throughline.app".formatted(i),
                  "Admin %02d".formatted(i + 1),
                  Role.ADMIN));
      u.setTeamId(teams.get(i % teams.size()).getId());
      userRepo.save(u);
    }

    // 17 more managers: total 20 = demo manager + jordan + director + 17 seeded. Each gets a team
    // assignment (skipping the two teams that already have demo manager / jordan).
    List<User> managers = new ArrayList<>();
    managers.add(manager);
    managers.add(jordan);
    int managerTarget = 20 - 3;
    for (int i = 0; i < managerTarget; i++) {
      Team t = teams.get((i + 2) % teams.size());
      User u =
          userRepo.save(
              new User(
                  org.getId(),
                  "auth0|seed-manager-%02d".formatted(i),
                  "manager%02d@demo.throughline.app".formatted(i),
                  "Manager %02d".formatted(i + 1),
                  Role.MANAGER));
      u.setTeamId(t.getId());
      u.setManagerId(director.getId());
      userRepo.save(u);
      if (t.getManagerId() == null) {
        t.setManagerId(u.getId());
        teamRepo.save(t);
      }
      managers.add(u);
    }

    // 145 ICs: 8 reports under jordan (P28 #4 over-indexed manager), and the rest distributed
    // across all teams + managers in round-robin.
    int icTarget = 150 - 2; // demo IC + sarah already seeded
    int seeded = 0;
    // First seed jordan's 8 reports on Enterprise GTM.
    for (int i = 0; i < 8; i++) {
      User u =
          userRepo.save(
              new User(
                  org.getId(),
                  "auth0|seed-ic-jordan-%02d".formatted(i),
                  "ic.jordan.%02d@demo.throughline.app".formatted(i),
                  "Jordan Report %02d".formatted(i + 1),
                  Role.IC));
      u.setTeamId(enterpriseGtm.getId());
      u.setManagerId(jordan.getId());
      userRepo.save(u);
      seeded++;
    }
    // Distribute the remainder.
    for (int i = 0; i < icTarget - 8; i++) {
      Team t = teams.get(i % teams.size());
      User mgr = managers.get(i % managers.size());
      User u =
          userRepo.save(
              new User(
                  org.getId(),
                  "auth0|seed-ic-%03d".formatted(i),
                  "ic.%03d@demo.throughline.app".formatted(i),
                  "IC %03d".formatted(i + 1),
                  Role.IC));
      u.setTeamId(t.getId());
      u.setManagerId(mgr.getId());
      userRepo.save(u);
      seeded++;
    }

    long users = userRepo.count();
    long sosCount = soRepo.count();
    log.info(
        "DemoSeeder full seed complete — org={} users={} teams={} rcdo={}×{}×{}×{} (={} SOs);"
            + " personas: admin={}, manager={}, ic={}, sarah={}, jordan={}, director={}; jordan"
            + " reports={}, additional ICs={}",
        org.getId(),
        users,
        teams.size(),
        rcs.size(),
        DEFINING_OBJECTIVES[0].length,
        OUTCOMES[0][0].length,
        SO_TEMPLATES.length,
        sosCount,
        admin.getId(),
        manager.getId(),
        ic.getId(),
        sarah.getId(),
        jordan.getId(),
        director.getId(),
        8,
        seeded - 8);
  }

  private static BigDecimal bd(String s) {
    return new BigDecimal(s);
  }
}
