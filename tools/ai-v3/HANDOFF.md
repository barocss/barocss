# BaroCSS Work handoff (current: 2026-10-01)

Read this first, then docs/autonomy-v3.md and your PLANNER.md or COMPUTE.md role prompt.
COLLABORATION.md describes communication. Current user instructions take precedence over old V1/V2
protocols, Claude supervisor prompts, model routing and the 2026-09-27 three-Work migration note.

| Work | Model / effort | Ownership |
|---|---|---|
| Planner — 01a0cbc7-a239-7fb1-8e0f-ed013c350e5f | gpt-6.1-sol / high | GitHub Issues, Wiki, Discussions, priorities, prepared scope/acceptance/tests, release Issue |
| Execute — 01a0cc08-dfb5-7142-90d9-77574034103d | gpt-6.1-sol / medium | One ready Issue at a time, implementation, verification, local commits and serial local merges |
| Review — 01a0cbd5-61a5-7dd3-b059-da00e174a27c | inactive | Preserved history/worktrees; no automatic calls or waiting dependencies |
| Release — 01a0f29f-0a94-751c-b710-7ec88d91c00a | existing settings | Existing final release PR/Actions flow; active approved 0.12.2 is preserved |

Planning lives on GitHub. Code lives in local git. Execute selects the highest-priority eligible ready
Issue, claims it, works in a branch/worktree off local develop, verifies, commits, merges --no-ff into
~/.barocss-ai/v3/integration and verifies again. It closes the Issue with SHAs/results and immediately
takes the next ready Issue. Priority is the Issue body's PRIORITY integer, smaller first, default 100,
ties by Issue number. Preserve existing claims and unrelated dirty work. No normal approval questions.

Required script: `python3 tools/ai-v3/verify-local.py --base <base-sha> --issue-body <saved-body-file>`.
It enforces the verify block, changed-package lint/type-check, build/package validation and insert/scope
browser fuzz. Use --full for pnpm check, additionally required for core/unclear impact or explicit acceptance.
Public API/CSS semantics/security changes retain exact compatibility reasoning and validation evidence;
there is no standing Review gate. Report only concrete missing decisions or blocked safety checks.

All development and checkpoints use local commits/branch merges until final release. No routine push
or PR completion requirement. Remote develop/main protections and required checks remain unchanged.
Planner collects release scope, completion conditions, candidate SHAs and validation in one Issue,
then hands it once to existing Release Work when ready. That Work owns protected release PRs and the
existing Actions flow. Do not duplicate or alter its approved active 0.12.2 work.

Locations: integration ~/.barocss-ai/v3/integration; tasks ~/.barocss-ai/v3/wt/issue-N;
Wiki ~/.barocss-ai/v3/wiki; private security evidence ~/.barocss-ai/v3/private-*.
Existing tasks.json/control.json and Claude-backed v3.py remain historical/paused; do not launch them.
Older attached Work checkouts may omit current policy: read it from integration explicitly.
No extra permanent Work or new scheduler. Keep unrelated release/product files untouched.
English for code/commits/GitHub/inter-Work records; Korean to the user. Private repros and launch drafts
remain private; no permission laundering, force push, history rewrite or unapproved publication.
