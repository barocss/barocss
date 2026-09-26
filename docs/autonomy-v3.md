# BaroCSS autonomy V3

Planning lives on GitHub; code lives in local git. No PRs, no CI round trip per task.

| world | where | who writes |
|---|---|---|
| Vision, principles, durable discoveries | GitHub **Wiki** | Planner, humans |
| ideas, hypotheses, research questions, LATER | GitHub **Discussions** | Planner, humans |
| actionable work (NOW / NEXT / BLOCKED) | GitHub **Issues** | Planner; Supervisor updates state |
| code, branches, worktrees, integration | local git (`develop`) | Compute, Supervisor |

## Loop

```
Planner (fresh Opus, effort medium) ─ writes Issue labelled v3:ready
Supervisor (tools/ai-v3/v3.py run) ─ claims it (v3:running), branch v3/issue-N + worktree off local develop
Compute (fresh Opus, effort low) ─ implements, targeted tests, one local commit, compact result
Supervisor ─ runs the Issue's ```verify block on the branch → git merge --no-ff into local develop
           ─ reruns verify on develop (reset on failure) → closes Issue (v3:done) with the summary + SHAs
           ─ records a Planner wake reason (result arrived / ready work below threshold)
```

Labels: `v3:ready` → `v3:running` → `v3:done` | `v3:failed` (2 attempts; the first failure re-queues).
Local state: `~/.barocss-ai/v3/` (`tasks.json`, `control.json`, `planner-wake.json`, `sessions/`,
`integration/` = the worktree holding local `develop`, `wt/issue-N`).

## Issue shape

Goal · Why · Relevant area · Acceptance · Risk (low | medium | high) · a ```verify block (targeted shell
commands). Risk: low = Compute + verify; medium = a fresh review may be added; high = fresh independent
review required before integration (not automated yet: the Planner does not mark high-risk Issues ready).

## Planning horizon

NOW 1-3 ready Issues · NEXT 3-5 plain Issues · LATER Discussions only · BLOCKED label + dependency.
The Planner wakes on: ready work below threshold, a Compute result, a blocker change, human feedback, a
milestone, unclear direction. Never merely because Compute is idle. IDLE is valid.

## Verification and checkpoints

Per task: the Issue's verify block (directly related tests, package type-check when useful), on the task
branch and again after integration. Broad `pnpm check` and `git push origin develop` happen only at a
checkpoint (a batch or milestone done, backup, release, core change, or unclear scope), started by a human
or the Planner's explicit decision.

## Commands

```
python3 tools/ai-v3/v3.py status | start | pause | resume | stop
python3 tools/ai-v3/v3.py plan
python3 tools/ai-v3/v3.py run --once          # or --issue N; plain `run` loops until paused/stopped/idle
```

## Kept from V1/V2, deprecated, rollback

Kept: fresh context per unit, the supervisor-owned lifecycle (control file, timeout, retry with a bounded
attempt count, crash recovery by recreating the worktree), env scrubbing for nested `claude`, serial by
default. Deprecated (not deleted): `.ai/` as runtime database, `EXPERIMENT.yaml` / `.ai/work` contracts,
evidence / Strategy / Review PRs, CI per semantic step, `tools/ai-supervisor/` V2 scheduler. They still
work unchanged: rollback = stop using `v3.py` and run `tools/ai-supervisor/supervise.py` as before; the V1
protocol text is kept in AGENTS.md below the V3 header.

## Three sessions (Planner, Compute, Review)

Ownership: Planner = direction, priority, scope, Issues/Discussions/Wiki, human directives. Compute =
implementation, targeted verification, local commits. Review = independent evaluation of medium/high-risk
changes and whether verification fits the risk. Act first within your ownership; message another
session only when it has information or authority that materially changes the decision; async by
default; never ask for routine approval.

| from → to | when | shape |
|---|---|---|
| Compute → Planner | ambiguous behavior, wrong task assumption, scope/product/API decision, priority-changing blocker | TASK/ISSUE · DISCOVERY · QUESTION · OPTIONS · RECOMMENDATION |
| Compute → Review | medium/high risk before integration | ISSUE · COMMIT · RISK · AREA · ACCEPTANCE · VERIFICATION · KNOWN CONCERNS |
| Review → Compute | verdict | ACCEPT · NEEDS_CHANGE (smallest blocking problem) · REJECT · ESCALATE_TO_PLANNER |
| Review → Planner | product ambiguity, reconsider/split/abandon, API/architecture direction | TASK · REVIEW DECISION · STRATEGIC CONCERN · DECISION NEEDED |

Transport: direct session messages when available, otherwise the Supervisor routes (Issue comments).
No loops: after two unresolved exchanges, escalate once to the owner with decision, evidence, options.
Durable outcomes land in their home (Issue, Discussion, Wiki, local git, Supervisor state); messages
themselves are not stored. Escalate to the human only for Vision changes, human-only product choices,
credentials/permissions, irreversible external actions, or real deadlock.
Claiming: a session that starts an Issue moves `v3:ready` → `v3:running` first, so it never runs twice.

## Parallel Compute (enabled 2026-09-26)

One Compute session runs up to 3 Issues at once as subagents (Agent tool, `isolation: "worktree"`), each
branched off local `develop` and claimed first (`v3:ready` → `v3:running`). Only the Compute session
integrates, one merge at a time, rerunning that Issue's verify block after each. Issues that touch the
same files or share a runtime resource never run together; browser/dev-server tasks get separate port
ranges (5200 + 100·n). Subagents never ask the human; questions go through the Compute session. Each
Issue says `Parallel: safe | after #N | serial`.

## Review rounds (2026-09-26)
For medium and high risk, NEEDS_CHANGE (CHANGES) means: fix, then get Review's ACCEPT on the fix commit, *then* integrate. "Addressed" isn't acceptance. Every integration also runs lint for the changed packages, and checkpoints (full `pnpm check` + PR) belong to the Planner.

## Parity numbers under vitest 5 (2026-09-26)
vitest 5 (#302) hides console output by default. To see the coverage lines, run the parity files with `--silent=false`, e.g. `pnpm --filter @barocss/kit exec vitest run tests/compat --silent=false`. The parity reference is Tailwind 4.3.3, with 4.1.13 as report-only (#304).

## CI-only steps in integration checks (2026-09-26)
`pnpm check` doesn't run every CI step. Integration checks and checkpoints also run `node .github/scripts/check-packages.mjs` (after `build:library`), which validates the packed packages' exports, types and CDN files. The 0.8.2 checkpoint failed there first (#340). Lesson from #235 (lint) and #340 (check-packages): when a CI step fails that local checks passed, add that step to the local integration check.

## Tailwind drift check (#365)
`.github/workflows/tailwind-drift.yml` runs weekly (and on manual dispatch, with an optional version spec such as `4.1.13` to simulate drift). It installs the latest `tailwindcss@4` in a scratch dir (no lockfile change), runs `tests/compat/tailwind-drift-365.test.ts` (skipped unless `BAROCSS_TW_DRIFT_DIR` is set) against both parity corpora and the preflight, and reports. Drift (a class at parity with the pinned version that fails with the latest, or a changed preflight) opens or updates one Issue titled "Tailwind 4.x drift: parity corpora or preflight changed". A clean run comments "clean at X" and closes that Issue if it is open, otherwise it stays silent. It is report-only: never on push/PR, not a required check, no release gate. The Planner triages its Issues (re-pin or not).
