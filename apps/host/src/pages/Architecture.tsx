import { Nav } from '../components/Nav.js';
import { Footer } from '../components/Footer.js';

// Placeholder. A sibling agent will replace this with the full architecture page.
export function Architecture() {
  return (
    <div className="flex min-h-full flex-col bg-(--color-shell-bg) text-(--color-shell-text)">
      <Nav />
      <main className="mx-auto w-full max-w-300 px-6 py-24 lg:px-10 lg:py-32">
        <p className="mb-4 text-xs font-medium tracking-widest text-(--color-hero-muted) uppercase">
          Architecture
        </p>
        <h1 className="text-4xl leading-tight font-semibold tracking-tight text-(--color-hero-heading) sm:text-5xl">
          The system, end to end.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-(--color-hero-text)">
          This page is being built in a sibling worktree. It will explain the RCDO graph data model,
          the AI copilot dataflow, the notification adapters, and the AWS production-target stack.
        </p>
      </main>
      <Footer />
    </div>
  );
}
