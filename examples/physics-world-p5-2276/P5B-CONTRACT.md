---
work_id: physics-world-p5-2276
artifact_type: atomic-common-world-domain-cutover-contract
status: AUTHOR_ONLY_PENDING_PARENT_REVIEW_AND_FREEZE_NOT_RUN
owner_role: p5b-public-contract-and-migration
source_request: one public World with direct cloth/fluid caller and export transition
last_updated: 2026-11-02
---

# Authority and hold

This author-only proposal adds no implementation or runtime authorization.
P5a checkpoint46e4a957fac7b8f114a603ff9ad939573176b56a qualified the four private
fixtures for two candidate steps and failure recovery on actual source/native
graphs. It did not qualify complete public admission, full horizons, fresh-scratch
cost, domain recording or active box response. Current authoring HEAD is
89d208b127c7c42a16b398c5641dcbf588d4a31b; original numerical providers remain
unchanged. Freeze exact providers, literal test cases, commands, budgets,
first-failure output and fresh IDs before code execution. Missing proof is HOLD;
a failed required gate is NO_GO. Whole-required-roadmap completion and reviewed
acceptance remain the integration condition. P4 full-stack/cost NO_GO and every
other pending required phase block merge; P5b alone cannot bypass them.

P0 target schemas/contract, ROADMAP P5, frozen CALLER-INVENTORY, scope/plan,
P5a contract/recipes/clarifications and actual receipts remain immutable.
Preserve original postcommit failure NO_GO receipts, static source-only anchor
failure/repair receipts and disclosed ungated compile-only policy miss. Never
rewrite old evidence as public P5 support. Original numerical criteria, raw
hashes, residuals, byte limits and replay tolerance do not change.

# One public API and complete admission

Only actual root `createPhysicsWorld(PhysicsModel,WorldOptions)` creates a
numerical World. Reuse existing Cloth/Fluid/PhysicsState shapes and exact IDs:
cloth-pinned-sphere-visual-v1, fluid-basin-visual-v1,
fluid-basin-xsph-visual-v1, fluid-static-box-visual-v1; domain-fixed broadphase,
dt1/120. Domain profile routing occurs before rigid-only dynamic-body rules.
No dummy dynamic body, fake rigid box-interior record, nested World, private
World facade, second clock or second owner. Exactly one cloth or one fluid;
static numerical owners only, no joints or mixed domain/dynamic coupling.

Before initializer/runtime buffer allocation, copy inert data under common
bounds and validate exact object fields, dense ordinary arrays, prototypes,
lengths, finite values and scalar/vector/quaternion shapes. Validate model
format/version/frame/SI conventions, gravity, options, globally unique qualified
IDs and every body/collider/domain/source-binding reference. Static owners have
exact static initial fields, identity XYZW rotation, one collider per owner,
identity local transform, positive finite shape dimensions, explicit sensor/CCD
false, restitution/friction0 and filter category1/mask65535. Reject unsupported
material/filter values rather than ignoring them. Body/domain membership and
source-binding roles/counts resolve before any runtime domain initialization.
No accessor may run during dependent validation.

Cloth admission compares every ordered rest/initial position, zero initial
velocity, physical per-vertex mass (including pins), triangle index/order,
pins0/16 and ordered1566 constraints (endpoints/kind/rest/compliance) against
an exact canonical reference from the original17×17 topology. Counts/ranges
are insufficient. Keep289 vertices/512 triangles, original total mass and
sphere center[0,0.1,0]/radius0.3/profile offset0.002. Compare field values with
explicit binary64 identity; do not normalize -0 or accept a different topology
with the same digest-sized counts. Selected fixed zero components use original native+0 bits exactly; no
normalization is introduced and unrelated rigid signed-zero rules stay intact.
Caller identity strings may vary within
common ID rules; fixture geometry/topology does not. Validate the reference's
canonical digest/raw operand data and generator provenance before use.

Fluid keeps the old admitted256-particle position variation, including shifted
and release/high-drop fixtures. Initial bounds are the original strict
radius <= p <= basin[axis]-radius, not the private insideBasin runtime ±1e-9
predicate. Preserve old pair minimumSquared-1e-12 exactly. Initial velocities
are explicit zero; visual-unit-weights is not calibrated particle mass. Radius
is0.0125. Smoothing radius is actual original1.8*FLUID_SPACING_M:
0.09000000000000001, F64LE0bd7a3703d0ab73f; literal0.09 is a distinct rejected
operand. Basin interior is exact original[0,0.7]×[0,1.3]×[0,0.5], represented
by a real static body and box-interior geometry. v1 has no smoothing; v2 exact
XSPH0.15. Static-box profile is v1 only, exactly one additional positive box,
original inflated basin-margin and initial-overlap checks. No XSPH+box, dynamic
obstacle, arbitrary particle count/velocity, emitter or P6 interaction.

Private initialize* remains an internal consumer of verified data. Public
admission is not delegated to its narrower checks. Extract old strict fluid /
CAD-data admission statements into common public-data validation without an
old Scene converter. Preserve original kernel and numerical expression order.
P3 rigid/contact/disjoint-hinge mathematical providers remain byte-identical;
rigid-only admission and step regions retain their original branch behavior.
Hash these unchanged regions and actual source/native closures; do not relabel
old P3 full-run receipts as a new full-run qualification of a changed provider.

# Data authoring and direct caller boundary

Use one frozen canonical dataset to generate two DATA-only consumers: an
internal cloth reference table for exact admission and shared example model
assets for all active callers/docs. Generation is a separate, explicitly counted
bounded data-authoring step: original createSheet once, original triangle-mass
accumulation once, no World/step/CAD/candidate. Save its source/output hashes and
canonical model digests; preserve all binary64 values and explicit -0 when
rendering literals. Do not execute topology generation on every model import.
If valid P5a artifacts already contain the exact complete data, reuse them with
provenance instead of rerunning a helper. Parent freezes which one path applies. The own generation ledger permits
createSheet1, triangle-mass accumulation1 and canonicalEncode12:four original
model targets, four rendered example model checks and four docs-copy checks.
Internal cloth-table equality uses recursive raw scalar/data comparison, no
extra codec calls. No initialRestDensity/solver/CAD/World call is permitted.
Public/internal tables are distinct deeply immutable containers; each caller
receives a detached copy. Verify copy writes cannot reach internal tables.
This generation is NOT_RUN; no model data was generated during authoring.

The planned example helper `model-data.mjs` exposes immutable public-model
literal assets and a deep-copy function returning plain PhysicsModel/options.
Fluid position variants are edits to public initialPositionsM on a copied model;
no legacy format/version/scene is accepted. It has no Physics runtime imports,
World creation, step/reset/lifetime, CAD parsing or hidden solver work. It is
an example asset, not a newly published factory API or package subpath. Docs
and isolated published-consumer probes copy/import the same hash-linked data
asset locally; they import only actual public Physics root/types at runtime.
Generated internal reference and external asset must agree field-for-field.
No package-private imports in public consumer examples.

Update all21 inventoried leaf files plus computed loaders, servers, generated
TypeScript programs, controllers/frame mappers, published-map assertions and
current docs/readmes in one buildable cutover. Numerical callers use model data
and `world.step([])`; rendering maps `world.getModel()` topology/static metadata
plus the chosen domain state entry, common identity and common cursor. Do not
recreate an obsolete cloth/fluid World DTO adapter to hide old call sites.
Host reset means owned World disposal/recreation; generation/display scheduling
is external. Existing two-World cloth host/shadow recovery remains two actual
root Worlds and is counted explicitly, not collapsed into one hidden facade.

Remove createClothWorld/createFluidWorld/createFluidWorldWithObstacle/
createCadFluidWorld and old runtime World/scene/state types, reset and step(dt)
APIs. Retain only needed internal kernel types. Remove old runtime entry files
and workspace/published subpaths ./cloth, ./fluid, ./fluid-cad; no alias,
renamed World factory, overload, compatibility switch or source fallback.
Remove createPhysicsClothWorld browser globals in native-scene-replacement,
qualified-face and shell; update their test consumers directly. Retire exact
obsolete emitted factory/World files because tsc does not delete stale output.
Preserve every historical archived source/emitted provider and public evidence
copy. Generic workspace/publish resolvers follow actual updated package maps.

# Frozen internal ownership interface

High admission returns pure validated copied data and calls no initializer:
`DomainModelData = {kind:'cloth';data:Cloth;staticData:StaticDomainData} |
{kind:'fluid';data:Fluid;staticData:StaticDomainData}`. `admitModel` adds
`domain:DomainModelData|null`. Rigid returns domain:null with unchanged kernel
data. Domain returns bodies:[],joints:[],disjointHinges:null as *internal rigid
kernel* populations; original static owners remain honest PhysicsModel data
and supply copied public static state. No fake box-interior Body is parsed.

Medium World calls initializeCloth/initializeFluid exactly once only after full
preflight succeeds, and owns clearable definition/accepted/static-state refs
under its existing single clock/guard. High owns model-admission.ts,
domain/admission.ts, generated cloth reference, optional CAD-data adapter and
any DomainModelData addition to domain/types.ts. Medium owns world.ts, replay,
public/legacy type cleanup, package/export/generated-provider changes, callers
and current docs. No concurrent edit of domain/types.ts; coordinate through
this interface before assigning code. All P5a mathematical stage behavior stays
fixed unless a separate observed failure authorizes a reviewed change.

# Shared transaction, guard and disposal

Common World owns one guarded lifetime, integer stepIndex and derived time,
one accepted state holder and existing recorder capability. Domain substeps
use fixed dt internally. Public static body state is honest copied static model
data; body contacts/events/CCD/joints remain empty and pairStats zero for these
profiles. No fabricated rigid contact/reaction report for particle projection.

Use verified P5a candidate stages with fresh solver scratch per attempt.
Preparation validates complete command shape under existing common guard/error
precedence, computes candidate/diagnostics, then prepares all copied public
state and any permitted recorder output before an assignments-only commit.
Failure retains accepted domain/rigid state, cursor, identity, diagnostics,
continuation data and log. Unknown thrown objects/Errors propagate unchanged;
no blanket numerical relabel. Raw scalar/typed-array fingerprints preserve -0.
Historical diagnostic JSON cannot prove unknown old zero signs.

Initially visual domain commands and queries are explicitly refused after
common generic shape validation. No command union/query schema extension.
Empty commands alone advance. Numeric step(dt) is rejected as malformed
commands, not supported by an overload. Existing disposed/owned/reentrant
precedence stays common, with no domain-specific guard bypass.

Use clearable owned model/definition/accepted references. No method closure
captures an immutable whole admitted result, model const or definition const
that survives disposal and prevents clearing buffers. Methods may capture one
clearable holder; disposal nulls owned references and releases registry-owned
links, preserving existing external getModel/getState copies. Fresh solver/grid
scratch is not retained between calls. Verify reachability/source ownership
and idempotence; do not claim forced GC or OS memory return. No new clock or
World-like methods are added to an internal holder.

# Explicit recording decision

Minimum P0-permitted choice is REFUSAL for every initial visual profile.
P5a measured cloth model222324 bytes >131072 cap; fluid models17732/17757/18376
only passed a size check. They did not qualify recording schema/wire/restore.
At step0, cloth attach throws WORLD_LIMIT from unchanged canonical model-byte
preflight; fluid/v2/static-box attach throws INVALID_SNAPSHOT explicitly for
unsupported domain recording. Refusal occurs before owner attachment or any
state/log/cursor change. Two failed attaches per domain control followed by a
normal direct step prove no owner residue. No stub recorder or partial record
escapes. Public CAD-derived model may have different IDs/bindings/encoded size;
measure its actual size, do not reuse the numerical preset's size label.

Keep128KiB model/1MiB recording/512frames/4096commands and existing BCPHREC1,
RecordedState=Serialized<PhysicsState>, signed-zero wire and1e-12 replay rules.
Do not add another World state/scene/codec, raise caps or enable a fluid wire
path by type presence. There are zero domain restore/serialize/deserialize
calls in this campaign. Existing rigid recording ownership and log-prepare
atomicity get a focused separate cohort; count every actual World call and
hidden reconstruction (planned zero because no restore/wire helper is called).
No artificial domain owner is attached just to claim an unreachable log path.

# Optional CAD data adapter

Add one DATA-only function to the existing optional ./cad-proxy service,
proposed `admitCadFluidStaticData(model,options,sourceText,request)` returning
copied completed model plus existing admitted proxy token. It cannot construct,
step, reset, dispose or retain a World. Reuse actual admitCadSurfaceProxy,
inflatedBoxBounds/insideStaticBox and original strict fluid data/margin/overlap
semantics, preserving real control-net/minimum-thickness operands and binding/
loss labels. Do not assume generic surface admission already includes fluid
checks. Source/profile/role validation precedes adding static body/collider/
binding IDs; no duplicate owner/reference or fake box-interior body record.

Caller explicitly invokes existing assertCadProxyCurrent(proxy,currentSource,
currentRevision) immediately before each World advance. Stale source/refusal
leaves World unattempted and state/log intact. Numeric root imports no CAD,
parser/native CAD, Viewer, live service, source text or source watcher. The
separate static-input-01 actual operand receipt is authority, not a new contact
proof. No new geometry algorithm, native service or dynamic coupling.

# Finite qualification and budget

P5B-PLAN.json fixes cohorts and direct caller assignments. Per source/native
graph:37 successful root Worlds,64 rejected creations (101 total factory
attempts),6334 World step entries:6281 accepted,13 synthetic failures and40
refusals. No old World, hidden CAD inner World, restore or wire construction.
Two graphs double these caps; no automatic second graph or over-budget rerun.
Counts include a four-World headless cloth host/reset seam and rigid recorder
control, not actual browser/Studio execution. They exclude separately declared
DATA-authoring generation and CAD data-service calls; each has its own finite
ledger. Before runtime, freeze literal mutation/command/fault IDs and exact
harness commands consistent with this plan; missing recipes are HOLD, not a
license to improvise extra cases. Parent may reduce scope with a new external
freeze; it may not silently expand counts.

Full numerical cohort per graph:cloth reference/sampling240, warmup240 and
three timed240 trials (5 Worlds/1200steps); four fluid release/high-drop v1/v2
runs720 plus two tuned repeats720 (6 Worlds/4320steps); static shelf main240,
repeat240 and matched bare timing240 (3 Worlds/720steps). Reuse fluid release
bare checkpoints for ordinary numeric comparisons, not a new duplicate bare
campaign. Times measure actual current public steps, including fresh scratch,
copying/admission/return costs as applicable; no fresh-scratch performance PASS
is assumed. Preserve cloth p95<=1000/120ms for each timed trial, all old cloth
hash/residual/sampling criteria and original1e-12 spike comparison and fluid-release-criteria exact hashes,
strict density0.25/0.05 at60/240, compression0.05, retained heap<=1MiB, original
XSPH high-drop/release speed/density bounds and relative cost<=1.5. Keep every
original raw checkpoint60/240/720; no tolerance change or rounded arrays.
Active shelf gates require cumulative hits>0 by60, no inflated-box penetration,
bare/shelf divergence and original shelf60/240 hashes; two-step P5a parity does
not supply those facts. Full3600 fluid stability remains unclaimed.

Additional atomic cohort uses16 Worlds:one never-failed control plus three
fault Worlds per profile. Each fault World accepts S1, fails S2 mid-kernel /
diagnostic / public-copy once and recovers to S2 equal to control. Counts48
entries/32accepted/12synthetic/4actual numeric refusals. The four numeric
refusals reuse four slots previously assigned to disposed-step calls; disposal
error identity is checked through getState instead. Domain command refusals
therefore contribute32entries, preserving total6334. No extra control trial. Domain recorder,
command/query/dispose controls reuse those four control Worlds. In one existing S2 failure/recovery pair per profile, after its planned
synthetic throw, inject a candidate invalidity after original solve to trigger
the actual NUMERIC_LIMIT guard while retainingS1, then perform the already
planned S2 recovery. The numeric control sets NaN only in a fresh candidate position after the
original solver returns and before the existing private validation. It must
exercise the real private NUMERIC_LIMIT constructor, then common guard details
(operation step, phase validation, actual cloth/fluid domain, retained accepted
cursor and appropriate entity IDs). Do not relabel an arbitrary thrown Error
as this control. Four extra numeric attempts replace four disposed-step
attempts; no extra recovery, control, accepted step or World. This checks the
real domain PhysicsError class, not only synthetic Error identity. These are
validator controls, not naturally observed physical NO_GOs. Total injected
World-step events per graph are17:13 unknown/log synthetic throws plus4 typed
numeric controls (the latter remain within40 step refusals). The separate
headless host adds one external Viewer-submit fixture failure, not a World
failure:18 harness injections including it, all explicitly counted. A two-World
rigid owner cohort adds8entries/4accepted/1log-preparation synthetic/3refusals;
the only independent-reference work is the separately frozen one-time
cloth oracle below, not another World cohort. Old P3 receipts remain
attributed to old providers; changed-provider focused regression is separate.

Source must PASS and be reviewed before genuine native emitted qualification.
Use existing installed toolchain, current root/provider generation and strict
published ESM/declarations. Verify one canonical PhysicsError/owner graph per
mode, source/native provider identity distinction, no source fallback, no CAD
numeric-root input and no stale old exports/files. Hash source before/after. Check admission, actual NUMERIC_LIMIT, disposed
and recorder error instanceof identity across root/replay/domain modules.
Current build externalizes ./types.js, ./recording-owner.js and
./provider-manifest.generated.js while domain modules import ../types.js.
Do not assume those path patterns guarantee one class after root bundling.
Verify the actual native root graph; only an observed failing gate justifies
a targeted bundler correction, preserving the first failure. No speculative
build rewrite is part of this plan.
Compile all affected computed entries/generated consumers/current docs samples
without evaluating them; no broad install/release runner or unrelated tests.
Documentation compile/link outputs are separate from numerical receipts.
Actual browser product, GPU completion, CAD Studio/Viewer UI and release are
NOT_RUN unless separately scoped; nothing here implies those actions.

# One-time independent cloth oracle

Source-only archive inspection found independent research snapshots at0/60/240,
not a full240-step position+velocity raw stream. They cannot support a fresh
full-run spike comparison by three hashes alone. Before current public trials,
parent separately freezes original physics-cloth-spike/{world,topology,
constraints,fixture}.mjs and all transitive imports, then authorizes exactly one
createClothTrial(CLOTH_FIXTURE,'xpbd',2,8):one research constructor, one research
createSheet,240 research step calls (1920 private advances). This is not an old
PhysicsWorld factory and is not executed during contract authoring.

Seal241 consecutive raw position+velocity frames0..240, each867+867 binary64
values (3343152 raw bytes total), plus original triangle topology and actual
source/provider hashes under a4MiB oracle-data cap within the campaign64MiB.
Retain signed zero/finite checks, frame lengths/order and whole-stream hashes.
Reauthenticate complete stream before either source or native current trials.
Reuse the same oracle for both graphs, all cloth cost/repeat trajectories and
headless numerical comparisons. No second oracle constructor/run. Compare
current positions/velocities to it using the unchanged old1e-12 absolute gate,
separate from exact historical public-World hash checks and current raw parity.
Record actual research counters before calls and preserve the first failure.
Parent grants a separate180s owned-child guard and explicit helper ledger;
original independent source is never replaced by a current kernel.

Parent owns heavy gate, branches, execution and commits. Use fresh evidence IDs,
180s child guard with bounded owned-group cleanup/EOF/close proof,64MiB campaign
evidence including8MiB emergency reserve. Stop first unexpected failure;
preserve partial actual counts, original failures and all precision/size limits.
