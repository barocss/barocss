---
work_id: physics-world-p5-2276
artifact_type: scope-and-transition-contract
status: AUTHOR_ONLY_PENDING_PARENT_FREEZE_NO_RUNTIME
owner_role: common-world-domain-contract
source_request: P5 direct cloth and fluid model transition under one World transaction
last_updated: 2026-11-02
---

# Authority and exit status

Develop integration requires completion and reviewed acceptance of the whole
required roadmap, not only P5a and P5b. P4 full-stack NO_GO and all other pending
required phases block the conditional merge. P5 completion cannot bypass them.

This is a proposed P5 contract. Implementation and execution are NOT_RUN.
The inventory was read at 8cdaf2d03f3b377b2ada8686f3ec6090b5d24d8b;
this contract was authored after P4 commit9551959c488f3f688846427b408f67036e70096b.
`CALLER-INVENTORY.md` SHA256
`890999fc5a752a761da0ed7f93d2923e770541d095563b0ba238c036538c3f0c`
is the frozen caller index. P0 `design/p0/CONTRACT.md`, `MIGRATION.md`,
`types.ts`, `profiles.json` and `validation.json`, current public
`src/types.ts`, and ROADMAP P5 are the target authorities. P0 files and all
prior receipts remain unchanged. P4 COST_NO_GO remains COST_NO_GO.

Parent must freeze provider hashes, selected commands, resource/call budgets,
first-failure rules and evidence IDs before runtime. Missing proof means HOLD.
A physical, transaction, closure or cost gate failure means NO_GO for that
scope; preserve its first failing receipt. A harness repair needs a fresh ID
and a reviewed freeze. No overwrite, fallback, threshold change or automatic
extra campaign is permitted. Develop integration is conditional on reviewed
completion of the whole required roadmap, including P5a and P5b; this document grants no merge, release or execution.

# Frozen public data and selected profiles

Use existing `PhysicsModel`, `Cloth`, `Fluid`, `WorldOptions` and
`PhysicsState` types directly. Do not add a second scene or state schema.
`Cloth` includes rest/initial positions, initial velocities, physical vertex
masses, indexed triangles, pins, ordered stretch/shear/bend-distance constraints
and static collider IDs. Constraint lambdas are private mutable runtime data.
`Fluid` includes initial positions/velocities, visual-unit-weights, particle and
smoothing radii, static collider IDs and explicit none/XSPH smoothing.

Public domain positions and velocities are copied `Float64Array`s in the
existing state entries. Cloth diagnostics are structural extension/compression,
vertex penetration, pin drift and total mass. Fluid diagnostics are mean
absolute density error, p95 compression, boundary hits and obstacle hits.
Topology/pins/static collider provenance are model data, not an old scene DTO.
Source inspection found Float64Array kernel storage, not Float32Array. Preserve
actual existing storage, casts, expressions and evaluation order; do not
introduce Float32 rounding or a numerical rewrite.

| Exact profile ID | Initial P5 population | Fixed private budget |
|---|---|---|
| `cloth-pinned-sphere-visual-v1` | Exact measured17×17 sheet:289 vertices,512 triangles,pins0/16, original masses/constraints/rest data; static sphere centre[0,0.1,0], radius0.3 and profile collision offset0.002 | Host dt1/120, max240 host steps; XPBD8 substeps ×2 projection iterations |
| `fluid-basin-visual-v1` | Existing256-particle v1 admission, basin[0.7,1.3,0.5], gravity[0,-9.81,0], radius0.0125, smoothing radius0.09; no visual smoothing | Host dt1/120, max3600;3 density passes |
| `fluid-basin-xsph-visual-v1` | Existing256-particle v2 population; same basin and exact XSPH coefficient0.15; original release/high-drop fixtures | Same PBF order, followed by original XSPH stage |
| `fluid-static-box-visual-v1` | Existing v1 basin and one admitted static axis-aligned CAD-derived box; original shelf and bare comparisons | Same PBF/static-box projection order; no XSPH+box combination |

All use `broadPhase:'domain-fixed'`. Existing fluid admitted position variation,
including the shifted fixture, must remain explicit in admission/tests. Do not
silently narrow it to a single lattice or admit new particle counts, velocities,
topology, forces or tuned coefficients. Admit inert copied data before profile
inspection. Reject unsupported domain mixtures, dynamic obstacles, cloth-fluid
interaction, self-contact, general cloth topology and P6 coupling before runtime
allocation. Static collider owners do not require a dummy dynamic rigid body.
Rigid profile admission and existing rigid/contact/hinge behavior remain intact.

# One owner and one commit

Only `createPhysicsWorld(model,options)` creates a public numerical World.
Its accepted record owns model/configuration identity, rigid/domain state,
clock, guard and recorder capability. Internal rigid/cloth/fluid kernels are
functions or private stage objects, never nested public or private Worlds.
They cannot own a host clock, recorder, reset API or public lifetime.

Proposed internal interfaces (names may change only before the implementation
freeze): `admitDomain(model,options)` returns copied immutable admitted data;
`prepareDomainStep(admitted,accepted,scratch)` returns a candidate plus measured
diagnostics; `preparePublicState(candidate,identity,nextIndex)` and the existing
recorder owner prepare copied outputs/log entries; the World then performs one
assignment-only commit. Kernel preparation receives fixed dt from the common
configuration; it cannot advance a private cursor. `timeSeconds` derives from
the single committed host stepIndex. Cloth substeps are divisions of that step.

Candidate positions, velocities and mutable lambdas have no accepted aliases.
Scratch may be retained only if a complete write-before-read and reference
retention audit proves that every next call overwrites all consumed values.
Otherwise candidate-own/recreate it. This includes cloth constraint objects,
PBF predicted/combined/density/lambda/correction/smoothing arrays, grid positions,
head/tail/links and obstacle counters. Grid references to failed candidates
must not affect later work or retain accepted mutable data.

Preserve original arithmetic/loop/neighbor order, damping0.998, rest-density
initialization, three density iterations, boundary/static-box stages and XSPH
placement. Preserve XPBD rest/compliance and lambda initialization order.
No precomputed substitute result, old World invocation or changed tolerance.
Prepare validation, diagnostics, public copied state and optional recorder log
before accepted pointer/cursor changes. Any failure retains accepted public and
hidden continuation state, identity, time and log. Unknown thrown values remain
unknown; do not classify every kernel/allocation Error as NUMERIC_LIMIT.
Common guard/error precedence, ownership and idempotent disposal apply once.
Disposal releases owned reachable buffers; no OS/GC guarantee is asserted.

Initially these visual profiles accept empty step command arrays only. Keep the
common command union and inert admission; refuse unsupported commands and
queries explicitly under the frozen common error precedence. No particle
query, emitter, moving collider, reset or dt argument is added.

# CAD boundary

Read source interfaces: `fluid/cad-admission.ts:admitCadFluidObstacle(scene,
sourceText,request)` returns `{proxy,box}` without constructing a World. It first
requires v1 fluid plus a static/box request, calls `admitFluidScene`, then calls
`cad-proxy-admission.ts:admitCadSurfaceProxy`. It computes `inflatedBoxBounds`,
checks particle-radius basin margins and rejects initial-particle overlap via
`insideStaticBox`. Generic surface admission alone does not supply these fluid
restrictions. `cad-world.ts` separately calls `assertCadProxyCurrent(proxy,
current.sourceText,current.currentRevision)` before its old inner step.

Define one data-only surface/static-model adapter under the existing optional
CAD service boundary. Reuse the actual current admission/geometry functions
above, preserving their box inflation, basin/overlap checks, source identity,
approximation and loss labels. Adapt inert common-model fluid input into these
checks without exposing the old scene or World API. Its output is copied static
body/collider/source-binding data plus the admitted proxy token needed for the
existing currentness service. It has no World, clock, step, reset or recorder.
No new service or parallel geometry implementation is introduced.

The caller must call the actual existing `assertCadProxyCurrent` with that
proxy and current source/revision immediately before each World advance
(including a recorder-owned advance). Stale-source refusal leaves World and
recorder untouched without a hidden World call. Numeric root closure excludes
CAD parsing, native CAD, Viewer, source text watchers and live service imports.
Static projection is not two-way reaction or pressure.

# Recording decision and immutable caps

The existing shared recorder registry and step0 ownership rules apply. Do not
add a domain recorder/clock. P2 limits remain encoded canonical model128KiB,
complete recording1MiB,512 frames and4096 aggregate commands. World model
digest support for a larger canonical model does not imply record admission.

Before any domain recording admission, a per-profile DATA-only size and schema
gate measures the exact
copied model with the existing canonical codec and freezes bytes, digest,
provider and selected fixture. The cloth's1566 ordered constraints may exceed
128KiB; its size is not yet measured and no PASS is assumed. Test exact limit
boundaries without raising caps. If a profile cannot satisfy model or complete
record budgets, recording must explicitly refuse that profile using the frozen
recording error contract, before attachment/state change. Ordinary non-recorded
World support can still qualify separately. Document each profile as either
qualified recording support or explicit tested refusal; no implicit schema.

The common `PhysicsState` remains the existing Float64Array-bearing runtime
state. It is not falsely assignable to the dense-array recording wire shape.
For admitted recording only, introduce a serializable `RecordingState`
representation or mapped type within the existing Recording DTO as P0 requires;
map runtime domain typed arrays to dense numeric arrays there. This is not a
second World state, scene or codec. Validate that exact schema before admitting
the profile. Preserve finite binary64 and signed zero,
use BCPHREC1 canonical binary wire, validate bounded shapes and IDs, and restore
through exact model/configuration/provider plus command reconstruction. Scratch
is not serializable public state. Prove actual source and native root/replay
share one owner registry; record/restore/continue/copy/ownership/limit failures
are atomic. Keep the existing replay1e-12 absolute/relative gate unchanged.
Count actual hidden constructors/steps from restore and wire helpers in the
frozen runtime budget. Never claim independent accuracy from replay parity.

# Two slices and direct removal

P5a extracts internal candidates and establishes retained old-profile numerical
and failure baselines. It may retain old public entrypoints only while this
slice is an unadopted preparatory change. No new public domain admission or
compatibility facade is introduced. Preserve original baselines and prove
candidate ownership before public cutover.

P5b is one atomic public transition: common World admission, state/commands/
recorder decision, every active caller and generated consumer, export maps and
docs move together. Remove `createClothWorld`, `createFluidWorld`,
`createFluidWorldWithObstacle`, `createCadFluidWorld`, old World/scene/state
runtime DTOs, reset and step(dt) APIs. Remove the three Viewer globals named
`createPhysicsClothWorld` in native-scene-replacement, qualified-face and shell.
No aliases, overloaded old constructor, dt bridge, hidden World facade, dual
API switch or source fallback remains. Host reset means dispose/recreate a
common World; display scheduling remains external. Remove obsolete runtime
subpaths from workspace/publish maps; any retained data-only subpath needs an
explicit preimplementation decision. Retire exact stale emitted factory files
because tsc does not delete them; never delete historical provider evidence.

`MIGRATION-PLAN.json` assigns module responsibilities and all21 verified direct
caller files plus indirect entry graphs. No new dependency, download, service,
root lockfile or unrelated Viewer lifecycle work is needed.

# Quantitative and integration gates

Freeze old criteria/provider/receipt SHA256 before any baseline or candidate
trial. Existing hashes, residual thresholds, sample steps and cost gates stay
unchanged. The source `fluid-release-criteria.mjs` remains the exact hash table
for bare/shelf step60/240 and v1/v2 release/high-drop step60/240/720; preserve
all entries, not only the final frame. Its stricter bare density gates0.25 at60
and0.05 at240, retained heap≤1MiB and relative visual/CAD cost≤1.5 remain.
Cloth original spike comparison1e-12, projection controls1e-15, structural
extension≤0.10, vertex penetration≤1e-6, exact zero pin drift, mass0.2±1e-14,
sampled triangle loss≤0.002 and public CPU p95≤1000/120ms stay unchanged.
Original archived hashes and receipt bytes remain historical evidence, not new
observations. Full encoded/raw array equality at archived checkpoints must be
reported independently from residual comparisons. No signed-zero normalization.

Add whole-host rollback and next-valid-step equality against a never-failed
control for mid-kernel, diagnostics, public-copy and log-prepare failures;
include failed aliases/scratch/lambda/grid paths. Verify guard precedence,
input/getter isolation, state/model copies, unsupported commands/queries,
limits, lifecycle and stale-source retention. Every supported selected profile
needs continuous source and genuine native emitted runs at its declared proof
horizon with one clock;240 or720 steps cannot claim3600-step stability. Budget
and authorize any larger horizon separately before running it.

Strict source/native consumer types, actual published maps/declarations,
canonical error/owner identity, CAD-free numerical import closure, no legacy
factory/global tokens in active consumers, updated computed loaders and docs
compilation are separate required gates. Browser product proof is separate and remains NOT_RUN unless an actual
browser scope is authorized and executed. No CAD Studio or Viewer UI work is
requested here; no release is implied. CPU/type/bundle proof does not substitute
for browser proof. Select existing leaf tools; the broad fluid release
runner installs/builds unrelated packages and is not authorized here.

This is a migration and failure-ownership claim for bounded visual profiles.
It is not a calibrated material/CFD/pressure/viscosity, hardware throughput,
new physical accuracy, cross-domain reaction or P6 coupling claim.
