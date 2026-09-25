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
| Work item | `EXPERIMENT.yaml` contract | 1: model + adapter (done). 2: `.ai/work/<id>.yaml` store |
| Work DAG readiness | implicit (one slot) | 1: `work.schedule()` (done, shadow) |
| COMPUTE | EXECUTION session, self-selects mode | 2: supervisor passes the work id |
| JUDGE | Strategy §2A | 3: separate session and instruction; code disposition split from verdict |
| PLANNER | Strategy §2B | 3: wakes only on `work.schedule()` planner events; IDLE marker |
| MERGE | Strategy session | 3: mechanical, from the Judge's recorded decision |
| concurrency | 1 | 4: worktree + port allocation, then 1 → 2 → 3 |
| lifecycle / runtime status | `run`, `status`, `release` | alongside 2–4: PAUSE/RESUME/STOP control file, status view |

## Slice 1 (this change): Work DAG scheduler in shadow, serial

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

## Success criteria

Slice 1 (met):
- all Phase 1/2 tests and the V1 replay pass unchanged;
- `work.schedule()` equals `sup.RULES` on all 68 replay events and a 7,200-state V1 grid;
- live shadow on `origin/develop` agrees (`EXECUTE E-008`, mode COMPUTE);
- DAG semantics (deps, cycles, conflicts, locks, observes, slots, planner wake) are covered by pure tests;
- no change to `AGENTS.md`, contract schema requirements or Phase 2 behaviour.

Migration overall: every step replay-equal to V1 at concurrency 1 before it takes a decision; a step is
reverted by deleting its code path, and durable state stays readable by the V1 protocol.

## Next slice (2): work store + contract-addressed Compute, still serial

1. `.ai/work/<id>.yaml` holds work items in the existing contract format; `EXPERIMENT.yaml` stays as the V1
   item and is read as one more item (adapter), so an empty `work/` is exactly V1.
2. `collect_live()` loads them from develop and each item's branch; `check.py --role execution --work <id>`
   freezes that file instead of `EXPERIMENT.yaml`.
3. Phase 2 `decide()` takes `work.schedule()`'s launch list (concurrency still 1) in place of `RULES`, gated by
   the replay equality. COMPUTE launches name the work id; AGENTS.md §1 gains one line: "if the instruction
   names a work id, run EXECUTION for that contract".
