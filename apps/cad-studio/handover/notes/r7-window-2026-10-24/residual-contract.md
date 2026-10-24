# R7 residual public contracts — 2026-10-25

Status: implementation contract for the owner-authorized remaining R7 window. Product adoption and P2 remain HOLD.
This addendum supplements immutable base c9cd4a8ca; it does not move that ref. Start from the exact containing
commit supplied by the coordinator. Previous preparation is3795e938b9e9f6e69a67cfdf1e3e5f59f3f25062.

The owner asked the coordinator to assign the remaining SI output and public-unit/field work by lane, then qualify
one assembled commit before adopting R7 together. This applies api-conventions.md section2, without new exceptions.

## Boundary rules

- Public options, stored latest documents, agent replies and facade results use mm, g, s and degrees. Angular
  velocity/acceleration/jerk use degree/s, degree/s², degree/s³. Slides use mm and corresponding time derivatives.
- Public force is N; turning effort/torque is N·mm. Gravity vector/magnitude is mm/s² (standard9810).
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
