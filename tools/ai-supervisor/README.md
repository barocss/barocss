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

```bash
python3 tools/ai-supervisor/supervise.py run --dry-run          # observe + decide; no launch, ledger untouched
python3 tools/ai-supervisor/supervise.py run                    # loop, at most one session at a time
python3 tools/ai-supervisor/supervise.py run --max-sessions 1   # canary: one handoff, derive the next action, stop
python3 tools/ai-supervisor/supervise.py status                 # last decision + recent ledger records
python3 tools/ai-supervisor/supervise.py release 'KEY'          # re-arm a key held after retry exhaustion
```

Loop: observe (Phase 1 `collect_live` + `derive`) → `decide()` (pure) → wait, hold, or launch one
`claude -p "<standard instruction>" --model opus --permission-mode auto` (the mode V1 sessions ran in) in
`$AI_HOME/workspace`, a clone reset to `origin/develop` → monitor → re-observe → repeat. The session gets only:

> Read AGENTS.md and follow it. / Determine your mode from the durable project state on origin/develop exactly
> as §1 says. / Run one pass of that mode, then stop.

plus, since migration slice 2, the observed step (`The supervisor observed that the next step is EXECUTE E-008:
EXECUTION (§3) of E-008 only … Confirm it with §1 first. If §1 gives a different mode or work item, stop
without changing anything.`). The step comes from the Work DAG scheduler (`status.work`); the V1 `RULES` gate
it while the work store is empty, and a disagreement holds as `work_model_disagrees`. With store items
(`.ai/work/<id>.yaml`, slice 3) the scheduler alone decides. See `MIGRATION.md`.

| next action (Phase 1) | supervisor |
|---|---|
| `PLAN`, `EXECUTE`, `REVIEW`, `MERGE` | launch one fresh session. MERGE too: only Strategy merges (AGENTS.md §6). One Strategy session still reviews → merges → plans → stops; the supervisor doesn't split it. |
| `WAIT_FOR_CI` | wait `--poll` s and re-observe. No session is kept alive for CI. |
| `WAIT_EXECUTION`, `WAIT_PLAN` | if our last session failed and nothing was pushed since: resume (retry). If it exited cleanly: hold (`incomplete`). Otherwise someone else's session: wait; hold (`inflight_quiet`) after 180 min without a push. |
| `BLOCKED`, `HUMAN_REQUIRED`, `IDLE` | hold (attention), don't guess. |

**Ledger** (`$AI_HOME/ledger.json`, outside git): session id, key (`<next action>@<develop sha>`), action,
experiment, pid/pgid, started_at, last_activity, timeout, attempt, state `RUNNING | COMPLETED | CRASHED |
TIMED_OUT`, exit code, the state before and after, and the mechanical `transition` (advanced / no_progress /
incomplete / contradiction / unexpected). Each session runs under a detached wrapper that writes `exit.json`,
so a restarted supervisor adopts a live session (found by its `--sup-session` token, which also defeats pid
reuse) or settles one that ended while it was stopped. A `flock` keeps one supervisor per `$AI_HOME`.

**Failure policy.** Only process failures retry: non-zero exit, a session error result (API/overload), no
result event, a vanished process, the hard timeout (EXECUTE 6 h, others 2 h) or 60 min without output (the
process group is killed). Budget: 3 attempts per key, backoff 120 s × n, then hold `retry_exhausted` until
the state changes or `release`. A clean exit is never retried, whatever it produced: a DISPROVEN, blocked or
INCONCLUSIVE result is a result, and a clean exit that left the key unchanged holds as `no_progress` (V1 has
no idle marker, so a relaunch would guess). The supervisor never reads a verdict, priority or evidence.

Phase 2 ambiguities: a crashed session's half-done pass (for example `done` without a PR) is resumed with
the same standard instruction, and what the fresh session makes of it is V1's call. A MERGE left behind by
a session that exited before CI turned green gets a fresh Strategy session, which has to recognise the
decided merge from the durable state.
