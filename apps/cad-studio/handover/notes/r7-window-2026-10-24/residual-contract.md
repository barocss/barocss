# R7 residual public contracts — 2026-10-25

Status: implementation contract for the owner-authorized remaining R7 window. Product adoption and P2 remain HOLD.
This addendum supplements immutable base c9cd4a8ca; it does not move that ref. Start from the exact containing
commit supplied by the coordinator. Previous preparation is3795e938b9e9f6e69a67cfdf1e3e5f59f3f25062.

The owner asked the coordinator to assign the remaining SI output and public-unit/field work by lane, then qualify
one assembled commit before adopting R7 together. This applies api-conventions.md section2, without new exceptions.

## Boundary rules

- Public options, stored latest documents, agent replies and facade results use mm, g, s and degrees. Angular
  velocity/acceleration/jerk use degree/s, degree/s², degree/s³. Slides use mm and corresponding time derivatives.
- Public force is N; turning effort/torque is N·mm. Gravity vector/magnitude is mm/s² (preserve existing standard9.80665m/s² as9806.65mm/s²).
  Density is g/cm³; inertia is g·mm², mass g, centroid mm. Service life is seconds.
- Core FK/IK/loop/profile/dynamics calculations retain radians and existing SI internals. Convert once at ingress
  and once at egress. Existing degree-based set_pose, waypoints, motion documents and API pose conversion must not
  be converted twice. Dimensionless ratios stay dimensionless. For a coupling between different joint types, convert
  the multiplier as well as the offset according to the leader/follower units; do not assume all couplings are turns.
- Stored RobotSettings.joints lower/upper/velocity use degrees for turning joints and mm for slides; effort uses
  N·mm or N. The internal JointTree remains rad/SI. Document readers resolve the joint type and convert explicitly.
  A separate public projection exposes limits/mimic/cam/contact values consistently. Retain typed refusals.
- Native URDF/MJCF/SDF/USD files retain format-specific SI. Preserving their existing frozen bytes is separate from
  converting public JSON. Do not regenerate native pins or loosen byte/numeric assertions. Reuse raw geometric moments
  before MMGS rounding for the SI export path where required; never pass fabricated densities to the public mass API.
- Source catalogue records with explicit {v,unit,src} retain original source units, source links and unchecked status.
  Unit-token lookup tables, format-mandated attributes and private math variables are not public quantity-field names.
- Latest unreleased schemas rename in place: no aliases, version bump or migration. Update tool contracts, schemas,
  validators, fixtures, path-based provenance and consumers together. Old quantity names must not remain accepted aliases.
  The owner rule supersedes a test requiring v3 merely for a latest-schema rename. Preserve actual refusal behavior.
- Explicit numerical-sketch v0 protocols and legacy Kernel control-polygon matching are separate R7.3d boundaries;
  audit and record these exact exclusions. Do not relabel an actively used public boundary as private to avoid migration.

## Names and value rules

Use camelCase, no unit suffixes, and a clear semantic noun. The Outer276-row/127-name and stored210/62 inventories
are candidate starting lists, not a certificate of completeness. Classify each occurrence as public/stored, private,
source-unit metadata, native-format or the named legacy boundary. Record exact producer, consumers, old/new names,
old/new units and a value rule before that family changes. Do not bulk-replace tokens without context.

Confirmed families:

| Old | Canonical public name | Value rule |
|---|---|---|
| nearMM,toolMM,layerMM,limitDeg,bendDeg | near,toolDiameter,layerHeight,overhangLimit,bendAngle | mm/deg unchanged |
| cornerMM,fluteMM,shankMM,rampDeg | cornerRadius,fluteLength,shankDiameter,rampAngle | unchanged |
| stepoverMM,stepdownMM | stepover,stepdown | unchanged |
| supportVolumeMM3/supportMM3,overhangMM2,contactMM2 | supportVolume,overhangArea,contactArea | unchanged |
| densityGPerCm3/gPerCm3,elasticModulusMPa,yieldMPa | density,elasticModulus,yieldStress | unchanged |
| buildMM,nozzleMM | buildVolume,nozzleDiameter | unchanged; preserve vector/scalar shape |
| seamMM,ownedVolumeMM3 | seamLength,ownedVolume | unchanged |
| lowerUM,upperUM,clearanceMinUM,clearanceMaxUM | lower,upper,clearanceMin,clearanceMax | µm to mm: divide1000 |
| mass_kg/com_m/inertia_kg_m2/moments_kg_m2/origin_mm | mass/centroid/inertia/moments/origin | ×1000/×1000/×1e9/×1e9/unchanged |
| gravity_m_s2 | gravity | ×1000 |
| peak_N/peak_N_m,rms_N/rms_N_m | peak,rms | force unchanged; turning moment ×1000; unit metadata N or N·mm |
| dwell_s,life_h,estop_rad_s2 | dwell,serviceLife,stopDeceleration | seconds unchanged; hours×3600; turning rad/s²×180/π |
| evaluationMs,builtMs,wallMs | evaluationTime,builtTime,wallTime | milliseconds divided1000 |
| duration_s,t_s,at_s,move_s,cycle_s | duration,time,at,moveDuration,cycleDuration | seconds unchanged |
| phase_deg/home_phase_deg/backlash_mm/residual_mm | phase/homePhase/backlash/residual | degrees/mm unchanged |
| overlap_mm3,clearance_mm,cut_area_mm2,thinnest_mm,draft_deg | overlap,clearance,cutArea,thinnest,draft | unchanged |

For other mechanical suffix-only fields the semantic name follows its established quantity (reach, tap, length,
width, radius, thickness, draftMin, etc.), preserving values. Resolve collisions by a clear noun. Internal dynamic
fields such as errorRad remain internal; their public projections use error in degrees. Every exclusion needs evidence.

## Lanes and serial dependencies

1. Kernel: minimal internal moment/cache boundary for native SI preservation, matching tests and package subpath
   wiring if needed; public mass result bytes/shape/units remain unchanged. Also own exact fit-deviation producer
   migration and tests in a later separate checkpoint. No API-lane files or pins. Submit the internal function/type
   contract to coordinator before implementation of its consumer.
2. Outer: public robot producer/storage/tool/UI adapters, remaining model fields/rows/validators/provenance, core
   non-Drawing tests and native SI adapter. Work in bounded checkpoints: angular/storage; force/time/public reports;
   mechanical/report names; SI integration after Kernel. Do not edit API, Drawings, GPU or Docs paths. Publish the
   exported projection signatures and exact maps immediately for consumers. Explicit shared leases from ownership.json stay valid.
3. API: src/api in both packages, matching API tests and approved P1 only. Start owned public adapters and independent
   mixed turn/slide checks from this base, using internal rad results. Reconcile with Outer's exact producer checkpoint
   before final tests. Public Robot.joints/setJoints, sweep contact, pose, inertia, gravity and owned naming must obey
   the same contract. Preserve P2 on its branch; do not import it.
4. Docs: library-docs only; document the confirmed contract and prepare independent degree/MMGS/SI examples. Consume
   exact producer/API checkpoints before sample execution and regenerated tool/refusal text. Preserve original failed
   evidence; never present current exceptions as permanent approval.
5. Drawings: drawing-owned consumers and tests; audit residual names and fit deviations, then consume exact producer
   checkpoints. Keep DR6b outside R7. Do not start DR7/DR8 during this window.
6. GPU: owner presently restricts source edits/remeasurement. Keep1205 clean; read-only map changed public DTO fields
   to exact viewport/render consumers and propose only mechanical compatibility edits. Coordinator must reconcile this
   restriction before dependent edits; no optimization or performance acceptance is part of R7.
7. Coordinator: contract/roadmap/browser-flow; serial --no-ff preparation merges with docs check after each. Preserve
   all immutable lane checkpoints and previous preparation receipts. Only this lane merges product.

## Qualification

Each lane records exact base/head, scope, clean state, independent physical oracles and focused/type/lint results,
first failures and NOT RUN. Existing expected numerical bounds and the70g rejection stay intact. Tool list plus prompt
must be measured at most25000characters. Source-only integrity does not substitute for runtime evidence.

After all public contracts and consumers are complete, freeze one assembled SHA. On that SHA run build/types/lint,
whole Kernel/Model/Studio/GPU suites, required fingerprint/RB/properties and docs samples/scenes/build, and the actual
full Studio browser flow on WebGPU and WebGL2. Keep prior failures and classify existing Node-pin/skips/TODOs separately;
never report them as PASS. The final acceptance decision must cite the exact suite results and unresolved exceptions.
No product merge occurs with an unexplained required failure or incomplete consumer contract. When qualified, adopt
R7 and its related lanes together in one serial local window with --no-ff and docs checks. P2 stays held.

## Confirmed producer interface supplements

The following signatures were agreed with their producers after the initial contract checkpoint. They are dependencies,
not evidence that implementation has passed.

- Outer `robot/units.ts`: jointSettingsIn(type,s), jointSettingsOut(type,s), jointTreeOut(tree),
  jointValuesIn/Out(tree,values), moveLimitsIn(tree,key,limits). Existing verbs exports of jointValuesIn/Out remain
  re-exports. Public joint-tree projection converts mixed coupling scale and offsets by both joint types.
- Outer `robot/verbs.ts` sweepOf adds optional `rawContactValues: Readonly<Record<string,number>>` outside `reply`.
  This internal value precedes radian rounding. Public tool and API project it once using jointValuesOut;
  no raw-radian alias is emitted in the public JSON. Do not convert an already r6-rounded radian contact to degrees.
- Kernel `@barocss/cad/internal/native-si-mass`: readNativeSIInertia(props:MassProperties) returns
  `{ok:true,inertia:NativeSITensor,density:number}` or
  `{ok:false,code:'NATIVE_SI_PROVENANCE_UNAVAILABLE',reason:'untracked'|'revolved'|'transformed'|'combined'|'difference'}`.
  Density is the actual original g/cm³. Kernel owns source/dist package-local wiring; no runtime dependency is added.
  Target native pins must not count unavailable plus a silent fallback as a successful byte-preservation check.
  Preserve existing general native-export support and disclose unsupported provenance paths separately.
- Kernel also migrates stored RobotSettings in its conformance/frozen input documents; low-level radian test vectors
  stay internal radians. Native output pins are unchanged. Outer migrates its own stored samples and fixtures.
- PrintLayers and its Omit-based PrintSummary: layerMM `{mm,basis}` becomes layerHeight `{value,basis}`;
  limit `{deg,basis}` becomes overhangLimit `{value,basis}`; supportVolumeMM3 becomes supportVolume.
  Values, basis flags and lazy layer(k) behavior are unchanged. GPU mechanical scope follows the exact producer.
- Fit producer lowerUM/upperUM/clearanceMinUM/clearanceMaxUM becomes lower/upper/clearanceMin/clearanceMax in mm.
  Drawing formatters remove their former divide1000 exactly once; e.g.18µm remains printed as+0.018mm.
  Root browser-flow has two owned fit-row fixtures and public RD2/RD3 payload/reply migrations to reconcile.

The native Split demo currently asserts Node22.23.3 while the selected host toolchain is22.22.0. This is an existing
required-check failure under the selected runtime. Record its exact cause and resolution; it is not an aggregate PASS.

## Gravity default correction

The existing internal STANDARD_GRAVITY is9.80665m/s². Preserve that physical default as9806.65mm/s² publicly.
The initial9810 wording assumed an existing9.81 default and did not authorize a physical default change.
An explicit input of9810mm/s² still converts to9.81m/s²; independent examples using that explicit input remain valid.
Native/dynamics defaults and existing physical oracles must not change merely to match a rounded example.

## Residual audit decisions (2026-10-25)

These omissions were found after the354-row inventory; that inventory is not a closure certificate.

| Boundary | Canonical field | Rule / owner |
|---|---|---|
| T-slot row sizeMM | cellSize | mm unchanged; row size remains its string name. Kernel producer then Outer table converter and fixtures. Remove the sizeMM whitelist; no alias. |
| CadPartFeatureProfile.ms | wallTime | seconds, retain original measured elapsed milliseconds and divide1000; Kernel producer, Outer rebuild/worker/UI consumers. |
| EvalResult.ms | wallTime | seconds, same evaluation interval divided1000 once, success and failure. This is a public engine subpath and worker result; API Work owns the explicit temporary producer/consumer lease. Rebuild evaluationTime then passes through wallTime, while human ms display multiplies1000. |
| DecimateReport.ms | wallTime | seconds, divide1000; keep measurement sites, geometry and numeric bounds. |
| ApproximationReport.maxSampledDeviationMM | maxSampledDeviation | mm unchanged; Kernel producer and exact GPU tessellation consumers. |
| P1 Check/EngineCheck.ms | duration | seconds, existing rounded-ms resolution divided1000; API-owned P1 reports only. |
| P1 treeMs | treeTime | seconds, divide1000; preserve P1 physical outputs and scope, no new sweep campaign. |
| OrientResult.ms and orient_for_print.ms | wallTime | seconds for the existing elapsed interval; preserve the tool's millisecond rounding resolution before dividing1000. Separate Outer mechanical/print checkpoint, not the API EvalResult lease. |
| orient_for_print support_mm3/overhang_mm2/height_mm/contact_mm2 | supportVolume/overhangArea/height/contactArea | same mm-based values and existing public rounding; preserve scoring, candidate choice and direction. |
| Public coupling g1/g2.rotation | rotation | raw internal GearPlacement radians to detached public degrees. Outer shared projection; no independent API helper. |

RevolveOptions.deg is a natural option name explicitly allowed by api-conventions section2; do not rename it through
an unscoped suffix substitution. Source unit metadata and explicitly labelled human text are separate from quantity
field names. In particular, retain Kernel checkFit.message's existing µm display with its explicit unit and its
one-time mm-to-µm formatting; this does not change the public fit JSON's mm contract.

P1 timing verification uses the existing --check --no-sweep flow and existing regressions. Its full files:true build
report runtime is NOT RUN here; do not add a sweep, new execution option or test seam to turn this rename into a
product campaign. Existing manufacturing findings and person-row waits remain.

## Follow-up ownership and qualification prerequisites (2026-10-25)

The T-slot Model importer temporary Kernel lease is complete at1d832089f and returned to Outer.
The API Work now has a temporary EvalResult time lease at944c49d1f90c4b656d265f1dab662573d58a0db0.
Its submitted12-file plan covers the producer, mesh wire, client/worker synthesized failures, Rebuild projection,
App display and matching tests. Outer excludes those time fields while implementing B2. The lease is returned
after its immutable checkpoint. Other telemetry fields are not renamed through an unscoped substitution.

B2 preserves the approved dimensionless names inertia_ratio_max and joint_limits. Its public harness projector
converts unrounded margin values and limits before applying the established public rounding. A private WeakMap
may retain those values at the existing atMost/range/actuator/sweep construction sites. Core JSON, arithmetic,
rounding, decisions, normalized margins, source and tolerances stay unchanged. Untracked clones do not silently
acquire unrounded provenance. Sized.trace.change remains explicitly labelled human text.

Package-consumer qualification must use the actual archive produced from the current package metadata and
strictly compare the packed name/version/private fields with that source. Retain no-runtime-dependencies,
all runtime and external TypeScript assertions, and the existing compiler flags and DOM libraries. Run external
consumers in their actual scratch context; do not import unrelated repository ambient types. Do not create
an archive under an obsolete name or alter package metadata to satisfy a stale test. Only the explicitly leased
consumer driver and its matching metadata/archive/context helpers may change. Keep each original failure.
These are implementation and verification assignments, not completed gates or product adoption.

## Public clearance and viewport follow-up (2026-10-25)

The same public quantity contract applies to structured worker and viewport DTOs. A transient value is not an
exception merely because it is not saved in a document. The following mechanical projections preserve numeric
values, original rounding, geometry, decisions, cache dependencies and human display units:

| Boundary | Canonical field | Meaning / owner |
|---|---|---|
| sweep_path.min_clearance | minClearance | {value,fraction,links}: mm clearance and dimensionless path coordinate; Outer shared projector. |
| check_path.min_clearance | minClearance | {value,time,links}: mm clearance and time in seconds; do not substitute fraction for time. |
| reference residual_mm | residual | mm unchanged, original twelve-significant-digit formatter; stored datum and fitting unchanged. |
| public keepout overlap_mm3 / clearance_mm | overlap / clearance | mm³ / mm unchanged; core KeepoutResult and App raw use stay unchanged. |
| public keepout required_mm / chord_tolerance_mm | requiredClearance / chordTolerance | mm unchanged; keep historical conformance oracle names and verdict thresholds. |
| PrintDisplay.topMM | top | mm unchanged; GPU owns the display, worker, panel, projection, overlay and Viewport consumers plus matching tests. Root owns the browser-flow probe. |

The PrintDisplay change is distinct from the Model PrintLayers producer but must be reconciled in this R7
window. It does not authorize a new clipping formula, cache algorithm, shader optimization or threshold. Retain
support geometry and the original displayed mm values. GPU consumes the exact Model producer on a branch
without G14/DoF/G15c feature ancestry. Root reconciles its shared browser getter after those exact producers.

The API L3 temporary five-file lease covers server robotL3 tool/main and three matching tests. Project the original
harness before serialization, validate canonical duty with readDuty, and preserve validated canonical numbers
rather than repeatedly converting and rounding them. keepsBrief retains strict life, poses and dwell comparisons
and its existing limits allowance. Preserve the original initial physical ratings of1rad/s and1Nm through the
shared settings adapter. No live model or new budget campaign is required for this contract migration.

The packaged numerical-v0 XYArc consumer still uses its actual centerMM/radiusMM report. That explicitly leased
legacy consumer correction is not closure of R7.3d retirement or a permanent exception for active public DTOs.
Final qualification remains on one immutable assembled SHA with Node22.23.3. Focused results below that boundary
remain scoped evidence, and P2 remains held.


## Additional active quantity families (2026-10-25)

These contracts consolidate the coordinator's explicit follow-up leases. They do not certify that every family is
implemented or qualified. The external receipt records each immutable producer, consumer, ownership and proof
boundary. A public field does not become exempt because it is a viewport DTO or a source-backed catalogue scalar.
Preserve all physical values, existing rounding, provenance, refusal conditions, numerical tolerances and native pins.

| Family | Canonical public names | Units and constraints |
|---|---|---|
| Material properties | density, elasticModulus, yieldStress | g/cm³ and MPa unchanged. Scalar source keys follow these names; explicit unit/source/page/URL metadata and lookup identities remain unchanged. |
| PrinterProfile and MouldFinish | buildVolume, layerHeight, nozzleDiameter; draftMin, draftRecommended | buildVolume is the same three-dimensional mm size vector, not a scalar volume. Lengths are mm; draft thresholds are degrees. Preserve optional omission and unknown/null semantics. |
| PrintLayers and overhang | layerHeight:{value,basis}, overhangLimit:{value,basis}, supportVolume; overhangArea, contactArea, worstAngle | Height mm, support mm³, area mm², angle degrees. worstAngle is zero for a vertical wall and ninety for a ceiling. Keep classification, lazy layers, geometry and cache dependencies. |
| CAM Model and viewport | safeZ:{value,basis}, stepover, stepdown; cornerRadius, fluteLength, shankDiameter, rampAngle; cellPitch, removedVolume, overcutVolume, sampleSpacing, lateralUncertainty | Absolute safeZ and lengths mm, volumes mm³, ramp angle degrees. Requested and effective cellPitch remain distinct values on their original DTOs. angularChordError, noseChordError and shankExtension retain their original displayed mm meanings. No sampling or clipping change. |
| Mechanical access, turning and machining | unreachedArea, addedArea, sampleStep, turnedArea, minOuterDiameter, includedAngle; tolerance.value and feasibleLimit | Areas mm², lengths mm, angle degrees. Preserve samples, classification, feasible-limit meaning and source. |
| Mould fields and analysis | DraftField.draftMin; DraftFace.min, steepest, belowArea; WallReport.thinnest, thick95; PartingReport.pullRange, isoclineLength; analysis wall thinnest/thick95/faces_below[].thickness; analysis draft draft/min/max | Angles degrees, lengths mm, belowArea mm². Threshold draftMin is distinct from observed min. Keep raw quantiles, sampling, geometry, r3/r6 and independent physical oracles. Public draft tool input is draftMin. |
| Viewport thresholds and casting | ThicknessLimits.minWall/materialMin/ratio; DraftLimits and CastingDraftLimits draftMin/draftRecommended; CastingSummary.tolerance.value | Wall lengths and tolerance mm, draft degrees, ratio dimensionless. Keep source, null, original threshold comparisons and catalogue lookup IDs. |
| Measure and section | angle, normalDistance, cutArea | Degrees, mm and mm² respectively. Preserve existing measurement precision and geometry. |
| Quote | tolerance:{value,perLength,source}, limits.largestPartSize, part.volumeBasis.massBound | Tolerance mm, perLength mm/mm, largestPartSize the same three-dimensional mm vector, massBound g. Preserve unknown/null/omitted fields, exact geometry behavior and formatter labels. |
| BOM | massBound, totalMassBound, totalMass | All are g. Preserve estimate flags, positive zero, null versus omitted, original r6 and addition order. totalMassBound uses view.parts plus base, not a second sum over derived lines. totalMass retains the existing incomplete-bead-accounting subtotal limitation. |
| Interference and keepout consumers | interference overlap/clearance; check_keepouts clearance/chordTolerance | mm³ and mm. Preserve the original overlap threshold, gap oracle and verdict. Historical conformance oracle identifiers remain separate; update actual getters and their matching tests. |

Old aliases, schema versions and migrations are not added for these unreleased active DTOs. Explicit source unit
records, catalogue threshold lookup IDs and labelled human strings are not renamed through a broad substitution.
The native and named legacy boundaries above remain separate. A test-only reader/writer for frozen native data
must state its boundary explicitly and must not regenerate fixture bytes or native pins.

Exported solver Duty is still an open boundary: wildcard package access means it cannot be declared private merely
because tools already project it. Public serviceLife is seconds. A new public life-in-hours exception is not approved.
The API Work must reconcile this with unchanged internal solver numerics, native fixture bytes, conversion order
and strict canonical file comparisons before an implementation lease is issued. This open item blocks final R7
qualification; it does not authorize conversion of unrelated internal radians or SI dynamics.
