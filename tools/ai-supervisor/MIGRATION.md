# Migration: V1 + Phase 2 → Planner / Work DAG / Compute / Judge

Target loop: state change → deterministic Supervisor asks "what semantic computation is due?" →
fresh Opus context (PLAN | COMPUTE | JUDGE) → bounded result in git → context destroyed → state change.
The Supervisor never decides priority, experiment design, ownership, verdict or evidence sufficiency.

## Current system (audited 2026-09-25)

| piece | what it proves | keep |
|---|---|---|
| `AGENTS.md` + `.ai/` (V1) | frozen contract, fresh contexts per mode, Strategy-only accept/merge, evidence levels, gates; E-001…E-007 ran on it | unchanged |
| `.ai/check.py` | contract freeze + write scope, deterministically | unchanged, plus optional-field types |
| `sup.py` (Phase 1) | pure `derive()` reproduces every V1 transition (replay, 68 events) | unchanged `RULES` |
| `supervise.py` (Phase 2) | serial launcher, ledger outside git, process-only retries; canary REVIEW E-007 → advanced | unchanged |

V1's structural limits for the target: one global slot (`EXPERIMENT.yaml`), so the unit of scheduling is
"the experiment", not a work item; Judge and Planner are one Strategy session (§2A → §2B); no IDLE marker;
no dependencies, locks or conflict model; runtime resources (ports, dev server) are implicit.

## Mapping

| target | V1 today | slice that changes it |
|---|---|---|
| Work item | `EXPERIMENT.yaml` contract | 1: model + adapter (done). 3: `.ai/work/<id>.yaml` store (done) |
| Work DAG readiness | implicit (one slot) | 1: `work.schedule()` (done, shadow). 2: the supervisor decides from it (done) |
| COMPUTE | EXECUTION session, self-selects mode | 2: launch names mode + work id, session confirms via §1 (done) |
| JUDGE | Strategy §2A | 4: own pass that stops at the recorded review; merge decision separate from verdict (done) |
| PLANNER | Strategy §2B | 3: writes store contracts with deps/locks, may write none (done). 4: own pass, durable IDLE marker (done) |
| MERGE | Strategy session | 4: mechanical, by the supervisor, from the recorded decision + human-approval gate (done) |
| concurrency | 1 | 5: worktree + port allocation, then 1 → 2 → 3 |
| lifecycle / runtime status | `run`, `status`, `release` | #125: START/PAUSE/RESUME/STOP, status view, one runner per repo (done); #127: notifications |

## Slice 1: Work DAG scheduler in shadow, serial

`work.py` is a pure scheduler over work items. `from_snapshot()` is the V1 compatibility adapter: V1 is a
DAG of at most one item whose write scope always includes `.ai/EXPERIMENT.yaml`, so any two V1 items
conflict and V1 is serial by construction. `sup.derive()` now runs the scheduler at concurrency 1 and
publishes it as `status.work`. It decides nothing: Phase 1 `RULES` still produce `next_action`, Phase 2
consumes that unchanged, and any disagreement becomes `attention: work_model_disagrees`.

Item fields (only what the scheduler reads): `id, outcome, branch, status` (V1 statuses), optional
`depends_on, locks, observes, priority`; write scope = `allowed.paths` + contract file + `.ai/evidence/<id>/`.
Item states: `READY, RUNNING, CI, JUDGE, MERGING, UNRECORDED, DONE, INVALID`.

Readiness: READY, all `depends_on` DONE, no conflict with an active item (RUNNING/CI/JUDGE/MERGING) or an
item picked in the same round (overlapping writes, shared lock, writes ∩ observes), and a free slot.
Launch order: MERGE → JUDGE → COMPUTE (priority, then id) → PLAN. Planner wakes only for: a rejected result
to record, a DAG only it can fix (unknown dependency or cycle) once nothing else can progress, or no open
work. Idle slots never wake it. Planner output landing (a strategy PR) blocks new launches.

Not built yet, on purpose: a `.ai/work/` store, protocol text for the new fields, Judge/Planner session split,
IDLE marker, mechanical merge, concurrency > 1, worktree/port allocation, PAUSE/RESUME/STOP, dashboard.
None of it has a consumer until slice 2 changes who reads the contract.

## Slice 2: the scheduler decides, launches are addressed, still serial

- `supervise.view_of()` takes the step from `status.work` (the scheduler), not from Phase 1's `next_action`.
  The V1 `RULES` become a gate: if the two disagree, `decide()` holds `work_model_disagrees` and launches
  nothing. Ledger keys are unchanged (`<step>@<develop sha>`), so existing ledgers keep counting attempts.
- Each launch is `STANDARD_INSTRUCTION` plus the observed step, e.g. *"the next step is EXECUTE E-008:
  EXECUTION (§3) of E-008 only: run that one frozen contract. Confirm it with §1 first. If §1 gives a
  different mode or work item, stop without changing anything."* A COMPUTE context is handed one contract
  instead of choosing work, and MERGE names the decided PR (Phase 2 ambiguity: a merge-only session had to
  infer it). §1 stays authoritative, so `AGENTS.md` needs no change; the planned "§1 gains one line" is
  replaced by the instruction's own confirm-or-stop guard.
- The ledger records `mode` (PLAN / COMPUTE / JUDGE / MERGE); `supervisor.json` shows buckets and planner state.

## Slice 3: work store, still serial (first protocol change)

- New contracts go to `.ai/work/<id>.yaml`, same format as `EXPERIMENT.yaml`. The legacy slot finishes its
  contract (E-008) and is never reused, so E-008's flow is unchanged. An empty store is exactly V1.
- `AGENTS.md` §1: a session takes the step its instruction names, or else `sup.py observe --out -`'s `work next`,
  reads that contract (branch copy while ready/running), and confirms the step against its status or stops.
  §2B: the Planner writes store contracts, more than one only for independent questions, declaring
  `depends_on`, `locks`, `observes`, `priority`; writing none is valid (idle). §2A/§3: `check.py --work <id>`.
- `check.py`: every store file is a full contract (id = file name, ids and branches unique across all
  contracts, outcome known); `--role execution --work <id>` freezes that file and scopes writes to it.
- `sup.py` loads the store from develop and each item's branch; the committed `check_work` runs as structure.
  Store branches aren't stray PRs, and a Planner branch may land while store work runs (V1 contradiction relaxed
  only when the store is non-empty).
- `work.from_snapshot()` returns legacy + store items. Store items can't have `done`/`blocked` on develop or
  `running` without a branch (INVALID → HUMAN_REQUIRED).
- The V1 gate (`agrees_with_v1`) applies only while the store is empty; with store items it is `None` and the
  scheduler alone decides. Items interleave in one serial lane: while one waits for CI or review, the next
  independent contract can run. The model already schedules concurrency 2; the supervisor stays at 1.

## Slice 4: Judge / Planner split, IDLE, mechanical merge, still serial

- **Judge.** A REVIEW pass ends at §2A.5: it records the review on the experiment branch, pushes, and stops.
  It neither merges nor plans. The verdict (`review.accepted_verdict`) and the merge decision (`review.merged`)
  are separate questions in the protocol text: PROVEN with the implementation discarded, and PARTIAL with a
  demonstrated part merged, are both expressible. No new field was needed; `merged` already is the disposition.
  A rejected result's record is copied onto develop by the next Planner (§2B.0), which the scheduler already
  wakes for (`UNRECORDED`).
- **Planner.** A PLAN pass that finds no question worth a contract writes `STATE.now.idle_since` (the develop
  sha it planned from) and `idle_reason`. `sup.idle_view()` keeps the marker valid only while the strategic
  inputs at that sha equal today's (VISION, STATE except `now`, every contract). Any judged result, contract,
  directive or knowledge change wakes the Planner. With a valid marker and no open work, the scheduler says
  `IDLE` and the supervisor holds `idle`. `check.py` validates the two fields.
- **Merge.** `MERGE #n` is no longer a session. The supervisor runs `gh pr merge <n> --merge --match-head-commit
  <sha>` (exactly the head the decision saw), after #127's `human-approved` gate for product code, only while
  running (a pause or stop during observation wins), and refuses a Planner PR with a file outside `.ai/`
  (`REFUSED` → hold `merge_refused`). A failed merge is a retryable failure under the same budget. Merges
  are ledger records (`kind: merge`) and notify like sessions.

## Success criteria

Slice 1 (met):
- all Phase 1/2 tests and the V1 replay pass unchanged;
- `work.schedule()` equals `sup.RULES` on all 68 replay events and a 7,200-state V1 grid;
- live shadow on `origin/develop` agrees (`EXECUTE E-008`, mode COMPUTE);
- DAG semantics (deps, cycles, conflicts, locks, observes, slots, planner wake) are covered by pure tests;
- no change to `AGENTS.md`, contract schema requirements or Phase 2 behaviour.

Slice 2 (met): all tests and the replay pass; `decide()` takes every Phase 2 test world from the scheduler with
`agrees_with_v1` true; a disagreement holds; live `run --dry-run` on `origin/develop` gives `EXECUTE E-008`,
mode COMPUTE, launch, with the addressed instruction.

Slice 3 (met): replay and the 7,200-state grid still equal V1 (empty store); store items run the whole
READY → RUNNING → CI → JUDGE → MERGING → DONE lifecycle in the scheduler; dependencies across store files,
invariants, the relaxed gate and addressed launches are tested; `check.py` is tested against a throwaway git repo
(structure errors, `--work` freeze and scope); live dry-run on develop still gives `EXECUTE E-008`.

Slice 4 (met): all tests (Phase 1, replay, work, Phase 2 process/lifecycle/ownership/notifications) pass;
a decided merge runs `gh` and launches no session (fake `gh`), is held by the approval gate until labelled,
blocked by pause, refused for a Planner PR outside `.ai/`, retried then held on failure; the IDLE marker holds
only while strategic inputs are unchanged (throwaway git repo) and yields `IDLE` → hold; replay unchanged.

Migration overall: every step replay-equal to V1 at concurrency 1 before it takes a decision; a step is
reverted by deleting its code path, and durable state stays readable by the V1 protocol.

## Next slice (5): concurrency 2, still one Planner

1. Per-session worktrees (one per work item branch) instead of the single `$AI_HOME/workspace`, and per-session
   runtime resources: a port range per slot handed to the session in its instruction, so contracts stop
   hard-coding `5173`. Contracts declare `locks` for anything still shared.
2. `decide()` takes up to N launches from `work.schedule(concurrency=N)`; the ledger already records one
   record per session. Start at N = 2 only after a replay-style test shows two independent items (disjoint
   writes, no shared lock) run without touching each other's worktree, port or branch.
3. The Planner and Judge stay one at a time; only COMPUTE parallelizes first.
