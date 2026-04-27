import { Link } from 'react-router-dom';
import { Nav } from '../components/Nav.js';
import { Footer } from '../components/Footer.js';

const REMOTE_APP_URL = 'https://weekly-commit-remote-production.up.railway.app/';

type CopilotTouch = {
  id: string;
  title: string;
  description: string;
  stage: 'DRAFT' | 'LOCKED' | 'RECONCILED' | 'MANAGER';
};

const COPILOT: readonly CopilotTouch[] = [
  {
    id: 'T1',
    title: 'Outcome suggestion',
    description: 'Recommends the Supporting Outcome each commit should attach to.',
    stage: 'DRAFT',
  },
  {
    id: 'T2',
    title: 'Drift warning',
    description: 'Flags commits whose phrasing drifts from the linked Outcome.',
    stage: 'DRAFT',
  },
  {
    id: 'T3',
    title: 'Portfolio review',
    description: 'On lock, surfaces over- and under-invested Outcomes for the week.',
    stage: 'LOCKED',
  },
  {
    id: 'T4',
    title: 'Alignment delta',
    description: 'Compares plan to outcome at reconcile and explains the gap.',
    stage: 'RECONCILED',
  },
  {
    id: 'T5',
    title: 'Weekly digest',
    description: 'Pre-digested manager view delivered through Slack and Outlook.',
    stage: 'MANAGER',
  },
  {
    id: 'T6',
    title: 'Alignment-risk alert',
    description: 'Hourly background scan that pings only when attention is warranted.',
    stage: 'MANAGER',
  },
  {
    id: 'T7',
    title: 'Commit quality lint',
    description: 'Inline checks for clarity, scope, and measurability as ICs draft.',
    stage: 'DRAFT',
  },
];

const STAGES: ReadonlyArray<{ id: string; caption: string }> = [
  { id: 'DRAFT', caption: 'IC drafts commits, links each to a Supporting Outcome.' },
  { id: 'LOCKED', caption: 'Week is sealed. Portfolio review runs.' },
  { id: 'RECONCILING', caption: 'IC marks done, partial, or not done with notes.' },
  { id: 'RECONCILED', caption: 'Alignment delta computed. Manager digest fires.' },
  { id: 'CARRIED_FORWARD', caption: 'Slipped commits spawn next week with parent reference.' },
];

export function Landing() {
  return (
    <div className="flex min-h-full flex-col bg-(--color-shell-bg) text-(--color-shell-text)">
      <Nav />
      <main>
        <Hero />
        <Problem />
        <Differentiator />
        <CopilotGrid />
        <LifecycleRibbon />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-(--color-hero-bg)">
      <div className="mx-auto max-w-300 px-6 pt-20 pb-16 lg:px-10 lg:pt-32 lg:pb-24">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-7">
            <p className="mb-6 text-xs font-medium tracking-widest text-(--color-hero-muted) uppercase">
              Weekly commit, reframed
            </p>
            <h1 className="text-4xl leading-tight font-semibold tracking-tight text-(--color-hero-heading) sm:text-5xl lg:text-6xl">
              Strategic alignment,
              <br />
              by design.
              <br />
              <span className="text-(--color-hero-text)">Not by manager-on-the-hook.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-(--color-hero-text)">
              ICs and an AI copilot do the alignment work as a natural byproduct of weekly planning.
              Managers get a pre-digested strategic dashboard and drill in only when something is
              genuinely worth their attention.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <a
                href={REMOTE_APP_URL}
                className="inline-flex items-center rounded-md bg-(--color-shell-text) px-5 py-3 text-sm font-medium text-(--color-shell-bg) shadow-sm transition-opacity hover:opacity-90"
              >
                Launch demo
              </a>
              <Link
                to="/architecture"
                className="inline-flex items-center rounded-md border border-(--color-hero-border) bg-(--color-panel-bg) px-5 py-3 text-sm font-medium text-(--color-shell-text) transition-colors hover:border-(--color-ribbon-link)"
              >
                See architecture
              </Link>
            </div>
          </div>
        </div>
        <div className="mt-16 lg:mt-20">
          <div className="overflow-hidden rounded-xl border border-(--color-hero-border) bg-(--color-panel-bg) shadow-2xl shadow-(--color-hero-border)/40">
            <video
              autoPlay
              muted
              loop
              playsInline
              poster="/hero-poster.png"
              className="aspect-video w-full object-cover"
            >
              <source src="/hero-video.mp4" type="video/mp4" />
            </video>
          </div>
        </div>
      </div>
    </section>
  );
}

function Problem() {
  return (
    <section className="border-y border-(--color-hero-border) bg-(--color-panel-bg)">
      <div className="mx-auto max-w-300 px-6 py-20 lg:px-10 lg:py-28">
        <p className="mb-12 text-xs font-medium tracking-widest text-(--color-hero-muted) uppercase">
          The reframe
        </p>
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-7">
            <h2 className="text-3xl leading-tight font-semibold tracking-tight text-(--color-hero-heading) sm:text-4xl">
              Manager attention is the scarce resource.
            </h2>
            <div className="mt-6 space-y-5 text-lg leading-relaxed text-(--color-hero-text)">
              <p>
                In the legacy weekly-commit ritual, ICs fill in unstructured forms and the manager
                tries to infer alignment by reading every entry. The data model is unstructured. The
                cognitive load is concentrated. The loop is broken at the manager.
              </p>
              <p>
                Throughline moves the alignment work to the place it belongs &mdash; into the
                planning surface itself. ICs link each commit to a Supporting Outcome on a
                strategy-to-execution graph. The AI copilot grades, suggests, and flags as they
                type. Managers stop reading. They review.
              </p>
            </div>
          </div>
          <div className="lg:col-span-5">
            <figure className="rounded-xl border border-(--color-hero-border) bg-(--color-hero-bg) p-8 lg:p-10">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-(--color-ribbon-link)"
                aria-hidden="true"
              >
                <path d="M7 7h4v4H7zM13 7h4v4h-4z" strokeLinejoin="round" />
              </svg>
              <blockquote className="mt-6 text-2xl leading-snug font-medium text-(--color-hero-heading)">
                &ldquo;Manager-on-the-hook&rdquo; is the broken loop. The fix is structural, not
                another form field.
              </blockquote>
              <figcaption className="mt-6 text-sm text-(--color-hero-muted)">
                The core operating premise of the product.
              </figcaption>
            </figure>
          </div>
        </div>
      </div>
    </section>
  );
}

function Differentiator() {
  return (
    <section className="bg-(--color-shell-bg)">
      <div className="mx-auto max-w-300 px-6 py-20 lg:px-10 lg:py-28">
        <div className="mb-12 max-w-3xl">
          <p className="mb-4 text-xs font-medium tracking-widest text-(--color-hero-muted) uppercase">
            The structural difference
          </p>
          <h2 className="text-3xl leading-tight font-semibold tracking-tight text-(--color-hero-heading) sm:text-4xl">
            Same prompt &ldquo;AI-powered.&rdquo; Different data model.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-(--color-hero-text)">
            Throughline&rsquo;s differentiator is not the model behind the assistant. It is what the
            assistant can see.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
          <article className="flex flex-col rounded-xl border border-(--color-hero-border) bg-(--color-panel-bg) p-8">
            <header className="flex items-baseline justify-between">
              <h3 className="text-lg font-semibold text-(--color-hero-heading)">
                What 15Five sees
              </h3>
              <span className="rounded-full bg-(--color-badge-bg) px-2.5 py-1 text-xs font-medium text-(--color-badge-fg)">
                Unstructured text
              </span>
            </header>
            <pre className="mt-6 overflow-hidden rounded-md border border-(--color-hero-border) bg-(--color-hero-bg) p-5 text-sm leading-relaxed whitespace-pre-wrap text-(--color-hero-text)">
              {`Priorities this week:
- Refactor billing service test suite
- Pair with K. on the SMB onboarding bug
- Continue the Q3 metrics dashboard

What an LLM can produce from this:
"The team focused on testing,
 onboarding, and dashboards."`}
            </pre>
            <p className="mt-6 text-sm leading-relaxed text-(--color-hero-muted)">
              A summary of the words. No way to answer &ldquo;which Outcome received zero effort
              this week?&rdquo; — the data model doesn&rsquo;t carry that signal.
            </p>
          </article>
          <article className="flex flex-col rounded-xl border border-(--color-ribbon-link) bg-(--color-panel-bg) p-8 ring-1 ring-(--color-ribbon-link)/30">
            <header className="flex items-baseline justify-between">
              <h3 className="text-lg font-semibold text-(--color-hero-heading)">
                What Throughline sees
              </h3>
              <span className="rounded-full bg-(--color-ribbon-low-bg) px-2.5 py-1 text-xs font-medium text-(--color-ribbon-low-fg)">
                Structured RCDO graph
              </span>
            </header>
            <div className="mt-6 rounded-md border border-(--color-hero-border) bg-(--color-hero-bg) p-5">
              <RcdoTree />
            </div>
            <pre className="mt-6 overflow-hidden rounded-md border border-(--color-hero-border) bg-(--color-shell-bg) p-5 text-sm leading-relaxed whitespace-pre-wrap text-(--color-hero-text)">
              {`Headline: SMB work severely under-indexed
(17% vs 40–55% target); retention outcomes
over-indexed at 38% vs 5–15% target.

Starved outcomes (2 weeks, zero commits):
• Expand SDR-AE coverage
• Tighten ICP qualification

Long carry-forward: commit 01KQ6Q7R…
carried 3 weeks — needs resolution.`}
            </pre>
            <p className="mt-6 text-sm leading-relaxed text-(--color-hero-muted)">
              Every commit is FK-linked to a Supporting Outcome. That single structural property is
              what turns a model summary into a manager-actionable digest. (Output above is from the
              live demo this week.)
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}

function RcdoTree() {
  return (
    <svg
      viewBox="0 0 360 200"
      className="h-auto w-full text-(--color-ribbon-link)"
      role="img"
      aria-label="Strategy to execution graph"
    >
      <g stroke="currentColor" strokeWidth="1" fill="none" opacity="0.45">
        <path d="M180 28 L80 70" />
        <path d="M180 28 L280 70" />
        <path d="M80 84 L40 124" />
        <path d="M80 84 L120 124" />
        <path d="M280 84 L240 124" />
        <path d="M280 84 L320 124" />
        <path d="M40 138 L20 178" />
        <path d="M40 138 L60 178" />
        <path d="M320 138 L300 178" />
        <path d="M320 138 L340 178" />
      </g>
      <g fontFamily="ui-sans-serif, system-ui" fontSize="9" textAnchor="middle">
        <Node x={180} y={20} label="Rally Cry" tone="strong" />
        <Node x={80} y={76} label="DO 1" />
        <Node x={280} y={76} label="DO 2" />
        <Node x={40} y={130} label="O 1.1" />
        <Node x={120} y={130} label="O 1.2" />
        <Node x={240} y={130} label="O 2.1" />
        <Node x={320} y={130} label="O 2.2" />
        <Node x={20} y={184} label="SO" small />
        <Node x={60} y={184} label="SO" small />
        <Node x={300} y={184} label="SO" small />
        <Node x={340} y={184} label="SO" small />
      </g>
    </svg>
  );
}

function Node({
  x,
  y,
  label,
  tone,
  small,
}: {
  x: number;
  y: number;
  label: string;
  tone?: 'strong';
  small?: boolean;
}) {
  const fill = tone === 'strong' ? 'var(--color-ribbon-link)' : 'var(--color-panel-bg)';
  const textFill = tone === 'strong' ? 'var(--color-shell-bg)' : 'var(--color-hero-heading)';
  const w = small ? 24 : 50;
  const h = small ? 14 : 16;
  return (
    <g>
      <rect
        x={x - w / 2}
        y={y - h / 2}
        width={w}
        height={h}
        rx="3"
        fill={fill}
        stroke="currentColor"
        strokeWidth="1"
      />
      <text x={x} y={y + 3} fill={textFill}>
        {label}
      </text>
    </g>
  );
}

function CopilotGrid() {
  return (
    <section className="border-t border-(--color-hero-border) bg-(--color-panel-bg)">
      <div className="mx-auto max-w-300 px-6 py-20 lg:px-10 lg:py-28">
        <div className="mb-12 max-w-3xl">
          <p className="mb-4 text-xs font-medium tracking-widest text-(--color-hero-muted) uppercase">
            The copilot lives across the lifecycle
          </p>
          <h2 className="text-3xl leading-tight font-semibold tracking-tight text-(--color-hero-heading) sm:text-4xl">
            Seven touchpoints. One coherent surface.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-(--color-hero-text)">
            The AI copilot is not a chat panel bolted on the side. It runs at every stage of the
            weekly commit, from drafting through manager review.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {COPILOT.map((t) => (
            <article
              key={t.id}
              className="flex flex-col rounded-xl border border-(--color-hero-border) bg-(--color-shell-bg) p-6 transition-colors hover:border-(--color-ribbon-link)"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex h-7 items-center rounded-md bg-(--color-shell-text) px-2 font-mono text-xs font-semibold text-(--color-shell-bg)">
                  {t.id}
                </span>
                <StageTag stage={t.stage} />
              </div>
              <h3 className="mt-5 text-base font-semibold text-(--color-hero-heading)">
                {t.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-(--color-hero-text)">
                {t.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function StageTag({ stage }: { stage: CopilotTouch['stage'] }) {
  return (
    <span className="rounded-full bg-(--color-badge-bg) px-2.5 py-1 font-mono text-xs tracking-wide text-(--color-badge-fg) uppercase">
      {stage}
    </span>
  );
}

function LifecycleRibbon() {
  return (
    <section className="border-t border-(--color-hero-border) bg-(--color-shell-bg)">
      <div className="mx-auto max-w-300 px-6 py-20 lg:px-10 lg:py-28">
        <div className="mb-12 max-w-3xl">
          <p className="mb-4 text-xs font-medium tracking-widest text-(--color-hero-muted) uppercase">
            The lifecycle
          </p>
          <h2 className="text-3xl leading-tight font-semibold tracking-tight text-(--color-hero-heading) sm:text-4xl">
            One ritual. Five states. Always reconcile.
          </h2>
        </div>
        <ol className="grid gap-3 lg:grid-cols-5">
          {STAGES.map((s, idx) => (
            <li key={s.id} className="relative flex flex-col">
              <div className="rounded-lg border border-(--color-hero-border) bg-(--color-panel-bg) p-5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-(--color-hero-muted)">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span className="font-mono text-xs font-semibold tracking-wide text-(--color-hero-heading)">
                    {s.id}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-(--color-hero-text)">{s.caption}</p>
              </div>
              {idx < STAGES.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute top-1/2 -right-2 hidden -translate-y-1/2 text-(--color-hero-muted) lg:block"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M3 8 L13 8 M9 4 L13 8 L9 12"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="bg-(--color-hero-bg)">
      <div className="mx-auto max-w-300 px-6 py-24 text-center lg:px-10 lg:py-32">
        <h2 className="text-3xl leading-tight font-semibold tracking-tight text-(--color-hero-heading) sm:text-4xl">
          See it in motion.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-(--color-hero-text)">
          A live, seeded demo &mdash; IC drafting, manager dashboard, the full lifecycle.
        </p>
        <div className="mt-10 flex justify-center">
          <a
            href={REMOTE_APP_URL}
            className="inline-flex items-center rounded-md bg-(--color-shell-text) px-6 py-3 text-sm font-medium text-(--color-shell-bg) shadow-sm transition-opacity hover:opacity-90"
          >
            Try the demo
          </a>
        </div>
      </div>
    </section>
  );
}
