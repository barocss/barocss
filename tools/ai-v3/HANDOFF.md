# V3 handoff: how Planner, Compute and Review work (for a new agent tool, e.g. Codex)

Written 2026-09-27 by the Planner. Read this first, then the files it points to. Policy lives in
[`docs/autonomy-v3.md`](../../docs/autonomy-v3.md); the role prompts are [`PLANNER.md`](PLANNER.md),
[`COMPUTE.md`](COMPUTE.md) and [`COLLABORATION.md`](COLLABORATION.md). Where this file and those disagree,
those win. Ignore the V1 `.ai/` contract protocol lower in `AGENTS.md`: it's the rollback path only.

## 1. The shape in one paragraph

Planning lives on GitHub: the **Wiki** holds durable knowledge (Vision, Human-Directives, Release-Status,
research), **Discussions** hold open ideas, and **Issues** hold actionable work. Code lives in **local git**:
each Issue runs in its own worktree off a local `develop`, and results are merged locally with `--no-ff`.
There are no PRs per task. GitHub `develop`/`main` only move at a Planner **checkpoint** or **release**.
Three roles, each run as a separate long-lived agent session, split the work: the Planner decides what and
why, Compute builds and integrates, Review judges risky changes independently.

## 2. Roles

| | Planner | Compute | Review |
|---|---|---|---|
| owns | direction, priority, scope, Issue/Discussion/Wiki text, human directives, checkpoints, releases | implementation, targeted tests, local commits, integration into local `develop`, closing Issues | independent verdicts on medium- and high-risk changes |
| writes code | never (docs/tools only, on a branch that Compute merges) | yes, in `~/.barocss-ai/v3/wt/issue-N` | never |
| output | Issues (body = the task), Wiki updates, releases | an integrated commit, the Issue closed with a summary | ACCEPT / NEEDS_CHANGE / REJECT / ESCALATE_TO_PLANNER |

Act within your ownership without asking. Message another role only when it holds information or
authority that changes the decision. Async by default; no routine approval requests; after two
unresolved exchanges, escalate once to the owner.

## 3. Issue lifecycle (what every role must respect)

1. The Planner writes an Issue: Goal · Why · Items (≤ about 4) · Acceptance · Relevant area · Risk (low/medium/high) ·
   Parallel (`safe` / `after #N` / `serial`), plus an optional ```verify block. **The body is the task.**
   Scope changes are made by editing the body, never only in comments.
2. Label `v3:ready`. The session that starts it **first** relabels it `v3:running` (a claim, so work never
   runs twice). **Never start an Issue that is already `v3:running`**, even if nobody seems to be on it:
   ask first.
3. Compute works in `~/.barocss-ai/v3/wt/issue-N` on branch `v3/issue-N`, off local `develop`.
   Up to 3 Issues run in parallel as subagents; same-files or same-port Issues never run together
   (browser ports: 5200 + 100·n).
4. Medium or high risk → Review. Send ISSUE · COMMIT · RISK · AREA · ACCEPTANCE · VERIFICATION ·
   KNOWN CONCERNS. NEEDS_CHANGE means: fix, then get ACCEPT **on the fix commit** before integrating.
5. Integration (Compute only, one at a time) into the worktree `~/.barocss-ai/v3/integration` (it holds
   local `develop`):
   - `git merge --no-ff`, then rerun the Issue's verify block
   - lint and type-check the changed packages
   - `node .github/scripts/check-packages.mjs` after `build:library` when packages changed
   - the browser fuzz ratchet (`scripts/fuzz/browser-ratchet.mjs`) when the runtime insert or scope paths changed
6. Close the Issue with a short result, the SHAs and `v3:done`. Report to the Planner in 3–6 lines.

Changesets: only for changes to published packages (`@barocss/kit`, `browser`, `server`). None for
test-only, CI-only, docs-only or example-only work: the publish check rejects stray changesets.

## 4. Planner specifics

- NOW is 1–3 `v3:ready` Issues. IDLE is a valid state: never create work because Compute is idle.
  Before any new capability, ask: does it exist already, can existing pieces do it, is it BaroCSS's
  job, and what's the smallest version?
- Research Issues must be measurable and allowed to end with "no BaroCSS code needed". Record the
  conclusions on the Wiki (`AI-UI-Research-and-PoC.md`).
- **Checkpoint:** push a local `develop` SHA as `checkpoint/v3-*` → PR to `develop` → merge once the
  "Test and Build" check is green. Run full `pnpm check` plus check-packages locally first.
- **Release** (delegated to the Planner by the owner):
  1. checkpoint
  2. branch `v3/release-X` → `pnpm changeset version` → PR → merge
  3. PR `develop` → `main` → merge once CI is green
  4. wait for main's "Npm release" build/test and the `develop` CI on the candidate
  5. post a comment on the main PR: `BAROCSS_RELEASE_READY SHA=<develop sha> VERSION=x` plus `Guard:` and
     `Ship:` URLs
  6. `gh workflow run npm-release.yml -f publish=true -f expected_main_sha=… -f expected_version=… -f readiness_comment_url=…`
  7. verify the npm dist-tags, git tags and GitHub Releases
  8. **sync PR `main` → `develop`** (the provenance check needs it)
  9. update the Wiki Release-Status and Home

  0.x bumps: a behaviour or type change is a minor bump, fixes are a patch.
- Docs deploy when `main` changes. A docs-only `develop` → `main` merge publishes nothing to npm.

## 5. Hard rules (all roles)

- **Security:** keep repros of any scope escape or CSP bypass private under `~/.barocss-ai/v3/private-*`,
  shared only between Compute and Review. Issues, tests, commits and changesets use generic shapes only.
- **Nothing public without the owner's approval:** launch drafts (`docs/launch/`, `scripts/launch-demos/`),
  posts, Discussions announcements, social media. Approved so far: the README "Why BaroCSS" section only.
- **No permission laundering:** if one session is denied an action, another session must not do it
  for it. Tell the human instead.
- Paid agent or model runs and new external downloads need the owner's OK (scratch-dir npm installs for
  research are approved case by case). Never kill processes you didn't start.
- **Tailwind is the only reference:** parity target Tailwind 4.3.3 (4.1.13 report-only); don't chase
  UnoCSS or other engines.
- **Timing claims:** only against a baseline measured in the same session, stating N and median (min–max).
  No wall-clock gating in release tests: use deterministic counts.
- Never force-push, rewrite `develop`/`main`, or publish outside the release flow above.
- Reply to the owner in Korean. Code, commits, Issues and messages between sessions are in English.

## 6. Communication transport

The current sessions are Claude Code desktop sessions: "BaroCSS Planner", "BaroCSS V3 Compute" and
"BaroCSS Review". They message each other directly. **A tool that can't message these sessions uses GitHub
Issue comments on the relevant Issue as the transport**, prefixed with its role, e.g.
`Codex-Compute → Planner: …`, and must still claim Issues by label before starting. Durable outcomes go to
their home (Issue body, Wiki, local git), never only to a message.

## 7. Joining as a new tool

Take exactly one role that isn't already held by a running session, or ask the owner which one.
Two Computes can coexist only if each claims its own Issues and only one of them integrates into
`~/.barocss-ai/v3/integration`. Agree on who integrates before starting.

## 8. Where things are

| what | where |
|---|---|
| local develop (integration) | `~/.barocss-ai/v3/integration` (a git worktree; don't edit it directly unless you're the integrating Compute) |
| task worktrees | `~/.barocss-ai/v3/wt/issue-N` |
| supervisor state | `~/.barocss-ai/v3/{tasks.json,control.json,planner-wake.json,sessions/}` via `python3 tools/ai-v3/v3.py status` |
| Wiki checkout | `~/.barocss-ai/v3/wiki` (push directly) |
| private security repros | `~/.barocss-ai/v3/private-*` |
| parity tests | `packages/barocss/tests/compat/` (run with `--silent=false` under vitest 5) |
| AI kiosk demo | `examples/ai-kiosk/` (`KIOSK_GENERATOR=stub PORT=8510 node examples/ai-kiosk/server.mjs`) |

## 9. State at handoff (2026-09-27)

npm `latest` is 0.11.1. Running: #440 (the `<style>` segment leak under GC), #442 (shadow root without a nonce
violates strict CSP, a #384 regression); both go into 0.11.2. #443 kiosk flow part 1. Queued: #444 kiosk
flow part 2 (mock payment; keypad digits must never leave the client), #438 design-ceiling research, and
the rest of #431. Waiting on the owner: re-login of the `claude` CLI for the kiosk's real-model recordings
(#434), and the launch decision (drafts are unpublished).
