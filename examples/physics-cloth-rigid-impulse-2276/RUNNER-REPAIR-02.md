---
work_id: physics-cloth-rigid-impulse-2276
artifact_type: narrow-runner-static-repair
status: AUTHOR_READY_HIGH_REVIEW_REQUIRED_NO_EXECUTION
owner_role: runner-validator-implementation
source_request: repair only R1 R2 R3 from CAMPAIGN-STATIC-REVIEW
last_updated: 2026-11-02
---

# Boundary

The original runner files remain in commit27736b631. The original NO_GO review
remains unchanged in commit105769198. This repair changes only the authorized
runner, validator, plan and READY plus this new report. Candidate, oracle,
CONTRACT, CASES and old review bytes are unchanged. No module evaluation,
fixture conversion, reference, candidate, build or World call occurred.

# R1: traversal lifetime and charge

WorkingBound now uses a class-owned static _visit method. It creates no nested
recursive function or closure cell that can retain a previous identity set.
check uses finally on success and error: clear seen, clear scratch, release
borrowed roots and the last loop root, then delete the scratch containers.
No later cyclic-GC collection is needed to release these containers.

The unchanged8MiB limit includes payload and serialization charges, the1MiB
fixed physical/encoder reserve, and the live traversal allocations. Before each
new identity enters seen, the walker charges existing identity integers plus
the incoming integer using sys.getsizeof, the scratch dict,4096bytes per active
frame, and5times the current set allocation. The latter covers simultaneous
old1x and bounded new4x table growth before allocation. Actual active set/ID/
frame charges remain included after insertion. Nodes50000 and depth32 remain
unchanged. The peak includes growth preflight. This is the documented logical
owned-data envelope; no interpreter/tool heap or RSS claim is added.

# R2: approved report/state component checks

Only two physical gate call sites change. Reported point/rigid/angular impulse
components now call gate(reported,stateDerived). Reported before/after energy
and dissipated energy now call gate(reported,stateDerived). Both use the
existing exact component bound e+e*abs(stateDerivedTarget), e=1/10^12.

Report-to-ideal and state-to-ideal gates remain unchanged. True P/L balances,
attachment residual and energy/work/objective invariants retain their frozen
before/after scales. No epsilon, tolerance, equation, case or call count changes.

# R3: original oracle failure prefix

Before an oracle PID starts, zero requests means NOT_STARTED. At observed PID
start, the actual request total becomes null with SPAWNED_UNAVAILABLE, not0.
Failure recovery first verifies the pre-spawn derived authorization bytes and
all frozen oracle source/input pins. It reads only ordinary files in the fresh
owned oracle directory. Each captured original file receives an exact byte/SHA
pin and a raw byte-for-byte copy; no JSON reserialization replaces it.

A valid final summary must match the oracle run ID, authorization hash, input
pins and bounded count protocol. It remains authoritative. If it is absent or
unreadable, the original bounded progress file supplies only durable lower-bound
counts. Actual total and in-flight work remain UNKNOWN. If neither can be read,
the spawned request total stays null/UNKNOWN. Known progress is never relabelled
as a final PASS. Read/authentication/copy failures are separate recovery errors;
the original campaign firstFailure remains unchanged. If a bounded raw copy
cannot be made, its original artifact pin/path and the copy error remain; the
original oracle file is never overwritten. No retry or extra reference occurs.

# Static verification

One heavy-gated repair check passed: Node22 --check; Python AST parse/compile
without module evaluation; no nested function inside WorkingBound; explicit
finally releases; exact source comparison against27736b631 after removing only
the WorkingBound class shows exactly the two approved gate substitutions and
no other physical-code change. Runner overlay function and the complete source/
native candidate call loops are byte-identical. PLAN ledger and bounds are
identical to the original. Candidate/oracle/authority/READY bytes match the
original commit. Optional DATA lifecycle/fallback executions were NOT_SELECTED.
No passed runtime prefix or parent noEmit prerequisite was repeated.

# Frozen providers for new review

- examples/physics-cloth-rigid-impulse-2276/impulse-run.mjs: a0ace9403124294433cbe345ab465c6772dc0649a708d4eb2f13ad8fe2d65585
- examples/physics-cloth-rigid-impulse-2276/native-validate.py: b67f5ae8b6f5b8b9efe389c1dcb72771b68108bc039cba0b2295d1cc63210094
- examples/physics-cloth-rigid-impulse-2276/RUNNER-PLAN.json: baf07b5973eb8daccc475cf494c761151540008649a08b602b859de83705d1d6

High review and a new explicit parent execution freeze are still required.
All numerical gates, source/native parity, fault outcomes and measured resource
maxima remain NOT_RUN. Future ledger remains50attempts/30candidate solves,
23reference requests/26physical validators/29direct child starts/0World.
