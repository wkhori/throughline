// Eval runner. Wraps the `evalkit` npm package (ADR row 34) and adds a path-based
// assertion DSL for the value / range / oneOf / stability checks evalkit doesn't
// expose. Real Anthropic calls only — no stubs, no retries (eval = signal).

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runChecks, type CheckSuiteResult } from 'evalkit';
import {
  N,
  PASS_THRESHOLD,
  PRICING,
  SCENARIOS,
  TEMPERATURE,
  type EvalAssertion,
  type EvalScenario,
} from './evalkit.config.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

// --- env loader (avoid an extra dotenv dep — file format is the standard `KEY=value` per line) ---
function loadEnvLocal(): void {
  const path = join(repoRoot, '.env.local');
  if (!existsSync(path)) return;
  const raw = readFileSync(path, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

// --- assertion DSL (see EvalAssertion in evalkit.config.ts) ---
function pickPath(obj: unknown, path: (string | number)[]): unknown {
  let cur: unknown = obj;
  for (const seg of path) {
    if (cur == null) return undefined;
    if (typeof seg === 'number') {
      if (!Array.isArray(cur)) return undefined;
      cur = cur[seg];
    } else {
      if (typeof cur !== 'object' || Array.isArray(cur)) return undefined;
      cur = (cur as Record<string, unknown>)[seg];
    }
  }
  return cur;
}

/**
 * Canonicalize a value for cross-run comparison. Sorts object keys recursively so two
 * structurally-equal objects with different key insertion order are deep-equal as strings.
 */
function canonicalize(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonicalize);
  if (v != null && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) {
      out[k] = canonicalize((v as Record<string, unknown>)[k]);
    }
    return out;
  }
  return v;
}

function canonicalString(v: unknown): string {
  return JSON.stringify(canonicalize(v));
}

const ACROSS_RUN_KINDS = new Set<EvalAssertion['kind']>(['allEqual', 'allEqualSet']);

function isAcrossRunAssertion(a: EvalAssertion): boolean {
  return ACROSS_RUN_KINDS.has(a.kind);
}

/**
 * Stability assertions evaluated after every run for a scenario completes. Returns one failure
 * string per assertion that did not hold (empty array on success). The runner adopts the same
 * convention used by the per-run assertion DSL: each failure is rendered with `path=` so reports
 * stay greppable.
 */
function assertAcrossRuns(values: unknown[], a: EvalAssertion): string[] {
  if (values.length === 0) return [`path=${a.path.join('.')} kind=${a.kind} → no runs to compare`];
  const failures: string[] = [];
  switch (a.kind) {
    case 'allEqual': {
      const first = canonicalString(values[0]);
      for (let i = 1; i < values.length; i++) {
        if (canonicalString(values[i]) !== first) {
          failures.push(
            `path=${a.path.join('.')} kind=allEqual → run 1 ${first} ≠ run ${i + 1} ${canonicalString(values[i])}`,
          );
        }
      }
      return failures;
    }
    case 'allEqualSet': {
      const sets = values.map((v) => {
        if (!Array.isArray(v)) return null;
        return [...v].map(canonicalString).sort().join('|');
      });
      if (sets.some((s) => s === null)) {
        return [`path=${a.path.join('.')} kind=allEqualSet → not all runs produced an array`];
      }
      const first = sets[0];
      for (let i = 1; i < sets.length; i++) {
        if (sets[i] !== first) {
          failures.push(`path=${a.path.join('.')} kind=allEqualSet → run 1 set ≠ run ${i + 1} set`);
        }
      }
      return failures;
    }
    default:
      return [`path=${a.path.join('.')} kind=${a.kind} → not an across-run assertion`];
  }
}

function assertOnce(value: unknown, a: EvalAssertion): { ok: boolean; reason: string } {
  switch (a.kind) {
    case 'exact':
      return value === a.arg
        ? { ok: true, reason: 'ok' }
        : { ok: false, reason: `expected ${JSON.stringify(a.arg)} got ${JSON.stringify(value)}` };
    case 'contains': {
      if (typeof value !== 'string')
        return { ok: false, reason: `value is not a string: ${typeof value}` };
      const needle = String(a.arg);
      return value.includes(needle)
        ? { ok: true, reason: 'ok' }
        : { ok: false, reason: `string did not contain ${JSON.stringify(needle)}` };
    }
    case 'range': {
      const [min, max] = a.arg as [number, number];
      if (typeof value !== 'number')
        return { ok: false, reason: `value is not a number: ${typeof value}` };
      return value >= min && value <= max
        ? { ok: true, reason: 'ok' }
        : { ok: false, reason: `value ${value} not in [${min}, ${max}]` };
    }
    case 'oneOf': {
      const allowed = a.arg as unknown[];
      return allowed.includes(value)
        ? { ok: true, reason: 'ok' }
        : {
            ok: false,
            reason: `value ${JSON.stringify(value)} not one of ${JSON.stringify(allowed)}`,
          };
    }
    case 'maxLength': {
      const max = a.arg as number;
      if (typeof value !== 'string' && !Array.isArray(value))
        return { ok: false, reason: `value not string or array` };
      const len = (value as string | unknown[]).length;
      return len <= max
        ? { ok: true, reason: 'ok' }
        : { ok: false, reason: `length ${len} exceeded max ${max}` };
    }
    case 'minLength': {
      const min = a.arg as number;
      if (typeof value !== 'string' && !Array.isArray(value))
        return { ok: false, reason: `value not string or array` };
      const len = (value as string | unknown[]).length;
      return len >= min
        ? { ok: true, reason: 'ok' }
        : { ok: false, reason: `length ${len} less than min ${min}` };
    }
    case 'present':
      return value !== undefined && value !== null
        ? { ok: true, reason: 'ok' }
        : { ok: false, reason: 'value missing' };
    case 'absent':
      return value === undefined || value === null
        ? { ok: true, reason: 'ok' }
        : { ok: false, reason: `value present: ${JSON.stringify(value)}` };
    default:
      return { ok: false, reason: `unknown assertion kind ${(a as { kind: string }).kind}` };
  }
}

// --- Anthropic call ---
interface AnthropicResponse {
  content: Array<{ type: string; text: string }>;
  usage: { input_tokens: number; output_tokens: number };
  stop_reason: string;
  model: string;
}

async function callAnthropic(
  apiKey: string,
  scenario: EvalScenario,
  input: unknown,
): Promise<{
  json: unknown;
  usage: AnthropicResponse['usage'];
  rawText: string;
  jsonText: string;
}> {
  const body = {
    model: scenario.model,
    max_tokens: scenario.maxTokens,
    temperature: TEMPERATURE,
    system: scenario.system,
    messages: [{ role: 'user', content: JSON.stringify(input) }],
  };
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Anthropic ${res.status}: ${txt.slice(0, 500)}`);
  }
  const data = (await res.json()) as AnthropicResponse;
  const rawText = data.content
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('');
  // Anthropic occasionally wraps JSON in ```json fences even when told not to. Normalise once
  // up front so both the project-specific path DSL *and* evalkit.runChecks see clean JSON.
  const stripped = rawText
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  const json = JSON.parse(stripped);
  return { json, usage: data.usage, rawText, jsonText: stripped };
}

function costCents(model: string, usage: AnthropicResponse['usage']): number {
  const p = PRICING[model];
  if (!p) return 0;
  // PRICING is dollars per 1M tokens. Return cents.
  const inputDollars = (usage.input_tokens / 1_000_000) * p.input;
  const outputDollars = (usage.output_tokens / 1_000_000) * p.output;
  return (inputDollars + outputDollars) * 100;
}

// --- runner ---
interface RunResult {
  scenario: EvalScenario;
  passes: number;
  attempts: Array<{
    runIdx: number;
    pass: boolean;
    failures: string[];
    rawSnippet: string;
    model: string;
    costCents: number;
  }>;
  totalCostCents: number;
}

async function runScenario(apiKey: string, scenario: EvalScenario): Promise<RunResult> {
  const fixturesDir = join(__dirname, 'fixtures', scenario.id);
  const input = JSON.parse(await readFile(join(fixturesDir, 'input.json'), 'utf8')) as unknown;
  const assertions = JSON.parse(
    await readFile(join(fixturesDir, 'expected.json'), 'utf8'),
  ) as EvalAssertion[];

  const perRunAssertions = assertions.filter((a) => !isAcrossRunAssertion(a));
  const acrossRunAssertions = assertions.filter(isAcrossRunAssertion);
  const runCount = scenario.runs ?? N;

  const attempts: RunResult['attempts'] = [];
  let passes = 0;
  let totalCostCents = 0;
  const successfulRunOutputs: unknown[] = [];

  for (let i = 0; i < runCount; i++) {
    try {
      const { json, usage, rawText, jsonText } = await callAnthropic(apiKey, scenario, input);
      const cost = costCents(scenario.model, usage);
      totalCostCents += cost;
      const failures: string[] = [];

      // evalkit's runChecks owns the universal assertions every Anthropic JSON response should
      // pass: response is non-empty, parses as JSON, and is an object (not a bare value or
      // array). Markdown fences have already been stripped in callAnthropic, so jsonText is
      // what evalkit should see. Per-scenario schema/content checks come from the fixture.
      const evalkitResult: CheckSuiteResult = runChecks({
        responseText: jsonText,
        json: { text: jsonText, requireObject: true },
      });
      if (!evalkitResult.passed) {
        for (const r of evalkitResult.results) {
          if (!r.passed) failures.push(`evalkit:${r.key} → ${r.details}`);
        }
      }

      // Project-specific path-based assertions: pick the value at a JSON path, then check it
      // against an exact / range / oneOf / present / absent / contains predicate.
      for (const a of perRunAssertions) {
        const value = pickPath(json, a.path);
        const result = assertOnce(value, a);
        if (!result.ok) {
          failures.push(`path=${a.path.join('.')} kind=${a.kind} → ${result.reason}`);
        }
      }

      const pass = failures.length === 0;
      if (pass) passes++;
      successfulRunOutputs.push(json);
      attempts.push({
        runIdx: i + 1,
        pass,
        failures,
        rawSnippet: rawText.slice(0, 200),
        model: scenario.model,
        costCents: cost,
      });
    } catch (e) {
      attempts.push({
        runIdx: i + 1,
        pass: false,
        failures: [`anthropic-error: ${e instanceof Error ? e.message : String(e)}`],
        rawSnippet: '',
        model: scenario.model,
        costCents: 0,
      });
    }
  }

  // Apply across-run (stability) assertions. A failure here invalidates every attempt's pass
  // verdict — stability is all-or-nothing. We surface the failures on the first attempt so the
  // existing report rendering picks them up without further changes.
  if (acrossRunAssertions.length > 0) {
    const stabilityFailures: string[] = [];
    for (const a of acrossRunAssertions) {
      const values = successfulRunOutputs.map((o) => pickPath(o, a.path));
      stabilityFailures.push(...assertAcrossRuns(values, a));
    }
    if (stabilityFailures.length > 0) {
      passes = 0;
      if (attempts.length > 0) {
        attempts[0] = {
          ...attempts[0],
          pass: false,
          failures: [...attempts[0].failures, ...stabilityFailures],
        };
      }
    }
  }

  return { scenario, passes, attempts, totalCostCents };
}

function fmtCents(c: number): string {
  return `${c.toFixed(4)}¢`;
}

function fmtCentsAsDollars(c: number): string {
  return `$${(c / 100).toFixed(4)}`;
}

async function main(): Promise<void> {
  loadEnvLocal();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !apiKey.startsWith('sk-ant-')) {
    console.error('ANTHROPIC_API_KEY missing or malformed in .env.local');
    process.exit(2);
  }

  const start = Date.now();
  console.log(
    `[evals] running ${SCENARIOS.length} scenarios (default N=${N}, ≥${PASS_THRESHOLD}/${N} to pass; stability scenarios may override)`,
  );
  const results: RunResult[] = [];
  for (const scenario of SCENARIOS) {
    process.stdout.write(`[evals] ${scenario.id} ${scenario.name} … `);
    const r = await runScenario(apiKey, scenario);
    const runCount = scenario.runs ?? N;
    const threshold = scenario.runs ? scenario.runs : PASS_THRESHOLD;
    const verdict = r.passes >= threshold ? 'PASS' : 'FAIL';
    console.log(`${verdict} (${r.passes}/${runCount}, ${fmtCentsAsDollars(r.totalCostCents)})`);
    results.push(r);
  }

  const elapsedMs = Date.now() - start;
  const totalCost = results.reduce((s, r) => s + r.totalCostCents, 0);
  const passed = (r: RunResult) => r.passes >= (r.scenario.runs ? r.scenario.runs : PASS_THRESHOLD);
  const allGreen = results.every(passed);

  // Markdown report
  const lines: string[] = [];
  lines.push('# AI Copilot Eval Report');
  lines.push('');
  lines.push(`Run timestamp: ${new Date().toISOString()}`);
  lines.push(`Total elapsed: ${(elapsedMs / 1000).toFixed(1)}s`);
  lines.push(`Total cost: ${fmtCentsAsDollars(totalCost)} (${fmtCents(totalCost)})`);
  lines.push(`Pass threshold: ≥${PASS_THRESHOLD}/${N} per scenario at temperature ${TEMPERATURE}.`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| ID | Touchpoint | Model | Passes | Verdict | Cost |');
  lines.push('|----|------------|-------|--------|---------|------|');
  for (const r of results) {
    const verdict = passed(r) ? '✅ PASS' : '❌ FAIL';
    const runCount = r.scenario.runs ?? N;
    lines.push(
      `| ${r.scenario.id.toUpperCase()} | ${r.scenario.name} | \`${r.scenario.model}\` | ${r.passes}/${runCount} | ${verdict} | ${fmtCentsAsDollars(r.totalCostCents)} |`,
    );
  }
  lines.push('');
  lines.push(
    `Overall: **${allGreen ? '✅ all scenarios passed' : '❌ at least one scenario failed'}**`,
  );
  lines.push('');
  lines.push('## Per-attempt detail');
  for (const r of results) {
    lines.push('');
    lines.push(`### ${r.scenario.id.toUpperCase()} — ${r.scenario.name}`);
    for (const a of r.attempts) {
      lines.push('');
      lines.push(
        `- **Run ${a.runIdx}** — ${a.pass ? '✅' : '❌'} (cost ${fmtCentsAsDollars(a.costCents)})`,
      );
      if (a.failures.length > 0) {
        for (const f of a.failures) lines.push(`  - ${f}`);
      }
      if (a.rawSnippet) {
        lines.push('  - raw (200 chars): `' + a.rawSnippet.replace(/\n/g, ' ') + '`');
      }
    }
  }
  lines.push('');

  const outPath = join(__dirname, 'last-run.md');
  await writeFile(outPath, lines.join('\n'));
  console.log(`[evals] wrote report → ${outPath}`);
  console.log(
    `[evals] total cost ${fmtCentsAsDollars(totalCost)} elapsed ${(elapsedMs / 1000).toFixed(1)}s`,
  );

  if (!allGreen) process.exit(1);
}

main().catch((e) => {
  console.error('[evals] fatal:', e);
  process.exit(2);
});
