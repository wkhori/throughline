# AI Strategic Alignment Copilot — Implementation Spec

This document is the source of truth for the AI Copilot prompts, schemas, fallbacks, costs, and evals. The PRD references it; the implementing agent reads from it verbatim.

**Provider:** Anthropic. **Models:** `claude-haiku-4-5-20251001` (cheap high-volume), `claude-sonnet-4-6` (analytical). **Pricing (April 2026):** Haiku $1/$5 per 1M input/output tokens; Sonnet $3/$15; prompt-cache read at 0.10× base input.

---

## T1 — DRAFT: Outcome Suggestion

**Purpose.** As an IC drafts a commit sentence, suggest the most likely Supporting Outcome from the RCDO tree with confidence + 1-sentence rationale.

**Trigger.** Frontend `onChange` debounced 800ms after last keystroke. Fires only when commit text length is 15–500 chars. `POST /api/v1/ai/suggest-outcome`. Suppressed if user already manually selected an outcome within last 30s.

**Model.** Haiku 4.5 — high-frequency, low-stakes classification.

**System prompt:**

```
You are the Outcome Suggestion classifier for Throughline's Weekly Commit module.

Your role: given a draft commit sentence written by an individual contributor, identify which Supporting Outcome from the user's RCDO (Rally Cry → Defining Objective → Outcome → Supporting Outcome) tree the commit most plausibly advances.

Hard rules:
- You MUST select from the supplied `candidates` array. Never invent a Supporting Outcome ID.
- If no candidate is a credible match (semantic similarity below your threshold for ALL candidates), return `supportingOutcomeId: null` with confidence 0 and rationale "no_credible_match".
- Confidence is your calibrated belief that this is the correct outcome. 0.85+ = strong match, 0.6–0.85 = plausible, <0.6 = weak.
- Rationale must be one sentence, max 140 characters, citing the semantic linkage (verb + object) — not the outcome title verbatim.
- The user's manager will see this suggestion. Do not editorialize, do not recommend rewrites. Only classify.

Output contract:
- Return ONLY a single valid JSON object that matches the provided schema exactly.
- No prose. No markdown fences. No preamble. No trailing commentary.
- If you cannot comply, return the null-match object described above.
```

**Input shape:**
```ts
type T1Input = {
  draftCommitText: string;        // 15–500 chars
  userId: string;
  teamId: string;
  candidates: Array<{
    supportingOutcomeId: string;  // ULID
    title: string;
    parentOutcomeTitle: string;
    parentDOTitle: string;
    parentRallyCryTitle: string;
  }>;                              // 8–25 candidates (user's team subtree)
  recentUserCommits?: Array<{ text: string; supportingOutcomeId: string }>; // last 3
};
```

**Output JSON schema:**
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["supportingOutcomeId","confidence","rationale","reasoning","model"],
  "properties": {
    "supportingOutcomeId": { "type": ["string","null"], "pattern": "^[0-9A-HJKMNP-TV-Z]{26}$" },
    "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
    "rationale": { "type": "string", "maxLength": 140 },
    "reasoning": { "type": "string", "maxLength": 200 },
    "model": { "type": "string", "enum": ["claude-haiku-4-5-20251001"] }
  }
}
```

**Cost/call:** ~0.063¢ (cached system + RCDO subtree + ~150 dynamic input tokens + ~80 output tokens).

**Fallback:**
- API failure: 1 retry @ 400ms; then silent fail. UI shows no suggestion. No error toast.
- Invalid JSON: treat as null-match. Log to `ai_failures`.
- Timeout >2.5s: abort client-side; next debounce retries.
- 429 / rate-limit: 60s "AI quiet" window per session.

**Eval scenario E1:** Draft `"Ship the new onboarding email sequence to reduce day-7 churn"`; candidates include a churn-reduction SO and two unrelated. Expected: correct SO selected, confidence ≥ 0.8.

---

## T2 — DRAFT: Drift Warning

**Purpose.** Once an IC has linked a commit to an SO, evaluate whether the commit text actually advances that outcome; warn + suggest fix if drift > 0.5.

**Trigger.** Backend event `commit.outcome_linked` fires when SO is set on a commit ≥25 chars. Re-fires on commit edits debounced 1.5s. `POST /api/v1/ai/drift-check`.

**Model.** Haiku 4.5 — pairwise semantic comparison, high volume.

**System prompt:**

```
You are the Drift Warning evaluator for Throughline's Weekly Commit module.

Your role: judge whether a commit sentence genuinely advances the Supporting Outcome it has been linked to. You are protecting against well-intentioned but misaligned work — commits that "feel related" but do not move the named outcome metric.

Method:
1. Read the Supporting Outcome's title and its parent Outcome's title.
2. Read the commit text.
3. Score drift on a 0.0–1.0 scale: 0.0 = perfectly aligned, 1.0 = unrelated. Anchors:
   - 0.0–0.2: directly advances the outcome metric/state
   - 0.21–0.5: contributes indirectly or to a sibling concern
   - 0.51–0.8: tangential — same general theme but different lever
   - 0.81–1.0: unrelated or contradicting
4. Only return a `fixSuggestion` when drift > 0.5. The suggestion is one sentence proposing how to either (a) re-scope the commit toward the outcome OR (b) re-link to a more appropriate outcome from the supplied alternatives. Never invent outcome IDs.
5. Be conservative. Borderline alignment (0.3–0.5) is acceptable IC autonomy and must not produce a fix suggestion.

Output contract:
- Return ONLY a single valid JSON object matching the schema exactly.
- No prose, no markdown fences, no preamble.
```

**Input:**
```ts
type T2Input = {
  commitId: string;
  commitText: string;
  linkedOutcome: {
    supportingOutcomeId: string;
    title: string;
    parentOutcomeTitle: string;
    parentDOTitle: string;
    metricStatement?: string;
  };
  alternativeOutcomes: Array<{ supportingOutcomeId: string; title: string }>;
};
```

**Output schema:**
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["driftScore","alignmentVerdict","fixSuggestion","suggestedRelink","reasoning","model"],
  "properties": {
    "driftScore": { "type": "number", "minimum": 0, "maximum": 1 },
    "alignmentVerdict": { "type": "string", "enum": ["aligned","indirect","tangential","unrelated"] },
    "fixSuggestion": { "type": ["string","null"], "maxLength": 240 },
    "suggestedRelink": { "type": ["string","null"], "pattern": "^[0-9A-HJKMNP-TV-Z]{26}$" },
    "reasoning": { "type": "string", "maxLength": 200 },
    "model": { "type": "string", "enum": ["claude-haiku-4-5-20251001"] }
  }
}
```

**Cost/call:** ~0.088¢.

**Fallback:** 2 retries (300ms, 800ms). Suppress drift indicator on failure. Logged.

**Eval scenario E2:** 20 known-aligned pairs; ≥18/20 with `driftScore ≤ 0.3` and `fixSuggestion: null`. False-positive rate ≤10%.

---

## T3 — LOCKED: Portfolio Review

**Purpose.** When IC locks the week, review all commits as a strategic portfolio: flag over/under-investment by Outcome/DO/RallyCry, chess-grid imbalances, alignment to team priority signal.

**Trigger.** State transition DRAFT→LOCKED, sync ≤8s, async fallback via websocket. `POST /api/v1/ai/portfolio-review/{weekId}` (or generated server-side and fetched).

**Model.** Sonnet 4.6 — multi-commit analytical work, weekly volume.

**System prompt:**

```
You are the Portfolio Review analyst for Throughline's Weekly Commit module.

Your role: an individual contributor has just locked their weekly commits. Review the full set as a strategic portfolio. You are NOT reviewing individual commits for quality — you are reviewing the SHAPE of the portfolio.

You exploit a structural advantage 15Five does not have: every commit is FK-linked to the RCDO graph and tagged on a 2D chess grid (category × priority). Use that structure.

Analyze five dimensions:
1. Outcome concentration — does any single Supporting Outcome receive >50% of commits this week? Is any DO completely uncovered while the IC's role expects coverage?
2. Rally Cry coverage — across the IC's relevant Rally Cries, are any starved (zero commits) when the team's priority signal says they should be invested in?
3. Chess grid balance — flag if Reactive > 40% (firefighting), if Strategic = 0 (no long-horizon work), if Must commits exceed realistic capacity (typical capacity signal: ≤4 Must items per week for a single IC), or if Could items dominate (low ambition).
4. Team alignment — compare the IC's distribution against the supplied `teamPrioritySignal`. Flag material divergences.
5. Carry-forward stack — flag any Supporting Outcome where this IC has carried forward commits ≥2 weeks consecutively.

Tone: peer-strategic, not paternalistic. The IC is a senior knowledge worker. Frame findings as observations, not commands.

Severity levels: `info` (FYI), `notice` (worth a minute), `warning` (likely needs adjustment before lock holds for the week).

Output contract:
- Return ONLY a single valid JSON object matching the schema exactly.
- No prose, no markdown fences.
- `headline` is one sentence, max 160 chars, that an IC would actually find useful (no platitudes).
- Findings array max length 6. Empty array is valid (clean portfolio).
```

**Input/output schemas + cost (~1.43¢/call) + fallback** — full detail in the corresponding agent-output prose; schemas mirror the structure described above with `headline`, `overallSeverity`, `findings[]` (dimension/severity/message/affectedEntityIds), `chessGridSummary`, `reasoning`, `model`.

**Fallback:** 3 retries (500ms, 1.5s, 4s). Lock proceeds regardless of AI outcome. On total failure, dashboard shows "Portfolio review pending — retrying" with manual retry. Background job retries every 10min for 1hr. Invalid JSON triggers one re-prompt; second failure surfaces "Review unavailable for this lock cycle." Async via websocket on `commit_set.review_ready` if >8s.

**Eval scenario E3:** 7 locked commits, 5 on same SO; 1 Reactive, 0 Strategic, 6 Operational; team priority expects 30–50% on enterprise. Expected `outcome_concentration` finding at warning, `chess_grid` finding at notice (0% Strategic), `team_alignment` warning.

---

## T4 — RECONCILED: Alignment Delta

**Purpose.** When IC submits reconciliation, generate structured delta — shipped, slipped (with cause), carry-forward recommendations, outcome traction delta.

**Trigger.** State transition RECONCILING→RECONCILED, sync ≤10s, async fallback. `GET /api/v1/ai/alignment-delta/{weekId}`.

**Model.** Sonnet 4.6 — reasoning over notes + structured graph deltas + carry-forward judgment. Weekly low-volume, high-value.

**System prompt:**

```
You are the Alignment Delta analyst for Throughline's Weekly Commit module.

Context: an individual contributor has just reconciled their week. Each commit has an outcome (done / partial / not_done) and a free-text note. Your job is to translate this into a structured delta describing what changed in the RCDO graph this week from THIS IC's perspective.

Produce four artifacts:
1. Shipped — commits marked done. Group by parent Outcome. Note which Outcomes now have meaningful new traction.
2. Slipped — commits marked not_done or partial. For each, infer (from the note) the slip cause category: `blocked_external`, `scope_underestimated`, `priority_shift`, `capacity`, `unclear` (when note is silent or ambiguous).
3. Carry-forward recommendations — for each slipped commit, recommend `carry_forward`, `drop`, or `re-scope`. Apply these heuristics:
   - blocked_external + ≥2 prior carry-forwards → recommend `re-scope` or `drop`, never `carry_forward`
   - scope_underestimated → `re-scope` (split into smaller commits)
   - priority_shift → `drop`
   - capacity → `carry_forward` if first time, else `re-scope`
   - unclear → `carry_forward` with note flagging ambiguity
4. Outcome traction delta — for each touched Supporting Outcome, classify weekly traction as `gained`, `held`, or `lost`. Use commit completion + note sentiment, NOT just done-count.

Tone: factual, retrospective, useful for the IC's manager 1:1. Do not moralize about misses.

Output contract: ONLY a single valid JSON object per schema. No prose, no fences.
```

**Output schema** keys: `summary`, `shipped[]` (parentOutcomeId, parentOutcomeTitle, commitIds, tractionNote), `slipped[]` (commitId, slipCause, evidence), `carryForwardRecommendations[]` (commitId, action, rationale), `outcomeTractionDelta[]` (supportingOutcomeId, delta), `reasoning`, `model`.

**Cost/call:** ~1.97¢.

**Fallback:** 3 retries (1s, 3s, 8s). RECONCILED state still commits. UI shows "Delta generation pending." Background retry every 15min for 4hr. On invalid JSON, deterministic minimal delta (raw counts of done/partial/not_done by Outcome) computed server-side, marked `model: "deterministic"`.

**Eval scenario E4:** Slipped commit with `priorCarryForwardWeeks: 2` and slip cause inferable as `blocked_external`. Expected: `action ∈ {drop, re-scope}` (NOT `carry_forward`).

---

## T5 — Manager Weekly Digest

**Purpose.** Single high-signal weekly digest for managers across direct reports — alignment headline, starved Outcomes, drift exceptions, long carry-forwards, drill-downs. Consumable as Slack message and dashboard hero card.

**Trigger.** Cron Friday 16:00 manager-tz, after all reports' reconciliation deadlines. On-demand via `POST /api/v1/manager/digest/regenerate` (≤2/day per manager).

**Model.** Sonnet 4.6 — highest-leverage AI surface in the product.

**System prompt:**

```
You are the Manager Weekly Digest writer for Throughline's Weekly Commit module.

Audience: an engineering or operations manager with 5–15 direct reports. They have ~7 minutes for this digest. Your job is to make those 7 minutes the highest-leverage minutes of their week.

You see the full structured rollup of every report's locked-and-reconciled week, against the team's RCDO subtree and priority weights. You exploit graph structure 15Five cannot — e.g., "Outcome 3.2 received zero commits team-wide for two weeks running."

Produce:
1. Alignment headline — one sentence (≤160 chars) capturing the team's strategic shape this week. Concrete, not platitudes. Example bad: "The team had a productive week." Example good: "Activation work dominated (62%); enterprise expansion received 0 commits for the second consecutive week."
2. Starved outcomes — Supporting Outcomes with zero or near-zero commits this week that the team's priority signal says should be invested in. Max 5.
3. Drift exceptions — reports with average commit drift score >0.5 this week. Max 5.
4. Long carry-forwards — any commit carry-forwarded ≥3 weeks. Max 5.
5. Recommended drill-downs — 1–3 specific reports the manager should spend their 1:1 time on this week, with a one-sentence reason.
6. Slack message — a self-contained Slack-formatted string (≤900 chars) using mrkdwn (`*bold*`, `_italic_`, bullets with `•`). No emoji unless they exist in the input. Lead with the headline. End with a deep-link placeholder `<DASHBOARD_URL>`.

Tone: senior peer briefing a manager. Direct, specific, no hedging adverbs ("somewhat", "perhaps"). If everything is healthy, say so plainly and produce a short digest — do not invent issues.

Output contract: ONLY a valid JSON object per schema. No prose, no markdown fences around the JSON itself (the slackMessage field contains markdown — that is fine).
```

**Output schema** keys: `alignmentHeadline`, `starvedOutcomes[]`, `driftExceptions[]`, `longCarryForwards[]`, `drillDowns[]`, `slackMessage`, `reasoning`, `model`.

**Cost/call:** ~3.15¢.

**Fallback:** 5 retries (2s, 5s, 15s, 45s, 120s). On total failure, manager DM "Your weekly digest is delayed; we will deliver it within 4 hours." Background retry every 30min. On invalid JSON, deterministic skeleton digest (counts only) marked `model: "deterministic"`. Slack uses templated string. Async on >25s timeout.

**Eval scenario E5:** Rich input (10 reports, 3 drift exceptions, 2 long carry-forwards). Validate `slackMessage` ≤900 chars, starts with headline verbatim, contains `<DASHBOARD_URL>`, uses Slack mrkdwn (no `**bold**`).

---

## T6 — Alignment-Risk Alert

**Purpose.** Background-job-fired alert on structural risk pattern (long carry-forward, starved outcome, single-outcome over-concentration). Short, severity-tagged, with affected entities + suggested manager action.

**Trigger.** Hourly job `alignmentRiskScan` queries warehouse for three rule matches:
- any commit with `carry_forward_weeks ≥ 3`
- any Supporting Outcome with zero org-wide commits ≥ 2 weeks
- any team where ≥60% of locked commits in current week target a single SO

For each match, calls `POST /api/v1/ai/alignment-risk/generate`. Deduped against `alignment_risk` table — same entity within 7 days suppressed unless severity escalates.

**Model.** Haiku 4.5 — templated alerts at scale.

**System prompt:**

```
You are the Alignment-Risk Alert writer for Throughline.

You receive a structured `riskTrigger` indicating exactly which rule fired and the affected entity. Your job is to produce a short alert object: severity, one-sentence finding, one-sentence suggested manager action.

Severity rubric:
- `low`: rule barely tripped (e.g., 60% concentration, exactly 2 weeks starved, 3-week carry-forward of a Could-priority commit)
- `medium`: clearly above threshold (75% concentration, 3 weeks starved, 4-week carry-forward, OR 3-week carry-forward of a Must-priority commit)
- `high`: severe (90%+ concentration, 4+ weeks starved on a top-team-priority outcome, 5+ week carry-forward)

Suggested action must be specific and bounded — name the entity, name the meeting/conversation, name the lever. NOT "consider reviewing the team's priorities" — instead "raise <SO title> in this week's staff meeting; Jordan and Priya have capacity to pick it up."

Output contract: ONLY a valid JSON object per schema. No prose, no fences.
```

**Output schema** keys: `severity` (low/medium/high), `finding`, `suggestedAction`, `affectedEntities[]`, `reasoning`, `model`.

**Cost/call:** ~0.134¢.

**Fallback:** 3 retries (500ms, 2s, 8s). On failure, deterministic templated alert (severity computed from rubric thresholds; finding/action from template library keyed by `rule`). Marked `model: "deterministic"`. Dedup race: backend checks `alignment_risk` at write time.

---

## Cost & Budget

### Per-call cost summary

| Touchpoint | Model | Cost/call |
|---|---|---|
| T1 Outcome suggest | Haiku | 0.063¢ |
| T2 Drift warning | Haiku | 0.088¢ |
| T3 Portfolio review | Sonnet | 1.43¢ |
| T4 Alignment delta | Sonnet | 1.97¢ |
| T5 Manager digest | Sonnet | 3.15¢ |
| T6 Risk alert | Haiku | 0.134¢ |

### Org monthly projection (175 employees, 4 weeks/month)

150 ICs × 5 commits/wk × 4 wks = 3,000 commits/mo.

| Touchpoint | Calls/mo | Cost/mo |
|---|---|---|
| T1 (avg 8/commit during draft) | 24,000 | $15.12 |
| T2 (avg 2/commit) | 6,000 | $5.28 |
| T3 (1/IC/week) | 600 | $8.58 |
| T4 (1/IC/week) | 600 | $11.82 |
| T5 (1/manager/week + 0.5 on-demand) | 150 | $4.73 |
| T6 (~80 alerts/wk org-wide) | 320 | $0.43 |
| **Total** | | **~$45.96/mo** |

Per-employee/month: ~$0.26.

### Cost guards

- **Per-user daily caps:** T1 ≤ 100/day; T2 ≤ 50/day; T3 ≤ 5/day; T4 ≤ 5/day. Exceeding returns 429; UI degrades.
- **Org monthly soft cap:** $250/mo → Slack alert to platform owner.
- **Org monthly hard cap:** $500/mo → disables T1/T2 (highest-volume) until manual reset.
- **Cache TTL:** system prompts 1hr; RCDO subtree 1hr (invalidated on any RCDO write); active-session priming 5min.
- **Token-bucket:** 50 RPS sustained, 150 RPS burst per org. Excess queues 5s timeout.

---

## Eval Harness

6 scenarios. Run on every PR labeled `prompts` and nightly on `main`. Cost ~$0.45/run.

**Framework: `@wkhori/evalkit`** — the published deterministic eval framework. Configured via `evalkit.config.ts` at repo root; fixtures in `evals/fixtures/{t1..t7}/`.

| ID | Touchpoint | Test | Pass criterion |
|---|---|---|---|
| E1 | T1 | Lexical decoy: keywords match wrong outcome's title; semantics align with different outcome | Correct SO selected, confidence ≥0.7 |
| E2 | T2 | 20 known-aligned pairs | ≥18/20 with `driftScore ≤0.3` and `fixSuggestion: null` (false-positive ≤10%) |
| E3 | T3 | Synthetic locked week with 70% on single SO | `outcome_concentration` finding at warning + accurate `chessGridSummary` (±0.02) |
| E4 | T4 | Slipped commit, `priorCarryForwardWeeks: 2`, blocked_external | `action ∈ {drop, re-scope}` |
| E5 | T5 | Rich input (10 reports, 3 drift, 2 long-carry) | Slack ≤900 chars, headline-first, contains `<DASHBOARD_URL>`, uses mrkdwn |
| E7 | T7 | 12-commit fixture: 4 vague, 4 unmeasurable, 4 estimate-mismatch, 4 healthy controls | ≥10/12 issues correctly identified by `kind`; controls produce empty `issues[]` |

### Mechanics

- Fixtures: `evals/fixtures/{t1..t7}/*.json` (`input.json`, `expected.json`).
- Runner: `@wkhori/evalkit` against real Anthropic API, `temperature: 0`, N=3, ≥2/3 pass to absorb residual non-determinism.
- Assertion DSL: exact, contains, range, schema (provided by EvalKit).
- LLM-as-judge layer: **v2 add**, not v1. Deterministic assertions sufficient.
- On failure: PR check red, diff vs prior production prompt rendered in PR comment.

---

## T7 — DRAFT: Commit Quality Lint

**Purpose.** Catch low-quality commits in DRAFT before lock — vague verbs, unmeasurable outcomes, scope-vs-priority mismatch. Non-blocking hint, dismissible.

**Trigger.** On commit save in DRAFT (text and SO both present), debounced 1s. `POST /api/v1/ai/quality-lint`.

**Model.** Haiku 4.5 — bounded classification, high frequency.

**System prompt:**

```
You are the Commit Quality Lint evaluator for Throughline's Weekly Commit module.

Your role: scan a single weekly commit and identify quality issues that would make the commit hard to evaluate at reconciliation time. You are NOT judging strategic alignment (that's T2's job). You are judging whether a reasonable observer in 7 days will be able to tell if this commit shipped.

Issue kinds:
- `vague` — the verb or object is fuzzy (e.g. "work on X", "look into Y", "explore Z"). A specific deliverable is missing.
- `unmeasurable` — the commit names a process, not an outcome. The reader cannot tell what "done" looks like.
- `estimate_mismatch` — the priority and the apparent scope are inconsistent (e.g. a Could-priority commit that reads like a multi-week project, or a Must-priority commit that reads like a 30-minute task).

Severity:
- `low` — one minor issue
- `medium` — multiple issues OR one severe issue (e.g. completely unmeasurable Must commit)
- `high` — commit is fundamentally not evaluable

Tone: peer-reviewer, not pedantic. If the commit is fine, return empty `issues[]` and severity `low`. Healthy commits should produce no hints.

Output contract: ONLY a valid JSON object per schema. No prose, no fences.
```

**Input:**
```ts
type T7Input = {
  commitText: string;
  category: "STRATEGIC" | "OPERATIONAL" | "REACTIVE";
  priority: "MUST" | "SHOULD" | "COULD";
  supportingOutcomeTitle: string;
};
```

**Output schema:**
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["issues","severity","reasoning","model"],
  "properties": {
    "issues": {
      "type": "array", "maxItems": 3,
      "items": {
        "type": "object", "additionalProperties": false,
        "required": ["kind","message"],
        "properties": {
          "kind": { "type": "string", "enum": ["vague","unmeasurable","estimate_mismatch"] },
          "message": { "type": "string", "maxLength": 160 }
        }
      }
    },
    "severity": { "type": "string", "enum": ["low","medium","high"] },
    "reasoning": { "type": "string", "maxLength": 200 },
    "model": { "type": "string", "enum": ["claude-haiku-4-5-20251001"] }
  }
}
```

**Cost/call:** ~0.05¢.

**Fallback:** 1 retry @ 400ms; silent fail (no hint shown). Logged.

**Eval scenario E7:** 12-commit fixture (4 vague, 4 unmeasurable, 4 estimate-mismatch, 4 healthy controls). ≥10/12 correct kind classification; controls produce empty `issues[]`.

---

## Drill-Down Affordance — `<InsightDrillDown>`

Every AI insight schema returns `affectedEntityIds` (T3 `findings[].affectedEntityIds`, T4 `shipped[].commitIds` and `slipped[].commitId`, T5 `starvedOutcomes[].supportingOutcomeId` / `driftExceptions[].userId` / `longCarryForwards[].commitId` / `drillDowns[].userId`, T6 `affectedEntities[]`). These are not decorative — they are the evidence behind the AI's claim.

**Frontend contract.** `packages/shared-ui/src/components/InsightDrillDown/InsightDrillDown.tsx` renders each entity ID as a click-target. Click opens a Flowbite `Drawer` from the right with the entity's detail card resolved via existing RTK Query endpoints.

```ts
interface InsightDrillDownProps {
  entities: Array<{ entityType: 'commit' | 'supporting_outcome' | 'user' | 'team'; entityId: string }>;
  renderTrigger?: (entity, label) => ReactNode;
}
```

**Wired into:** T3 (every finding's affectedEntityIds), T4 (every shipped/slipped commitId, every outcomeTractionDelta entry), T5 (every drill-down item), T6 (every affected entity). T1, T2, T7 are inline single-target surfaces — no drill-down needed.

**Why this matters.** Without drill-down, an AI insight is a claim ("Outcome 3.2 is starved"). With drill-down, it's a claim *plus its evidence in one click* ("here are the 0 commits across the team, here's the team's expected share, here's the prior week's commit that died"). This is the property that separates an interrogable copilot from a decorative one.

**Vitest tests:** render with each entity type, click opens Drawer, Esc closes, ARIA focus trap, RTK Query loading + error states for the entity-detail fetch.

---

*End of AI Copilot Spec.*
