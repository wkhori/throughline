// Throughline AI eval runner — wraps the published `evalkit` npm package
// (https://www.npmjs.com/package/evalkit, ADR row 34).
//
// Behaviour:
//   1. Loads .env.local for ANTHROPIC_API_KEY (mandatory).
//   2. For every scenario in evalkit.config.ts:
//      - Reads `evals/fixtures/<id>/input.json` (a Record passed verbatim as the user message).
//      - Reads `evals/fixtures/<id>/expected.json` (assertion list).
//      - Calls Anthropic Messages API N=3 times at temperature 0.
//      - Hands every Anthropic response to evalkit's `runChecks` for the JSON-validity +
//        schema-match + content-match leg of every scenario, and applies the project-specific
//        path-based assertion DSL on top for value/range/oneOf checks evalkit doesn't expose
//        out of the box.
//   3. Writes a Markdown report to `evals/last-run.md`.
//   4. Exits non-zero if any scenario passed fewer than PASS_THRESHOLD of N runs.
//
// Hard rules: every scenario MUST be called against the real Anthropic API. No stubs. No retries
// for transient HTTP failures (eval = signal, not robustness test). If a network error occurs,
// the run for that scenario fails outright and shows up red in the report.

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

  const attempts: RunResult['attempts'] = [];
  let passes = 0;
  let totalCostCents = 0;

  for (let i = 0; i < N; i++) {
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
      for (const a of assertions) {
        const value = pickPath(json, a.path);
        const result = assertOnce(value, a);
        if (!result.ok) {
          failures.push(`path=${a.path.join('.')} kind=${a.kind} → ${result.reason}`);
        }
      }

      const pass = failures.length === 0;
      if (pass) passes++;
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
    `[evals] running ${SCENARIOS.length} scenarios × N=${N} (≥${PASS_THRESHOLD}/${N} to pass)`,
  );
  const results: RunResult[] = [];
  for (const scenario of SCENARIOS) {
    process.stdout.write(`[evals] ${scenario.id} ${scenario.name} … `);
    const r = await runScenario(apiKey, scenario);
    const verdict = r.passes >= PASS_THRESHOLD ? 'PASS' : 'FAIL';
    console.log(`${verdict} (${r.passes}/${N}, ${fmtCentsAsDollars(r.totalCostCents)})`);
    results.push(r);
  }

  const elapsedMs = Date.now() - start;
  const totalCost = results.reduce((s, r) => s + r.totalCostCents, 0);
  const allGreen = results.every((r) => r.passes >= PASS_THRESHOLD);

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
    const verdict = r.passes >= PASS_THRESHOLD ? '✅ PASS' : '❌ FAIL';
    lines.push(
      `| ${r.scenario.id.toUpperCase()} | ${r.scenario.name} | \`${r.scenario.model}\` | ${r.passes}/${N} | ${verdict} | ${fmtCentsAsDollars(r.totalCostCents)} |`,
    );
  }
  lines.push('');
  lines.push(`Overall: **${allGreen ? '✅ all scenarios passed' : '❌ at least one scenario failed'}**`);
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
  console.log(`[evals] total cost ${fmtCentsAsDollars(totalCost)} elapsed ${(elapsedMs / 1000).toFixed(1)}s`);

  if (!allGreen) process.exit(1);
}

main().catch((e) => {
  console.error('[evals] fatal:', e);
  process.exit(2);
});
