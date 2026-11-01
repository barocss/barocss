---
work_id: physics-world-p5-2276
artifact_type: p5a-clock-free-candidate-kernel-contract
status: AUTHOR_ONLY_PENDING_PARENT_FREEZE_NOT_RUN
owner_role: internal-domain-stage-contract
source_request: extract candidate initialization and preparation before atomic public cutover
last_updated: 2026-11-02
---

# Scope and evidence boundary

This contract and KERNEL-RECIPES.json are author-only. No implementation or
candidate execution has occurred. Parent freezes exact recipes, providers,
source/helper graph, build commands, IDs and resource guard before any runtime.
Only future new production files `src/domain/types.ts`, `cloth.ts`, `fluid.ts`
are proposed. No existing production file changes in P5a. In particular, all
original mathematical files, public root/exports, admission, shared World,
recorder, provider manifests and old factories remain byte-identical. P5b owns
the later atomic public cutover; no private World facade is allowed here.

HEADabc9bd5b87c0b389d92d4ad5e1bbaf4ee272c5cb contains the frozen source/native
baseline. Both report PASS_REPRODUCED_P5A_CURRENT_ATOMICITY_NO_GO, not atomicity
PASS. Each used14 actual constructors/28 step entries/20 numerical commits.
Those receipts and provider copies remain immutable. This new campaign reuses
captured raw step1/2 states and never calls an old World again. Its parity is
not an independent new physical accuracy, longer-horizon stability or cost claim.
P4 full-stack NO_GO and all other required roadmap exits continue to block
whole-roadmap integration, even if these private stages later pass.

# Internal interfaces and ownership

`domain/types.ts` defines private, clock-free admitted definitions, accepted
buffers, candidate/prepared-output result types, and the discriminated four
profile routing type. Reuse public `Cloth`, `Fluid`, collider/static-body data,
WorldOptions profile IDs and existing PhysicsState domain-entry shapes. Existing
RecordedState is already Serialized<PhysicsState>; no new wire/World/scene type.
No exports from root, legacy factory entry or package map in this slice.

`domain/cloth.ts` proposes `initializeCloth(cloth, staticData)` returning copied
immutable definition and initial accepted buffers/diagnostics, and
`prepareCloth(definition,accepted)` returning `{candidate,output}`. The latter
allocates fresh positions, velocities, mutable constraint/lambda objects and
ClothSolver scratch for each attempt. Reconstruct inverse masses exactly from
explicit physical vertex masses and pins; candidate sheets reference copied
rest/topology/definition data, never mutable accepted buffers. Keep every
original expression and constraint traversal, XPBD8×2 and fixed substep dt.
Original solver/projectDistance/projectSphere/diagnostics/bounds are called
unchanged. No createSheet call inside initialization or preparation.

`domain/fluid.ts` proposes `initializeFluid(fluid,staticData)` and
`prepareFluid(definition,accepted)` with the same result convention. Initialization
computes initialRestDensity once from exact copied input, initial diagnostics,
and, for the static-box profile, original inflatedBoxBounds once from numerical
box data. Every prepare allocates fresh positions/velocities and a fresh
PbfSolver, including its grid/predicted/combined/density/lambda/correction/
smoothing arrays and obstacle counter. No solver/grid object or failed candidate
escapes in accepted/output data. Preserve three density passes, damping0.998,
neighbors, basin/static-box projection, velocity reconstruction and XSPH order.
No retained failed-candidate grid alias can affect a later call.

Definitions and accepted data cannot acquire a cursor, time, step/reset/query/
dispose method, owner registry, log, guard, source watcher or World reference.
Preparation performs no accepted assignment. It prepares diagnostics, validates
original numeric bounds and prepares copied output before returning. Candidate
and output typed arrays are distinct; output writes cannot mutate candidate,
accepted or model data. A later common World may commit returned candidate by
assignment; that commit does not exist in this slice. Test record labels1/2
are external sequence labels, not a domain clock.

Fresh per-call solver scratch is the selected initial design. Do not switch
to retained scratch in response to cost without a separately reviewed contract
and ownership proof. No benchmark execution is included in this recipe.

# Fixtures and canonical model size

A test-only fixture builder under the example directory authors existing public
model data. It calls original createSheet exactly once per graph, preserving
rest/position/triangle/pin/constraint order. It obtains vertex masses by the
same area-weight accumulation as original topology: allocate289 zeros, compute
triangleVertexMass = densityKgM2 * spacing ** 2 / 6, and add in the exact1536
triangle-index sequence. Do not recover masses through rounded inverse-mass
reciprocals or give pinned vertices zero mass. Copy1566 constraints in order,
with original rest length and kind-specific compliance0.001/0.1. This builder
executes original topology arithmetic (including rest-length hypot); it is not
zero module/helper execution or a new mathematical authority.

Build the fluid lattice exactly once per graph using the frozen z4/y8/x8 loop,
then copy into the three explicit fluid models. Stage initialization runs three
times, and initialRestDensity is honestly three numerical helper calls. CAD
box center[0.35,0.2,0.25]/half-extents[0.15,0.01,0.15] are captured qualified
fixture values, not new CAD parsing. Preserve original inflatedBoxBounds in
static initialization. No CAD compiler/admission/currentness call occurs here;
the private numeric stage consumes static numerical data only. The later P5b
optional adapter retains currentness obligations.

Four complete plain PhysicsModels use common schema format/version/frame/SI
units, explicit static owners/colliders, no joints/dynamic bodies, one cloth or
fluid and no cross-domain mixture. Exact IDs/transforms/materials/filter fields
are fixed in recipes. Basin box-interior has center[0.35,0.65,0.25] and half
extents[0.35,0.65,0.25], representing [0,basin] without rounding/substitution.
Sphere profile offset0.002 remains a fixed profile value, not enlarged geometry.
Static shelf provenance is a literal fixture label; sourceBindings are empty
in this private numeric recipe, with no CAD-source or provenance admission claim.

After frozen fixture/helper authentication and construction, existing
identity.canonicalEncode is called exactly four times, once per complete plain
model. Save actual encoded bytes, SHA256 and model size; do not attach a recorder
or run serialize/restore. This is a DATA size gate *after declared builder and
initialization arithmetic*, not a claim that importing/constructing topology is
numerically inert. Canonical model may exceed recorder128KiB; report it exactly.
No recording cap changes:128KiB model,1MiB record,512frames,4096commands.
Per-profile recording schema/budget/closure support or explicit refusal remains
undecided. Existing canonical encoder and RecordedState are reused later.

# Fixed sequence, failures and counts

Use four profiles in recipe order and actual source graph first. Native starts
only after reviewed source PASS and fresh authorization. For each profile:
initialize once; prepare nominal S1 from initial; prepare nominal S2 from S1.
Compare their output arrays byte-exactly to captured baseline after/next. Then
three independent attempts from the same immutable S1 inject mid-kernel,
diagnostic and prepare-copy failures. After each throw, compare full accepted
S1 and model/definition fingerprints unchanged; disarm and prepare once again
from S1. The recovered candidate/output must equal the already-computed,
never-failed nominal S2 control exactly. There are no additional control steps.
Keep references and poison returned copies after comparison to test isolation
without extra numerical calls; do not poison the shared nominal control itself.

Each injected Error is preallocated per attempt and must escape by identity.
Only test provider overlays inject: cloth after the first completed original
projectDistance call of the first substep; PBF after first completed original
projectDensity call; diagnostic after the original domain diagnostics returns;
prepare-copy before the first prepared-output position copy. No public options,
production fault hooks, global allocator patch, numeric perturbation or genuine
OOM claim. Never modify original mathematical provider files; transform only
isolated test copies and record original/effective graph hashes. All overlays
are inactive for nominal/recovery calls and must fire exactly once when armed.

Per graph:4 initializations,32 prepare attempts,20 returns,12 injected throws;
8 nominal outputs and12 recoveries. Cloth8 fresh solver constructions/calls;
PBF24 fresh solver constructions/calls. Four mid-kernel failures prevent full
completion;28 kernels complete, but8 diagnostic/copy failures return no output.
No World constructors/factory attempts/World.step/record/restore/query calls.
Original initialization diagnostics:cloth1/fluid3. Preparation diagnostics:
cloth7/fluid21 (mid-kernel attempts do not reach diagnostics). Original
initialRestDensity3; topology createSheet1; mass accumulation1; inflatedBoxBounds1;
canonicalEncode4. Source and native each have these counts; combined values
are exactly double. Recipes specify further deterministic helper counts.

# Proof, build and stop rules

Authenticate all frozen baseline start/exit/summary/case files and provider
manifest before helper import or fixture construction. Both CAD-inner and
CAD-outer baseline rows must agree exactly as DATA before one static profile
can reuse them; no fifth physical candidate profile is created. Decode raw
F64LE bytes with exact lengths/hashes/finite checks and preserve signed zero.
Map domain diagnostics explicitly: legacy fluid diagnostics plus its separately
captured obstacleHits become the existing common fluid diagnostics fields.
Compare arrays/raw values, IDs/order/diagnostics exactly; profile/provider labels
are graph provenance, not cross-provider identity equality. Existing cloth
residuals and fluid release hash tables/tolerances remain frozen unchanged.
Two-step captured parity does not certify240/720/3600-step behavior. In these
first two steps, the captured static-box states have zero obstacle hits and
match bare-fluid arrays; this prefix cannot prove active box contact response.

Source bundle exports only private stage functions and test fixture helpers;
reject CAD/World/recorder/legacy factory modules in its actual input graph.
Native uses existing installed tsc with the package tsconfig and an explicit
fresh evidence outDir; no install, package build script or provider-generator
mutation. Import actual emitted domain modules through native ESM, unbundled,
with their emitted mathematical/identity/type dependencies. Never overwrite
production dist or frozen baseline providers. Hash emitted closure and compiler
inputs; verify original mathematical files unchanged before/after compilation
and trials. Native emission is not public root admission/type-consumer proof.

Parent-owned guard:180s per child; bounded owned-group termination/pipe EOF/
close/group-absence final receipt as baseline guard; total evidence64MiB per
campaign including copied providers, raw arrays, build logs and emergency data.
Reserve8MiB within that cap for first-failure/count/cleanup evidence. Count and
persist actual entry/return/throw/helper counters before calls; retain partial
counts on failure. Stop on first unexpected numerical, equality, ownership,
resource, build or authentication failure. No next graph, automatic retries,
tolerance change or receipts overwrite. Missing proof is HOLD. Any failed
required gate is NO_GO for the extraction; fix only after parent authorization
with a new immutable freeze/receipt ID. Browser/UI/docs/public domain admission,
recorder support and whole-roadmap adoption remain outside this slice.
