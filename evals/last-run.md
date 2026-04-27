# AI Copilot Eval Report

Run timestamp: 2026-04-27T17:57:10.937Z
Total elapsed: 146.4s
Total cost: $0.1713 (17.1344¢)
Pass threshold: ≥2/3 per scenario at temperature 0.

## Summary

| ID | Touchpoint | Model | Passes | Verdict | Cost |
|----|------------|-------|--------|---------|------|
| T1 | E1 — Outcome suggestion (lexical decoy) | `claude-haiku-4-5-20251001` | 3/3 | ✅ PASS | $0.0036 |
| T2 | E2 — Drift warning (aligned pair) | `claude-haiku-4-5-20251001` | 3/3 | ✅ PASS | $0.0035 |
| T3 | E3 — Portfolio review (concentrated) | `claude-sonnet-4-6` | 3/3 | ✅ PASS | $0.0399 |
| T4 | E4 — Alignment delta (blocked_external + 2 prior CF) | `claude-sonnet-4-6` | 3/3 | ✅ PASS | $0.0570 |
| T5 | E5 — Manager digest (rich input) | `claude-sonnet-4-6` | 3/3 | ✅ PASS | $0.0631 |
| T7 | E7 — Commit quality lint (vague Must) | `claude-haiku-4-5-20251001` | 3/3 | ✅ PASS | $0.0041 |

Overall: **✅ all scenarios passed**

## Per-attempt detail

### T1 — E1 — Outcome suggestion (lexical decoy)

- **Run 1** — ✅ (cost $0.0012)
  - raw (200 chars): ````json {   "supportingOutcomeId": "01J0SOOOO000000000000000A",   "confidence": 0.92,   "rationale": "Shipping onboarding email sequence directly targets day-7 churn reduction, matching the outcome's `

- **Run 2** — ✅ (cost $0.0012)
  - raw (200 chars): ````json {   "supportingOutcomeId": "01J0SOOOO000000000000000A",   "confidence": 0.92,   "rationale": "Shipping onboarding email sequence directly targets day-7 churn reduction, matching the outcome's `

- **Run 3** — ✅ (cost $0.0012)
  - raw (200 chars): ````json {   "supportingOutcomeId": "01J0SOOOO000000000000000A",   "confidence": 0.92,   "rationale": "Shipping onboarding email sequence directly targets day-7 churn reduction, matching the outcome's `

### T2 — E2 — Drift warning (aligned pair)

- **Run 1** — ✅ (cost $0.0012)
  - raw (200 chars): ````json {   "commitId": "01J0COMMIT00000000000000A",   "driftScore": 0.15,   "rationale": "The commit directly targets the named metric (day_7_churn_pct) by shipping an onboarding email sequence desig`

- **Run 2** — ✅ (cost $0.0012)
  - raw (200 chars): ````json {   "commitId": "01J0COMMIT00000000000000A",   "driftScore": 0.15,   "rationale": "The commit directly targets the named metric (day_7_churn_pct) through a specific intervention (onboarding em`

- **Run 3** — ✅ (cost $0.0012)
  - raw (200 chars): ````json {   "commitId": "01J0COMMIT00000000000000A",   "driftScore": 0.15,   "rationale": "The commit directly targets the named metric (day_7_churn_pct) through a specific, measurable intervention (o`

### T3 — E3 — Portfolio review (concentrated)

- **Run 1** — ✅ (cost $0.0133)
  - raw (200 chars): `{"weekId":"01J0WEEK0000000000000001","userId":"01J0USER000000000000000001","headline":"5 of 7 commits land on one Supporting Outcome, and the team's top-priority Rally Cry ('Move upmarket') has zero c`

- **Run 2** — ✅ (cost $0.0131)
  - raw (200 chars): `{"weekId":"01J0WEEK0000000000000001","userId":"01J0USER000000000000000001","headline":"5 of 7 commits land on one Supporting Outcome, and the team's top-priority Rally Cry (Move upmarket, 40%) has zer`

- **Run 3** — ✅ (cost $0.0135)
  - raw (200 chars): `{"weekId":"01J0WEEK0000000000000001","userId":"01J0USER000000000000000001","headline":"5 of 7 commits land on one Supporting Outcome and zero commits touch the team's top-priority Rally Cry — portfoli`

### T4 — E4 — Alignment delta (blocked_external + 2 prior CF)

- **Run 1** — ✅ (cost $0.0185)
  - raw (200 chars): ````json {   "weekId": "01J0WEEK0000000000000001",   "userId": "01J0USER000000000000000001",   "shipped": [     {       "commitId": "01J0COMMIT00000000000010",       "text": "Land trial-week activation`

- **Run 2** — ✅ (cost $0.0196)
  - raw (200 chars): ````json {   "weekId": "01J0WEEK0000000000000001",   "userId": "01J0USER000000000000000001",   "shipped": [     {       "commitId": "01J0COMMIT00000000000010",       "text": "Land trial-week activation`

- **Run 3** — ✅ (cost $0.0189)
  - raw (200 chars): ````json {   "weekId": "01J0WEEK0000000000000001",   "userId": "01J0USER000000000000000001",   "shipped": [     {       "commitId": "01J0COMMIT00000000000010",       "text": "Land trial-week activation`

### T5 — E5 — Manager digest (rich input)

- **Run 1** — ✅ (cost $0.0211)
  - raw (200 chars): ````json {   "managerId": "01J0USER000000000000000900",   "managerName": "Jordan Kim",   "weekStart": "2026-04-20",   "alignmentHeadline": "Trial-churn work consumed 62% of commits; enterprise logo pur`

- **Run 2** — ✅ (cost $0.0212)
  - raw (200 chars): ````json {   "managerId": "01J0USER000000000000000900",   "managerName": "Jordan Kim",   "weekStart": "2026-04-20",   "alignmentHeadline": "Trial-churn work consumed 62% of commits; enterprise logo pur`

- **Run 3** — ✅ (cost $0.0208)
  - raw (200 chars): ````json {   "managerId": "01J0USER000000000000000900",   "managerName": "Jordan Kim",   "weekStart": "2026-04-20",   "alignmentHeadline": "Trial-churn work consumed 62% of commits; enterprise logo pur`

### T7 — E7 — Commit quality lint (vague Must)

- **Run 1** — ✅ (cost $0.0014)
  - raw (200 chars): ````json {   "issues": [     {       "kind": "vague",       "description": "The verb 'look into' and object 'the billing thing' lack specificity. What is the actual deliverable? A diagnosis? A fix? A r`

- **Run 2** — ✅ (cost $0.0014)
  - raw (200 chars): ````json {   "issues": [     {       "kind": "vague",       "description": "The verb 'look into' and object 'the billing thing' lack specificity. What is the actual deliverable? A diagnosis? A fix? A r`

- **Run 3** — ✅ (cost $0.0014)
  - raw (200 chars): ````json {   "issues": [     {       "kind": "vague",       "description": "The verb 'look into' and object 'the billing thing' are both fuzzy. What specific deliverable or outcome should result from t`
