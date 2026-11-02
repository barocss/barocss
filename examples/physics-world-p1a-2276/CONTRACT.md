---
work_id: physics-world-p1a-2276
artifact_type: bounded-transaction-preparation-contract
status: ready_for_build
owner_role: independent-physics-algorithm-work
source_request: continue after frozen P0; prepare a single common World execution structure without compatibility paths
last_updated: 2026-11-02
---

# P1a: prepare output and recording before state commit

Parent: P0 `a81748a54c7e1ecf0915015575256e81d989f43a`. Original numerical source for the diagnostic baseline is
`66df02f8e7d5a3a7ab7b8ff7a0184bf34d978713`; the two transaction files are unchanged between these checkpoints.
Work branch: `codex/physics-world-p1a-2276`. Existing HOLD, NO_GO, old source/evidence, physical errors, point counts,
iteration caps and180s per-process guard remain. No package signature, export, source condition, dependency or
compatibility factory changes. This is internal preparation; P1b's new public model/options contract is NOT implemented.

## Allowed changes

- `packages/barocss-physics/src/world.ts`: after all existing candidate checks, build the final copied public state
  from candidates with `stepIndex+1`. Then perform the same accepted pointer/counter assignments and return that
  prepared object. Do not alter arithmetic, contact/joint phases, event ordering, integrator or admission.
- `packages/barocss-physics/src/replay-session.ts`: allocate the next frame array and next aggregate count before the
  privately owned World advances. After a successful step, replace the two prepared fields by simple assignments.
  Keep the current exclusive private-World ownership and existing admission order.
- New verification files under this directory and a bounded roadmap/status note. No old report/fixture/oracle edits.

The preparation may cost extra memory/copy time. Record the small fixed-fixture cost; do not claim general speed or
memory guarantees. No public failure hook is allowed. Unexpected exceptions remain execution exceptions; do not
catch and reclassify them as a numerical refusal. Fatal OOM/process termination is outside the tested guarantee.

## Diagnostic baseline and fixed acceptance

Before changing runtime source, run a diagnostic on the frozen two providers. A one-shot test-only hook throws a
unique sentinel at the next returned-state copy, or immediately before the current replay append. The diagnostic
must observe the old step advancing despite the thrown exception and replay state/log disagreement. Diagnostic
exit0 means the observer reproduced the bug; its fields must still say retentionfalse and alignmentfalse.

For the fixed source, use the same output-copy hook and a replay hook immediately before allocating `nextFrames`.
Instrument only the two exact source/emitted provider files. Anchors must be unique, transformed bytes and hashes
must be retained, and every other baseline numerical provider must match the frozen commit. No instrumented graph
is reported as an ordinary public-package pass.

Acceptance is exact structural equality, not a widened physical tolerance:

1. Persistent contacts:120warm steps with active support impulses and stay events. Failed next output preparation
   leaves the snapshot unchanged;20 subsequent valid steps equal an untouched control at every returned field.
2. Sleeping island:120warm steps with two sleeping spheres. Failed impulse-wake/output preparation retains the
   accepted sleeping state;20 subsequent valid steps, including that impulse once, equal the untouched control.
3. Dynamic hinge history:30warm motor steps and a nonzero accepted angle. Failed output preparation retains state;
  20 subsequent valid steps equal control, including angle and motor/constraint reports. No two-hinge GO is inferred.
4. Replay:12accepted frames, failed next log preparation, exact retained snapshot and frame log.20 subsequent steps
   equal control; save/restore/continue succeeds at the existing replay comparison gate. A separate64-command frame
   attempt at a prepared-log fault does not consume the4096-command aggregate budget. Empty frames do not consume it.

The snapshots are public projections. Continuation equality exercises warm impulses, sleep counters and joint/event
history for those exact cases; it is not proof for every internal buffer, unsupported profile or all failure points.
Cloth/fluid ownership gaps are unchanged and remain P5 requirements. The injected failure represents a recoverable
preparation exception, not a measured real allocator exhaustion or a physical contact failure.

## Ordinary consumers and numerical boundary

Run separately without any provider instrumentation against current source and actual strict tsc-emitted root+replay
closure. Reject emitted proof if any own Physics TypeScript provider is present. Compare the existing one-second
semi-implicit force/gravity solution at1e-11, copied nested state, INVALID_COMMAND/NUMERIC_LIMIT retention, disposal,
and ordinary replay restore/20-step continuation. These are software/API tests, not full-engine or hardware evidence.

Also rerun the affected existing independent continuous ballistic/rotation/impact and bounded sphere-contact tests
through actual source/emitted providers in this new evidence directory. Preserve their original tolerances. The
reduced pendulum is unchanged; do not repeat unrelated broad campaigns merely to acknowledge the change. Public
two-hinge activation and original1200-step8-box settling remain NO_GO/NOT_RUN. No body-cap increase, extra solver
iteration, display proof, physical-load claim or measured validation is part of this slice.

Fresh run IDs are required. Each process has180s timeout, bounded output, recorded command/exit/signal/UTC times and
provider/bundle hashes. Runtime tests and genuine compilation run only under the repository heavy-lane gate. Prior
runs are never overwritten and baseline reproduction is never combined with fixed passes into a physical score.
