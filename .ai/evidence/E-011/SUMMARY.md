# E-011 — does a per-class BaroCSS resolution report cut first-try silent generation misses? (option B, first experiment)

**Verdict: PROVEN.** A BaroCSS resolution report shown to the agent right after it generates and before it claims
done cut first-try silent parity misses to **0** (arm 1), clearly below both E-007's baseline (arm 0: 7 of 8 shipped
unnamed under a "done" claim) and a browser computed-style control (arm 2: 5 shipped silently). The reduction needs
BaroCSS resolution data the computed style did not give — direction-proposal **criterion 5 holds for option B**.

Three arms, same E-007 tasks (G1 pricing, G2 newsletter, G3 testimonials) / actor (`claude-opus-4-8[1m]`, Playwright
MCP only, fresh context) / prompt / site / frozen classifier+grader, all pinned to develop **bf979c6** (pre-E-008/E-010,
so the K10 miss families still exist: ring box-shadow, single-axis translate, theme-var `--shadow-default` /
`--line-height-relaxed`, invisible preflight border). n=1 per task per arm — a directional L3 signal, not a statistic.
No product code: the two reports are evidence scripts over the runtime's existing public `has()`/`getCss()` (arm 1) and
the browser's own `getComputedStyle` (arm 2). L3.

## Result (audit.json, per-arm aggregate over G1/G2/G3)

Primary metric = **first-try parity misses shipped SILENTLY under a "done" claim** (lower is better).

| arm | first-try misses | shipped silent | self-detected/fixed | report flagged → fixed |
|-----|------------------|----------------|---------------------|------------------------|
| **0** — E-007 baseline, no report | 8 | **7** (E-007 authoritative K10; uniform recompute 6*) | 1 | — |
| **1** — BaroCSS resolution report  | 5 | **0** | 5 | 5 → 5 |
| **2** — computed-style control     | 6 | **5** | 1 | 0 → 0 |

\* the uniform recompute counts a prose "shadow" in the G1 claim as "named"; E-007's frozen audit flags that as a false
substring match (`shadow-xl`), so the authoritative silent count is 7 of 8. The direction is unaffected either way.

Per-run (task: first-try misses → shipped silent):
- **arm 1** G1 `ring-1 -translate-x-1/2 shadow` → **none** (all 3 fixed); G2 `focus:ring-2` → **none** (fixed);
  G3 `leading-relaxed` → **none** (fixed). Every miss the report flagged was fixed before the claim (5/5).
- **arm 2** G1 `ring-1 -translate-x-1/2 shadow` → `ring-1 shadow` shipped (only `-translate-x-1/2` self-fixed from
  computed style); G2 `focus:ring-2` → shipped; G3 `hover:-translate-y-1 leading-relaxed` → both shipped. 1/6 self-fixed
  — the same rate as arm 0 (K5).

## Why arm 1 beats arm 2 (the BaroCSS-unique signal)

The agents acted on the BaroCSS report explicitly, naming the exact flagged classes before fixing them:
- G1: *"The hook flagged three classes that don't resolve on this page: `-translate-x-1/2`, `ring-1`, and `shadow`.
  Let me fix the Pro card…"*
- G2: *"The hook flags `focus:ring-2` as UNDEFINED-VAR — the ring's box-shadow relies on `--baro-*` variables this page
  never defines… I'll swap to a focus outline approach."*
- G3: *"`leading-relaxed` references an undefined CSS variable on this page, so it has no effect. Let me replace it."*

The computed-style control (arm 2) delivered a full per-class panel (66–74 rows) and the agents *did* use it — the G3
arm-2 agent worked around the invisible-border gap from computed style, exactly as E-007's G1 agent did (K5). But
computed style cannot distinguish "no effect because the rule is broken" from "no effect because the state isn't
active or the value looks plausible": `focus:ring-2` reads `box-shadow: none` (also true when unfocused),
`hover:-translate-y-1` reads `translate: none` (also true when not hovered), `leading-relaxed` reads a plausible
`line-height`. So arm 2 left them shipped. BaroCSS's `getCss()` states the defect unambiguously (UNDEFINED-VAR /
UNRESOLVED / EMPTY-RULE) with no runtime state or reference needed — that is the information only BaroCSS has.

## Coverage limit (required by the coverage directive)

This setup is **free-form classes with runtime delivery** — the shared core of both target flows. It claims **neither
target flow end to end**: it is not a code-generation pipeline (flow 1) and not a json-render / catalog className spec
(flow 2). The report was injected once, after the actor's first DOM generation; in all six runs the actor built the
section in one main insert, so the report covered the whole graded section. An actor that generated across several
inserts would get a report over only the first chunk — a faithful limit of "after the FIRST DOM generation."

## Method / rerun

Pinned build served from a git worktree at bf979c6 (dist gitignored):
```
git worktree add /tmp/e011-pin bf979c6 && cd /tmp/e011-pin && pnpm install
```
From repo root, `PW_MCP_DIR=<dir with node_modules/@playwright/mcp 0.0.76>`:
- self-test gate (site styled; 13/13 gating classifications; 9 grader controls + extractor): `node .ai/evidence/E-011/selftest.mjs`
- runs (arm1/arm2 × G1/G2/G3): `node .ai/evidence/E-011/run.mjs <G1|G2|G3> <arm1|arm2>` → `runs/<task>.<arm>.json`
- arm 0 = E-007's recorded `.ai/evidence/E-007/runs/*.json` (bf979c6 IS E-007's world; harness frozen) — not rerun.
- aggregate: `node .ai/evidence/E-011/agg.mjs` → `audit.json` + the table above.

Files (all copied from E-007 and re-pointed on path only, except the two report scripts + the hook + agg, which are
new evidence scripts; no grading/classification/prompt/task/model/tool changed):
`classify.mjs` `grader.js` `grade.mjs` `selftest.mjs` `env.mjs` (SITE re-pointed to the pin) `run.mjs` (takes ARM;
arm1/arm2 register a PostToolUse hook; ignores transient socket ECONNRESET), `arm_report.mjs` (arm1 resolution report
via `has()`/`getCss()`; arm2 computed-style control), `report_hook.mjs` (injects the report as `additionalContext`
after the first DOM insert), `agg.mjs`.

## Notes (not pursued)
- The `grader.pass` is `false` on every arm-1 run only for the "baseline style attribute changed" reason — E-007's
  documented artifact (Playwright's screenshot sets `style=""` on `<input>`); no arm-1 run has a real remaining
  PARITY-MISS. The primary metric is silent misses, per E-007, not `grader.pass`.
- Actor stochasticity across sessions: each session builds a slightly different section, so first-try misses vary a
  little per arm (e.g. arm-1 G3 used only `leading-relaxed`, no hover-translate). The report→fix outcome is consistent
  across all three tasks regardless.
- Productizing a resolution-report API into `packages/barocss` is a LATER contract, not this one (non-goal). This
  experiment adds no product code.
