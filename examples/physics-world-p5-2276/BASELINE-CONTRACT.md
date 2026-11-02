---
work_id: physics-world-p5-2276
artifact_type: current-provider-failure-baseline-contract
status: AUTHOR_ONLY_NOT_RUN_PENDING_PARENT_FREEZE
owner_role: bounded-domain-baseline-harness
source_request: reproduce old return-copy failure semantics and common domain profile refusals
last_updated: 2026-11-02
---

# Scope and authority

No baseline has run. This contract authorizes no numerical execution. Parent
must review/freeze this contract, runner and provider manifest, acquire its
existing heavy gate, and explicitly authorize each fresh receipt ID. Source
must PASS and be reviewed before emitted execution. Any unexpected failure
stops the campaign; do not continue to another graph or retry automatically.
Keep every failed receipt. This is a current-provider failure baseline, not
P5 implementation, independent new accuracy, stability, CFD or browser proof.

The worktree moved from inspected inventory HEAD8cdaf2d03 to P4 checkpoint
9551959c4 then9b16f1ab4 and branch codex/physics-world-p5-2276. Production was
reported unchanged since P3; manifest pins actual current bytes, not that report.
Frozen inventory/scope/plan remain unchanged. Current types already have
`RecordedState = Serialized<PhysicsState>`; use this existing representation
in later P5 recording work rather than inventing another alias. Current replay
conversion/validation still explicitly refuse domains. No record admission or
record model size is tested here.

`BASELINE-PROVIDERS.json` freezes exact source/emitted Physics and CAD trees,
package maps, runner/contract, shelf input and old authority/probe receipts.
Every listed byte/hash and exact tree population is authenticated before any
provider import/call, again before trials and after trials. Source esbuild
onLoad rejects inputs outside the frozen set. No package source/build/generated
manifest mutation, dependencies, download, broad release runner or service.
Parent must also record the manifest hash externally to avoid self-reference.

# Exact source semantics and fault ownership

Cloth `cloth/world.ts:step` prepares candidate arrays/diagnostics, assigns them,
increments stepIndex, then calls getState; getState first copies positions via
`sheet.positions.slice()`. Fluid does the same with `this.positions.slice()`.
CAD `fluid/cad-world.ts:step` checks current source, advances the actual inner
fluid World, then calls its own getter. Outer getState obtains inner copied
state and spreads it into a new DTO. Failure there occurs after inner commit.
These are source facts, not yet executed baseline results.

The isolated overlay inserts a per-instance hook at the first position-copy
expression in cloth/fluid getState and at the outer CAD getter's inner-copy /
spread preparation expression. It throws an exact preallocated Error once at
that expression. No Array/typed-array prototype/global allocator is patched.
This is a synthetic return-copy/preparation failure, not proof of real OOM or
a platform allocation-failure guarantee. The exact exception object must escape.
Constructor-entry, step-entry, actual cloth-solver/PBF entry and cursor-commit
counters are test-only hooks;
no arithmetic expression, iteration count, admission, timing or physical bound
is changed. Source/emit transform anchors must occur exactly once or preflight
fails. Inactive hooks copy normally. Three World modules plus cloth/solver and fluid/pbf entry-only counters are
transformed; the two kernel counter sites run before the first solver statement (cloth) or the
first PBF obstacle-counter reset (after its local boundaryHits initialization).

All faults are armed after both independent Worlds are constructed and an
unarmed step0 state is copied. They target the chosen instance, never a control.
A failed public step is expected to throw yet leave cursor1/time1/120 accepted.
Harness success is PASS_REPRODUCED_KNOWN_ATOMICITY_NO_GO, never an atomicity
PASS. Its state must equal the never-failed control's first accepted state exactly,
including typed-array element signs and diagnostics. Next target/control steps
must both reach2 and compare exactly. This deliberately records the old atomicity
gap, rather than labeling it successful rollback. First unexpected exceptions,
known first injected exceptions and before/after/next cursors remain separate.

# Finite population and actual call ledger

Each graph runs exactly five cases in this order: cloth; fluid v1; fluid v2
XSPH0.15; CAD v1 inner-fluid copy fault; CAD v1 outer-return-copy fault. Every
case has a fresh faulted World and a never-failed control, uses only dt1/120,
empty legacy external inputs beyond the required current-source argument, and
advances two accepted kernel states per World. No reset, query, recording,
restore, hidden serialization constructor or diagnostic extra trial.

Fixtures exactly follow existing cloth-world-probe and fluid-world/visual/CAD
shelf probes: pinned-sheet-sphere-v1 cloth scene;256 fluid particles in z4/y8/x8
loop order with [0.2+x*0.05,0.45+y*0.05,0.3+z*0.05], basin[0.7,1.3,0.5], gravity
[0,-9.81,0]; optional exact XSPH0.15; existing shelf file, shelfRev1/static-box
request. Current source checks remain live for every CAD step. No new initial
geometry, coefficient, force, random input or source mutation.

| Per graph | Fixed expected count |
|---|---:|
| Public legacy factory attempts/returned Worlds |10/10 |
| Actual constructors, including inner fluid and CAD wrapper |14:cloth2,fluid8,CAD4 |
| Public step attempts/returns |20/15 |
| Total actual step method entries (includes CAD inner calls) |28:cloth4,fluid16,CAD8 |
| Actual cloth solver / PBF step calls |4/16 |
| Actual numerical cursor commits (CAD wrapper has no separate cursor) |20 |
| Synthetic copy/preparation throws |5 |
| Explicit top-level cleanup attempts/completions |10/10; CAD cleanup invokes4 inner disposals |
| Common factory profile-refusal attempts/returned Worlds |4/0 |

Two graphs total28 constructors,56 step entries,40 numerical commits,
8 cloth solver and32 PBF calls,40 public step attempts,30 public returns,
10 synthetic throws and8 rejected
common factory attempts. Common World is a factory closure, not a class:
rejected creation attempts are counted explicitly rather than mislabeled as
constructed live Worlds. No numerical step follows a rejected common factory.

Four common options use exact frozen planned IDs and domain-fixed broadphase.
The submitted model has valid outer fields and empty entity/domain arrays.
Current profile dispatch must throw canonical root PhysicsError INVALID_CONFIG
with `profile is not implemented`, before body/domain validation. This proves
current profile refusal only; it does not claim a complete valid P5 fixture or
that later domain-shape parsing ran. The four IDs are
cloth-pinned-sphere-visual-v1, fluid-basin-visual-v1,
fluid-basin-xsph-visual-v1 and fluid-static-box-visual-v1.

# Providers, evidence and guard

Source: one esbuild ESM graph from actual current root and old three entrypoints,
with only the described onLoad overlay. CAD resolves to its actual frozen source.
Emitted: unbundled actual copied Physics/CAD dist trees, using current published
root dist/index.js and original old domain dist entries. Three copied World files plus the two kernel entry-counter files receive the
same bounded overlay; arithmetic remains unchanged. A staged CAD export bridge resolves
the copied native CAD root; no source fallback or CAD rebundling. No current
package dist file is overwritten. Numerical-root CAD-free closure is not claimed
for this combined legacy baseline (legacy CAD-fluid intentionally imports CAD).

Node22 required. CLI (NOT_RUN), after parent approval/heavy gate:
`node baseline.mjs --run-id FRESH --graph source --authorize-baseline`
and, only after reviewed source PASS, a separate emitted invocation with fresh ID.
Node process.execPath is reused by the isolated child. Parent supplies its
explicit installed Node22 binary and normal repository guard.

The async outer guard starts180000ms at child spawn; detached census group is
owned. Timeout/output overflow sends TERM then KILL after1000ms, then a bounded2000ms post-KILL close/reaping wait. PASS requires pipe EOF,
process close and owned-group absence, not merely child exit. Deadline remains
active until finalization; cleanup is separate from the180s runtime allowance. Only that group is targeted. stdout+stderr combined
cap4MiB. Native provider copy cap32MiB; source bundle cap16MiB; case evidence
cap4MiB; durable progress is small and written at actual entry/commit counts.
Immutable start/case/refusal/summary/exit files use exclusive creation; only
progress.json is explicitly a replaceable live counter. No receipt overwrite.

Case records retain raw host typed-array bytes as hex and SHA256 for before,
after,next/control, exact equality results, diagnostics and first thrown Error.
Little-endian host is required for this raw evidence label; no JSON numeric
round-trip or zero normalization replaces array authority. Summary reports actual
counts and failures. Timeout receipt points to existing progress/summary and
never invents completed calls. Cleanup continues only for already-owned Worlds.
Resource/IO/build/import failures are harness FAIL, not numerical correctness.

No tolerance is widened. Exact state equality is the migration-failure baseline;
original cloth/fluid hash/residual authorities remain pinned unchanged and are
not rerun or relabeled here. Full-horizon accuracy, original benchmark/cost
campaign, recorder size, strict declarations, browser, CAD Studio/Viewer UI,
P5 implementation and whole-roadmap integration remain NOT_RUN/pending.
