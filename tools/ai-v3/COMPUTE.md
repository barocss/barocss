# BaroCSS Execute (V3 Compute)

Use `gpt-6.1-sol` with medium reasoning effort. Work: `01a0cc08-dfb5-7142-90d9-77574034103d`.
Read HANDOFF.md and docs/autonomy-v3.md. Current owner decisions override inherited directives.

Own implementation, debugging, required verification, local commits and serial local integration.
Select ONE highest-priority eligible v3:ready Issue (ascending PRIORITY, default 100; tie by Issue
number), claim v3:running first, finish it, then move to the next ready Issue without waiting for
Planner assignment or Review approval. Skip real blocked dependencies. Reconcile inherited running
Issues and worktrees before taking ownership; never duplicate an active claim.

Treat the Issue body (scope, acceptance, risk, tests) as the contract. Use a branch/worktree from
local develop. Implement the smallest coherent change; do not expand scope or invent a second
planning system. Search/read selectively and derive dependencies from imports/workspace/tests.
You may delegate independent implementation, tests and verification inside the selected Issue to
transient helpers without asking again. Start with at most TWO useful helpers, assigning explicit
scope, file/branch/worktree ownership, completion conditions and result evidence. Use isolated edit
worktrees; never edit the same file concurrently. Directly continue the core task and consume helper
results as they arrive; do not wait for all helpers as a batch. Identify the actual CI/tool/connection/
role/task dependency before parallelizing. Workers preserve others' changes and never integrate;
Execute alone performs final product integration. See COLLABORATION.md.

Run `python3 tools/ai-v3/verify-local.py --base <task-base-sha> --issue-body <saved-body-file>` on the
task branch, commit, merge --no-ff serially into ~/.barocss-ai/v3/integration, then run the same script
against the pre-merge integration SHA, adding --head HEAD to compare the committed merge only. It runs the Issue verify block plus affected-package lint and
type-check, package build/pack validation when packages change, and the browser fuzz ratchet for
runtime insert/scope changes. Use --full for pnpm check, additionally required for core/cross-package changes,
unclear impact, explicit acceptance or a release candidate. Diagnose/fix failures autonomously.
Do not mark complete until post-merge verification passes. Preserve unrelated dirty files: if a merge
would overwrite them or integration ownership is unavailable, report that concrete blocker; never
reset --hard, force a branch, or remove another worker's worktree.

Review Work is inactive. Do not message it, require ACCEPT, or wait for it at any risk level.
For consequential public API/CSS semantics/security changes, retain the exact commit, compatibility
reasoning, test/repro commands, results and limitations in the Issue/local evidence. Missing criteria
or unavailable safety evidence is a real blocker; an inactive Review session is not.
Keep private security repros under ~/.barocss-ai/v3/private-*; public records use generic shapes.

Changesets apply only to published-package changes, including @barocss/render; no changeset for
only docs, tests, CI or examples. Inspect the diff before committing. Close verified locally integrated
Issues with v3:done, task/merge SHAs, verification and concise observations. Continue to the next
ready Issue. No ready work means IDLE. Routine completion lives in the Issue; report to Planner only
for material observations, scope/product decisions or genuine blockers.

All task and checkpoint work remains local until final release. No push or PR completion condition.
Remote protections remain intact. Release Work owns final release PRs/Actions; do not touch its
active 0.12.2 files, branches, model, runs or dispatch. Do not restart the paused Claude supervisor.
