---
work_id: physics-api-roadmap-2276
artifact_type: architecture-and-development-roadmap
status: ready_for_build
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

This is the local design direction for subsequent bounded implementation. The proposed API below is NOT implemented.
`ready_for_build` applies to the first contract/inventory slice, not to all later solvers or to release. Numerical
profiles beyond existing receipts remain BACKLOG until their own inputs, error gates and execution costs are frozen.
The current public API remains unchanged by this design document. The frozen [P0 contract](design/p0/CONTRACT.md),
[target types](design/p0/types.ts), [direct migration scope](design/p0/MIGRATION.md) and [validation requirements](design/p0/validation.json)
now define the first implementation boundary. They are design artifacts, not package exports or runtime support.

The initial product is a renderer-neutral numerical library for bounded CAD and mechanism experiments. Visual
fluid and cloth models can be useful, but their evidence class must stay visual until separately validated.
The design does not promise a general engineering multiphysics solver. Hardware, manufacturing acceptance,
Studio implementation and external simulator adoption are outside the current independent work.

The package is unreleased. Change first-party callers directly when the new API is implemented. Do not add a
`legacy` namespace, old/new mode switch, silent fallback, compatibility factory or duplicate execution engine.
Retain old source and first failures in immutable Git/evidence records, rather than executing both APIs in production.
The retired Motion package stays retired. Robot kinematics and prescribed-motion loads remain in CAD Model.

Existing Physics, Studio and manufacturing HOLDs remain. This roadmap is not an instruction to resume their owners,
merge to develop, activate an unsupported profile, deploy, publish or run hardware. Work continues in the independent
branch with explicit owned paths. No dependency or security-setting change is proposed in this slice.

## Source baseline: the apparent worlds have different roles

Baseline: `db84f1e17833fbdb140de953e1efb538da7ed865`. Paths below are relative to this package.

| Current entry | Actual ownership | Consequence |
|---|---|---|
| Root `createPhysicsWorld` | Rigid bodies, joints, contact, queries, candidate state and configured clock (`src/world.ts`, `src/types.ts`) | It is currently a rigid World, not a multiphysics World. |
| `/replay` | `RecordedPhysicsSession` creates one root World and records accepted commands (`src/replay-session.ts:12–40`) | It is a recording/session layer, not another solver. Its scene schema contains only `PhysicsWorldConfig`. |
| `/fluid` | Separate particle state, PBF solver and step counter (`src/fluid/world.ts:12–28,50–75`) | It shares no rigid identity, collision graph or accepted time. Gravity and basin parameters are profile constants. |
| `/cloth` | Separate sheet state, XPBD solver and step counter (`src/cloth/world.ts:9–54`, `src/cloth/profile.ts`) | Its static sphere is not a rigid entity; it cannot transfer a reaction to one. |
| `/fluid-cad` | CAD source admission plus the existing fluid solver with static box bounds (`src/fluid/cad-world.ts:15–18,46–55`) | It is a source-bound adapter, not fluid–rigid coupling. The solver sees no dynamic body to receive a reaction. |

The public factories also disagree on lifecycle: fluid and CAD fluid call `active()` in `dispose()` and refuse a
second disposal; rigid, cloth and the reduced pendulum dispose idempotently. Rigid has no reset; fluid and cloth
reset fixed scenes. Replay takes commands without a dt argument, while numerical worlds take dt. These are current
facts, not a proposed common contract.

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

### Proposed API shape — NOT executable today

The following is a signature sketch for the contract phase, not a supported code sample:

```text
createPhysicsWorld(model: PhysicsModel, options: PhysicsWorldOptions): PhysicsWorld
  options: fixedStepSeconds, supportProfile

world.getModel()                  -> copied immutable model description
world.getState()                  -> copied accepted state, all admitted domains, one stepIndex/time
world.step(commands = [])         -> copied state after exactly one configured host step
world.query(request)              -> result from accepted state only
world.dispose()                   -> idempotent; subsequent operations refuse DISPOSED

createPhysicsRecorder(world)      -> recording controller with exclusive step ownership
restorePhysicsRecording(log, expectedModel, expectedRuntime) -> new admitted World and recorder

admitCadProxy(source, request)     -> numerical collider/body input + source binding + explicit loss
cadPose(binding, acceptedState, currentSourceIdentity) -> display transform after exact source/revision checks
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
the matching commands exactly once. It prepares the bounded log entry and checks recording budgets before any
physical candidate executes. World state, hidden caches, clock and that prepared entry commit together through a
non-throwing internal operation. No serialization, callback or further admission check may fail between those
commits. Observer failures after a completed commit are reported as observer errors, never as a refused physical step.
Disposing a recorder detaches it; World disposal remains owned by its creator.
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
| P0 — capability and API contract | This source baseline and current owner/HOLD check. Inventory all public factories, subpaths and first-party callers; fix model/state/command/error/lifetime/recording contracts. | Every current supported/refused/unmeasured row mapped; complete caller file list; proposed types and negative cases; no silent domain isolation. | CONTRACT_READY: target types/negative consumers and admission-constant checks pass; bounded caller inventory classified. Runtime target NOT_IMPLEMENTED. |
| P1 — common World, rigid first | P0. Separate immutable model from rigid runtime without changing numerical phases; implement one clock, candidate caches, copied state and idempotent disposal. | Existing admitted rigid fixtures and refusal precedence preserved; failure injection before and after each phase leaves accepted state/cache/log/time identical; deterministic next accepted step matches a fresh control. Measure allocation and per-step cost. | P1a_DONE: prepared rigid return/log commit verified in source and actual emitted closure; P1b model/options cutover NOT_RUN. No new body/joint support. |
| P2 — recording and CAD boundary | P1. Move recording to the common World; separate CAD admission from runtime; migrate actual callers directly. | Record/restore/continue matches source and actual emitted consumers; stale source/model/profile rejection; unrecorded stepping prevented; numerical root graph has no CAD/parser/Viewer imports. MMGS/off-origin independent adapter tests pass. | BACKLOG. No arbitrary checkpoint import or CAD Studio integration. |
| P3 — hinge and mechanism dynamics | P1; original #1489 contract. Preserve four spheres, two disjoint hinges, 1/120 s and 1200 steps. Retain step77 raw-bit failure. | Exact original source/repeat/emitted/reference gates; independently verified rename/order controls before widening admission. Resolve missing original runtime operands or separately decide a new cross-runtime claim without rewriting the old gate. | NO_GO. Scalar reconstruction alone is insufficient. #1490 stays dependent on public adoption and existing owner authority. |
| P4 — contact and original eight-box exit | P1 and the already measured 32-point equilibrium/192-row repair. Improve independent reference cost within the fixed 180 s budget before full replay. Preserve original inputs and all points. | Same32 patch equilibrium, strict line booleans, 1e-9 m geometry, 1e-10 SI residual gates; original ALIGNED/OFFSET/YAW1200-step settling metrics; actual source/repeat/emitted graph and per-phase accounting. Public adoption only after the full selected contract. | NO_GO. Matched16-step prefixes pass; separate ALIGNED308-step source attempt is incomplete. Public persistent limit stays4. |
| P5 — cloth and fluid as model data | P1/P2 and each domain's independent current receipts. Extract kernels into candidate buffers, admit existing fixed scenes as explicit model data and static colliders. No dynamic coupling. | Reproduce original fixed-profile results before adding input freedom; domain failure rolls back whole host step; common-clock/substep checks; source/emitted closure; reject unsupported cross-domain pairs. | BACKLOG; visual evidence class stays visual. Can proceed independently of unrelated full-stack acceptance within its own frozen scope. |
| P6a — cloth–rigid coupling | P5 and qualified contact/rigid cases needed by a small declared pair, not a blanket full-engine GO. | Equal/opposite impulse and torque, attachment/contact residuals, work/dissipation balance, dt refinement, mass-ratio/boundary/refusal tests; no pinned-vertex masquerading as dynamic reaction. Freeze numerical tolerances first. | NOT_SUPPORTED; gates must be specified before execution. |
| P6b — fluid–rigid coupling | P5 and its required rigid/contact profile. Independent of P6a. Start with one small dynamic rigid object, no cloth. | Momentum/reaction accounting, independent buoyancy or pressure reference where the model supports it, dt/particle refinement, density/free-surface limits and measured cost; correct external basin reaction. Freeze reference error first. | NOT_SUPPORTED; visual PBF alone is not a CFD accuracy claim. |
| P7 — connected joints and control | Required P3/P4 leaf profiles, verified single fixed-axis dynamics and explicit plant model. Keep Robot FK/IK/timing in CAD Model. | First two-link conservation/reference case; then actuator units/saturation/sample time and tracking gates. Desired motion and actual response are separate arrays. Unreachable/saturated inputs remain visible. | BACKLOG. Reduced pendulum ODE checks do not qualify rigid multi-link dynamics. |
| P8 — product consumers and measured validation | Only profiles that passed their own preceding gates; existing HOLD/owner authority separately resolved. | #1490 live World→Viewer where applicable; design revision/save/reopen/refusal retention; then separately controlled measurements with uncertainty and intended-use limits. | OUTSIDE CURRENT WORK / NOT_RUN. No deployment, hardware control or manufacturing approval. |

P3 and P4 are independent acceptance tracks after the common rigid contract. P5 does not make either NO_GO pass.
P6a and P6b require their actual contact dependencies, not the completion of every optional Physics feature. This
keeps the roadmap usable without turning a shared API into an all-or-nothing engine claim.

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
Move this standalone model to independent reference examples when transitioning its callers; preserve its algorithm,
contracts and numerical receipts. Do not turn it into a second permanent public simulation owner. A later product
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
The target API remains unexported. `contract-check.ts` verifies positive/negative type consumers only;
`examples/physics-world-p0-2276/check-contract.mjs` checks admission constants, fixed vectors and requirement structure.
The expanded caller inventory separates active imports, computed loaders, shared build metadata and frozen evidence.
No lexical count is a runtime call count. Source-based review identified return-copy/log allocations after commit,
shared cloth lambdas and fluid scratch ownership as explicit next-step tests, not verified retention properties.

P1 starts with internal preparation P1a under the one current root signature, then P1b performs the atomic public
model/options cutover with all affected root/replay/CAD consumers. This adds no compatibility overload or parallel
engine. Recording wire encoding must preserve signed zero; raw JSON is not its future save/load path. See the
P0 report in `examples/physics-world-p0-2276/`. Original HOLD/NO_GO/error gates and archived failures remain unchanged.


## P1a checkpoint (2026-11-02)

The canonical rigid implementation prepares its copied successful output before accepted state replacement.
Replay prepares next frames/count before advancing its privately owned World. Only those two runtime providers
change; current signatures, exports, admission and numerical phases are retained as the sole canonical API.
This is the explicit P1a preparation in `design/p0/MIGRATION.md`, not a compatibility facade or completed P1b.

The frozen baseline reproduces three post-exception step advances and a replay log/state mismatch. Fixed
source and actual emitted root/replay each pass4injected transaction cases plus2ordinary API cases. The
unchanged independent rigid/contact references pass5cases per graph with matching numerical diagnostics.
Failure injection is test-only; it is not ordinary package or hardware evidence. All original gates/HOLDs/NO_GO
remain. Detailed commands, provider hashes, first diagnostic and limits are in `examples/physics-world-p1a-2276/`.
The next public cutover must implement the P0 model/options contract and migrate its actual root/replay/CAD
consumer graph together; it cannot retain an old World behind a wrapper or claim full physical engine completion.
