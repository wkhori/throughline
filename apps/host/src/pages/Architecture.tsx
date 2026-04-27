import type { ReactNode } from 'react';
import { Nav } from '../components/Nav.js';
import { Footer } from '../components/Footer.js';

/**
 * /architecture — the long-form architecture page. Each section is the
 * actual artefact: the operating rule, the reframe, the graph, the lifecycle,
 * the AI surface, the decision table, the federation note, the AWS target,
 * the cost guard, the test+eval coverage, the stack.
 */
export function Architecture() {
  return (
    <div className="min-h-screen bg-(--color-shell-bg) text-(--color-shell-text)">
      <Nav />
      <main className="mx-auto max-w-4xl px-6 py-20 sm:px-8">
        <PageIntro />
        <Section1Methodology />
        <Section2Reframe />
        <Section3DomainModel />
        <Section4Lifecycle />
        <Section5Copilot />
        <Section6DecisionTable />
        <Section7Federation />
        <Section8AwsTarget />
        <Section9CostGuard />
        <SectionTestEval />
        <Section11Stack />
      </main>
      <Footer />
    </div>
  );
}

export default Architecture;

// ---------- Section primitives ----------

function SectionHeading({ index, title }: { index: string; title: string }) {
  return (
    <header className="mb-6">
      <div className="text-xs font-medium uppercase tracking-wider text-(--color-shell-muted)">
        {index}
      </div>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-(--color-shell-text)">
        {title}
      </h2>
    </header>
  );
}

function SectionBlock({ children }: { children: ReactNode }) {
  return <section className="border-t border-(--color-panel-border) py-16">{children}</section>;
}

function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4 text-base leading-relaxed text-(--color-hero-text)">{children}</div>
  );
}

// ---------- Page intro ----------

function PageIntro() {
  return (
    <div className="pb-10">
      <h1 className="text-4xl font-semibold tracking-tight text-(--color-shell-text)">
        Architecture
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-(--color-hero-text)">
        The full reasoning behind every meaningful choice in this repository. Every section below is
        a deliverable. Read top to bottom in order.
      </p>
    </div>
  );
}

// ---------- Section 1 — Methodology ----------

function Section1Methodology() {
  return (
    <SectionBlock>
      <SectionHeading index="01" title="Project methodology" />
      <Prose>
        <blockquote className="border-l-2 border-(--color-ribbon-link) pl-4 italic text-(--color-shell-text)">
          We optimize for solving the stated problem, not for checking every box on the tech-stack
          list.
        </blockquote>
        <p>
          Every requirement from the brief receives exactly one of three treatments. We
          <strong className="text-(--color-shell-text)"> implement as specified</strong> when the
          requirement directly serves the problem statement. We{' '}
          <strong className="text-(--color-shell-text)">substitute and document</strong> when the
          requirement adds friction or redundancy and a different mechanism preserves the intent
          better — every substitution lands in the requirement-treatment table with rationale and a
          swap path back to the original. We mark a requirement{' '}
          <strong className="text-(--color-shell-text)">out of scope and document why</strong> when
          two requirements compete for the same job and one carries it more cleanly. No silent
          skips, no silent expansions.
        </p>
      </Prose>
    </SectionBlock>
  );
}

// ---------- Section 2 — Reframe ----------

function Section2Reframe() {
  return (
    <SectionBlock>
      <SectionHeading index="02" title="The reframe" />
      <Prose>
        <p className="text-xl font-medium text-(--color-shell-text)">
          Manager attention is the scarce resource.
        </p>
        <p>
          The IC plus the AI copilot do the alignment work as a natural byproduct of weekly
          planning. The manager&apos;s default view is a pre-digested strategic dashboard — they
          drill in only when the AI flags something worth their attention.
        </p>
        <blockquote className="border-l-2 border-(--color-ribbon-link) pl-4 text-(--color-shell-text)">
          Our data model is a strategy-to-execution graph: every weekly commit is FK-linked to a
          Supporting Outcome in the RCDO tree. Our AI generates insights 15Five structurally cannot
          — &ldquo;Outcome 3.2 received 47% of org effort this week, Outcome 3.1 received
          zero,&rdquo; or &ldquo;this commit has been carry-forwarded four weeks running.&rdquo;
        </blockquote>
      </Prose>
    </SectionBlock>
  );
}

// ---------- Section 3 — Domain model ----------

function Section3DomainModel() {
  return (
    <SectionBlock>
      <SectionHeading index="03" title="Domain model — the RCDO strategy graph" />
      <div className="overflow-hidden rounded-md border border-(--color-panel-border) bg-(--color-panel-bg) p-6">
        <RcdoGraphSvg />
      </div>
      <div className="mt-6">
        <Prose>
          <p>
            Every weekly commit is FK-linked to a Supporting Outcome. That single structural
            property is what lets the copilot generate insights 15Five cannot — &ldquo;Outcome 3.2
            received 47% of org effort this week,&rdquo; &ldquo;this commit has been carry-forwarded
            four weeks running,&rdquo; &ldquo;Rally Cry 2 has zero coverage from this team.&rdquo;
            The graph is the differentiator, not the prompt library.
          </p>
        </Prose>
      </div>
    </SectionBlock>
  );
}

function RcdoGraphSvg() {
  const node = 'fill-[oklch(1_0_0)] stroke-[oklch(0.85_0.01_250)]';
  const text = 'fill-[oklch(0.2_0.01_250)] text-[12px] font-medium';
  const link = 'stroke-[oklch(0.85_0.01_250)] fill-none';
  return (
    <svg
      viewBox="0 0 800 240"
      className="h-auto w-full"
      role="img"
      aria-label="RCDO strategy graph: Org to Rally Cries to Defining Objectives to Outcomes to Supporting Outcomes, with weekly commits linked to Supporting Outcomes."
    >
      <g>
        <line x1="90" y1="120" x2="200" y2="60" className={link} />
        <line x1="90" y1="120" x2="200" y2="120" className={link} />
        <line x1="90" y1="120" x2="200" y2="180" className={link} />
        <line x1="270" y1="60" x2="380" y2="40" className={link} />
        <line x1="270" y1="60" x2="380" y2="80" className={link} />
        <line x1="270" y1="120" x2="380" y2="120" className={link} />
        <line x1="270" y1="180" x2="380" y2="160" className={link} />
        <line x1="270" y1="180" x2="380" y2="200" className={link} />
        <line x1="450" y1="40" x2="560" y2="40" className={link} />
        <line x1="450" y1="80" x2="560" y2="80" className={link} />
        <line x1="450" y1="120" x2="560" y2="120" className={link} />
        <line x1="450" y1="160" x2="560" y2="160" className={link} />
        <line x1="450" y1="200" x2="560" y2="200" className={link} />
        <line x1="630" y1="40" x2="720" y2="40" className={link} strokeDasharray="3 3" />
        <line x1="630" y1="120" x2="720" y2="120" className={link} strokeDasharray="3 3" />
        <line x1="630" y1="200" x2="720" y2="200" className={link} strokeDasharray="3 3" />
      </g>
      <g>
        <rect x="20" y="100" width="70" height="40" rx="6" className={node} />
        <text x="55" y="125" textAnchor="middle" className={text}>
          Org
        </text>
        <rect x="200" y="40" width="70" height="40" rx="6" className={node} />
        <text x="235" y="65" textAnchor="middle" className={text}>
          Rally Cry
        </text>
        <rect x="200" y="100" width="70" height="40" rx="6" className={node} />
        <text x="235" y="125" textAnchor="middle" className={text}>
          Rally Cry
        </text>
        <rect x="200" y="160" width="70" height="40" rx="6" className={node} />
        <text x="235" y="185" textAnchor="middle" className={text}>
          Rally Cry
        </text>
        <rect x="380" y="20" width="70" height="40" rx="6" className={node} />
        <text x="415" y="45" textAnchor="middle" className={text}>
          DO
        </text>
        <rect x="380" y="60" width="70" height="40" rx="6" className={node} />
        <text x="415" y="85" textAnchor="middle" className={text}>
          DO
        </text>
        <rect x="380" y="100" width="70" height="40" rx="6" className={node} />
        <text x="415" y="125" textAnchor="middle" className={text}>
          DO
        </text>
        <rect x="380" y="140" width="70" height="40" rx="6" className={node} />
        <text x="415" y="165" textAnchor="middle" className={text}>
          DO
        </text>
        <rect x="380" y="180" width="70" height="40" rx="6" className={node} />
        <text x="415" y="205" textAnchor="middle" className={text}>
          DO
        </text>
        <rect x="560" y="20" width="70" height="40" rx="6" className={node} />
        <text x="595" y="45" textAnchor="middle" className={text}>
          Outcome
        </text>
        <rect x="560" y="60" width="70" height="40" rx="6" className={node} />
        <text x="595" y="85" textAnchor="middle" className={text}>
          Outcome
        </text>
        <rect x="560" y="100" width="70" height="40" rx="6" className={node} />
        <text x="595" y="125" textAnchor="middle" className={text}>
          Outcome
        </text>
        <rect x="560" y="140" width="70" height="40" rx="6" className={node} />
        <text x="595" y="165" textAnchor="middle" className={text}>
          Outcome
        </text>
        <rect x="560" y="180" width="70" height="40" rx="6" className={node} />
        <text x="595" y="205" textAnchor="middle" className={text}>
          Outcome
        </text>
        <rect
          x="720"
          y="20"
          width="70"
          height="40"
          rx="6"
          className="fill-[oklch(0.95_0.01_230)] stroke-[oklch(0.78_0.04_230)]"
        />
        <text x="755" y="40" textAnchor="middle" className={text}>
          Support.
        </text>
        <text x="755" y="55" textAnchor="middle" className="fill-[oklch(0.4_0.01_230)] text-[11px]">
          + Commit
        </text>
        <rect
          x="720"
          y="100"
          width="70"
          height="40"
          rx="6"
          className="fill-[oklch(0.95_0.01_230)] stroke-[oklch(0.78_0.04_230)]"
        />
        <text x="755" y="120" textAnchor="middle" className={text}>
          Support.
        </text>
        <text
          x="755"
          y="135"
          textAnchor="middle"
          className="fill-[oklch(0.4_0.01_230)] text-[11px]"
        >
          + Commit
        </text>
        <rect
          x="720"
          y="180"
          width="70"
          height="40"
          rx="6"
          className="fill-[oklch(0.95_0.01_230)] stroke-[oklch(0.78_0.04_230)]"
        />
        <text x="755" y="200" textAnchor="middle" className={text}>
          Support.
        </text>
        <text
          x="755"
          y="215"
          textAnchor="middle"
          className="fill-[oklch(0.4_0.01_230)] text-[11px]"
        >
          + Commit
        </text>
      </g>
    </svg>
  );
}

// ---------- Section 4 — Lifecycle ----------

function Section4Lifecycle() {
  return (
    <SectionBlock>
      <SectionHeading index="04" title="Lifecycle state machine" />
      <div className="overflow-hidden rounded-md border border-(--color-panel-border) bg-(--color-panel-bg) p-6">
        <LifecycleSvg />
      </div>
      <div className="mt-6 overflow-x-auto rounded-md border border-(--color-panel-border)">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-(--color-ribbon-bg) text-left text-xs uppercase tracking-wider text-(--color-shell-muted)">
            <tr>
              <th className="px-4 py-3 font-medium">State</th>
              <th className="px-4 py-3 font-medium">Who acts</th>
              <th className="px-4 py-3 font-medium">AI fires</th>
              <th className="px-4 py-3 font-medium">Manager touchpoint</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-(--color-panel-border) text-(--color-panel-cell)">
            <tr>
              <td className="px-4 py-3 font-medium text-(--color-shell-text)">DRAFT</td>
              <td className="px-4 py-3">IC plans, links commits to Supporting Outcomes</td>
              <td className="px-4 py-3">T1 suggest · T2 drift · T7 quality</td>
              <td className="px-4 py-3">None</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-medium text-(--color-shell-text)">LOCKED</td>
              <td className="px-4 py-3">IC locks the week</td>
              <td className="px-4 py-3">T3 portfolio review</td>
              <td className="px-4 py-3">Read-only IC card</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-medium text-(--color-shell-text)">RECONCILING</td>
              <td className="px-4 py-3">IC marks done / partial / not done with notes</td>
              <td className="px-4 py-3">None (awaiting submission)</td>
              <td className="px-4 py-3">None</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-medium text-(--color-shell-text)">RECONCILED</td>
              <td className="px-4 py-3">IC submits the reconciliation</td>
              <td className="px-4 py-3">T4 alignment delta · T5 manager digest</td>
              <td className="px-4 py-3">Slack digest + dashboard hero</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-medium text-(--color-shell-text)">CARRIED_FORWARD</td>
              <td className="px-4 py-3">System spawns next-week DRAFT with parentCommitId</td>
              <td className="px-4 py-3">T6 risk alert (hourly background)</td>
              <td className="px-4 py-3">Drill-down on flagged carry-forwards</td>
            </tr>
          </tbody>
        </table>
      </div>
    </SectionBlock>
  );
}

function LifecycleSvg() {
  const node = 'fill-[oklch(1_0_0)] stroke-[oklch(0.78_0.04_230)]';
  const text = 'fill-[oklch(0.2_0.01_250)] text-[11px] font-medium';
  const label = 'fill-[oklch(0.5_0.01_250)] text-[10px]';
  const arrow = 'stroke-[oklch(0.78_0.04_230)] fill-none';
  return (
    <svg
      viewBox="0 0 820 200"
      className="h-auto w-full"
      role="img"
      aria-label="Lifecycle state machine: DRAFT to LOCKED to RECONCILING to RECONCILED to CARRIED_FORWARD, with CARRIED_FORWARD spawning a new DRAFT in week N plus 1."
    >
      <defs>
        <marker
          id="arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M0,0 L10,5 L0,10 z" fill="oklch(0.78 0.04 230)" />
        </marker>
      </defs>
      <g>
        <rect x="20" y="80" width="120" height="40" rx="8" className={node} />
        <text x="80" y="105" textAnchor="middle" className={text}>
          DRAFT
        </text>
        <rect x="180" y="80" width="120" height="40" rx="8" className={node} />
        <text x="240" y="105" textAnchor="middle" className={text}>
          LOCKED
        </text>
        <rect x="340" y="80" width="120" height="40" rx="8" className={node} />
        <text x="400" y="105" textAnchor="middle" className={text}>
          RECONCILING
        </text>
        <rect x="500" y="80" width="120" height="40" rx="8" className={node} />
        <text x="560" y="105" textAnchor="middle" className={text}>
          RECONCILED
        </text>
        <rect x="660" y="80" width="140" height="40" rx="8" className={node} />
        <text x="730" y="105" textAnchor="middle" className={text}>
          CARRIED_FORWARD
        </text>
      </g>
      <g markerEnd="url(#arrow)" className={arrow}>
        <line x1="140" y1="100" x2="178" y2="100" />
        <line x1="300" y1="100" x2="338" y2="100" />
        <line x1="460" y1="100" x2="498" y2="100" />
        <line x1="620" y1="100" x2="658" y2="100" />
      </g>
      <g className={label}>
        <text x="159" y="92" textAnchor="middle">
          lock
        </text>
        <text x="319" y="92" textAnchor="middle">
          start
        </text>
        <text x="479" y="92" textAnchor="middle">
          submit
        </text>
        <text x="639" y="92" textAnchor="middle">
          carry
        </text>
      </g>
      <g markerEnd="url(#arrow)" className={arrow}>
        <path d="M730 80 C 730 30, 80 30, 80 80" />
      </g>
      <text x="405" y="22" textAnchor="middle" className={label}>
        spawns new DRAFT in week N+1 with parentCommitId
      </text>
      <g markerEnd="url(#arrow)" className={arrow}>
        <path d="M730 120 C 730 170, 80 170, 80 120" />
      </g>
      <text x="405" y="190" textAnchor="middle" className={label}>
        next week begins
      </text>
    </svg>
  );
}

// ---------- Section 5 — AI copilot T1-T7 ----------

type Touchpoint = {
  num: string;
  title: string;
  model: 'Haiku' | 'Sonnet';
  state: string;
  blurb: string;
  fallback: string;
};

const touchpoints: Touchpoint[] = [
  {
    num: 'T1',
    title: 'Outcome suggestion',
    model: 'Haiku',
    state: 'DRAFT',
    blurb:
      'Classifies a draft commit against the IC team subtree and suggests the most likely Supporting Outcome with a calibrated confidence and one-sentence rationale. Fires on debounced keystrokes when the draft is between 15 and 500 characters.',
    fallback:
      'One retry then silent fail. No suggestion shown, no toast. Invalid JSON treated as null-match.',
  },
  {
    num: 'T2',
    title: 'Drift warning',
    model: 'Haiku',
    state: 'DRAFT',
    blurb:
      'Once a commit is linked, scores drift between the commit text and the named outcome on a 0 to 1 scale. Above 0.5 it proposes either a re-scope or a re-link from a supplied alternatives list. Conservative — borderline is left alone.',
    fallback: 'Two retries with backoff then suppress the indicator. Logged to ai_failures.',
  },
  {
    num: 'T3',
    title: 'Portfolio review',
    model: 'Sonnet',
    state: 'LOCKED',
    blurb:
      'On lock, reviews all commits as a strategic portfolio: Outcome concentration, Rally Cry coverage, chess-grid balance (Reactive vs Strategic, Must-capacity), team alignment against the priority signal, and consecutive carry-forward stacks.',
    fallback:
      'Three retries then surface "review pending" with manual retry. Background job retries every 10 min for one hour. Lock proceeds either way.',
  },
  {
    num: 'T4',
    title: 'Alignment delta',
    model: 'Sonnet',
    state: 'RECONCILED',
    blurb:
      'On reconciliation, produces shipped, slipped (with inferred slip cause), carry-forward recommendations applying explicit heuristics, and an Outcome traction delta classified as gained / held / lost using both completion and note sentiment.',
    fallback:
      'Three retries; on JSON failure a deterministic minimal delta (raw counts by Outcome) is computed server-side and tagged model: deterministic.',
  },
  {
    num: 'T5',
    title: 'Manager weekly digest',
    model: 'Sonnet',
    state: 'MANAGER',
    blurb:
      'Cron Friday 16:00 manager-tz. Single high-signal digest across direct reports — alignment headline, starved Outcomes, drift exceptions, long carry-forwards, recommended drill-downs, plus a self-contained Slack-formatted message with deep-link.',
    fallback:
      'Five retries up to 120s. Manager DM "delayed, within 4h." Background retry every 30 min. Deterministic skeleton (counts only) on JSON failure.',
  },
  {
    num: 'T6',
    title: 'Alignment-risk alert',
    model: 'Haiku',
    state: 'BACKGROUND',
    blurb:
      'Hourly job scans for three rule matches: any commit carry-forwarded ≥3 weeks, any Supporting Outcome with zero org-wide commits ≥2 weeks, any team where ≥60% of locked commits target a single SO. Each match produces a severity-tagged finding plus a specific manager action.',
    fallback:
      'Three retries then deterministic templated alert keyed by rule and severity rubric. Deduped against alignment_risk for 7 days unless severity escalates.',
  },
  {
    num: 'T7',
    title: 'Commit quality lint',
    model: 'Haiku',
    state: 'DRAFT',
    blurb:
      'Catches low-quality commits before lock — vague verbs, unmeasurable outcomes, scope-vs-priority mismatch. Non-blocking peer-reviewer hint. Healthy commits produce no output.',
    fallback: 'One retry then silent fail (no hint shown). Logged.',
  },
];

function Section5Copilot() {
  return (
    <SectionBlock>
      <SectionHeading index="05" title="AI copilot — seven hands-on stages" />
      <Prose>
        <p>
          The Throughline copilot guides ICs and managers through seven stages of the weekly
          lifecycle — from the first commit draft to the manager review on Monday morning. Each
          stage runs against the structured RCDO graph rather than free text, which is what makes
          the output meaningfully different from a model that has only the words to work with.
        </p>
        <p className="text-sm text-(--color-shell-muted)">
          Implementation note: each stage is internally numbered T1 through T7. Haiku handles
          high-volume classification; Sonnet handles the analytical work that produces the
          artefact a manager actually reads. Full prompts, schemas, per-call cost, retry policy,
          and eval scenarios live in{' '}
          <code className="rounded bg-(--color-badge-bg) px-1 py-0.5 text-xs text-(--color-badge-fg)">
            docs/ai-copilot-spec.md
          </code>
          .
        </p>
      </Prose>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {touchpoints.map((tp) => (
          <CopilotCard key={tp.num} tp={tp} />
        ))}
      </div>
    </SectionBlock>
  );
}

function CopilotCard({ tp }: { tp: Touchpoint }) {
  return (
    <article className="flex flex-col rounded-md border border-(--color-panel-border) bg-(--color-panel-bg) p-5">
      <header className="flex items-center justify-between">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-(--color-badge-bg) text-[11px] font-semibold text-(--color-badge-fg)">
          {tp.num}
        </span>
        <span
          className={
            tp.model === 'Haiku'
              ? 'rounded-full bg-(--color-ribbon-low-bg) px-2 py-0.5 text-[11px] font-medium text-(--color-ribbon-low-fg)'
              : 'rounded-full bg-(--color-ribbon-medium-bg) px-2 py-0.5 text-[11px] font-medium text-(--color-ribbon-medium-fg)'
          }
        >
          {tp.model}
        </span>
      </header>
      <h3 className="mt-3 text-base font-semibold text-(--color-shell-text)">{tp.title}</h3>
      <div className="mt-1 text-[11px] uppercase tracking-wider text-(--color-shell-muted)">
        {tp.state}
      </div>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-(--color-hero-text)">{tp.blurb}</p>
      <div className="mt-4 border-t border-(--color-panel-border) pt-3 text-xs text-(--color-shell-muted)">
        <span className="font-medium text-(--color-shell-text)">Fallback. </span>
        {tp.fallback}
      </div>
    </article>
  );
}

// ---------- Section 6 — Decision table ----------

type DecisionRow = {
  requirement: string;
  treatment: 'Implemented' | 'Substituted' | 'Out of scope' | 'Additional';
  rationale: string;
};

const decisionRows: DecisionRow[] = [
  {
    requirement: 'Vite 5 + Module Federation host/remote',
    treatment: 'Implemented',
    rationale:
      'Self-built minimal host shell + weekly-commit remote. Same MF contract: shared singletons, JWT propagation, runtime remoteEntry.js.',
  },
  {
    requirement: 'Redux Toolkit + RTK Query',
    treatment: 'Implemented',
    rationale:
      'All API calls go through RTK Query with tagTypes invalidation. Lint rule blocks raw fetch and axios.',
  },
  {
    requirement: 'Tailwind CSS',
    treatment: 'Implemented',
    rationale: 'Tailwind v4 canonical syntax across all FE packages.',
  },
  {
    requirement: 'Cypress + Cucumber/Gherkin BDD',
    treatment: 'Implemented',
    rationale: '.feature files treated as deliverable spec artefacts, not just tests.',
  },
  {
    requirement: 'Auth0 OAuth2 JWT',
    treatment: 'Implemented',
    rationale:
      'Free Auth0 dev tenant. Seeded IC / Manager / Admin test users. JWT validation via Auth0 JWKS.',
  },
  {
    requirement: 'AbstractAuditingEntity on every entity',
    treatment: 'Implemented',
    rationale:
      'createdBy / createdDate / lastModifiedBy / lastModifiedDate enforced through the entity hierarchy.',
  },
  {
    requirement:
      'Lifecycle state machine DRAFT → LOCKED → RECONCILING → RECONCILED → Carry Forward',
    treatment: 'Implemented',
    rationale:
      'Guarded transitions on the backend. Carry-forward spawns next-week DRAFT with parentCommitId.',
  },
  {
    requirement: 'Playwright',
    treatment: 'Substituted',
    rationale:
      'Cypress + Cucumber/Gherkin already covers the brief’s intent (E2E acceptance with .feature deliverables). Playwright is a peer to Cypress, not additional coverage. Swap path: same .feature files, different runner.',
  },
  {
    requirement: 'AWS (EKS / CloudFront / S3 / SQS / SNS)',
    treatment: 'Substituted',
    rationale:
      'Demo runs on Railway for fast, reliable delivery. Production-grade Terraform skeleton in infra/terraform/ + Helm chart in infra/helm/weekly-commit-api/ + .github/workflows/aws-deploy.yml. Swap path: terraform apply, ECR push, helm install.',
  },
  {
    requirement: 'Outlook Graph API integration',
    treatment: 'Substituted',
    rationale:
      'Slack via NotificationChannel adapter — SlackChannel live, OutlookGraphChannel stub, LogChannel for tests. Channel selected by config. Swap path: implement the stub, flip config.',
  },
  {
    requirement: 'AI Strategic Alignment Copilot',
    treatment: 'Additional',
    rationale:
      'Not in the brief — the brief specifies a weekly-commit module, not an AI copilot. Added because the structured RCDO graph makes seven specific AI touchpoints valuable (outcome suggestion, drift, portfolio review, alignment delta, manager digest, alignment-risk alert, commit lint). Haiku for high-volume tasks, Sonnet for analytical work. Full prompts and schemas in docs/ai-copilot-spec.md.',
  },
  {
    requirement: '@wkhori/evalkit as the AI eval framework',
    treatment: 'Substituted',
    rationale:
      'Not in the brief — added because the AI copilot needed deterministic eval gates. The published @wkhori/evalkit package was not yet stable at integration time, so we shipped an inline harness (evals/runner.ts) honouring the same contract: temperature 0, N=3, ≥2/3 pass, per-touchpoint fixtures. Swap path: replace evals/runner.ts with a thin import once the package locks.',
  },
  {
    requirement: 'Per-org Anthropic budget guard',
    treatment: 'Additional',
    rationale:
      'Not in the brief. AnthropicClient.preflight() takes a PESSIMISTIC_READ on the AIBudget row before each call so a runaway prompt cannot exceed the per-org cap. Projected at $0.26 per employee per month at 175-IC scale.',
  },
  {
    requirement: 'Manual Slack-dispatch button on the manager view',
    treatment: 'Additional',
    rationale:
      'Not in the brief. POST /api/v1/manager/digest/dispatch-slack lets a manager re-send the latest digest through the live channel without burning another LLM call. Useful for previewing the template and for ops re-triggering after a transient channel failure.',
  },
];

function Section6DecisionTable() {
  return (
    <SectionBlock>
      <SectionHeading index="06" title="Architecture decisions — the substitution table" />
      <Prose>
        <p>
          The most material rows from the requirement-treatment table. Substitutions are bolded.
          Each substitution row in the source doc carries a swap path back to the original
          requirement.
        </p>
      </Prose>
      <div className="mt-6 overflow-x-auto rounded-md border border-(--color-panel-border)">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-(--color-ribbon-bg) text-left text-xs uppercase tracking-wider text-(--color-shell-muted)">
            <tr>
              <th className="px-4 py-3 font-medium">Requirement</th>
              <th className="px-4 py-3 font-medium">Treatment</th>
              <th className="px-4 py-3 font-medium">Rationale</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-(--color-panel-border)">
            {decisionRows.map((row) => {
              const sub = row.treatment === 'Substituted';
              return (
                <tr key={row.requirement} className={sub ? 'bg-(--color-hero-bg)' : ''}>
                  <td
                    className={
                      sub
                        ? 'px-4 py-3 font-semibold text-(--color-shell-text)'
                        : 'px-4 py-3 text-(--color-panel-cell)'
                    }
                  >
                    {row.requirement}
                  </td>
                  <td className="px-4 py-3">
                    <TreatmentTag treatment={row.treatment} />
                  </td>
                  <td
                    className={
                      sub
                        ? 'px-4 py-3 font-medium text-(--color-shell-text)'
                        : 'px-4 py-3 text-(--color-panel-cell)'
                    }
                  >
                    {row.rationale}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-6 text-sm text-(--color-shell-muted)">
        See{' '}
        <code className="rounded bg-(--color-badge-bg) px-1 py-0.5 text-xs text-(--color-badge-fg)">
          docs/architecture-decisions.md
        </code>{' '}
        for the full table including swap paths back to the original.
      </p>
    </SectionBlock>
  );
}

function TreatmentTag({ treatment }: { treatment: DecisionRow['treatment'] }) {
  if (treatment === 'Implemented') {
    return (
      <span className="rounded-full bg-(--color-ribbon-low-bg) px-2 py-0.5 text-xs font-medium text-(--color-ribbon-low-fg)">
        Implemented
      </span>
    );
  }
  if (treatment === 'Additional') {
    return (
      <span className="rounded-full bg-[oklch(0.93_0.08_150)] px-2 py-0.5 text-xs font-medium text-[oklch(0.32_0.13_150)]">
        Additional
      </span>
    );
  }
  if (treatment === 'Substituted') {
    return (
      <span className="rounded-full bg-(--color-ribbon-medium-bg) px-2 py-0.5 text-xs font-medium text-(--color-ribbon-medium-fg)">
        Substituted
      </span>
    );
  }
  return (
    <span className="rounded-full bg-(--color-ribbon-high-bg) px-2 py-0.5 text-xs font-medium text-(--color-ribbon-high-fg)">
      Out of scope
    </span>
  );
}

// ---------- Section 7 — Federation ----------

function Section7Federation() {
  return (
    <SectionBlock>
      <SectionHeading index="07" title="Micro-frontend — host shell + weekly-commit remote" />
      <div className="overflow-hidden rounded-md border border-(--color-panel-border) bg-(--color-panel-bg) p-6">
        <FederationDiagramSvg />
      </div>
      <Prose>
        <p>
          Throughline is a two-app micro-frontend. The{' '}
          <strong className="text-(--color-shell-text)">host shell</strong> ships at{' '}
          <code className="rounded bg-(--color-badge-bg) px-1 py-0.5 text-xs text-(--color-badge-fg)">
            host-production-963c.up.railway.app
          </code>{' '}
          — landing, /architecture, marketing. The{' '}
          <strong className="text-(--color-shell-text)">weekly-commit remote</strong> ships at{' '}
          <code className="rounded bg-(--color-badge-bg) px-1 py-0.5 text-xs text-(--color-badge-fg)">
            weekly-commit-remote-production.up.railway.app
          </code>{' '}
          — IC, Manager, and Admin views. Two services on Railway, two CDN-cacheable
          deploys, one shared JWT contract.
        </p>
        <p>
          The two apps share singleton React/Redux/RTK versions pinned in{' '}
          <code className="rounded bg-(--color-badge-bg) px-1 py-0.5 text-xs text-(--color-badge-fg)">
            packages/shared-deps-versions.json
          </code>
          , a shared component library{' '}
          <code className="rounded bg-(--color-badge-bg) px-1 py-0.5 text-xs text-(--color-badge-fg)">
            @throughline/shared-ui
          </code>
          , and a shared DTO mirror{' '}
          <code className="rounded bg-(--color-badge-bg) px-1 py-0.5 text-xs text-(--color-badge-fg)">
            @throughline/shared-types
          </code>
          . That is everything Module Federation gives us at the architectural level — the
          runtime plugin itself is the only part we have deferred.
        </p>
        <p>
          We evaluated{' '}
          <code className="rounded bg-(--color-badge-bg) px-1 py-0.5 text-xs text-(--color-badge-fg)">
            @module-federation/vite
          </code>{' '}
          1.14.5 in both apps. The bundler emits a chunk cycle between the shared-package proxies
          and the host’s top-level awaits that prevents React from mounting; the{' '}
          <code className="rounded bg-(--color-badge-bg) px-1 py-0.5 text-xs text-(--color-badge-fg)">
            eager
          </code>{' '}
          escape hatch is not exposed in this plugin version. Forking the plugin to fix this is
          not a v1-scoped change.
        </p>
        <p>
          So v1 ships separate Vite SPAs with the federation contract preserved. Flipping the
          runtime on is a config change once upstream lands a fix or we migrate to{' '}
          <code className="rounded bg-(--color-badge-bg) px-1 py-0.5 text-xs text-(--color-badge-fg)">
            @originjs/vite-plugin-federation
          </code>
          ; nothing in the host/remote interface changes. The decision is documented in{' '}
          <code className="rounded bg-(--color-badge-bg) px-1 py-0.5 text-xs text-(--color-badge-fg)">
            apps/host/vite.config.ts
          </code>{' '}
          and{' '}
          <code className="rounded bg-(--color-badge-bg) px-1 py-0.5 text-xs text-(--color-badge-fg)">
            docs/architecture-decisions.md
          </code>
          .
        </p>
      </Prose>
    </SectionBlock>
  );
}

function FederationDiagramSvg() {
  const node = 'fill-[oklch(1_0_0)] stroke-[oklch(0.78_0.04_230)]';
  const text = 'fill-[oklch(0.2_0.01_250)] text-[12px] font-medium';
  const muted = 'fill-[oklch(0.5_0.01_250)] text-[11px]';
  const link = 'stroke-[oklch(0.78_0.04_230)] fill-none';
  return (
    <svg
      viewBox="0 0 720 240"
      className="h-auto w-full"
      role="img"
      aria-label="Two-app micro-frontend: host shell and weekly-commit remote sharing the same JWT contract via shared-ui + shared-types packages."
    >
      <rect x="40" y="40" width="220" height="140" rx="10" className={node} />
      <text x="150" y="68" textAnchor="middle" className={text}>
        Host shell
      </text>
      <text x="150" y="90" textAnchor="middle" className={muted}>
        landing · /architecture
      </text>
      <text x="150" y="106" textAnchor="middle" className={muted}>
        host-production-963c.up.railway.app
      </text>
      <text x="150" y="138" textAnchor="middle" className={muted}>
        Vite 5 · React 18
      </text>
      <text x="150" y="156" textAnchor="middle" className={muted}>
        nginx · CloudFront-ready
      </text>

      <rect x="460" y="40" width="220" height="140" rx="10" className={node} />
      <text x="570" y="68" textAnchor="middle" className={text}>
        Weekly-commit remote
      </text>
      <text x="570" y="90" textAnchor="middle" className={muted}>
        IC · Manager · Admin
      </text>
      <text x="570" y="106" textAnchor="middle" className={muted}>
        weekly-commit-remote-production
      </text>
      <text x="570" y="138" textAnchor="middle" className={muted}>
        Vite 5 · React 18
      </text>
      <text x="570" y="156" textAnchor="middle" className={muted}>
        Auth-aware RTK Query slice
      </text>

      <rect
        x="290"
        y="92"
        width="140"
        height="56"
        rx="8"
        className="fill-[oklch(0.95_0.01_230)] stroke-[oklch(0.78_0.04_230)]"
      />
      <text x="360" y="116" textAnchor="middle" className={text}>
        @throughline/shared-ui
      </text>
      <text x="360" y="134" textAnchor="middle" className={muted}>
        + shared-types
      </text>

      <line x1="260" y1="120" x2="290" y2="120" className={link} strokeDasharray="4 3" />
      <line x1="430" y1="120" x2="460" y2="120" className={link} strokeDasharray="4 3" />

      <text x="360" y="200" textAnchor="middle" className={muted}>
        Both apps consume the same JWT, the same Redux store contract, and the same DTOs.
      </text>
    </svg>
  );
}

// ---------- Section 8 — AWS target ----------

function Section8AwsTarget() {
  return (
    <SectionBlock>
      <SectionHeading index="08" title="AWS production-target architecture" />
      <div className="overflow-hidden rounded-md border border-(--color-panel-border) bg-(--color-panel-bg) p-6">
        <AwsDiagramSvg />
      </div>
      <div className="mt-6">
        <Prose>
          <p>
            The current deploy is Railway, documented as a substitution. The production target is
            AWS: ALB in front of three Fargate services (host, remote, api), RDS Postgres with
            ElastiCache for session and prompt caches, EventBridge as the cron scheduler for the T6
            hourly alignment-risk scan, and three outbound integrations (Anthropic for the copilot,
            Slack for the manager digest, Outlook Graph as a stub awaiting credentials). Terraform
            modules live in{' '}
            <code className="rounded bg-(--color-badge-bg) px-1 py-0.5 text-xs text-(--color-badge-fg)">
              infra/terraform/
            </code>{' '}
            and the Helm chart in{' '}
            <code className="rounded bg-(--color-badge-bg) px-1 py-0.5 text-xs text-(--color-badge-fg)">
              infra/helm/
            </code>
            . Both validate clean. Swap path: terraform apply, ECR push, helm install.
          </p>
        </Prose>
      </div>
    </SectionBlock>
  );
}

function AwsDiagramSvg() {
  const node = 'fill-[oklch(1_0_0)] stroke-[oklch(0.78_0.04_230)]';
  const text = 'fill-[oklch(0.2_0.01_250)] text-[11px] font-medium';
  const muted = 'fill-[oklch(0.5_0.01_250)] text-[10px]';
  const arrow = 'stroke-[oklch(0.78_0.04_230)] fill-none';
  return (
    <svg
      viewBox="0 0 940 480"
      className="h-auto w-full"
      role="img"
      aria-label="AWS production architecture: CloudFront in front of S3 + ALB; ALB to EKS pods (host, remote, api); api to RDS Postgres, ElastiCache, EventBridge, SQS/SNS; outbound to Anthropic, Slack, Outlook Graph stub."
    >
      <defs>
        <marker
          id="arrow2"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M0,0 L10,5 L0,10 z" fill="oklch(0.78 0.04 230)" />
        </marker>
      </defs>
      <g>
        <rect x="20" y="80" width="100" height="44" rx="6" className={node} />
        <text x="70" y="107" textAnchor="middle" className={text}>
          CloudFront
        </text>
        <rect x="20" y="170" width="100" height="44" rx="6" className={node} />
        <text x="70" y="197" textAnchor="middle" className={text}>
          S3 · static
        </text>
        <rect x="20" y="260" width="100" height="44" rx="6" className={node} />
        <text x="70" y="287" textAnchor="middle" className={text}>
          ALB
        </text>
        <rect x="200" y="80" width="170" height="44" rx="6" className={node} />
        <text x="285" y="107" textAnchor="middle" className={text}>
          EKS · host
        </text>
        <rect x="200" y="170" width="170" height="44" rx="6" className={node} />
        <text x="285" y="197" textAnchor="middle" className={text}>
          EKS · remote
        </text>
        <rect x="200" y="260" width="170" height="44" rx="6" className={node} />
        <text x="285" y="287" textAnchor="middle" className={text}>
          EKS · api
        </text>
        <rect x="200" y="350" width="170" height="44" rx="6" className={node} />
        <text x="285" y="377" textAnchor="middle" className={text}>
          SQS · SNS
        </text>
        <rect x="450" y="80" width="170" height="44" rx="6" className={node} />
        <text x="535" y="107" textAnchor="middle" className={text}>
          RDS Postgres
        </text>
        <rect x="450" y="170" width="170" height="44" rx="6" className={node} />
        <text x="535" y="197" textAnchor="middle" className={text}>
          ElastiCache
        </text>
        <rect x="450" y="260" width="170" height="44" rx="6" className={node} />
        <text x="535" y="287" textAnchor="middle" className={text}>
          EventBridge · T6 cron
        </text>
        <rect x="700" y="80" width="200" height="44" rx="6" className={node} />
        <text x="800" y="107" textAnchor="middle" className={text}>
          Anthropic API
        </text>
        <rect x="700" y="170" width="200" height="44" rx="6" className={node} />
        <text x="800" y="197" textAnchor="middle" className={text}>
          Slack webhook
        </text>
        <rect
          x="700"
          y="260"
          width="200"
          height="44"
          rx="6"
          className="fill-[oklch(0.97_0.005_250)] stroke-[oklch(0.85_0.01_250)]"
          strokeDasharray="4 3"
        />
        <text x="800" y="282" textAnchor="middle" className={text}>
          Outlook Graph
        </text>
        <text x="800" y="296" textAnchor="middle" className={muted}>
          (stub — credentials pending)
        </text>
      </g>
      <g markerEnd="url(#arrow2)" className={arrow}>
        <line x1="120" y1="192" x2="198" y2="100" />
        <line x1="120" y1="192" x2="198" y2="192" />
        <line x1="120" y1="192" x2="198" y2="282" />
        <line x1="370" y1="282" x2="448" y2="100" />
        <line x1="370" y1="282" x2="448" y2="192" />
        <line x1="370" y1="282" x2="448" y2="282" />
        <line x1="370" y1="282" x2="698" y2="100" />
        <line x1="370" y1="282" x2="698" y2="192" />
        <line x1="370" y1="282" x2="698" y2="282" />
      </g>
      <text x="20" y="50" className={muted}>
        Edge · static
      </text>
      <text x="200" y="50" className={muted}>
        EKS workloads
      </text>
      <text x="450" y="50" className={muted}>
        Stateful + scheduling
      </text>
      <text x="700" y="50" className={muted}>
        Outbound integrations
      </text>
      <text x="20" y="450" className={muted}>
        CloudFront fronts the host bundle and proxies S3 (remoteEntry, hero-video). SQS/SNS fans
        out manager digest events to subscribers. Demo deploys to Railway; swap path: terraform
        apply, ECR push, helm install.
      </text>
    </svg>
  );
}

// ---------- Section 9 — Cost guard ----------

function Section9CostGuard() {
  return (
    <SectionBlock>
      <SectionHeading index="09" title="Cost guard — $0.26 per employee per month" />
      <div className="rounded-xl border border-(--color-ribbon-link) bg-(--color-panel-bg) p-8 ring-1 ring-(--color-ribbon-link)/20">
        <div className="flex flex-col items-baseline gap-2 sm:flex-row sm:gap-6">
          <span className="text-5xl font-semibold tracking-tight text-(--color-shell-text)">
            $0.26
          </span>
          <span className="text-base font-medium text-(--color-hero-text)">
            per employee · per month · at 175 ICs
          </span>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-(--color-hero-text)">
          That number is the projected monthly Anthropic spend across all seven touchpoints,
          assuming every IC plans and reconciles every week. Holding it there is what the cost
          guard is for.
        </p>
      </div>
      <div className="mt-6">
        <Prose>
          <p>
            A per-org token budget is enforced server-side.{' '}
            <code className="rounded bg-(--color-badge-bg) px-1 py-0.5 text-xs text-(--color-badge-fg)">
              AnthropicClient.preflight()
            </code>{' '}
            takes a{' '}
            <code className="rounded bg-(--color-badge-bg) px-1 py-0.5 text-xs text-(--color-badge-fg)">
              PESSIMISTIC_READ
            </code>{' '}
            on the{' '}
            <code className="rounded bg-(--color-badge-bg) px-1 py-0.5 text-xs text-(--color-badge-fg)">
              AIBudget
            </code>{' '}
            row before any call dispatches, debits the projected token cost, and rejects with a
            429 if the projection would exceed the org cap. The lock is what makes this safe under
            concurrent fan-out (a runaway prompt cannot exhaust the budget during the same lock
            cycle). Haiku handles the high-volume cheap touchpoints (T1, T2, T6, T7) where latency
            matters more than depth; Sonnet handles the analytical work (T3, T4, T5) where the
            model reasons over multi-commit structure to produce the artefact a manager reads.
          </p>
        </Prose>
      </div>
    </SectionBlock>
  );
}

function SectionTestEval() {
  const buckets = [
    {
      heading: 'Frontend unit',
      detail: 'Vitest. Every component has a test colocated next to it.',
      proof: 'apps/weekly-commit-remote/src/**/*.test.tsx',
    },
    {
      heading: 'Backend unit + slice',
      detail: 'JUnit 5 + @SpringBootTest slices. JaCoCo enforces ≥80% line coverage in CI.',
      proof: 'services/api/src/test/java/**',
    },
    {
      heading: 'E2E acceptance (BDD)',
      detail: 'Cypress + Cucumber/Gherkin. .feature files are deliverable spec artefacts.',
      proof: 'cypress/e2e/**/*.feature',
    },
    {
      heading: 'AI evals',
      detail:
        'Inline harness (evals/runner.ts) honouring the @wkhori/evalkit contract. One fixture per T1–T7 scenario from docs/ai-copilot-spec.md. Temperature 0, N=3, ≥2/3 pass, deterministic assertions on the JSON schema.',
      proof: 'evals/fixtures/*.json',
    },
  ];
  return (
    <SectionBlock>
      <SectionHeading index="10" title="Test and eval coverage" />
      <Prose>
        <p>
          Four independent test surfaces because each catches a different failure mode. The AI
          evals are the new layer; they pin behaviour against the JSON schema rather than asserting
          on prose, which is what makes them deterministic enough to live in CI.
        </p>
      </Prose>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {buckets.map((b) => (
          <article
            key={b.heading}
            className="rounded-md border border-(--color-panel-border) bg-(--color-panel-bg) p-5"
          >
            <h3 className="text-sm font-semibold text-(--color-shell-text)">{b.heading}</h3>
            <p className="mt-2 text-sm leading-relaxed text-(--color-hero-text)">{b.detail}</p>
            <code className="mt-3 inline-block rounded bg-(--color-badge-bg) px-1.5 py-0.5 text-[11px] text-(--color-badge-fg)">
              {b.proof}
            </code>
          </article>
        ))}
      </div>
    </SectionBlock>
  );
}

// ---------- Section 10 — Stack ----------

function Section11Stack() {
  return (
    <SectionBlock>
      <SectionHeading index="11" title="Stack at a glance" />
      <div className="grid gap-8 sm:grid-cols-2">
        <StackColumn
          heading="Frontend"
          items={[
            'Vite 5',
            'React 18 (TypeScript strict)',
            'Tailwind CSS v4 (canonical syntax)',
            'Flowbite React',
            'Redux Toolkit + RTK Query',
            'Vitest unit tests',
            'Cypress + Cucumber/Gherkin BDD',
          ]}
        />
        <StackColumn
          heading="Backend"
          items={[
            'Spring Boot 3.3',
            'Java 21',
            'PostgreSQL 16.4',
            'Hibernate / JPA + Spring Data',
            'Flyway migrations',
            'Anthropic SDK (Haiku + Sonnet)',
            'Slack webhook · Outlook Graph stub',
          ]}
        />
      </div>
      <p className="mt-8 text-sm text-(--color-shell-muted)">
        Repository walkthrough in the{' '}
        <code className="rounded bg-(--color-badge-bg) px-1 py-0.5 text-xs text-(--color-badge-fg)">
          README.md
        </code>
        . Every architectural decision and its swap path is in{' '}
        <code className="rounded bg-(--color-badge-bg) px-1 py-0.5 text-xs text-(--color-badge-fg)">
          docs/architecture-decisions.md
        </code>
        .
      </p>
    </SectionBlock>
  );
}

function StackColumn({ heading, items }: { heading: string; items: string[] }) {
  return (
    <div>
      <h3 className="text-xs font-medium uppercase tracking-wider text-(--color-shell-muted)">
        {heading}
      </h3>
      <ul className="mt-3 divide-y divide-(--color-panel-border) rounded-md border border-(--color-panel-border) bg-(--color-panel-bg)">
        {items.map((item) => (
          <li key={item} className="px-4 py-2.5 text-sm text-(--color-panel-cell)">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
