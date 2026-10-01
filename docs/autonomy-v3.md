# BaroCSS autonomy V3 (current: 2026-10-01)

Planning lives on GitHub; implementation and integration stay in local git until final release.
Current user instructions override historical protocols and migration notes.

## Roles and continuous loop

Planner (gpt-6.1-sol / high) independently maintains Issues, Wiki, Discussions and priorities.
It prepares new features with bounded scope, completion conditions and reproducible tests.
Execute (gpt-6.1-sol / medium) selects ONE highest-priority eligible ready Issue, claims it,
implements, verifies, commits, merges locally, verifies again, closes it and continues to the next.
Review is inactive; preserve its records/worktrees and remove automatic calls and verdict waits.
Normal work does not wait for Planner assignment, role questions or approval. Report concrete blockers.

Labels: v3:ready → v3:running → v3:done; use blocked for real unresolved dependencies.
Issue body: Goal, Why, Scope/non-goals, Acceptance, Relevant area, Risk, nonempty ```verify commands,
PRIORITY integer (smaller first, default 100; tie by number), real Dependencies and ownership.
NOW 1–3 ready Issues; NEXT 3–5 likely follow-ups; LATER Discussions. IDLE is valid.
Do not start claimed running work until its preserved branch/results and ownership are reconciled.

## Local integration and required validation

Execute alone integrates serially into ~/.barocss-ai/v3/integration (local develop).
Task branches/worktrees start from local develop. Preserve inherited uncommitted changes and recordings.
Use git merge --no-ff; do not overwrite dirty files, reset --hard, force branches or delete others' trees.
Run `python3 tools/ai-v3/verify-local.py --base <base-sha> --issue-body <saved-body-file>` before committing
and again after integration against the pre-merge SHA with --head HEAD, comparing committed changes
without including inherited unrelated dirty work. The script requires the Issue verification,
affected-package lint/type-check, library build plus .github/scripts/check-packages.mjs for package
changes, and scripts/fuzz/browser-ratchet.mjs for runtime insert/scope changes.
Use --full for pnpm check, which additionally covers core/cross-package changes, unclear impact, explicit acceptance
and release candidates. Existing safety scripts/tests remain intact; no weaker substitute for failure.
Record consequential API/CSS semantics/security rationale, compatibility criteria, exact SHAs, commands,
results and limits. Missing evidence can block integration; no standing Review role is required.
Private security repros remain private. Close only after post-merge checks pass, with task/merge SHAs.
Changesets apply to published-package changes only, including render; not docs/tests/examples alone.

## Checkpoints and release ownership

Development and checkpoints use local commits/branch merges only; do not push or open PRs until final
release. Absence of a PR/push is never an incomplete task. No branch-protection bypass: remote
protected develop/main changes and required checks belong to the existing final release process.
Planner consolidates release scope, completion conditions, candidate SHAs, required validation and
blockers in one release Issue. Once ready, hand it once to Release Work
01a0f29f-0a94-751c-b710-7ec88d91c00a and record the handoff in the Issue to prevent duplicate dispatch.
Release owns the existing Actions deployment. Its approved 0.12.2 work is already active: preserve its
model, files, branches, runs and dispatch; this operating change does not issue another release.

## Coordination and preserved systems

Use Issue bodies/results for routine coordination; direct messages only for material scope/priority
changes or genuine blockers. No standing Review calls, ACCEPT waits or extra permanent Works.
Existing transient-subagent authorization is preserved inside Execute's one selected Issue; workers
never integrate and do not replace the inactive Review Work. See COLLABORATION.md.
The Claude-backed tools/ai-v3/v3.py plan/run and V1/V2 supervisors remain paused historical tools.
Their model constants are Claude configuration, not active Codex Work settings. Do not restart them.
Local task/control/session files are evidence, not a second planning database. Old protocols in
AGENTS.md are historical only. Preserve automatic approval rejections and never route denied work
through another role. Speak Korean to the user and English in code/commits/GitHub/inter-Work records.

## Parity numbers under vitest 5 (2026-09-26)
vitest 5 (#302) hides console output by default. To see the coverage lines, run the parity files with `--silent=false`, e.g. `pnpm --filter @barocss/kit exec vitest run tests/compat --silent=false`. The parity reference is Tailwind 4.3.3, with 4.1.13 as report-only (#304).

## CI-only steps in integration checks (2026-09-26)
`pnpm check` doesn't run every CI step. Integration checks and checkpoints also run `node .github/scripts/check-packages.mjs` (after `build:library`), which validates the packed packages' exports, types and CDN files. The 0.8.2 checkpoint failed there first (#340). Lesson from #235 (lint) and #340 (check-packages): when a CI step fails that local checks passed, add that step to the local integration check.

## Tailwind drift check (#365)
`.github/workflows/tailwind-drift.yml` runs weekly (and on manual dispatch, with an optional version spec such as `4.1.13` to simulate drift). It installs the latest `tailwindcss@4` in a scratch dir (no lockfile change), runs `tests/compat/tailwind-drift-365.test.ts` (skipped unless `BAROCSS_TW_DRIFT_DIR` is set) against both parity corpora and the preflight, and reports. Drift (a class at parity with the pinned version that fails with the latest, or a changed preflight) opens or updates one Issue titled "Tailwind 4.x drift: parity corpora or preflight changed". A clean run comments "clean at X" and closes that Issue if it is open, otherwise it stays silent. It is report-only: never on push/PR, not a required check, no release gate. The Planner triages its Issues (re-pin or not).

## Timing claims (2026-09-27)

A timing claim compares against a baseline measured in the same session and environment, and states N and
the median with its spread (min–max). Never compare timings across sessions or machines; rerun the baseline
next to the new measurement instead (#394, #403).
