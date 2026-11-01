---
work_id: physics-stack-solver-2276
artifact_type: frozen-private-world-adapter-contract
status: ready_for_build
owner_role: independent-algorithm-work
source_request: substitute the certified candidate in the preserved private World
last_updated: 2026-11-01
---

# Private cold normal World adapter

This new test-only adapter substitutes the complete velocity solve in a
temporary esbuild graph. No existing source file is written. The target is
the original private eight-box World, initially ALIGNED. First-frame source
qualification passed before this extension. Genuine emitted first-frame
qualification and the parent source freeze are still required before a new
World campaign. Existing HOLDs and original physical gates remain in force.

## Source substitution

`transformGlobalIslandSource(source,adapterModulePath)` requires the original
global-island.ts SHA256
`670f5226576cb0a2c1963705b99704be71d4ebd3ad38c312adf9c16d43781d8d`.
It requires exactly one original solve-method start and one following
position-method comment, checks their order, and inserts one helper import.
The entire old solve() method, including initialization, warm starts and64
point sweeps, is replaced. Constructor geometry, patch/point order, frozen
normals/witnesses, the original full-pair position phase and reference-world
source are unchanged. The transform returns input/output/replaced-block
SHA256 and byte counts plus anchor counts for the parent's receipt.

The parent esbuild plugin calls this function only for that exact source
path and provides the absolute path to this new world-adapter.ts module.
The caller must assert exactly one transform activation. The runner must
record the returned transformed source/hash and actual bundle provider graph.
The helper import must resolve to the same module instance used by the entry
to register its observer. Source transformation is an explicit experimental
change; it is not a claim that the old World has adopted this solver.

## Velocity helper and restricted profile

`solveFrozenNormalIsland(bodies,patches)` receives all original working
bodies and every original assembled patch/point. It supports exactly eight
dynamic1kg boxes with half extents[.25,.25,.25], inverse local inertia exactly
[24,24,24], restitution0 and friction1/.7, plus the original static floor.
It supplies exact world inverse inertia24I for these isotropic cubes; no
quaternion normalization, tolerance relaxation or matrix symmetrization is
used. The floor has zero motion/inertia, half extents[2,.1,2] and its original
fixed pose. Body IDs and contact IDs remain opaque.

Every actual point becomes one candidate row. Candidate IDs are compact
JSON([originalPairKey,originalPointId]); original IDs, family and order are
retained in the mapping and old point ledger. More than32points is a profile
refusal. No row selection, merging or truncation is allowed. There is one
cold candidate call per admitted island and no warm impulse application.
The candidate's fixed64total-QR limit and all existing gates remain unchanged.

Candidate success is necessary. Additionally, every loaded row (lambda>0)
must have reported tangent speed<=1e-10m/s and the zeroTangentFeasible flag
must be true. The adapter recalculates point relative velocity and loaded
tangent speed directly from returned body velocities, using the same fixed
normal gate. If any loaded row fails, refuse that World attempt with
NUMERIC_LIMIT. Do not silently continue as frictionless dynamics. No fallback
solver, friction coefficient change, tangent row omission or retry follows.
Unloaded rows retain zero impulse. The original nonzero friction parameters
are admitted only where zero tangent impulse is feasible; general friction
contact remains unsupported.

All guards and the observer run before the helper changes working body
velocities. Accepted output changes only v/omega. It creates a complete old
point ledger with warm0 and final normal lambda/tangent0, and a point map
using the original cache keys. The original downstream position/report code
then runs unchanged. Cache values may be reported but are never read as warm
seeds on the next step. Old globalSweeps/pointUpdates remain0. coldPoints is
the full point count; compatibility tests/reuse remain0. Candidate work is
reported separately; it is not represented as old point sweeps.

## Per-attempt observation

`setNormalIslandObserver(callback|null)` registers a synchronous callback
and resets attemptOrdinal to0. Each solve attempt increments it once and
emits a detached event with problem, candidate result, original point mapping,
velocitySolveAccepted, assembled point/patch counts, and refusal details. The
parent added these count-only diagnostics before the first adapter run, so
profile refusals also disclose the full count without dropping rows. The parent associates this with
its current World step/scene. One island call per attempted step is required.
The observer may perform independent validation and throw before mutation.
Unknown observer throws propagate. A velocity-accepted event does not prove
that the subsequent position phase or World transaction is accepted.

Candidate NUMERIC maps to PhysicsError NUMERIC_LIMIT; candidate work refusal
maps to ITERATION_LIMIT. Profile/tangent refusal maps to NUMERIC_LIMIT.
Every refusal preserves the previous accepted World state through the old
working-copy transaction. No observer event or source receipt overrides a
physical first failure. The parent owns bounded execution, source/emitted
provider assertions, independent per-step checks and trajectory acceptance.

No author test, build, import or numerical call occurs before parent freeze.
These two files are frozen after READY; the parent owns all actual runs.

## Emission preparation failure

world-emitted-01 refused during strict TypeScript emission before any World
or candidate call. Its type-only PointLedger import followed the old private
position solver graph, which has missing MJS declarations and unknown-error
type failures. That failed receipt remains. The parent replaced only that
type import with an identical local structural reporting DTO before the next
fresh attempt. No runtime algorithm, transform, gate or old file changed.
The old position-source graph has not thereby passed strict compilation.
