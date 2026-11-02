---
work_id: physics-api-roadmap-2276
artifact_type: architecture-and-development-roadmap
status: p5_done_bounded_localselected_p4_no_go
owner_role: independent-physics-algorithm-work
source_request: redesign the unreleased Physics library and reorganize its roadmap; preserve HOLD, NO_GO and first failures
last_updated: 2026-11-02
---

# Physics library design and roadmap

## Decision and scope

Use one public simulation World for one physical scene. Keep rigid, cloth and fluid numerical solvers separate
inside that World. Give the World one frame, gravity definition, entity identity space, accepted clock and commit
boundary. Replay records that World. CAD code admits numerical inputs and binds results to a source revision.
Neither replay nor a CAD adapter is a physical domain.

The common root implements the P0 model/options/state contract for the admitted rigid and fixed visual
profiles. P2 owns attached recording for supported rigid models; P5 moves cloth/fluid state under the common
World. Selected source and native runtime checks pass. Remaining consumer/document gates, dynamic coupling,
original full-stack exit and connected mechanisms remain separate; this is not whole-engine or release qualification. The frozen [P0 contract](design/p0/CONTRACT.md),
[target types](design/p0/types.ts), [direct migration scope](design/p0/MIGRATION.md) and
[validation requirements](design/p0/validation.json) define the boundary. The design files remain design artifacts;
the current package runtime exports only implemented capabilities. See the P1b checkpoint below for exact evidence limits.

The initial product is a renderer-neutral numerical library for bounded CAD and mechanism experiments. Visual
fluid and cloth models can be useful, but their evidence class must stay visual until separately validated.
The design does not promise a general engineering multiphysics solver. Hardware, manufacturing acceptance,
Studio implementation and external simulator adoption are outside the current independent work.

The package is unreleased. Change first-party callers directly when the new API is implemented. Do not add a
`legacy` namespace, old/new mode switch, silent fallback, compatibility factory or duplicate execution engine.
Retain old source and first failures in immutable Git/evidence records, rather than executing both APIs in production.
The retired Motion package stays retired. Robot kinematics and prescribed-motion loads remain in CAD Model.

Existing Physics, Studio and manufacturing HOLDs remain. This roadmap is not an instruction to resume their owners,
activate an unsupported profile, deploy, publish or run hardware. The owner separately authorized a develop
merge after the whole required roadmap passes; that condition has not been met. Work continues in the independent
branch with explicit owned paths. No dependency or security-setting change is proposed in this slice.

## Historical source baseline: the apparent worlds have different roles

Baseline: `db84f1e17833fbdb140de953e1efb538da7ed865`. Paths below are relative to this package.

| Entry at this baseline | Actual ownership | Consequence |
|---|---|---|
| Root `createPhysicsWorld` | Rigid bodies, joints, contact, queries, candidate state and configured clock (`src/world.ts`, `src/types.ts`) | It is currently a rigid World, not a multiphysics World. |
| `/replay` | `RecordedPhysicsSession` creates one root World and records accepted commands (`src/replay-session.ts:12–40`) | It is a recording/session layer, not another solver. Its scene schema contains only `PhysicsWorldConfig`. |
| `/fluid` | Separate particle state, PBF solver and step counter (`src/fluid/world.ts:12–28,50–75`) | It shares no rigid identity, collision graph or accepted time. Gravity and basin parameters are profile constants. |
| `/cloth` | Separate sheet state, XPBD solver and step counter (`src/cloth/world.ts:9–54`, `src/cloth/profile.ts`) | Its static sphere is not a rigid entity; it cannot transfer a reaction to one. |
| `/fluid-cad` | CAD source admission plus the existing fluid solver with static box bounds (`src/fluid/cad-world.ts:15–18,46–55`) | It is a source-bound adapter, not fluid–rigid coupling. The solver sees no dynamic body to receive a reaction. |

The public factories also disagree on lifecycle: fluid and CAD fluid call `active()` in `dispose()` and refuse a
second disposal; rigid, cloth and the reduced pendulum dispose idempotently. Rigid has no reset; fluid and cloth
reset fixed scenes. Replay takes commands without a dt argument, while numerical worlds take dt. These are facts of the named historical baseline. P1b changes the rigid root and recording scene inputs; separate cloth/fluid lifecycle remains until P5.

Calling independent `rigid.step()` and `fluid.step()` in sequence cannot create a shared physical scene. If the
second call refuses, the first may already have advanced. There is no combined rollback, shared contact law or
opposite reaction. A facade that merely loops over today's worlds would conceal this defect in meaning.

## Comparison with other libraries

Official documentation was read on 2026-11-01. This comparison informs the architecture; no external runtime was
installed or executed and no foreign solver is selected as a dependency.

| Library and source | Relevant pattern | Lesson for this design |
|---|---|---|
| [Rapier JavaScript 0.21 soft bodies](https://rapier.rs/docs/user_guides/javascript/soft_bodies/) | Soft and rigid bodies can be inserted into one World; constraints interact with scene contacts and joints. | A shared World can own different physical representations. This does not imply BaroCSS already supports them. |
| [Rapier serialization](https://rapier.rs/docs/user_guides/javascript/serialization/) | Snapshot and restore operate on a World. | Recording and restore belong to simulation state, rather than a separate kind of physical world. |
| [PhysX 5.4.1 particle systems](https://nvidia-omniverse.github.io/PhysX/physx/5.4.1/docs/ParticleSystem.html) | A particle system and its buffers are distinct objects; the system is added to a PxScene. That version deprecates particle cloth in favour of FEM cloth. | Internal solver/state separation is normal. Do not copy a deprecated cloth API or require its CUDA backend. |
| [Project Chrono SPH coupling](https://api.projectchrono.org/classchrono_1_1fsi_1_1sph_1_1_ch_fsi_system_s_p_h.html) | Separate multibody and fluid systems are joined by an explicit FSI interface, coupling scheme and combined step. | Separate solvers are also valid when the exchange and synchronization contract is explicit. |
| [MuJoCo simulation](https://mujoco.readthedocs.io/en/stable/programming/simulation.html) | Model description and runtime data are distinct; a step advances their associated simulation. | Separate immutable model input from mutable simulation state. This is not evidence for a fluid feature. |

There is no universal requirement for one numerical solver. The design choice here is a single public owner of a
scene's accepted state, with explicit solver and coupling contracts beneath it. The recommendation is an inference
from the source gaps and these documented patterns, not a claim of API compatibility with those engines.

## Target ownership

| Layer | Owns | Does not own |
|---|---|---|
| `PhysicsModel` | Immutable SI physical entities, shapes, materials, joints, source bindings and initial state | Runtime clocks, UI controls or native CAD objects |
| `PhysicsWorld` | Admitted model, selected support profile, accepted state/time, commands, queries, transactional stepping and disposal | Rendering, file/network I/O, arbitrary solver plugins |
| Internal solvers | Domain arrays, integrator, constraints and domain diagnostics | Independent public clocks, hidden CAD imports or a second public World |
| Coupling implementation | Supported entity-pair interactions and equal/opposite exchange, within a fixed phase order | An implied all-domain interaction matrix |
| Recording service | Accepted command log, model/runtime identity, checkpoint/restore checks | Another time source, a second solver, hardware accuracy claims |
| CAD adapter | Source revision, occurrence identity, mm/MMGS conversions, explicit approximation and display mapping | Advancing physics or changing CAD/history during a failed step |
| Viewer / Studio | Displayed cursor, controls and user workflow | Simulation truth or physical validation |

Keep optional entry points for data builders or adapters when they avoid unnecessary CAD dependencies. An import
subpath is a module boundary, not a reason to create a second simulation owner. Start with explicit internal domain
implementations; a general plugin framework, generic event bus and configurable solver graph are not needed now.

### Physical inputs and support profiles

Separate the physical model from solver settings and qualification evidence. A cube's mass or a sheet's topology
belongs to the model. Time step, numerical caps and an admitted coupling scheme belong to a support profile.
Measured error and provenance belong to a receipt. Do not embed a unique demo scene as the entire definition of a
general `cloth` or `fluid` API.

Start with the already supported literal fixtures. Generalizing their model input requires independent boundary
and physical checks before widening admission. A larger body cap is not a qualified profile. Public support must
name the complete combination: topology, shapes, dynamic/static roles, joints, contact law, dt range and budgets.
Reject incompatible domain combinations before any runtime state is created; do not silently simulate them apart.

All dynamic quantities use metres, kilograms, seconds and radians in a declared right-handed frame. Gravity is an
explicit world vector; there is no universal CAD up axis. Use XYZW local-to-world quaternions. Specify COM, inertia
frame and parallel-axis conversion, and contact normals A→B with opposite signed impulses. Convert CAD mm/deg/MMGS
only at adapters. Public Robot facade units remain its existing degrees/mm contract.

Stable entity IDs cover rigid bodies, colliders, cloths, fluids and joints. Particle/vertex indices are local to
their owning entity, not interchangeable global body IDs. A collider has an owner, local transform and geometry
identity. Source revision, model digest and approximation loss stay with a CAD binding; parsing a CAD source must
not be required by the numerical core.

### Current rigid API and recording services

The rigid root and attached recording service use these current signatures:

```text
createPhysicsWorld(model: PhysicsModel, options: WorldOptions): PhysicsWorld
  options: fixedStepSeconds, profile, broadPhase

world.getModel()                  -> copied immutable model description
world.getState()                  -> copied accepted state, all admitted domains, one stepIndex/time
world.step(commands = [])         -> copied state after exactly one configured host step
world.query(request)              -> result from accepted state only
world.dispose()                   -> idempotent; subsequent operations refuse DISPOSED

createPhysicsRecorder(world)      -> recorder with exclusive advancing ownership; attach at step0
restorePhysicsRecording(recording, {model, options, providerDigest}) -> {world, recorder}
serializePhysicsRecording(recording) -> Uint8Array with BCPHREC1 magic
deserializePhysicsRecording(bytes) -> copied validated recording

admitCadSurfaceProxy(source, request) -> current: numerical collider/body input + source binding + explicit loss
cadProxyPose(proxy, bodyState, currentSource, currentRevision) -> current: display transform after exact source/revision checks
```

The World stores dt once. Callers cannot advance individual domains independently. An application owns wall time;
there is no internal animation timer. Integer host step indices determine accepted simulation time. Domain solvers
may use profile-fixed integer substeps, but publish only the common host boundary. Do not infer temporal accuracy
from all domains reporting the same time.

`PhysicsState` keeps domain-specific fields and diagnostics; do not flatten particles into rigid bodies or invent
rigid torques for an XPBD correction. The CAD adapter receives complete current source text and revision as `currentSourceIdentity`; it compares them
with the binding's admitted identity. The numerical core cannot discover CAD freshness. The detailed discriminated
types, query variants and bounded allocation plan
are the first implementation contract, not frozen signatures in this sketch. No arbitrary `setState()` is planned.
For reset, construct a new World from its admitted model. Recording restore follows its verified reconstruction
path. Do not retain domain-specific reset semantics in the common API.

A recorder must prevent unrecorded direct steps while attached. It reads only completed accepted commits and appends
the matching commands exactly once. It preflights the next indexed command frame and log budgets before any physical candidate executes. After
candidate calculation, it prepares the returned state copy, final recording state and complete bounded encoding
before the nonthrowing shared commit. World state, hidden caches, clock and the prepared recording commit together. No serialization, callback or further admission check may fail between those
commits. Observer failures after a completed commit are reported as observer errors, never as a refused physical step.
Disposing a recorder detaches it and releases its recording/options references; World disposal remains owned by its
creator. These ownership checks do not establish garbage-collection timing or recovery from out-of-memory failure.
Restore creates a new World and validates profile, model, source revision, solver/runtime identity and log budgets.
Distinguish replay-by-reexecution from exact checkpoint restore. Checkpoints would need warm impulses, XPBD lambdas,
sleep/island state, RNG state and all other history-dependent data. Until that state is specified and tested, expose
only verified log reconstruction. A replay tolerance or byte match is never physical validation.

### One accepted step

1. Validate model freshness, complete commands and remaining budgets before mutating any accepted data.
2. Construct candidate buffers from accepted state, including every mutable solver cache.
3. Execute the profile's documented integration, collision, constraint and coupling phases. Choose the phase order
   by the physical model and independent verification. Do not invent a common loop that changes the qualified rigid
   phase order, projection timing or arithmetic without new evidence.
4. Check finite values, contact geometry, joint limits, conservation/work residuals and profile-specific gates.
5. On success, commit all domains, caches, diagnostics, events, clock and any prepared recording entry together
   through the exclusive step controller. On refusal, expose the previous accepted state/time; keep failure details
   separate from physical results. A diagnostic must identify the failing phase/domain/profile.

Copy-on-candidate buffers are the first bounded implementation. Their cost must be measured. Generic rollback across
today's opaque worlds is rejected: they expose no complete hidden-state restore. Factor numerical kernels only where
needed to support the transaction; do not wrap their public `step()` calls and claim atomicity.

### Explicit interaction matrix

One World must either implement a declared interaction, or refuse the combination. Disabled interactions require
an explicit profile rule; they cannot be an unnoticed consequence of separate factories.

| Pair | Current fact | Target qualification order |
|---|---|---|
| Rigid–rigid | Bounded primitive contacts; original stack NO_GO | Preserve present cases, close strict geometry/contact and original quality exits. |
| Cloth–static collider | One fixed sphere in the visual profile | Generalize only after the same sheet/obstacle can be expressed as model data with unchanged results. |
| Fluid–static collider | Fixed basin and optional static CAD box | Same fluid kernel and explicit numerical collider; CAD is only its input adapter. |
| Cloth–dynamic rigid | No shared state or opposite reaction | Separate small two-way collision/attachment profile and momentum/work checks. |
| Fluid–dynamic rigid | No coupling; static particle projection only | Separate two-way exchange profile with pressure/impulse reaction and time-step convergence. |
| Fluid–cloth / self-contact / fracture | Not supported | Deferred; do not enable through the shared facade. |

A static obstacle is externally supported and can absorb momentum; record that external reaction in the accounting.
Dynamic coupling needs both sides' reaction and work. Freeze exchange phase, integer substep ratios, reaction
accumulation and units before execution. Apply each exchanged impulse to each side exactly once, and integrate
continuous forces over the declared interval. Matching animated positions or copying a collider transform
once per frame is not evidence of two-way coupling. Fluid density error and cloth strain diagnostics are numerical
observations, not material stress or calibrated viscosity.

## Reorganized development roadmap

Use these IDs as package development slices under existing #2276, not as another global execution queue or new
worker assignment. Reuse the existing leaf issues for their original acceptance. Each slice starts by fixing source
SHA, owned files, fixture digest, errors and cost limits. Each ends with source and genuine emitted-consumer receipts,
the first failure, current result, unsupported combinations and next dependency. No step can change old tolerances,
iterations, original input law or evidence in order to pass.

| Slice | Dependency and bounded change | Exit evidence | Current status |
|---|---|---|---|
| P0 — capability and API contract | This source baseline and current owner/HOLD check. Inventory all public factories, subpaths and first-party callers; fix model/state/command/error/lifetime/recording contracts. | Every current supported/refused/unmeasured row mapped; complete caller file list; proposed types and negative cases; no silent domain isolation. | CONTRACT_READY at frozen P0; bounded inventory and types passed. Rigid runtime is adopted by P1b/P2; unsupported domains remain future work. |
| P1 — common World, rigid first | P0. Separate immutable model from rigid runtime without changing numerical phases; implement one clock, candidate caches, copied state and idempotent disposal. | Existing admitted rigid fixtures and refusal precedence preserved; failure injection before and after each phase leaves accepted state/cache/log/time identical; deterministic next accepted step matches a fresh control. Measure allocation and per-step cost. | P1a_DONE. P1b model/options cutover implemented locally: selected source 8 / emitted 8 public checks and 21 focused probes per graph pass; native emitted runtime/declarations pass. Docs samples174/174, site/build/link checks and README native examples pass. Viewer SDK stays explicitly external in host callsite bundles; full DOM execution NOT_RUN. No new body/joint support. |
| P2 — recording and CAD boundary | P1. Move recording to the common World; separate CAD admission from runtime; migrate actual callers directly. | Record/restore/continue matches source and actual emitted consumers; stale source/model/profile rejection; unrecorded stepping prevented; numerical root graph has no CAD/parser/Viewer imports. MMGS/off-origin independent adapter tests pass. | P2_DONE_LOCALSELECTED. Public source/emitted11/11 each; test-only injected preparation15/15 each; native published maps/types PASS. No arbitrary checkpoint import or CAD Studio integration. |
| P3 — hinge and mechanism dynamics | P1/P2; original #1489 contract. Preserve four spheres, two disjoint hinges, 1/120 s and 1200 steps. Retain step77 raw-bit failure. | Exact original source/repeat/emitted/reference gates; independently mapped rename/order controls; separately budgeted recorder and hardened current API checks. Historical operands remain unavailable; no cross-runtime claim follows. | Selected local disjoint profile PASS; current API adopted with unchanged calculation bytes. Historical step77, general connected joints and #1490 live adoption remain separate. See the P3 checkpoint. |
| P4 — contact and original eight-box exit | P1 and the already measured 32-point equilibrium/192-row repair. Improve independent reference cost within the fixed 180 s budget before full replay. Preserve original inputs and all points. | Same32 patch equilibrium, strict line booleans, 1e-9 m geometry, 1e-10 SI residual gates; original ALIGNED/OFFSET/YAW1200-step settling metrics; actual source/repeat/emitted graph and per-phase accounting. Public adoption only after the full selected contract. | NO_GO. Matched16-step prefixes pass; separate ALIGNED308-step source attempt is incomplete. Public persistent limit stays4. |
| P5 — cloth and fluid as model data | P1/P2 and each domain's independent current receipts. Extract kernels into candidate buffers, admit existing fixed scenes as explicit model data and static colliders. No dynamic coupling. | Reproduce original fixed-profile results before adding input freedom; domain failure rolls back whole host step; common-clock/substep checks; source/emitted closure; reject unsupported cross-domain pairs. | P5a private candidate extraction PASS for four fixtures/two steps/failure recovery; P5b_DONE_BOUNDED_LOCALSELECTED: public source/native runtime, strict source/native consumers,127logical bundles and4selected source doc examples pass. Native rendering SDKs remain explicit external dependencies; their implementation/product closure is NOT_RUN. Visual evidence class stays visual; full required roadmap exits still block integration. |
| P6a — cloth–rigid coupling | P5 and qualified contact/rigid cases needed by a small declared pair, not a blanket full-engine GO. | Equal/opposite impulse and torque, attachment/contact residuals, work/dissipation balance, dt refinement, mass-ratio/boundary/refusal tests; no pinned-vertex masquerading as dynamic reaction. Freeze numerical tolerances first. | NOT_SUPPORTED publicly; private instantaneous impulse source/native campaign PASS. G5/schema, trajectory/contact/work/dt and needed G1/G4 leaves remain before public coupling. |
| P6b — fluid–rigid coupling | P5 and its required rigid/contact profile. Independent of P6a. Start with one small dynamic rigid object, no cloth. | Momentum/reaction accounting, independent buoyancy or pressure reference where the model supports it, dt/particle refinement, density/free-surface limits and measured cost; correct external basin reaction. Freeze reference error first. | NOT_SUPPORTED; visual PBF alone is not a CFD accuracy claim. |
| P7 — connected joints and control | Required P3/P4 leaf profiles, verified single fixed-axis dynamics and explicit plant model. Keep Robot FK/IK/timing in CAD Model. | First two-link conservation/reference case; then actuator units/saturation/sample time and tracking gates. Desired motion and actual response are separate arrays. Unreachable/saturated inputs remain visible. | BACKLOG. Reduced pendulum ODE checks do not qualify rigid multi-link dynamics. |
| P8 — product consumers and measured validation | Only profiles that passed their own preceding gates; existing HOLD/owner authority separately resolved. | #1490 live World→Viewer where applicable; design revision/save/reopen/refusal retention; then separately controlled measurements with uncertainty and intended-use limits. | OUTSIDE CURRENT WORK / NOT_RUN. No deployment, hardware control or manufacturing approval. |

P3 and P4 are independent acceptance tracks after the common rigid contract. P5 does not make either NO_GO pass.
P6a and P6b require their actual contact dependencies, not the completion of every optional Physics feature. This
keeps the roadmap usable without turning a shared API into an all-or-nothing engine claim.

### Necessary qualification additions (G1–G7; 2026-11-02)

These are concrete gaps or explicit prerequisites within P0–P7, not new public
Worlds, packages or a second execution queue. The source audit is
`examples/physics-world-p5-2276/ROADMAP-GAP-AUDIT.md`. Reuse already qualified
receipts at their exact provider/profile scope; do not duplicate their work.
A new row does not retroactively change any frozen campaign, tolerance or
historical result.

`CORE_REQUIRED` closes a gap in currently admitted behavior or evidence trust.
`PROFILE_PREREQUISITE` applies only when the selected extension needs it.
Future optional features and existing HOLD work remain outside the current
merge completion set.

| Gate | Priority and source gap | Dependency / finite exit | Current status |
|---|---|---|---|
| G1 — anisotropic rigid free rotation | **CORE_REQUIRED.** Rectangular boxes admit general angular velocity and unequal primitive-COM moments. Current world stepping applies external torque/impulse then advances orientation, with no torque-free gyroscopic update (`src/world.ts`, `src/validation.ts`). Sphere-spin checks do not qualify this freedom. | First freeze a supported rotation subset and finite isotropic control, off-axis axisymmetric box and triaxial box. Compare an independent analytic/Euler-equation reference, world angular momentum, energy, rotation and matched-time dt refinement. Quantify reference error and cost first. Preserve any initial failure; a separately reviewed admission restriction is an unsupported boundary, not a numerical PASS. Qualify before general off-axis box, coupled trajectory or connected-mechanism claims that use it. | **ONE-STEP SOURCE/NATIVE PHYSICAL NO_GO REPRODUCED (2026-11-02).** For the frozen axisymmetric box, max world angular-momentum component drift is8.333140433438353e-5 kg m²/s against2e-12; energy and squared-q norm pass. Exact first-failure evidence: `examples/physics-rigid-rotation-g1-2276/RESULTS-01.json`. The isolated **G1a axisymmetric/cube staged source and genuine NodeNext emitted-entry qualification PASS**:20Worlds/1688accepted steps/20failure controls, max world-L residual1.4218082239564305e-16kg m²/s and analytic omega error9.038815095388075e-15rad/s. Three dt grids meet the frozen ROUNDING_FLOOR criterion; no measured order claim. See `examples/physics-rigid-rotation-g1-2276/REPAIR-RESULTS-02.md`. G1btriaxial, wider admitted-range/near-unit/axis/frame and downstream integration, canonical root bundle and production activation remain open/NOT_RUN. The original production baseline failure is preserved. Cubic original stacks and P3 spheres are isotropic; their exact contracts are unchanged. Capsule inertia remains its declared isotropic proxy. The instantaneous impulse precursor advances no orientation and gains no new gyro condition. |
| G2 — admitted contact-law / CCD coverage | **CORE_REQUIRED.** P4's first32-point normal equilibrium is not evidence for every friction/restitution branch. Current laws include a0.5m/s restitution switch, minimum restitution, geometric-mean friction and static/dynamic limits; CCD has separate touch/overlap/parallel/endpoint branches. | Build a finite profile/pair/law/branch evidence table. Reuse existing sphere impact, sliding-to-rolling, support and exact geometry receipts. Qualify only missing required before/at/after switches, separating/closing/resting, reversed/zero tangent, stick/slip, grazing/corner/tied TOI and finite-boundary cases. Compare independent geometry/TOI, equal/opposite force moment and work; account external support and projection. Preserve existing laws and original iteration caps. | **STATIC19-BRANCH EVIDENCE MAP COMPLETE; NUMERICAL GAPS OPEN (2026-11-02).** `examples/physics-contact-coverage-g2-2276/COVERAGE-01.json` pins44 historical source/emitted receipt artifacts, current law/test files and14 matching leaf comparisons. No new physics/World calls or measured full branch coverage. The first actual source corner witness is **NO_GO for exact rounded contact**: squared distance0.0125m² exceeds(radius+1e-12m)²≈0.0100000000002m². Source helper1/reference audit1/World0; Native and biased-stop audit NOT_RUN after first failure. This is a conservative expanded-box boundary, not a tunnelling claim. `examples/physics-contact-coverage-g2-2276/CORNER-RESULTS-01.json` preserves it. Exact switch/tie proofs, rounded-feature repair and persistent restitution semantics remain open. No universal collision/rotating-CCD expansion; original P4 eight-box exit remains required and NO_GO. |
| G3 — COM / principal frame / tensor admission | **PROFILE_PREREQUISITE** for non-primitive inertia, offset COM or nonidentity collider frames. Current public inertia is primitive-COM or sphere-isotropic; collider local transforms are identity. An off-COM anchor does not establish arbitrary CAD mass properties. | Before such an extension, fix COM, principal axes, local/world tensor meaning, SI/MMGS conversion, symmetry/positive definiteness/physical moment inequalities and parallel-axis conversion. Use independent off-COM impulse/torque, translated/rotated controls and wrong-frame/nonphysical refusals. Migrate actual callers directly with no compatibility engine. | **NOT_SUPPORTED outside current primitives.** No full-tensor API/import is required when the selected plant's primitive COM law suffices. CAD/Studio ownership remains unchanged. |
| G4 — rank / conditioning / lawful frame and scale controls | **PROFILE_PREREQUISITE** for expanded coupled or connected constraints. Existing solvers have different pivot/condition limits; none is a universal threshold. | Define independent constraint rank, permitted redundant rows, inconsistent/singular refusal and a unit-aware condition metric before selecting a solver. Verify exact small rank controls and full state/cache/log retention. Add common translation/proper-rotation and dimensional M/L/T similarity cases only where every transformed input, material and dt remains admitted. No hidden regularization/fallback or copied threshold. | **PER-PROFILE_PENDING.** The private impulse population keeps its own frozen condition4096 and13-case reference; no added transformations or calls are inserted into that completed campaign. |
| G5 — typed mixed endpoints and coupled phase ownership | **PROFILE_PREREQUISITE** before public P6a/P6b integration. Existing Joint/JointState/commands name rigid body IDs; visual models reference only static colliders and commit one selected domain branch. | Freeze tagged rigid-anchor/cloth-vertex or rigid/fluid references, owner/index checks and SI exchange reports. Define force interval, actual physical substeps, solver iteration distinction, lambda/cache lifetime and host reaction accumulation. Apply each opposite impulse exactly once; inject first-side/both-side/pre-log failures and retain all accepted state/time/log. Then qualify the finite trajectory's drift/contact/work/dt gates. | **NOT_SUPPORTED publicly.** The private instantaneous50-attempt source/native campaign passes; it proves neither full-sheet coupling nor public state/schema, contact, trajectory or timestep accuracy. No clothId-as-bodyId or pin-as-dynamic-reaction shortcut. |
| G6 — domain recording capability and reconstruction | **PROFILE_PREREQUISITE only if enabling domain/coupled recording.** Current cloth attach exceeds128KiB; fluid attach/domain restore refuse explicitly. P5 verified those refusals, not domain record/restore. | Keep a public supported/refused capability row. Before enabling, define typed-array wire, complete state/history for log reconstruction versus checkpoint, supported duration and bounded payload. Test below/at/over caps, atomic refusal, source/native record–restore–continue. Existing128KiB/1MiB/512frame/4096command caps and errors remain; do not raise them or introduce an old-reader fallback to obtain PASS. | **CURRENT REFUSAL QUALIFIED; ENABLEMENT_NOT_SUPPORTED.** This is not a missing P5 exit and does not require a new codec for the current work. |
| G7 — provider / oracle / failed-prefix evidence trust | **CORE_REQUIRED for each new qualification.** Actual campaign review found partial memory sums, widened report/state gates and lost interrupted reference counts. A producer PASS or missing-count0 is insufficient. | Pin actual loaded source/native/reference/tool/declaration closure, input/raw-number authority and gate/budget definition before calls. Preserve physical, harness, resource and source failures separately. Authenticate original summaries; progress supplies durable lower bounds and unknown in-flight totals remain UNKNOWN. Distinguish payload charges from unmeasured heap/RSS. Check newly changed trust logic with bounded DATA tests, without repeating numerical prefixes to repair receipts. | **SELECTED PRIVATE CAMPAIGN PASS after recorded static repairs.** Other profiles retain their own proof limits, P3 missing historical operands and P4 historical raw-sign UNKNOWN. No blanket cross-runtime/determinism or physical-accuracy badge. |

Dependency order: close the G1 admitted-rotation boundary and G2 finite coverage
map before the corresponding general rigid/contact claim. Keep original P4
work as its own acceptance track. Before a new P6/P7 plant runs, select only
its needed G3/G4/G5 prerequisites; contact-free instantaneous work does not
inherit unused contact or rotation-trajectory requirements. P6b must first
state its physical mass/density/pressure/reaction law; visual unit weights or
PBF lambda do not acquire kg/Pa meaning by coupling. G6 applies only to a
recording capability being enabled. G7 applies to every new receipt.

### Completion set, optional work and estimates

Required completion remains the bounded P0–P7 scope plus applicable core and
profile prerequisites above. Existing P3/P5 selected completions stay recorded;
they are not reclassified as general engines. The owner-authorized develop
merge stays conditional on the entire required completion set, affected actual
source/native/API checks and preserved evidence. No partial or optional-feature
count turns an outstanding required NO_GO into GO.

Arbitrary compound/mesh collision, general rotating-body CCD, fluid–cloth
coupling, self-contact, fracture, arbitrary CAD tensor imports, new material
families and generic solver plugins are **FUTURE_OPTIONAL**, unless a separately
selected plant actually requires one. They have no current implementation or
merge deadline. First qualify the smallest chosen physical law; do not add all
possible physics features as completion gates.

Headless numeric host/runtime qualification is separate from Viewer/SDK/product
execution. Record actual source/emitted/runtime/platform/performance scope and
reuse valid receipts; cross-runtime raw-bit equality is not presumed. A new
runtime/download/dependency still requires the existing policy check. P8,
Studio, hardware, manufacturing and measured engineering/CFD acceptance remain
**OUTSIDE_CURRENT_WORK / HOLD**; this document does not reactivate their owners.

Report milestone completion, first failure and direction changes with the
current qualified profile, remaining dependency and estimate confidence.
Track main-slice completion and added gates separately; row counts are not a
weighted percent. The next completion-date estimate must use actual G1/P4 and
coupling results. No whole-engine date is asserted from authoring or a single
instantaneous operator PASS.

### Fixed original stack and hinge exits

Reuse #1572/#1399's exact definitions: eight dynamic boxes plus floor; ALIGNED/OFFSET/YAW; 1200 steps at1/120s;
penetration≤2mm; terminal2s vertical drift≤5mm, horizontal≤1cm, linear speed≤0.02m/s, angular speed≤0.02rad/s,
tilt≤1degree; no finite-floor escape. The original definition is authoritative if this summary omits a detail.
No 16-step prefix, four-body public scene, reordering study or extra-iteration result replaces that exit.

Reuse #1489's exact raw-bit/reference gates and literal four-sphere/two-disjoint-hinge fixture. The reconstructed
angle0.3020821295571869rad versus failed report0.30208212955718694rad remains recorded. Do not reinterpret two
disjoint components as a connected two-link mechanism or replace exact historical checks with a new tolerance.

### Direct API transition, without a compatibility engine

P0 must discover every importer before editing exports. Search packages, apps, examples and documentation, including
computed server entry paths, HTML import maps and emitted probes. P1/P2/P5 then change the canonical implementation
and each first-party caller in the same bounded slice. P1 first separates rigid internals while preserving the
current root signature, or migrates the root and every direct consumer (including replay) atomically if it changes
that signature. P2 cannot defer a build-breaking root/replay mismatch. P5 removes each old fluid/cloth/CAD-fluid
runtime factory in the same slice that introduces its common-World equivalent and updates its callers; do not add
an old-signature adapter or export two factories for the same model. Numerical kernels can be retained when their laws are still
valid; duplicate public simulation ownership must be removed. New input admission must refuse old unsupported
shapes explicitly. Do not silently infer missing units, profile or revision.

The reduced `createPlanarPendulum` implementation is a verified one-coordinate model, not a replacement rigid hinge.
The standalone model now lives in `examples/physics-planar-pendulum-reference/pendulum.ts`, outside the public root; its algorithm, contracts and numerical receipts are preserved. Do not turn it into a second permanent public simulation owner. A later product
need for a reduced model would require an explicitly admitted profile under the common World contract. This API
placement change does not qualify a rigid-body pendulum or invalidate the reduced model's numerical evidence.

Old receipts, archived providers and failure logs are immutable. Old runtime factories and schema migration branches
are not required merely because the package has unreleased users. Before export removal, verify the migrated source
and emitted consumer graph and leave a source-path/receipt mapping. An old failure stays a failure of its original
checkpoint even after its caller is migrated.

## Validation rules and test budget

- Fix error gates before executing new cases. Use independent geometry, analytical solutions or a reference with
  quantified error. Do not accept the finest run or the implementation's own residual as the only oracle.
- Exercise normal, boundary and impossible inputs; finite checks, units, stale identity, repeat execution, step
  refinement, supported-duration stability and refused-step retention. Test hidden solver state, not just returned arrays.
- Separate numerical error, geometry approximation, physical-model error and measurement uncertainty. Momentum and
  work budgets must include external loads, fixed supports and dissipation. Use conservation only when applicable.
- Preserve arithmetic/phase order during structural changes unless a separately frozen numerical study justifies a
  change. Decouple source/emitted equality, cross-runtime bitwise equality and physical error claims.
- Do not select a solver by a prettier animation, more iterations or a relaxed tolerance. Record cost beside error.
  Retain fixed 180s reference budget, iteration caps and all first failures in the current stack study.
- A test definition is not an execution. Source, actual emitted package closure, public API admission, active adoption,
  Viewer acceptance, measurement and release each have separate status fields. Do not sum test counts into a physics badge.

Initial P0 checks are source inventory and type/contract review, not full numerical campaigns. Subsequent slices run
only affected meaningful tests and one actual public consumer before broadening. Existing installed tools suffice;
review project policy before new dependencies, downloads, external runtimes, paid jobs or security changes.

## Traceability and preserved evidence

Remote issue bodies were read again on2026-11-01. They remain open; no Issue, Wiki or global priority was edited:
[roadmap#2276](https://github.com/barocss/barocss/issues/2276),
[public hinge#1489](https://github.com/barocss/barocss/issues/1489),
[live consumer#1490](https://github.com/barocss/barocss/issues/1490),
[stack#1572](https://github.com/barocss/barocss/issues/1572).
This package document reorganizes the independent development direction under that context. It does not replace
their historical contracts, authorize paused workers or close their acceptance gates.

The inherited local reports remain authoritative for their measured cases:

- `examples/physics-motion-foundations-2276/`: independent kinematics/units, continuous ballistic convergence,
  reduced pendulum and bounded sphere cases; first invalid-input and harness failures retained.
- `examples/physics-motion-nogo-2276/`: original32-contact residual and exact feasible equilibrium; historical hinge
  operands reconstructed, missing failed candidate operands still unknown.
- `examples/physics-stack-solver-2276/`: coupled normal candidate, original geometry failures and fixed iteration caps.
- `examples/physics-contact-boundary-2276/`: strict192-row source/emitted repair, matched16-step prefixes, incomplete
 308-step run and runner failure correction. Full original settling remains NO_GO/NOT_RUN.

The five documentation bundles added in the accompanying docs work describe today's real API, not the signature
sketch above. They must change with each canonical API transition. See
`apps/library-docs/docs/reference/physics-verification.md` for publicly readable bounded results and preserved failures.


## P0 checkpoint (2026-11-02)

P0 fixes the required model/state/command/failure/lifetime/recording contracts in `design/p0/`.
At the P0 checkpoint the target API remained unexported. `contract-check.ts` verifies positive/negative type consumers only;
`examples/physics-world-p0-2276/check-contract.mjs` checks admission constants, fixed vectors and requirement structure.
The expanded caller inventory separates active imports, computed loaders, shared build metadata and frozen evidence.
No lexical count is a runtime call count. Source-based review identified return-copy/log allocations after commit,
shared cloth lambdas and fluid scratch ownership as explicit next-step tests, not verified retention properties.

The transition started with preparation P1a under the old root signature; P1b now performs the direct public
model/options cutover with all affected root/replay/CAD consumers. This adds no compatibility overload or parallel
engine. Recording wire encoding must preserve signed zero; raw JSON is not the current recording wire path. See the
P0 report in `examples/physics-world-p0-2276/`. Original HOLD/NO_GO/error gates and archived failures remain unchanged.


## P1a checkpoint (2026-11-02)

The canonical rigid implementation prepares its copied successful output before accepted state replacement.
At P1a, replay prepared next frames/count before advancing its then-private World. Only those two runtime providers
changed at that checkpoint; its then-current signatures, exports, admission and numerical phases were retained as the sole canonical API.
This is the explicit P1a preparation in `design/p0/MIGRATION.md`, not a compatibility facade or completed P1b.

The frozen baseline reproduces three post-exception step advances and a replay log/state mismatch. Fixed
source and actual emitted root/replay each pass4injected transaction cases plus2ordinary API cases. The
unchanged independent rigid/contact references pass5cases per graph with matching numerical diagnostics.
Failure injection is test-only; it is not ordinary package or hardware evidence. All original gates/HOLDs/NO_GO
remain. Detailed commands, provider hashes, first diagnostic and limits are in `examples/physics-world-p1a-2276/`.
The next public cutover must implement the P0 model/options contract and migrate its actual root/replay/CAD
consumer graph together; it cannot retain an old World behind a wrapper or claim full physical engine completion.


## P1b checkpoint (2026-11-02; selected local verification complete)

The single rigid creation API is now `createPhysicsWorld(model:PhysicsModel,options:WorldOptions)`.
It exposes copied `getModel()`/`getState()`, fixed `step(commands?)`, tagged `query(input)` and idempotent disposal.
Bodies, colliders and source bindings are explicit model entities. Identity uses canonical typed SHA-256 model,
configuration and provider digests; signed zero is retained. The source and emitted provider manifests identify
their actual graphs. The emitted root keeps its provider module external until post-bundle manifest generation.
No old config converter, root overload, fallback engine or root reduced-pendulum export remains.

At the frozen P1b checkpoint, replay used its former scene/session service and prior binary format. Those
receipts remain historical. Current P2 source uses the attached common-World recorder and `BCPHREC1` binary
recording format. There is no raw JSON or old-schema migration reader. CAD admission supplies separate numerical body/collider and source-binding data;
exact source text/revision and off-origin mapping remain adapter responsibilities. Fluid/cloth own their current
single domain factories until P5; no new domain law or dynamic coupling is enabled.

Selected checks recorded at this slice: 8 source public tests and 8 emitted public tests;21 focused current probes
in each graph; native local published-map runtime and strict declarations in
`examples/physics-world-p1b-2276/evidence/native-04/result.json`. Earlier failed attempts remain beside later results.
Five foundation entries also pass 21 tests, current documentation samples pass 174/174, and source mapping
passes in `mapping-02`. These records verify the named providers only. Documentation build/site/link checks pass; README examples compile and execute in `native-05`. Seven host callsites bundle with the absent Viewer SDK explicitly external (`hosts-03`); full Viewer/DOM execution remains NOT_RUN. Basic HTTP startup/bundle/close passes (`server-01`). See `examples/physics-world-p1b-2276/README.md` for exact proof boundaries.
P1a pinned injection runners remain historical and are not modern API evidence. Source mappings and preserved parent
hashes are in `examples/physics-world-p1b-2276/migration-services.json` and the other slice migration ledgers.

No new physics qualification follows from an API cutover. P2 attached-recorder ownership has selected local source/emitted and native verification. P3 mechanisms, P4 full original-stack exit and P5 domain migration remain
separate work. Existing HOLDs, original NO_GO results,
first failures, numerical gates, immutable reports and release boundaries remain unchanged.

## P2 checkpoint (2026-11-02; P2_DONE_LOCALSELECTED)

`createPhysicsRecorder(world)` attaches to one common World at step0. Direct/cached World stepping and a second
attachment refuse `WORLD_OWNED`; reads and queries remain available. Recorder disposal detaches without disposing
the World. World disposal invalidates its recorder. Advanced Worlds cannot start a new history.
`saveRecording()` returns copied model/options/identity, indexed command frames and final state.
`restorePhysicsRecording(recording,{model,options,providerDigest})` reconstructs an isolated candidate and returns
`{world,recorder}` only after complete validation, exact expected identity and the original1e-12 final-state comparison.
Source revisions remain in model source bindings; CAD mapping still checks exact current source text/revision.
`serializePhysicsRecording` / `deserializePhysicsRecording` use bounded canonical typed bytes with `BCPHREC1` magic.
The old public scene/session constructors and snapshot codec are removed without aliases or migration readers.

Selected P2 checks pass on their named providers: public source05 and emitted05 each11/11; test-only fault
source04 and emitted04 each15/15: four step preparation points and attach output preparation, each across three rigid profiles. Native03 passes actual
staged publish-map runtime, strict positive/negative declarations, shared ownership registry, CAD release consumer
and all four README code blocks. Ordinary probes pass21 per source/emitted graph in run02; the three recording callers also pass after final fixes in records-source/emitted-01; foundation checks pass21
per graph. Documentation samples pass174/174 in run03. Documentation build/site/link checks are recorded separately in docs-check/build/links-01.

The large fixture has six sleeping bodies at step180, restores and continues20steps, then checks wake behavior.
The off-origin CAD maximum error is1.421e-14mm against the original1e-6mm gate. Independent ballistic position
errors are81.75/40.875/20.4375mm with refinement ratio2. These checks do not widen the admitted physics profiles.
Frame512, aggregate-command4096, canonical-model128KiB, total-recording1MiB and original1e-12 comparison gates remain.
Before a physical candidate, frame/log preflight completes. After the candidate, final state, returned copy and
recording encoding complete before the nonthrowing shared commit. Disposal releases recording/options references;
no garbage-collection timing or out-of-memory guarantee follows.

Whole-engine acceptance remains NO_GO. Named provider receipts and first failures remain separate from physical
qualification. P0/P1a/P1b evidence, original two-hinge/eight-box NO_GO, HOLDs, numerical gates, domain factories
pending P5, and deployment/product acceptance boundaries remain unchanged.

## P3 checkpoint (2026-11-02; selected local disjoint profile)

The common World directly admits the exact two-disjoint-hinge/four-sphere case.
It reuses the existing pose/velocity projection and report mathematics. Canonical
Z0 then Z1 calculation order is separate from caller-order state arrays. Generic
command admission and both axis restrictions precede the new empty-command rule.
Any cross-component contact refuses. The P0/P2 candidate/preflight/shared-commit
boundary remains. No legacy factory, engine switch or alternate public World exists.

Original staged observed source, ordinary repeat and native emitted each pass
1,200 steps. Full independent saved certificate reuse requires exact six-phase,
projection, report, correction, cap and signed-zero correspondence plus every
original physical gate. Selected controls pass within the unchanged47/4182
ceilings (actual47/4180). Separate recorder integration passes with four Worlds,
20 accepted steps and six refused entries. Actual hardened source/native public
API passes fourteen constructor attempts and six accepted steps; emitted strict
positive declarations compile. The only nongenerated transfer difference is a
raw initial-quaternion guard. No new 1,200-step run at that hardened hash is claimed.

Observed SOURCE maxima are zero COM/plane drift, anchor gap, axis deviation and
measured momentum residual components; maximum angular correction is
.0010000000000000002 Nms against the unchanged.01 cap. These are fixture-specific
measurements, not convergence, cross-runtime, connected-mechanism or equipment
claims. The old step77 failure and missing original operands stay historical
NO_GO/UNKNOWN. Public #1490 live integration and all existing HOLDs remain.

Commands, exact providers, first failures and documentation check receipts are
in `examples/physics-world-p3-2276/README.md`. Next is P4 independent reference
cost analysis before the original full-stack exit. P5 domain migration and P6/P7
remain separate. The owner authorized a develop merge after the entire required
roadmap completes; that conditional step is pending. No push, release or deployment.


## P4/P5 current checkpoint (2026-11-02)

P4 support-radius cache candidates v1/v2/v3 preserve their selected current raw
results but fail the fixed cost gate. V3 CPU cost is885643000→1078494000ns
(+21.775%). That cache slice is ended; no fourth variant or full-stack replay
is authorized by its result. Original eight-box exits remain NO_GO and the
public persistent-body cap remains4.

P5b now has one public common World for its admitted rigid and fixed visual
models. Old cloth/fluid/CAD-fluid factories, DTOs and subpaths were removed
with their first-party callers; no compatibility engine remains. The same
World owns accepted state, configured time and failure commit. Domain kernels
own only private candidates. Numerical root imports no CAD runtime.

Actual source and native published-map cohorts each pass101factory attempts,
37Worlds,64creation refusals and6334step entries:6281accepted,13synthetic
preparation/log failures and40refusals. Four refusals are private numeric-limit
controls. Five240-step cloth runs per graph compare all241frames to a single
independently generated research reference at the unchanged1e-12 absolute
component gate. Exact peak difference was not recorded. Fluid basin cases
reach720steps; shelf cases240steps. No3600-step stability claim follows from
that admission cap. Original numerical hashes, residuals, active-contact checks,
repeat gates and measured cost limits pass for those selected horizons.

Cloth recorder attach refuses at the unchanged128KiB model cap; three fluid
profiles refuse unqualified recording with `INVALID_SNAPSHOT` and no owner
residue. Original1MiB/512frame/4096command budgets and BCPHREC1 remain. Domain
recording/restore, moving-body coupling, calibrated cloth/CFD and equipment
validation are not qualified. Native-entry01's private/root types external
collision remains recorded; canonical-path external resolution repairs the
build, and native-entry02 plus later source/native runtime pass.

Strict positive/negative consumers pass for actual source and published-native
maps. All60source entry bundles pass. Native entry/generated/root compilation
completes127logical checks across the two modes with an explicit rendering-SDK
boundary:8missing published endpoint identities across13hosts remain external.
Those Viewer/CADInterop/GPU implementations and product execution are NOT_RUN;
Physics, CAD and replay use actual native modules without source fallback.
Three earlier build failures plus a zero-build copy-provenance startup failure
remain recorded.76valid prior bundle results and both strict results are
verified/reused; the final51bundles and one lint invocation pass. No passed
numeric campaign was repeated for this compilation work.

The displayed visual example passes separately:4Worlds,4accepted steps,
4recorder refusals and4disposals, source only. It does not reclassify the older
whole-sample receipts. Current site structure/build/link receipts and exact
commands are recorded separately in `examples/physics-world-p5-2276/README.md`.
`public-runtime-results.json` retains the prior runtime checkpoint unchanged.
P4 full-stack NO_GO and required P6/P7 work still block whole-roadmap develop
integration. Existing HOLDs, error gates and first failures remain.
