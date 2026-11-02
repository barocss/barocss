# G1e public admission and API range audit

Status: READY for parent review; static inspection only. Canonical adoption: HOLD.
Inspected checkout: `codex/physics-world-p5-2276`, HEAD `2435ae21cf3b1fd65b4d70fdbe2c1caabb698031`.
This report changes no production source, numerical code, build output or test.

## Decision

Use an explicit, BREAKING physical-support predicate in the existing rigid profiles.
Keep one `createPhysicsWorld(model, options)` and one numerical World. Do not add
an integrator flag, caller-selected numerical method, second World or fallback.
Reject an unsupported dynamic anisotropic box at construction, including a box
initially at rest. A later load, contact or motor can otherwise reach the same gap.
Do not infer qualification from successful Newton convergence or finite output.

The smallest safe first adoption is a finite single-rotor subset of
`rigid-discrete-v1` with `broadPhase:'direct'`. Retain existing isotropic semantics
where the current inertia model is isotropic. Reject unsupported anisotropic
dynamic boxes in `rigid-persistent-box-v1` and `rigid-large-v1` as well.
Static and kinematic anisotropic boxes do not need this new dynamic restriction.
This is a proposed admission decision, not a claim that the subset is implemented.

## Existing contract and actual gap

`src/types.ts:100-109` exposes three rigid profile names and numeric fixed steps.
`src/model-admission.ts:49-76` admits dt `[1/240,1/30]`, mass `[1e-6,1e6]`,
world angular components `[-1000,1000]` and unit quaternions within `1e-6`.
`src/validation.ts:50-53,113-129` admits each box half extent `[0.0001,1000]`
and derives primitive COM moments. It normalizes admitted quaternions.
`src/world.ts:211-243` applies angular impulse plus dt times torque through
world inverse inertia, then advances q with unchanged world omega. That free
flow is insufficient for a general anisotropic box.
The G1b staged helper's dt, derivative and momentum checks are numerical bounds.
Its fixed momentum unit does not establish physical accuracy over all inputs
that pass those checks. Nor does dt <= 1/60 cover the existing dt <= 1/30 API.

## Concrete admission predicate to freeze before implementation

Keep the current exact schema, IDs, units, local-collider, body and joint checks.
Then classify each dynamic body's actual authored geometry and derived inertia.
Use exact admitted equality to identify an isotropic box; do not add an epsilon
that converts an unequal-inertia body to an isotropic body.
For an anisotropic dynamic box, require an entry in a frozen physical-support
catalog. The catalog must specify mass, ordered half extents, authored q and
world omega, dt, initial position/velocity, gravity, scene topology, permitted
loads and accepted step horizon. Do not use a test name or model revision as
the support decision. Entity IDs and provenance need only satisfy normal schema.
Use the complete finite transformed input records, not a claim of all rotations.
Record exact binary64 operands and the authored-to-normalized-q mapping.

Initial proposed public range: only mass 1, h `[.1,.2,.3]`, q identity,
omega `[1,1,1]`, dt 1/120 and one step. Even this needs actual-root proof.
The following prior leaves are candidates for later admission, not automatic
initial API support. The forced three-dt/0.1 s range must pass before expansion.

| Leaf | Physical operands / finite bound | Further scope restriction |
| --- | --- | --- |
| Triaxial free | mass 1; h `[.1,.2,.3]`; omega `[1,1,1]`; original q; three paid dt values; 0.1 s | Copy exact dt, q and step counts from authenticated G1b inputs. |
| Axisymmetric free | mass 1; h `[.1,.1,.2]`; omega `[1,0,1]`; 1 s | Copy exact q and dt from authenticated G1a inputs. |
| Finite frame cases | The eight G1c physical input records | Admit only those transforms; no continuous SO(3) support claim. |
| Principal kick | mass 1; h `[.1,.2,.3]`; q identity; initial omega zero; dt 1/120 | Step 1 Jz=1/64 and tauz=1/8; step 2 empty; two steps only. |
| General recorder | Same triaxial box; omega `[1,1,1]`; dt 1/120 | Empty commands through two steps; saved one-frame replay/continuation. |
| Nonprincipal loads | J `[1/1024,-1/2048,1/4096]`; tau `[1/128,-1/256,1/512]` | NOT_RUN; test zero, pure J and J+tau; tau acts over every positive interval. |

Each anisotropic leaf requires its qualified single-body topology, no joints,
contacts, CCD, sleep or visual domains, unless separate evidence explicitly
qualifies these features. Do not graft a qualified rotor into an arbitrary scene.
A finite catalog is conservative. A useful continuous mass/shape/spin envelope
needs a separate range argument and independent samples; it is not derived here.

## Refusal, precedence and atomicity

Creation: finish ordinary model parsing first, then reject unsupported physical
configurations with `INVALID_CONFIG`; do not return a partially admitted World.
Step: preserve current DISPOSED/reentrancy, recorder ownership and existing
World/recording budget precedence (`world.ts:160-180,435-451`). Parse commands
before the new load policy. Reject a well-formed load outside the supported leaf
with `INVALID_COMMAND`, before candidate numerical work and recorder preparation.
After command admission, reject advancement beyond the physical horizon with
`NUMERIC_LIMIT`; this limit expresses missing physical support, not extra budget.
Validate candidate support before integration, after actions/motors, and after
constraint/contact work where applicable. Refuse a numerical escape with
`NUMERIC_LIMIT` before public output/recording preparation and shared commit.
Preserve accepted q, omega, clock, contacts, events, caches, sleep and recording.
Keep raw unknown errors unchanged. Do not replace existing first-failure receipts.
Restore must use the same constructor and per-step predicate. Changed provider
identity must refuse stale recordings under the existing replay identity checks.

## Affected first-party callers and fixtures

| Path under repository root | Static impact / required treatment |
| --- | --- |
| `examples/physics-scene/oriented-colliders-probe.mjs:12` | Dynamic h `[.2,.1,.1]` collision becomes unsupported; record explicit breaking refusal. |
| `examples/physics-scene/thin-box-ccd-probe.mjs:10` | Dynamic anisotropic CAD box with CCD becomes unsupported; preserve old contact receipt. |
| `examples/physics-world-p1b-2276/public.test.mjs:154` | Constructs World with dynamic CAD h `[.05,.02,.03]`; constructor becomes refused. |
| `examples/physics-world-p2-2276/public.test.mjs:119` | Constructs World/recorder with that dynamic CAD box; constructor becomes refused. |
| `apps/library-docs/samples/physics-docs.test.mjs:165-174` | CAD conversion/pose only; no World here, so preserve this test and document the separate admission limit. |
| `examples/physics-cad-scene/cad-proxy-probe.mjs:8-18` | Dynamic sphere and static anisotropic box; no restriction from anisotropic dynamics alone. |
| `examples/physics-scene/persistent-box-probe.mjs:11` | Dynamic cubes; retain prior physical scope and prove affected canonical behavior. |
| `examples/physics-scene/box-point-probe.mjs:7` | Dynamic cubes; do not convert to refusal just because they are boxes. |
| `examples/physics-scene/rotation-probe.mjs:11` | Sphere rotation and inertia override; no general anisotropic claim. |
| `examples/physics-scene/large-scene-probe.mjs:8-19` | Sphere population and static floor; no anisotropic-dynamic restriction alone. |
| `examples/physics-scene/app.js`, `examples/physics-scene/release-consumer.mjs`, `examples/physics-cad-scene/model.js`, `examples/physics-viewer-scene/app.js` | Sphere dynamics plus static boxes; retain geometry. |
| `examples/physics-rigid-rotation-g1{,b,c,d}-2276/` | Historical copied providers stay immutable; canonical qualification needs new actual-root receipts. |

Migration: preserve old affected probes and FAIL receipts with their original
shapes and assertions. Add separately named refusal checks for their exact
inputs. Report old acceptance probes as expected BREAKING FAIL until their
contracts are explicitly retired; do not hide the failure by replacing a shape.
The public P1b/P2 CAD tests need this split; keep independent CAD pose assertions
using inert admitted proxy data without constructing an unsupported World.
Static/cube/sphere caller families above retain their prior contracts. No broad
repository or browser PASS is implied by this targeted source inventory.

## Public mapping and adoption obligations

No new package export is required. Keep public `RigidBody`, `Inertia`, commands,
`WorldOptions`, `Identity` and `PhysicsErrorCode` shapes. Add the physical limits
to their comments, package README, user reference and served examples. Clearly
mark reduced admission as BREAKING. Do not silently alter old sample geometry.
If a named bounded physical profile is preferred, add it to `RigidProfileId`,
`WorldOptions`, admission and docs, and still reject unsupported anisotropy in
all old profiles. It buys an explicit label, not wider qualification; it costs
more API changes and migration than the existing-profile predicate.

After authorized source adoption, run the package's actual `build:library` path:
source provider generation, tsc, root bridge build, emitted provider generation.
Keep new admission/helper imports reachable in both root provider graphs. Pin
source/emitted manifest bytes and digests; never hand-edit generated manifests.
Check root and replay module graph ownership, source/emitted parity, malformed
input precedence, off-range creation/load/horizon refusal and recorder rollback.
Qualify the canonical admitted leaves against independent physical references.
Preserve HOLD/NO_GO records, original tolerances and first failures unchanged.
Current NOT_RUN: G1e nonprincipal load proof, canonical implementation/build,
canonical physical/regression/recorder checks, browser/product validation,
remote publication and deployment. No release or deployment is authorized here.
