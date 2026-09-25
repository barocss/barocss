# ai-supervisor (V2 Phase 1: shadow, Phase 2: serial)

A deterministic observer of the V1 autonomous protocol (`AGENTS.md`, `.ai/`). It reads `origin/develop`,
the `ai/*` branches, PRs and required CI, then predicts the next V1 action. **It performs none of them.**
It never launches sessions, pushes, or opens, closes or merges PRs, and it makes no experiment or product
judgment. Design: `docs/autonomy-v2-design.md` §11 P1.

```bash
python3 tools/ai-supervisor/sup.py observe                     # → ~/.barocss-ai/status.json (or $AI_HOME)
python3 tools/ai-supervisor/replay.py --trace                  # replay E-001… from git + fixture
python3 -m unittest discover -s tools/ai-supervisor -v         # rule tests + replay
```

| file | what |
|------|------|
| `sup.py` | `collect_live()` (git/gh reads) → snapshot JSON → `derive()` (pure) → status JSON. The V1 precedence is the `RULES` table. |
| `replay.py` | Rebuilds a snapshot before every historical event and asserts the predicted action matches what V1 actually did next. `--record` re-records the fixture. |
| `fixtures/v1-history.json` | Only what git can't give: PR open/merge times and required-check times (PRs #106 to #119). |
| `test_sup.py` | One test per rule, contradiction and precedence edge, plus the replay. |
| `supervise.py` | Phase 2 serial supervisor (below). |
| `test_supervise.py`, `fixtures/fake_claude.py` | Phase 2 tests: pure `decide()` plus real processes against a fake `claude`. |
| `work.py`, `test_work.py` | Work DAG scheduler (PLAN / COMPUTE / JUDGE) over the legacy `EXPERIMENT.yaml` item and the `.ai/work/<id>.yaml` store; published as `status.work`, equal to V1 while the store is empty. See `MIGRATION.md`. |

## Actions

`PLAN`, `EXECUTE E-N`, `REVIEW E-N`, `MERGE #n`, `WAIT_EXECUTION E-N`, `WAIT_PLAN <branch>`, `WAIT_FOR_CI #n`,
`BLOCKED #n` (the PR to merge next has red CI), `HUMAN_REQUIRED` (contradiction or `STATE.now.blockers`).
`IDLE` is reserved: V1 has no state that means "nothing to do" (see below).

## V1 precedence (first match wins; `sup.RULES`)

| rule | when | action | AGENTS.md |
|------|------|--------|-----------|
| C0 | any contradiction | HUMAN_REQUIRED | not reachable by following the protocol |
| P1 | one open `ai/strategy-*` PR | WAIT_FOR_CI / MERGE / BLOCKED | §2B.3 |
| P2 | `ai/strategy-*` ahead of develop, no PR | WAIT_PLAN | §2B.3 |
| E1 | status `ready`, no branch | EXECUTE | §1, §3.1 |
| E2 | status `ready`/`running` on the branch | WAIT_EXECUTION | §1 |
| E3 | `done`/`blocked`, no PR yet | WAIT_EXECUTION | §3.6 |
| E4 | `done`/`blocked`, PR checks pending | WAIT_FOR_CI | §2A.2 |
| R1 | `done`/`blocked`, PR checks concluded (red counts) | REVIEW | §1, §2A |
| M1 | branch `evaluated`, `review.merged: true` | WAIT_FOR_CI / MERGE / BLOCKED | §2A.5 |
| M2 | branch `evaluated`, `review.merged: false` | PLAN (record goes on a strategy branch) | §2A.5 |
| S1 | `none`/`evaluated`/missing with `STATE.now.blockers` | HUMAN_REQUIRED | §2B.3, §8 |
| S2 | `none`/`evaluated`/missing | PLAN | §1 |

"Status" is the branch copy when develop says `ready`/`running` and the branch exists (§1.2), else develop's.

## V1 ambiguities the supervisor can't settle mechanically

1. **Liveness.** `running` on the branch looks the same whether the Execution is alive or crashed. V1 maps
   `running` to "EXECUTION" (resume), which could double-run a live session. The shadow reports
   `WAIT_EXECUTION` plus the branch's quiet time. Phase 2 needs a ledger and a timeout to decide.
2. **No idle state.** V1 Strategy always writes a contract, so `evaluated` always means PLAN. If a Strategy
   pass ever ends without a contract or blocker, the next pass would re-plan the same inputs. The shadow
   flags this when the last `.ai` commit on develop is a non-review Strategy commit. The E-001 bootstrap
   (`ai(strategy): migrate …` then `status: none`) triggers the flag, and that is correct.
3. **REVIEW, MERGE and PLAN are one V1 session.** The shadow predicts them as three steps. The replay
   matches V1 because the V1 session happens to act in that order. Launching one session per step is a
   Phase 2 choice, not a V1 fact.
4. **When to review against CI.** V1 says review reads CI but doesn't say whether to wait for it. The shadow
   waits for required checks to conclude before REVIEW. History never contradicted this: CI took about 1 min
   and every review commit landed at least 4 min later.
5. **Push time.** GitHub keeps no push times for merged branches, so replay uses commit time as push time.
   The one clock mismatch (merge commit dated 1 s before `mergedAt`) is handled by dating develop merges by
   `mergedAt`.
6. **Rejected product-code PR.** V1 has Strategy close the PR and copy the record onto a strategy branch. No
   history covers it. The shadow predicts PLAN (rule M2) and treats a closed PR on an unreviewed branch as a
   contradiction.

## Phase 2: serial autonomous supervisor (`supervise.py`)

Removes the one human action left in V1: opening a fresh Opus session and pasting the standard instruction.
The protocol itself is unchanged; the repository is the prompt.

### Lifecycle: app-scoped, not a daemon

The autonomous work runs while something the user started is running: typically a Claude App session that
runs `start` as a background task, or a terminal. It is never installed as a service.

```bash
python3 tools/ai-supervisor/supervise.py start            # autonomous work on (foreground; Ctrl-C = stop)
python3 tools/ai-supervisor/supervise.py status           # observe at any time (--refresh: read GitHub now, --json)
python3 tools/ai-supervisor/supervise.py pause            # launch nothing new; a running session finishes
python3 tools/ai-supervisor/supervise.py resume
python3 tools/ai-supervisor/supervise.py stop             # stop now; a running session is interrupted
python3 tools/ai-supervisor/supervise.py start --dry-run  # observe + decide once, launch nothing
python3 tools/ai-supervisor/supervise.py start --max-sessions 1   # canary: one handoff, then stop
python3 tools/ai-supervisor/supervise.py release 'KEY'    # re-arm a key held after retry exhaustion
```

| runner state | meaning |
|---|---|
| `RUNNING` | loop active: launches, waits for CI, or holds for attention (`activity` says which) |
| `PAUSING` | pause requested while a session runs; the session is bounded (timeouts), so it may finish |
| `PAUSED` | no session; still observing, launching nothing (`next action … → paused`) |
| `STOPPED` | no runner. Set by `stop`, by the owner exiting, by SIGTERM/SIGINT/SIGHUP, or by a runner crash |

- **Owner.** `start` is tied to its parent process (`--owner PID` to name another, `--no-owner` to opt out).
  When the owner exits, the run stops. Each session's wrapper watches the owner too, so an Opus session
  never outlives the app even if the runner dies with it.
- **Stop is safe to resume.** A stopped session is recorded `INTERRUPTED`. That costs no retry attempt, and
  the next `start` resumes from durable git/GitHub state: the same action again, or whatever the repository
  now says. `start` always means running, whatever the last request was. A second `start` is refused while
  one runs (`flock`).
- **Status** shows the runner state, the active outcome, the current experiment and its question, the mode
  of the running session (STRATEGY / EXECUTION), the Opus session (action, attempt, elapsed vs timeout,
  quiet time, latest tool call), the last result (state, transition, duration, cost, first line of the
  session's report), the next action and what the runner will do with it, CI/PR waiting and blockers.
- **Feedback** never pauses the loop. It reaches sessions the V1 way, through `STATE.human_directives`,
  which Strategy reads. The loop only waits on a human when the protocol says so (`HUMAN_REQUIRED`,
  `BLOCKED`, or a hold).
- **One supervisor per repository.** Ownership is a `flock` on `~/.cache/ai-supervisor/locks/<repo id>.lock`
  (from the passwd home, so neither `AI_HOME` nor `$HOME` moves it). The repo id is the hash of the
  canonical `origin` remote (`git@github.com:O/R.git`, `https://…/O/R` → `github.com/o/r`), or of the git
  common dir when there is no remote. Every worktree and clone of one repository therefore shares one
  lock, and different repositories run independently. The kernel drops the lock when its holder dies, so
  a crash never leaves it stuck. `<repo id>.owner.json` (pid, home, worktree, random token) only labels
  the owner: liveness is always "is the lock held right now", never a pid, so pid reuse can't fake an
  owner and nothing is ever signalled by pid. `pause`, `resume`, `stop` and `status` find the owner through
  the lock, whichever worktree or `AI_HOME` they are typed in. Session wrappers carry the repo id, so
  `start` refuses while a session of this repository from another home is still alive, and `stop` ends
  it (found by its token).
- **Notifications.** The runner tells the user without being asked. Each event goes to
  `$AI_HOME/events.jsonl` (last 5 shown by `status`) and, on macOS, to a desktop notification. Events: a
  session started or ended (with the next step), the first CI wait on a PR, every new hold (urgent, with
  a sound: `needs you: …`), and pause/stop. Waits and holds are announced once per change, not once per
  poll. `--no-notify` keeps only the file.
- **Human approval for product code** (`STATE.human_directives`, 2026-09-25). A `MERGE #n` whose PR comes
  from a contract with `allowed.product_code: true` holds as `human_approval` until the PR carries the
  `human-approved` label or an approving review. Only then is a fresh session launched to land it.
  Evidence-only PRs merge as in V1. Sessions push with the user's GitHub account, and GitHub doesn't let
  an author approve their own PR, so the label is the approval for now. With a separate bot account, an
  approving review would do.
- **Lanes** (`start --concurrency 2`). Several sessions at once, one per slot: slot n works in its own clone
  (`$AI_HOME/workspace`, `workspace-1`, …) and gets ports `5200 + 100n … +99` (`$BARO_PORT_BASE`, also named in
  its instruction). Only COMPUTE parallelizes; at most one Strategy session (REVIEW/PLAN) runs at a time, and
  items with overlapping writes or a shared `locks` entry never run together. A Planner is woken for an empty
  lane only when `STATE.now.lanes` marks it `backlog`. `--concurrency 1` (default) is the serial loop, unchanged.
- Control goes through `$AI_HOME/control.json` (what the user wants), and the runner reports in
  `runner.json` (what it is doing). Both live outside git.

### Loop

Loop: observe (Phase 1 `collect_live` + `derive`) → `decide()` (pure) → wait, hold, or launch one
`claude -p "<standard instruction>" --model opus --permission-mode auto` (the mode V1 sessions ran in) in
`$AI_HOME/workspace`, a plain clone reset to `origin/develop` before every launch → monitor → re-observe → repeat. The session gets only:

> Read AGENTS.md and follow it. / Determine your mode from the durable project state on origin/develop exactly
> as §1 says. / Run one pass of that mode, then stop.

plus, since migration slice 2, the observed step (`The supervisor observed that the next step is EXECUTE E-008:
EXECUTION (§3) of E-008 only … Confirm it with §1 first. If §1 gives a different mode or work item, stop
without changing anything.`). The step comes from the Work DAG scheduler (`status.work`); the V1 `RULES` gate
it while the work store is empty, and a disagreement holds as `work_model_disagrees`. With store items
(`.ai/work/<id>.yaml`, slice 3) the scheduler alone decides. See `MIGRATION.md`.

| next action (Phase 1) | supervisor |
|---|---|
| `PLAN`, `EXECUTE`, `REVIEW` | launch one fresh session. One Strategy session still reviews → merges → plans → stops; the supervisor doesn't split it. |
| `MERGE` | no session: the supervisor runs `gh pr merge <n> --merge --match-head-commit <sha>` for a merge Strategy already decided (product code only after the `human-approved` gate; a Planner PR only if every file is under `.ai/`, else hold `merge_refused`). |
| `WAIT_FOR_CI` | wait `--poll` s and re-observe. No session is kept alive for CI. |
| `WAIT_EXECUTION`, `WAIT_PLAN` | if our last session failed and nothing was pushed since: resume (retry). If it exited cleanly: hold (`incomplete`). Otherwise someone else's session: wait; hold (`inflight_quiet`) after 180 min without a push. |
| `BLOCKED`, `HUMAN_REQUIRED`, `IDLE` | hold (attention), don't guess. |

**Ledger** (`$AI_HOME/ledger.json`, outside git): session id, key (`<next action>@<develop sha>`), action,
experiment, pid/pgid, started_at, last_activity, timeout, attempt, state `RUNNING | COMPLETED | CRASHED |
TIMED_OUT | INTERRUPTED`, exit code, the result summary, the state before and after, and the mechanical `transition` (advanced / no_progress /
incomplete / contradiction / unexpected). Each session runs under a detached wrapper that writes `exit.json`,
so a restarted supervisor adopts a live session (found by its `--sup-session` token, which also defeats pid
reuse) or settles one that ended while it was stopped. A `flock` keeps one supervisor per `$AI_HOME`.

**Failure policy.** Only process failures retry: non-zero exit, a session error result (API/overload), no
result event, a vanished process, a failed workspace setup, the hard timeout (EXECUTE 6 h, others 2 h) or 60 min without output (the
process group is killed). Budget: 3 attempts per key, backoff 120 s × n, then hold `retry_exhausted` until
the state changes or `release`. A clean exit is never retried, whatever it produced: a DISPROVEN, blocked or
INCONCLUSIVE result is a result, and a clean exit that left the key unchanged holds as `no_progress` (V1 has
no idle marker, so a relaunch would guess). The supervisor never reads a verdict, priority or evidence.

Phase 2 ambiguities: a crashed session's half-done pass (for example `done` without a PR) is resumed with
the same standard instruction, and what the fresh session makes of it is V1's call. A MERGE left behind by
a session that exited before CI turned green gets a fresh Strategy session, which has to recognise the
decided merge from the durable state.
