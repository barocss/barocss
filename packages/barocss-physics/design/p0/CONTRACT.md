---
work_id: physics-world-p0-2276
artifact_type: frozen-common-world-contract
status: ready_for_build
owner_role: independent-physics-algorithm-work
source_request: fix common World model, state, command and failure contracts and direct caller migration before runtime implementation
last_updated: 2026-11-02
---

# Common World P0 contract

This contract and `types.ts` define the target API. They are not exported by the current package and provide no
runtime implementation. Baseline: `66df02f8e7d5a3a7ab7b8ff7a0184bf34d978713`. Existing package exports and numerical
laws are unchanged in P0. All current HOLD, NO_GO, original fixtures, tolerances, iteration caps and first failures
remain. The contract fixes implementation choices for P1/P2/P5; it does not qualify them.

The canonical implementation will have one accepted state/time owner per World. It will not delegate a host step
to separate public fluid/cloth Worlds. Kernels remain distinct. P1 initially admits rigid models only. P5 adds the
already bounded visual domains as explicit model data. Cross-domain dynamic interactions remain refused until their
own P6 profiles are specified and verified. A target type describing a domain is not admission or numerical evidence.

## Frozen decisions

| Topic | Decision |
|---|---|
| Creation | `createPhysicsWorld(model, options)`; exactly one target signature. P1 may first refactor internals under the current sole signature, but its public cutover changes all direct consumers in one buildable slice. |
| Model | Immutable, copied, versioned SI data. Native CAD objects, functions, callbacks, timers and live source watchers are excluded. |
| Step | `world.step(commands = [])` advances exactly one configured host step. No dt argument, child-domain step or hidden wall clock. |
| State | One integer step index and time `stepIndex * fixedStepSeconds`, with domain-specific outputs and identity. No fractional domain commits. |
| Reset/load | No reset method and no arbitrary setState. Create a new World from the admitted model; verified recording restore creates a new World. |
| Failure | Deterministic admission precedence; typed refusal retains all accepted continuation state and recording. Prepare output/log allocations before a non-throwing shared commit. |
| Queries | Read accepted state, return tagged results with collider identity. Unsupported query/profile combinations refuse; they never become an empty overlap or `hit:null`. |
| Recording | One exclusive advancing owner; read/query allowed through the World. No unrecorded direct step while attached. Detaching a recorder does not dispose its World. |
| CAD | Adapter compares exact current source and revision against its retained binding; numerical core sees only SI inputs and provenance. |
| Transition | Update live consumers directly. Remove obsolete factories/exports in their assigned slice. No overload, alias, compatibility namespace, fallback engine or version migration. |

## Model contract

`PhysicsModel` has exact data fields: `format`, `version`, `revision`, `frame`, `units`, `gravityMps2`, `bodies`,
`colliders`, `joints`, `cloths`, `fluids`, `sourceBindings`. Every array is supplied, including empty arrays. Inputs
are dense ordinary arrays and plain records with `Object.prototype`; reject accessors, symbols, sparse arrays,
custom prototypes and unknown fields before reading dependent values. No mutation of input is allowed. TypeScript
does not enforce finite values, exact object fields, array bounds or entity relationships; runtime admission must.

Units are m/kg/s/rad. Frame is explicit right-handed XYZ, with local-to-world XYZW rotation. Gravity is a world
vector; no universal CAD up axis is assumed. COM position is the body's origin. Linear/angular velocity, force,
torque and impulses are world-frame vectors. Body geometry, joint anchors and collider transforms are local.
Model inertia is about COM in body axes. There is no inferred nonzero COM offset or arbitrary inertia tensor.

IDs follow the existing qualified ASCII rule `[A-Za-z][A-Za-z0-9._:-]{0,63}`. Model entity IDs are globally unique
across bodies, colliders, joints, cloths, fluids and bindings. Particle/vertex indices are local to their entity.
References must resolve to the declared kind, and IDs are never truncated. Existing body/joint IDs and input order
must be retained where the original contract requires them; choose new distinct collider IDs without renaming a
body. A colliding legacy joint/body name needs an explicit direct caller edit, not automatic renaming.

Array order is retained. P1 preserves the current body-ID pair ordering, joint order and solver arithmetic. Contact
A/B follows that admitted body pair; collider A/B follows its corresponding owner and is not separately resorted.
Changing IDs/order is not deemed physically neutral without the required control. P3's original hinge IDs/order
and P4's saved-contact order remain immutable references.

### Bodies, colliders and joints

Bodies carry mass/inertia and initial COM state; colliders carry geometry, material, filter/sensor/CCD policy and
owner/local transform. P1 admits exactly one identity-local collider per rigid body. Extra/offset colliders and
compound-body inertia are refused. Separation in the data model does not enable compound geometry.

`primitive-com` selects the current documented primitive inertia model: sphere2mr²/5, box COM diagonal from half
extents, capsule's labelled isotropic proxy. `sphere-isotropic` retains the current sphere-only inertia override.
The profile must validate that primitive inertia uses its one admitted collider. There is no full-tensor input or
implicit CAD mass-property recovery. A static/kinematic body has no dynamic mass/inertia or initial velocity fields.
Kinematic initial velocity is zero and subsequent velocity is derived from a translation target.

Material restitution/friction and filter/sensor/CCD fields are explicit, including false/default values. Non-large
rigid profiles accept only the semantic no-filter values (category1/mask65535); other filter values remain refused.
Sensor and CCD role restrictions remain as currently admitted. Explicit false flags in the new schema represent
the old omitted semantics; they do not admit a dynamic sensor or a new CCD combination. The large profile requires
the mandatory `joints` array to be empty. The old API's rejection of a supplied even-empty `joints` field does not
apply as an omission rule to this new required-field schema; no joint is enabled by that representation change. The target has no migration from omitted fields.

Quaternions retain the current rigid norm gate1e-6 and current normalization at runtime initialization. `getModel()`
returns a copy of the admitted input values, before numerical normalization, so input identity does not silently
change. Initial public state uses the normalized runtime quaternion. Do not normalize saved inputs or signed zeros
when certifying old bitwise fixtures. Refusal of future compound geometry is not a relaxation of that norm gate.

Joint types remain fixed/hinge. Local anchors, world axis and radian limits are explicit; hinge motor is either null
or the existing bounded motor data. No two-hinge or connected-chain profile is enabled here. Preserve current
anchored/dynamic-pair/CCD combination admission, not just the parser's count ceiling. Profile catalogue is frozen
in `profiles.json`; unsupported combinations give `INVALID_CONFIG` before allocation of runtime domains.

### Cloth and fluid data, reserved for P5

Cloth has explicit rest/initial positions, initial velocities, per-vertex masses, indexed triangles, pins and ordered
distance constraints. Constraint data has no solver lambda. Lambdas belong to the candidate/solver state. P5 first
admits only the exact289-vertex/512-triangle/two-pin measured sheet and static sphere, with its eight substeps and
two projection iterations. The same numeric kernel order must be reproduced before allowing a different topology.
Pinned mass remains physical mass with an external support; zero inverse mass does not mean zero mass.

Fluid declares initial particle arrays, radii, static collider identities and visual smoothing. Its current PBF
profile uses visual unit weights and a normalized rest-density reference. No kg particle mass, calibrated density,
viscosity or pressure law is invented. P6b needs a separately specified physical mass/reaction model before two-way
coupling. `box-interior` describes the fixed axis-aligned basin, and is never admitted by rigid profiles. P5 first
admits the same256 particles, basin dimensions, static-box option and separate XSPH coefficient0.15 configuration.
Velocity decay, kernel constants, solver budgets and substep counts remain in the fixed profile, not tunable material
fields. No fluid/cloth command or particle query is added by this schema.

### Source identity and digests

Source bindings contain revision, source digest, occurrence/model identity, entity references and approximation
loss. They contain no native Surface, source parser or source text. The CAD adapter separately retains exact source
text, source centre/bounds, transform and the complete binding. `cadPose(binding,state,currentSourceIdentity)` must
receive current text and revision explicitly and compare both exactly. A source digest does not replace that exact
comparison. Core stepping a frozen old model is valid; it does not claim that the current CAD document is unchanged.
The host/adapters must reject late results for a different current revision before adopting them.

Identity has model/configuration/provider SHA-256 digests. Freeze the digest representation as `sha256:` plus64
lowercase hex digits. Model/configuration digests use a canonical typed-data encoding: null/boolean tags; strings
as UTF-8 with unsigned32-bit little-endian byte length; numbers as exact IEEE754 binary64 little-endian bytes;
arrays with tag+unsigned32-bit length and entries in source order; plain records with tag+unsigned32-bit key count
and keys in ASCII lexicographic order. Tags are one byte: null0,false1,true2,string3,number4,array5,record6. Record
keys use the same string encoding. Only admitted ASCII field names are allowed; undefined/nonfinite values refuse.
Thus -0, array order and number bits are preserved; JSON key insertion order is immaterial. Hash the complete encoding.
This is an input identity rule, not a physical oracle or a new cross-runtime bitwise trajectory promise.

The provider digest is generated by the source/emitted build's provider manifest, not caller-supplied simulation
options. It identifies actual algorithm/settings providers. A source receipt and emitted receipt each record their
actual graph; a nominal package version or source alias is not evidence of emitted closure. Digest implementation
and independent encoding vectors are P1 contract tests; no hash/runtime implementation is claimed by P0.

## State and queries

`getState()` and a successful `step()` return independent snapshots, including all nested vectors, arrays and
diagnostics. Typed-array buffers are caller-owned copies and can be changed by the caller without affecting the
World. Readonly TypeScript fields restrict assignment; they do not freeze a typed-array buffer. No input or output
shares a mutable solver buffer. Reads and queries do not advance time, clear events or wake bodies.

State always supplies `bodies`, `joints`, `contacts`, `events`, `ccdHits`, `cloths`, `fluids` and `pairStats`; unused
domains have empty arrays. Body output is runtime COM pose/velocity, not authored CAD placement. Static values are
explicit zero velocity and sleepingfalse. Initial events/contacts/CCD outputs are empty. Cloth/fluid topology and
static model data are read from the copied model; snapshots need not duplicate them.

Contacts report world points, A→B normal, positive normal impulse on B/opposite on A, and world tangential impulse
on B. Joint projection reactions and motor impulse remain numerical impulses, not calibrated mechanical loads.
No aggregate kinetic energy, stress, constraint force, pressure or conservation PASS is invented where uncomputed.
All diagnostic values are named by their actual measured quantity, not a general `physicsAccuracy` scalar.

Overlap queries return collider IDs sorted by owner body ID then collider ID. Raycasts return body+collider ID and
distance; equal distance uses the same owner-ID tie break as the current primitive query. Only supported primitive
shapes are queried; a fluid, cloth or interior-basin query is refused until a query profile explicitly admits it.
Current query bounds and1e-9 unit-direction gate remain. A query must validate the complete input before reading
candidate geometry. No public capsule/controller state is inserted as an extra physical domain. The separate static
capsule query and its kinematic locomotion controller keep their bounded geometric contracts and current exports.
They do not own a common-World body or exchange forces. A caller may use a result to author an admitted kinematic
target; that does not imply dynamic pushing, controller coupling or a second physical-domain World.

## Commands and clocks

The only P1 commands are the existing five tagged kinds in `types.ts`. At most64 dense entries per step; at most one
command per body and kind. Force/torque/impulse/angular impulse require a dynamic body. Kinematic target requires a
kinematic body and changes translation only. Unknown entities, wrong entity kind and duplicate commands refuse.
No motor/config/shape/topology editing command, angular kinematic target, cloth force or fluid emitter is implied.

Forces and torques act for that host step only. Impulses apply once. Preserve current action grouping and numerical
phase order: angular impulse+torque integration, motor drive from accepted joint angle, orientation, linear
impulse/gravity/force/position, admitted CCD, contact/joint passes, sleep/events, numerical validation. This is the
existing rigid order, not a newly selected general integrator. A missing kinematic target means no displacement and
zero derived velocity. Zero force/impulse still refuses in the current dynamic-hinge profile; allowed angular vectors
must meet its1e-12 axis gate. Box-CCD zero/nonzero angular-command distinction remains unchanged.

One World has one configured positive host dt and integer step index. `timeSeconds` is multiplication from that
index, not an accumulated floating-point sum. Domain substeps divide the host step by a fixed integer. No interpolation
occurs in the physics state; display interpolation is external. All domains reach the same accepted host boundary.
No adaptive dt or increased iterations is introduced to make a failing fixture pass.

## Failure and lifetime contract

The package retains one canonical `PhysicsError` constructor per installed graph; new common-World details extend
that error instead of creating per-domain classes. Stable fields are `code` and copied `details`, not messages.
Details contain operation, phase, reason, domain, involved IDs and accepted cursor (null at creation). A failed
candidate is not returned as partial state. Failures are held separately from physical observations and do not mutate
the last accepted diagnostics or event stream. No internal failure becomes zero force, empty collision or success.

### Deterministic precedence

The target precedence intentionally differs from some current APIs. It must be tested with combined-invalid inputs.

| Operation | Ordered checks |
|---|---|
| Create | Full data-shape/version/finite/identity checks → reference/kind checks → profile/combination/range admission → bounded allocation/initialization. No live partially created World escapes. |
| World step | DISPOSED → REENTRANT_CALL → WORLD_OWNED → remaining host-step budget → complete generic commands → domain-specific command restrictions → candidate phases → numerical validation → prepared output/record commit. |
| Recorder step | World disposed/reentrancy → active exclusive ownership → host/frame/aggregate-command budgets → complete commands → same candidate/validation/commit path. A disposed recorder refuses even if its World remains active. |
| Query/read | DISPOSED → REENTRANT_CALL (if observing a candidate) → complete query/admitted-profile checks → accepted-state computation/copy. Read/query remains allowed while a recorder owns advancing. |
| CAD adapter | Disposed owner where applicable → complete current-source/binding input shape → exact source/revision/occurrence identity → state-to-binding identity → mapping. Stale data is never guessed. |
| Restore | Complete recording shape/bounds → expected model/config/provider identity → isolated reconstruction → final comparison → ownership transfer. Dispose isolated candidate on failure. |

Within generic commands, validate shape/known kind/field finiteness for the entire array before entity-role and
duplicate checks, in input order. Input admission executes no solver. A budget failure wins over malformed commands
as in the current root World. Removing per-call dt intentionally removes INVALID_STEP from common step outcomes;
the shared error family can still use it for independent existing geometric/controller APIs until their direct transition.

`INVALID_CONFIG` covers malformed/unsupported models and profiles; `INVALID_COMMAND` and `INVALID_QUERY` cover their
specific inputs and unsupported domain operations. `WORLD_LIMIT` covers admitted step/frame/command/resource caps;
`NUMERIC_LIMIT` covers a bounded candidate failing finite/geometry/residual/model gates. `STALE_SOURCE` belongs to
the source adapter. Recording uses INVALID_SNAPSHOT/STALE_SNAPSHOT, not automatic migration. New WORLD_OWNED and
REENTRANT_CALL make exclusive/lifecycle failures explicit. These are target codes; existing runtime does not emit them.

### All-or-nothing accepted continuation state

Prepare candidates, final public return copy, diagnostics/events and any bounded recording entry before commit.
Commit by non-throwing internal pointer/counter replacement with no user callback, getter, logging or serialization
between physical and recording changes. No allocation is permitted inside that commit. A post-commit observer error
cannot be reported as a refused physical step. No observer callbacks are in the initial API.

On a typed refusal, model identity, step/time, bodies, domain arrays, contacts, event pairs, joint history, warm
impulses, sleep/island counters, accepted diagnostics and recording all remain unchanged. The next accepted step
must match a control that never attempted the refused step. There is no public rollback/setState escape hatch.
Scratch may be reused only if every later read is preceded by deterministic initialization from accepted inputs;
it must contain no retained alias to an accepted candidate buffer. Otherwise it is part of candidate-owned state.
P1/P5 tests must prove this by continuation, not merely by comparing the public snapshot after failure.

Recoverable precommit allocation failure must not advance accepted state; report a bounded resource failure when it
can be classified safely. Process termination, fatal out-of-memory, corrupted runtime and native engine failure are
outside a recoverable JavaScript API guarantee. Do not catch every exception and relabel it NUMERIC_LIMIT. Unexpected
internal errors are execution failures, preserved with their stack/provider identity; they are not physical NO_GO data.

Disposal is idempotent for common World and recorder. It invalidates all subsequent methods except repeated dispose,
releases reachable owned arrays/caches/log/model references, and does not alter caller-owned snapshots. World disposal
also invalidates an attached recorder; recorder disposal only detaches/releases the recording service. An old World
cannot resume. Garbage collection timing and OS memory return are not promised.

## Internal ownership requiring implementation work

| Current source | State / gap | Required action |
|---|---|---|
| `src/world.ts:97–110,291–301` | Bodies, contacts, joint reports, active event pairs, persistent points, sleep counters, CCD and clock commit together, but return copying occurs afterward. | Stage the complete public output before replacing accepted pointers; preserve numerical phase order. |
| `src/replay-session.ts:30–40` | World advances before frame push and count increment. | Prepare a bounded next log before the physical attempt; share a non-throwing commit path. The current private-owned World already prevents external unrecorded steps; attached-recorder ownership needs P2 tests. |
| `src/cloth/world.ts:43–54`, `src/cloth/solver.ts:22–24` | Candidate sheet shares constraint objects whose lambdas mutate. Public arrays can remain unchanged while hidden state changes. | Candidate-own lambda state or prove it is fully reinitialized scratch with no continuation influence. Current full hidden-state retention is NOT established. |
| `src/fluid/pbf.ts:10–17`, `src/fluid/neighbors.ts` | Solver owns predicted/grid/density/lambda/correction/smoothing scratch and references. | Explicit scratch lifetime and initialization audit; no failed candidate retained through a grid reference. |
| Rigid/fluid/cloth state getters | Public copy allocation follows state replacement. | Prepare copied successful reply before commit. Do not widen refusal guarantees merely by documentation. |
| Fluid/CAD-fluid dispose | Second disposal currently throws; some solvers retain initial/scratch references. | Change lifetime once during P5 direct transition, with explicit new tests; keep old receipts attributed to old behavior. |

These are source findings, not a measured physical root cause for the existing stack/hinge failures. P0 does not fix
them. No original first-failure log or physical tolerance changes because a target contract is stronger.

## Recording contract

Recording attaches only at step0; attaching to an advanced World refuses INVALID_SNAPSHOT because public state does
not contain enough hidden state to reconstruct its history. One recorder per World. It owns advancing until detach;
direct `world.step()` gives WORLD_OWNED even with empty commands. Read/query access remains available. A second attach
refuses WORLD_OWNED. Detach is permanent for that recorder; creating another recorder on an advanced World still refuses.

Store copied model/options/identity, accepted command frames with consecutive1-based indices, and final copied state.
Retain512frames and4096total commands. The new binary wire contract bounds the encoded model to128KiB
and complete recording to1MiB. These are byte limits for the new format, not a claim that the old JSON code-unit
size check is equivalent; original snapshot limits/receipts remain unchanged. No old PhysicsSceneV1/PhysicsSnapshotV1 migration; new `barocss-physics-recording` is an unreleased direct
transition. Typed-array domain snapshots are represented as dense numeric arrays in the Recording DTO. The only supported
wire codec is `serializePhysicsRecording` / `deserializePhysicsRecording`, returning/reading Uint8Array. Prefix
exactly8ASCII bytes `BCPHREC1`, followed by the canonical typed-data encoding above for the complete Recording DTO.
This preserves every finite binary64 value, including -0; raw JSON.stringify/parse is NOT a supported save/load path.
The decoder checks magic, version, byte/array/depth limits and exact end-of-input before constructing a live World;
reject trailing data, invalid tags, noncanonical key order, duplicates, truncated data, depth>32 and nonfinite numbers.
The recording DTO's format/version and runtime identity are still validated after decoding. The old JSON wire
format is refused, not auto-detected or migrated. Codec failures use INVALID_SNAPSHOT. P2 must include signed-zero
model/options/command/final-state round trips and known SHA-256/canonical-byte vectors; P0 supplies definitions only. P2 initially admits rigid recordings only; P5 extends recording only with its
actual domain closure and budgets, or refuses that profile explicitly.

Restore uses exact model/configuration/provider identity; reexecutes commands in a private new runtime; compares
final finite numbers at the existing1e-12 absolute/relative replay gate and structural/ID data exactly. On success,
return both World and attached recorder; the caller owns their lifecycle. On failure neither escapes. A changed
provider is STALE_SNAPSHOT, not an automatic cross-version replay attempt. This is log reconstruction, not checkpoint
restore or a new bitwise determinism/accuracy guarantee. Warm starts, sleep and domain history must be reproduced by
actual commands. Arbitrary state loading and partial history cannot substitute.

## Transition and validation exit

The caller inventory is `examples/physics-world-p0-2276/callers.{md,json}`. It supplies exact files/hashes/lines,
export maps, computed-path findings and a bounded lexical search rule. It is not proof about arbitrary dynamically
generated or external imports. `MIGRATION.md` fixes the atomic cutover and owner boundaries. Historical receipts,
provider freezes and oracle fixtures are preserve-only; active callers and harnesses are separate migration work.

P0 exits only when positive/negative compile consumers pass, profile limits match current sources, caller matches
are classified, generated inventory is reproducible, and the failure/ownership gaps have implementation tests assigned
in `validation.json`. A declaration's compile success is not runtime API integration or a numerical PASS. New schema,
hashing, recorder ownership and full continuation retention remain NOT_RUN until their implementation steps run.
