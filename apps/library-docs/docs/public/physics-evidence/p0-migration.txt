---
work_id: physics-world-p0-2276
artifact_type: direct-caller-transition-contract
status: ready_for_build
owner_role: independent-physics-algorithm-work
source_request: fix first-party transition scope without legacy compatibility paths
last_updated: 2026-11-02
---

# Direct transition boundaries

The complete bounded lexical corpus and direct-call candidate groups are in
`examples/physics-world-p0-2276/callers.{md,json}`. File hashes and1-based lines identify this checkout's inputs.
An import candidate is not proof that a feature ran. Pure prose, immutable evidence and frozen providers must not
be rewritten as active callers. Arbitrary computed strings, external consumers and ignored/generated bodies remain
outside the inventory's completeness claim. Every direct API cutover must additionally build its actual selected
consumer graphs before removing the prior API. No callsite is fixed by a compatibility alias.

## P1a: one existing canonical API, stronger internal commit

First separate candidate/output/accepted-commit responsibilities inside the existing rigid implementation. The
current `createPhysicsWorld(config)` is still the sole public factory in this substep; no target overload, wrapper
factory, feature flag, alternate engine or fallback is added. This is an internal preparation step, not completion
of the new public contract. Keep the P0 declarations outside `src`/exports until the actual cutover.

Stage the rigid public return copy before replacing accepted state, and prepare the replay log before advancing
its privately owned World. Both changes must preserve arithmetic, contact/joint phase order, dt/caps and original
admission. Run affected meaningful continuation and existing numerical consumers against actual source/emitted
providers. Do not use new hidden-state guarantees to relabel the historical stack/hinge result.

P1a needs only isolated Physics implementation and new verification examples. All old consumers retain the one
canonical signature, so no shared root/package map change is needed merely to prepare the transaction boundary.
P1a may complete independently while P1b remains NOT_RUN. It cannot be reported as public common-World integration.

## P1b: atomic rigid public cutover

Replace root creation with the model/options signature and `step(commands)`. Remove old `PhysicsWorldConfig`
public creation types/signatures, old per-call dt and separate raycast/overlap methods in that same slice; do not
leave aliases or overloads. Preserve primitive numeric kernels, values, admission combinations and phase order.
New model explicit fields are authored at callers, rather than inferred by an old-config converter. The canonical
constructor builds its internal numeric Body/collider records directly from the admitted model. It may reuse
numeric parsing/geometry kernels, but must not convert to an old public config and instantiate an old World behind
a new facade. There is one accepted state owner and no public or private selectable compatibility engine.

The indivisible dependency set includes:

- `packages/barocss-physics/src/{index,types,world}.ts` and affected parser/internal imports.
- `src/replay-session.ts` and `src/replay-scene.ts`: these are actual root constructors, not optional later work.
  They must build and run with the new root immediately. The old recording service can retain its sole current
  external service contract until P2, but cannot retain old root DTOs as compatibility types. Update its single
  canonical implementation. An old recording schema referring to removed config data must be directly replaced
  at this boundary; P2 cannot defer that mismatch or provide an old-format migration reader.
- `src/cad-proxy-types.ts`, `cad-proxy-admission.ts`, `cad-proxy-pose.ts` and current source-adapter consumers where
  they directly consume body input/output types. P2 does the final adapter ownership cleanup; P1b must keep the
  actual root/adapter graph type-correct. It must not hide old input inside `any`, source-only aliases or casts.
- The current source and emitted package probes in `examples/physics-scene/`, `physics-cad-scene/`, current Viewer
  host input builders, and workspace-source loading/probe graphs identified by the inventory. Only harness/API
  inputs change; Physics/Viewer numerical and display qualifications stay separate. This does not resume Viewer work.
- `apps/library-docs/samples/physics-docs.test.mjs`, its source alias and the three Physics API guides. The source
  examples and a real emitted root consumer must both run. Existing documentation receipts stay immutable.
- Current research harness entry imports/DTO construction that actually target the moving public API. Freeze
  their original input/oracle/gates first. Frozen private World implementations and evidence providers stay at
  their immutable checkpoint; do not mass-replace their source tokens. A retired execution harness must be
  explicitly removed from current execution with its historical result retained, not silently deleted to pass.

The concrete direct candidates include203 root-group files in the initial inventory, but that number includes
errors, type imports and numerical harness candidates. It is not a claim that203 factories execute. Capsule-only
root importers need export/type-resolution checks, not a compulsory functional rewrite. Dynamic loading/HTML/server
entries require their own graph check even when they contain no creation call.

Move the standalone reduced pendulum to an independent reference entry in the same root-export cutover; update
its docs and source/emitted reference consumers. It remains the same numerical model with the same receipts.
Do not replace rigid pendulum or hinge acceptance with that reduced ODE. Keep the static capsule query and kinematic controller exports unchanged in P1; only affected shared type/error
imports need updates. They remain geometric utilities without a common-World body or force exchange. Do not turn
controller state into another physical-domain World. Their historical tests remain attributed.

If a current caller outside the owned Physics/examples/docs scope requires edits, record the exact dependency and
obtain the existing owner's scoped handoff before that cutover. P1a can continue without it. No partial signature
change that leaves root/replay, CAD, cloth/fluid type imports or current build scripts broken can be called complete.

## P2: common recording and CAD service boundary

Replace old recording constructors with `createPhysicsRecorder(world)` and `restorePhysicsRecording(...)`, including
step0 attachment, exclusive advancing ownership, shared prepared commit, copied serialization and exact identity.
Update the `./replay` entry and every active replay consumer together. Do not retain `createPhysicsScene`,
`createPhysicsReplaySession`, `restorePhysicsReplaySession` or an old-snapshot migration as aliases.

CAD adapter output becomes numerical body/collider input plus a separate binding. Current source text/revision is
explicit at mapping/admission. `./cad-proxy` can remain a module boundary for optional CAD dependencies; it never
creates/steps a numerical World. Keep the numerical root graph free of CAD parsing/native objects. Update the
adapter tests and actual emitted/source graphs. Do not alter original off-origin or stale-source gates.

## P5: remove domain factories at their actual model transition

For each domain, introduce the common-World model profile and directly update current callers, then remove its old
runtime factory in the same bounded slice. Existing domain factories may remain the sole canonical API for their
unmigrated domain before that slice; they may not coexist with a common-World replacement for the same domain.
There is no old/new selector.

| Current entry / files | Transition |
|---|---|
| `/cloth`, `src/cloth.ts`, `src/cloth/world.ts` | Retain XPBD kernel, move candidate/state ownership under World, author exact measured sheet+static sphere data, update cloth probes/Viewer data hosts and remove createClothWorld. |
| `/fluid`, `src/fluid.ts`, `src/fluid/world.ts` | Retain PBF kernel and fixed arithmetic; author exact basin/particles and separate visual smoothing configuration; remove createFluidWorld after same-slice caller conversion. |
| `/fluid-cad`, `src/fluid-cad.ts`, `src/fluid/cad-world.ts` | Express its admitted static numerical box through the CAD adapter and common fluid model; remove createCadFluidWorld and this runtime subpath. Keep source-current and approximation checks at the adapter. |

Domain subpaths can export model data builders/types only if useful; no domain clock/reset/World class remains.
Remove obsolete World types, factories and runtime exports, and update both workspace/published package maps and
actual source/emitted consumers. The new recorder must either support that exact domain graph with verified
reconstruction or refuse recording for it explicitly. No fluid/cloth/rigid dynamic coupling is activated by P5.

## Shared build, evidence and ownership

`packages/barocss-physics/package.json` is the owned package-map boundary. Shared root manifests, lockfiles, CI,
release/deploy workflows and policy remain their existing owner's scope. Inventory matches there have operation
`verify-mapping-under-existing-owner`, not permission to edit or launch CI/release. Generic workspace discovery
normally needs no change. A concrete mapping change needs an exact separate handoff; do not broaden a migration
by rewriting every token matching `physics`.

Original numerical contracts, saved states, compressed recordings, source freezes, provider ledgers, prior report
files and all `evidence/` directories are immutable. New results go to fresh run IDs and named new example directories.
Original source at historical Git commits remains available as reference data, not a selectable production engine.
No snapshot migration, old-profile fallback or archive provider is reachable from the new public creation API.

After each slice: source checks → target type checks → selected actual source consumer → actual emitted closure →
failure continuation/copy/lifecycle tests → relevant docs checks. Run unchanged broad numerical campaigns only when
new source changes affect them; never infer long-time stability from API migration. Record renamed/removed entry
paths, new canonical provider identity, exact first failure, source/emitted status and outstanding owner dependency.
