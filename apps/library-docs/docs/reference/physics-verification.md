# Physics verification

This page records bounded numerical evidence available on this independent development branch. It does not clear
the existing Physics, Studio or manufacturing HOLDs. Historical two-hinge failures and stable eight-box stacks remain
NO_GO. A new bounded disjoint-hinge qualification is recorded separately below. No measured machine validation,
manufacturing approval or deployment follows from these results.

Read [Physics](/packages/physics/), [Units and frames](/packages/physics/units-and-frames) and
[Profiles and lifecycle](/packages/physics/profiles-and-lifecycle) before selecting a test. For prescribed joint
motion, use [Robot motion](/guide/robot-motion). A supported input is not a claim that every admitted parameter
has been verified to the errors below.

## What a pass establishes

Keep these records separate:

| Record | What it establishes |
|---|---|
| Implementation | Code and input checks exist at a named revision. |
| Source example execution | The documented public imports run through a source bundle. |
| Emitted consumer execution | Actual compiled JavaScript and declarations resolve through the selected package map. |
| Numerical verification | Independent geometry, analytical solutions or reference calculations meet a fixed gate for named inputs. |
| Deterministic reproduction | Selected outputs or bytes agree for named runs and runtimes. This does not establish accuracy. |
| Measured validation | Controlled measurements agree within a stated uncertainty. NOT_RUN here. |
| Product-flow acceptance | A design can be saved, reopened, run and compared through the product. NOT_RUN for these independent experiments. |

The site's `test:samples` runner uses package sources. It is not a published-package test. The foundation report
also records a separate native emitted Physics consumer; that historical result does not make every site example
an emitted-consumer pass. See the [general verification tiers](/reference/verification#planned-experiment-evidence).

## Independent references and fixed errors

The foundation used Node 22.19.0 on macOS ARM64. Its gates were fixed before execution. The
[foundation report](/physics-evidence/foundation-report.txt) and [original contract](/physics-evidence/foundation-contract.txt)
retain the inputs, commands, first failures and narrower source/emitted boundaries. These are historical results,
not new executions performed by a documentation build.

| Model and case | Independent comparison | Measured result | Original gate |
|---|---|---|---|
| Revolute/prismatic FK, 20 off-origin poses | Direct point geometry | Maximum position error 2.8422e-14 mm | 1e-9 mm; rotation entries 1e-12 |
| Reachable IK, three analytic targets | Goal residual and joint limits | Position 5.7934e-14 m; angle 6.084e-37 rad | 1e-4 m; 1e-3 rad; limits respected |
| Unreachable IK | Known reach boundary | Residual 0.04000000000000001 m; slide stops at 80 mm | At least 0.0399 m; limits respected |
| Mixed-unit trapezoid, 202 samples | Geometric pose and piecewise timing | Maximum Cartesian error 6.3553e-14 mm | 1e-9 mm; normalized/radian error 1e-12 |
| Ballistic flight, t=1 s, dt=1/60, 1/120, 1/240 s | Constant-acceleration solution | Position errors 81.750, 40.875, 20.4375 mm | Coarse error below 83 mm; refinement ratios 1.99–2.01 |
| Unequal-mass elastic sphere impact | Momentum and kinetic energy | 0 N·s; energy error 2.2205e-16 J | 1e-10 in each SI unit |
| Reduced pendulum, amplitude 1.5 rad, dt=1/120 s | Elliptic period and geometric energy | Period error 0.00264214%; energy envelope error 0.0187680% | Each at most 1% |
| Same pendulum, t=0.1, 0.2, 0.3 s | Inverted elliptic flight-time integral | Angle 1.39932e-5 rad; speed 1.66005e-4 rad/s | 1e-3 rad; 1e-2 rad/s |
| Pendulum step refinement | Errors against independent reference at each dt | Period ratios 4.00145, 4.00061; energy ratios 4.00004, 4.00001 | Each ratio 3.2–4.8 |
| Pendulum, amplitude 2.5 rad, 100 cycles | Period and every sampled energy state | Period error 0.000681902%; maximum energy deviation 0.00329421 J (0.0155418%) | Each at most 1% |
| Sphere floor support, 3000 steps at 1/120 s | Gap and accumulated support impulse | Gap 0 m; cumulative balance error 2.5580e-12 N·s | 1e-10 m; per-step impulse 1e-10 N·s; cumulative 1e-8 N·s |
| Sphere sliding to rolling | Analytical final translation, spin and energy | 0.7142857142857146 m/s; -3.571428571428573 rad/s; 0.714285714285715 J | Error at most 1e-9 in each reported unit |

The pendulum reference uses AGM and fixed Simpson quadrature, not a copy of the stepper or its finest run as truth.
The reduced model uses one fixed axis and explicit pivot inertia. It does not validate a general rigid hinge,
continuous rotation near the separatrix or a CAD-authored free-motion workflow.

Ballistic energy error was -0.8019675, -0.40098375 and -0.200491875 J at those three steps. This records
discretization error; it is not an energy-conservation pass. Contact impulse-work accounting compares velocity
changes with work. It is also different from long-time energy conservation.

## Contact research: one patch before a trajectory

The eight-box research uses eight dynamic cubes and a static floor in a private diagnostic World. The public
`persistent-box-v1` profile still admits at most four total bodies. These experiments do not activate a nine-body
public API or a general multi-body solver.

The original first ALIGNED patch has the same 32 contact points used by the candidate. Exact Fraction equilibrium
shows that zero final body velocities and angular velocities are feasible. A per-corner impulse distribution need
not be unique. The candidate is compared by body balance and all contact residuals, not one chosen load split.

| Fixed-patch comparison | Original first failure | Coupled candidate | Unchanged gate |
|---|---|---|---|
| Closing normal speed | 0.0040639119536177174 m/s at the first diagnostic row | Maximum 3.885780586188048e-16 m/s over all rows | 1e-10 m/s |
| Absolute complementarity | 0.0005373978089614024 J at that row | Maximum 9.529876887626191e-17 J | 1e-10 J |
| Reference equilibrium velocity | No accepted equilibrium claim | Maximum 1.8041124150158794e-16 m/s | 1e-10 m/s |
| Independent impulse-work residual | Separate accounting check | Maximum 3.469446951953614e-18 J | 1e-10 J |

The measured fixed patch used one QR decomposition and one outer iteration, within the original cap of 64.
No contact points were removed and no tolerance or iteration cap was increased. This solve does not prove the
cause of the later collapse. General friction is not qualified by a case whose loaded tangential velocities are zero.
Read the [diagnosis](/physics-evidence/nogo-report.txt), [solver report](/physics-evidence/solver-report.txt),
[first failure](/physics-evidence/first-stack-failure.json) and
[candidate receipt](/physics-evidence/first-equilibrium-source.json).

## Strict contact geometry and the retained failures

A small distance to an OBB is insufficient. The strict witness check asks whether the actual returned binary64
point's normal line intersects both exact normalized-quaternion OBBs, with the correct A exit, B entry and surface
midpoint. Slab intervals receive no tolerance inflation. The separate distance gate remains 1e-9 m, paired witness
movement 1e-12 m and Decimal80/120 agreement 1e-60.

The initial four saved poses contained 77 failed rows. The first repair passed those 128 rows but failed the next
World attempt: ALIGNED step 4 and OFFSET step 2 exposed missing midpoint and face conditions. The expanded baseline
has six poses, 192 rows: 79 fail, one is unresolved and 112 pass. The unresolved row is not counted as a pass.

The final construction passes all 192 rows against the independent Decimal80/120 reference in source and actual
emitted geometry. It repairs all 80 failed or unresolved rows while retaining count, order, IDs and normal bits.
Maximum point movement is 3.1031676915590914e-16 m; maximum actual midpoint error is 2.81191119989596e-17 m.
The maximum measured inward adjustment is five representable steps within a fixed cap of 16. This constructs an
accepted point; it does not widen the geometry gate.

Per-face caps remain 200000 rational operations, 2000000 metered BigInt operations and 16384 bits. Observed maxima
are 5211, 383233 and 2005 bits. Finite fixtures do not establish all-input completeness or general performance.
Read the [boundary report](/physics-evidence/boundary-report.txt), [contract](/physics-evidence/boundary-contract.txt),
[source receipt](/physics-evidence/geometry-source.json) and [emitted receipt](/physics-evidence/geometry-emitted.json).

## Original stack: accepted prefix, full case NO_GO

The original scenes retain dt=1/120 s, eight 1 kg cubes, the static floor, friction 1/0.7 and all contacts.
The original target remains 1200 steps, including the 8–10 s settling criteria.

| Scene | Independently accepted matched source/emitted prefix | Maximum QR count per solve | Maximum closing speed | Maximum complementarity |
|---|---|---|---|---|
| ALIGNED | 16 steps | 1 | 1.054392670760619e-15 m/s | 3.016881029213819e-16 J |
| OFFSET | 16 steps | 11 | 8.35871629753124e-16 m/s | 2.353675197446504e-16 J |
| YAW | 16 steps | 3 | 7.597458302814675e-16 m/s | 1.7977308790694733e-16 J |

The compiled comparison emits the geometry, candidate normal solver, verifier and adapter. The private World and
some helpers remain source providers. This is not a full emitted public-package integration test. Raw body hashes
and decoded records agree for the selected prefixes. See [source](/physics-evidence/world-source.json) and
[emitted](/physics-evidence/world-emitted.json) receipts; each still says `privateTrajectoryGO:false`.

A separate source attempt accepted 308 ALIGNED steps before the fixed 180 s execution guard. Its runner then
incorrectly continued to another case; that experiment was stopped and its partial records retained. The runner
was repaired with error-path tests. The [308-step receipt](/physics-evidence/world-time-guard.json) remains incomplete.
The 16-step comparison is a selected comparison range, not a replacement for the original success criterion.

| Remaining NO_GO or NOT_RUN | Next dependency |
|---|---|
| Original ALIGNED collapse at step 960; OFFSET 315; YAW 243 | Complete original-duration verification within the fixed execution budget; retain all quality and geometry gates. |
| Full repaired 1200-step settling run | Reduce independent reference execution cost, then rerun. No long-time pass yet. |
| General or connected multi-hinge network | The new disjoint profile does not share bodies or qualify a connected two-link mechanism. See P3 below. |
| Historical hinge report discrepancy at step 77 | Historical reconstructed operands support 0.3020821295571869 rad; failed report was 0.30208212955718694 rad. The candidate's original preprojection operands were not observed, so the full cause is unresolved. |
| Original motion input failures | Keep the [24/25 first-failure record](/physics-evidence/first-motion-input-failure.txt); later finite-input guards do not erase it. |
| Hardware prediction and manufacturing safety | Separate controlled measurements, uncertainty and intended-use approval. |

The earlier solver report overstated that its error helper was connected to the trajectory runner. The later
boundary work records this correction and connects the actual runner path. The old report is preserved as written.

## Reproduce and inspect provenance

Use a checkout that contains the named source revisions and its existing project dependencies. Do not overwrite
existing run IDs. Apply the repository's heavy-lane gate before numerical campaigns. These are historical checkpoint reproduction commands, not current P1b root qualification or steps performed
by a documentation build. The original boundary-research entries now forward to a provider pinned at parent
`0be1dffb8`; their preserved records retain that historical meaning. Use the current P1b slice runner and receipts
for the new model/options API. Do not treat a successful archived provider run as a current-root result:

```sh
# From the repository root, with the supported Node 22 runtime.
node examples/physics-contact-boundary-2276/run.mjs baseline docs-baseline-NEW
node examples/physics-contact-boundary-2276/run.mjs geometry-source docs-geometry-source-NEW
node examples/physics-contact-boundary-2276/run.mjs geometry-emitted docs-geometry-emitted-NEW examples/physics-contact-boundary-2276/evidence/docs-geometry-source-NEW
node examples/physics-contact-boundary-2276/run.mjs world-source docs-world-source-NEW
node examples/physics-contact-boundary-2276/run.mjs world-emitted docs-world-emitted-NEW examples/physics-contact-boundary-2276/evidence/docs-world-source-NEW/world-result.json
```

Foundation receipts originate in commits `038c2a2fd4e6462dc025e28089afd8f549d79891` and
`031f66c3ea572c3a496cfa319a4c542e7b19fc3a`; diagnosis in `7105c4755fcbf4f0cbc764b864a55bf550f741b3`;
fixed-patch candidate in `8d7474ba0b4df5367dbeee93b3a95cb777dcac48`; final boundary evidence in
`db84f1e17833fbdb140de953e1efb538da7ed865`. These are local development checkpoints, not release identifiers.
The [evidence manifest](/physics-evidence/manifest.json) names each original repository path, byte count and SHA-256.
Included evidence files are byte-identical copies. Complete raw archives, provider graphs and command records remain
in the corresponding `examples/` directories at those checkpoints. No failed archive was replaced by a later result.


## Transaction preparation checkpoint

The [P1a report](/physics-evidence/p1a-report.txt) records a later software reliability change: the rigid World
prepares its returned copy before committing accepted state, and replay prepares its next log before advancing.
Test-only preparation exceptions reproduce the old post-exception advance/log mismatch. Fixed source and actual
emitted root/replay pass the selected continuation checks; ordinary uninstrumented consumers and the unchanged
five independent rigid/contact tests pass separately. At that P1a checkpoint the original public signatures and numerical laws remained.
That checkpoint did not implement the proposed common model API, fix cloth/fluid hidden-state ownership, clear HOLDs or
replace the original hinge and eight-box NO_GO. Deterministic continuation is distinct from physical accuracy.


## P1b API cutover and verification limits

At the frozen P1b checkpoint, the rigid root accepted `createPhysicsWorld(model,options)`, copies admitted model and accepted
state, steps only its configured interval, and returns tagged collider queries. That checkpoint's former replay scenes contained explicit
model/options/identity. Its former snapshot wire codec used `BCPHSNP1` plus canonical typed bytes, preserving signed
zero. The reduced pendulum is an independent reference example outside the public root. These API changes add no
new collision, joint or domain law and do not widen any numerical acceptance gate.

The local P1b slice has recorded 8 selected source public tests, 8 emitted public tests and 21 focused probes per graph.
The native published-map runtime and strict declaration checks passed in
`examples/physics-world-p1b-2276/evidence/native-04/result.json`. Source and emitted provider identities remain
separate. Five foundation entries pass 21 tests, current docs samples pass 174/174, and source mapping passes (`mapping-02`).
Documentation site checks, build and scoped links pass. Four README blocks compile and execute in `native-05`.
Seven current host callsites bundle with the absent Viewer SDK explicitly external (`hosts-03`); full Viewer/DOM
execution remains NOT_RUN. The basic HTTP startup/bundle/close and idempotent provider refresh pass (`server-01`). The existing tables above remain attributed to their
original numerical providers. P1a pinned injection runners remain historical, and original failed reports are retained.

Selected #1572 diagnostic commands exit normally, but their three-box OFFSET and YAW reductions retain
`BOUNDED_SETTLING_NO_GO`. The collision reference is producer-only; these are not independent eight-box passes.

Recorder attachment was outside that P1b slice. The current P2 recorder is described below. Common fluid/cloth migration was outside that P1b checkpoint; P5 records its later transition below. Viewer product acceptance, hardware and manufacturing remain unverified. Existing Physics/Studio/manufacturing HOLDs, public
multi-hinge and original-stack NO_GO decisions and all original first-failure tolerances remain unchanged.

## P2 attached recorder: selected local software verification

The current `/replay` entry attaches `createPhysicsRecorder(world)` at step0 and restores with
`restorePhysicsRecording(recording,{model,options,providerDigest})`. Direct/cached World stepping and a second
attachment refuse WORLD_OWNED. Read/query remain available. Recorder disposal detaches; the caller owns World
disposal. Old scene/session/snapshot exports have no aliases or migration reader. The sole wire is BCPHREC1.

Public source05/emitted05 pass11/11. Test-only preparation faults source04/emitted04 pass15/15, including attach
output allocation failure before ownership transfer. Native03 checks actual published maps, positive/negative
declarations, shared registry, CAD release consumer and four README blocks. Ordinary probes pass21 per graph,
foundations21 per graph, final recording callers3 per graph and documentation samples174/174. The build/site/link
checks have separate receipts. Sources, actual commands and numerical errors are in
`examples/physics-world-p2-2276/README.md`; this is local verification, not publication.

The saved UTF-8 leading-BOM failure and stranded-ownership fault failures are retained beside successful runs.
Canonical Unicode and signed zero are preserved. Physical candidate source is unchanged; original1e-12 replay,
ballistic refinement and CAD off-origin bounds remain. The large profile actually restores six sleeping bodies
and matches20subsequent steps after wake-up. Existing HOLDs, multi-hinge/eight-box NO_GO, first failures and
measurement/manufacturing limits remain. Full Viewer/Studio and hardware validation are NOT_RUN.

## P3 disjoint-hinge qualification

The common World now admits the exact four-sphere/two-disjoint-hinge profile
in [profiles and lifecycle](/packages/physics/profiles-and-lifecycle#use-the-selected-disjoint-hinge-model).
No body is shared. Empty commands are the supported input. The study uses
Node 22.19.0 on macOS ARM64, zero gravity and dt=1/120 s.

| Receipt | Executed result and boundary |
|---|---|
| Staged observed source | Original 1,200 steps pass. Exact six-phase raw data, complete projection certificates, reports, corrections and caps match the authenticated independent 80/120-digit bank. All original physical gates also pass. |
| Staged ordinary repeat and actual native emitted | 1,200 steps each pass public-bit correspondence to that qualified source. Their internal phases were not observed. |
| Selected controls | PASS: global constructor attempts 47, step attempts 4,180, queries 18. Includes six first-step RENAME/PERMUTE checks, two RENAME recovery steps and retained state after 52 refusals. No 1,200-step variant claim. |
| Attached recorder, separate gate | Source/native PASS: four constructors, 20 accepted steps and six refused step entries. Four-frame restore and both S5 continuations agree exactly. Eight internal restore steps are source-bound counts, not new instrumented native traces. |
| Actual current public API, separate gate | Source/native PASS; strict emitted declarations compile. Fourteen constructor attempts include ten quaternion refusals. Six accepted steps include four original-bank comparisons and two existing free-sphere compatibility steps. |

The current source differs from the staged calculation only by an additional
raw-quaternion admission restriction and generated provider identity. It requires
exact initial `[+0,+0,+0,1]`; scaled or negative-zero aliases refuse. The
original 1,200-step receipts retain their staged source hash. They are not
reported as a fresh 1,200-step execution of the hardened current source.

For observed SOURCE, maximum COM/plane drift, anchor gap, axis deviation and
measured momentum residual components are zero for this fixture. Maximum
angular correction is 0.0010000000000000002 N·m·s, below the original 0.01 cap.
First reported limit is step 197; motor first becomes zero at step 198; both
final angles are 0.8 rad. These measurements do not supply a time-step
convergence order or general mechanism accuracy.

The historical candidate's step77 one-ULP report mismatch remains NO_GO. Its
original intermediate operands are still unknown. New step77 operands match
the saved bank; this does not explain or erase the older failure. Connected
joints, arbitrary geometry/materials/gravity, cross-component contact, nonempty
control commands, stable eight-box stacks and hardware validation remain
unsupported or NO_GO. All existing HOLDs and first failures remain.

See the [P3 report](/physics-evidence/p3-report.txt),
[main DATA audit](/physics-evidence/p3-main.json),
[controls](/physics-evidence/p3-controls.json),
[recorder](/physics-evidence/p3-recorder.json) and
[current API](/physics-evidence/p3-adoption.json). These local receipts do not
establish publication, Studio/Viewer acceptance or measured equipment agreement.


## P5 common World visual profiles

The only simulation factory is root `createPhysicsWorld(model, options)`.
Cloth, basin water, XSPH water and one static CAD shelf are explicit model data.
There is no old domain factory, compatibility engine or second domain clock.
These remain visual profiles, without material calibration or dynamic coupling.

Public source and actual native published-map runtime cohorts each pass101factory
attempts:37returned Worlds and64creation refusals. Each records6334step entries:
6281accepted,13synthetic preparation failures and40refusals. The refusal count
includes4private numeric-limit controls. Separate source/native state retention,
repeat and raw-output comparisons pass. Fault controls are test-only evidence.

| Named check | Result | Fixed gate and boundary |
|---|---|---|
| Cloth, five240-step Worlds per graph | All241frames per World pass the independent research oracle comparison | Absolute component error≤1e-12; exact peak error was not recorded. Oracle generated once from the original independent research implementation. |
| Cloth geometry | Maximum sampled triangle penetration0.0013840839157666096m; structural extension0.05174255069177636 |≤0.002m and≤0.10 respectively; not calibrated fabric accuracy. |
| Cloth cost | Source p95≤1.849875ms; native p95≤1.947125ms across three timed runs each | Each<8.333333ms on the named host. |
| Version1 low-start water | Density residual0.22785881124725596 at60;0.015288410357167534 at240 |<0.25 and<0.05; six basin runs per graph reach720steps, not the3600-step admission cap. |
| XSPH cost | Maximum paired ratio1.21170536 |<1.5; visual coefficient0.15 is not calibrated viscosity. |
| Static CAD shelf |859cumulative hits at60;2660at240; source/native original hashes and geometry checks pass | Two shelf240-step runs plus one bare timing run per graph; static contact only. |
| Domain recorder refusal | Cloth `WORLD_LIMIT`; three fluid profiles `INVALID_SNAPSHOT`; no owner residue | Original128KiB/1MiB/512frame/4096command caps retained; no domain recording, restore or wire qualification. |

Strict positive/negative source/native consumers pass. Compilation covers60
source entries and127logical source/native/generated/root bundles. Native
rendering dependencies use an explicit boundary:8missing published SDK endpoint
identities across13hosts are external. Viewer/CADInterop/GPU implementation
closure and product execution remain NOT_RUN. Physics, CAD and replay use
actual native modules without a source fallback. Earlier compilation and
copy-provenance failures remain recorded; authenticated passes are reused.

The displayed visual example passes in a separate source cohort:4Worlds,
4accepted steps,4failed recorder attaches and4disposals. This is not a fresh
execution of the older full documentation suite. Site structure/build/link
receipts are separate. A documentation build executes no physics and cannot
supply runtime accuracy evidence. The original native import failure
from a private/root `types.js` external-name collision is preserved. The build
now selects externals by canonical source path; repaired native entry import
and subsequent public runtime pass.

Detailed commands, provider hashes, raw operands, immutable references, first
failures and exact proof limits are in the repository report
`examples/physics-world-p5-2276/README.md` and `public-runtime-results.json`.
P4 full eight-box settling remains NO_GO. Connected mechanisms, P6 coupling,
P7 control, full Viewer acceptance, measured equipment validation and
manufacturing approval remain unsupported or NOT_RUN. Existing HOLDs remain.


## Additional qualification gates

The [current package roadmap](/physics-evidence/api-roadmap.txt) names seven
additional gates G1–G7. Core work covers already-admitted anisotropic box
rotation, a finite contact-law/CCD coverage map and trustworthy provider/oracle
failure-prefix evidence. Selected extensions must first qualify the COM/tensor,
rank/conditioning, mixed-endpoint/substep and recording capabilities they use.
At that checkpoint capsule inertia remained an isotropic proxy; a free-rotation box gap
must not be misreported as a measured capsule or old cubic-stack failure.

These are scoped dependencies, not seven new public features. Existing P3/P5
receipts and original gates remain. General mesh collision, rotating CCD,
fluid–cloth coupling, self-contact, fracture and generic plugins remain optional.
Studio, hardware and manufacturing HOLDs remain. The private contact-free
impulse campaign passes its frozen source/native population; it advances no
time/orientation and does not qualify public coupling or general rotation.

Later G1 checks remain staged. Eight named input/frame cases pass on Source and
genuine emitted World: cyclic axes, world half-turns, radial near-unit q signs
and one equal-inertia mass/length pair. The first run passed one physical case
then failed test-observer cleanup; the later result reuses that physical audit
and preserves the original FAIL. The largest angular-momentum error is
2.1876288451716093e-17 kg m²/s. This is a finite one-step population.

The separate command/recorder gate passes on both graphs: six actual Worlds,
twelve accepted steps, eight independent endpoint audits and six refused steps
that preserve state, recording and accepted caches. It checks principal-axis
impulse/torque expiry and a two-step general triaxial record–restore–continue
path. Maximum angular-momentum error is 1.600786710055395e-17 kg m²/s. New ODE
windows are zero; recorded continuation equality is separate from physical
reference accuracy. The [roadmap](/physics-evidence/api-roadmap.txt) names the
exact source reports and remaining boundaries.

These checks do not activate the private rotation prototype in the public
package. Wider admitted inertia/spin/dt inputs, G1a x/y symmetry, off-axis
loads, motors, contacts and joints still need their own qualification. The
original production gyro NO_GO and eight-box NO_GO remain. No tolerance or
HOLD changed; no measured-equipment or manufacturing safety claim follows.

## G1 nonprincipal loads and public range

The historical G1e checkpoint added a breaking public input boundary, superseded by the general rotation checkpoint below. The earlier G1d principal
torque oracle checked a full-kick/free discrete map. Its original PASS is
preserved, but it is not evidence for the continuous-torque pose. In the new
paired Source/emitted baseline, nonprincipal J alone passes. J with constant
world torque fails: maximum R-entry error is 6.261993963206803e-6 and torque-work
residual is 2.592920627392333e-7 J, despite passing final angular momentum.
These actual first failures remain recorded.

An independent 13-state body-momentum/rotation/work ODE supplies directed
80/120-digit Taylor32 targets with full degree64 defect bounds. It does not use
the candidate's quaternion RK4 method. The new forced candidate passes on both
graphs with maximum R-entry error 3.641892612819734e-13 and work/energy residual
4.0216506512969355e-15 J under the original gates. Its four-World micro reused
the same paid bank. Tool-path and compiler-output failures before physical
evaluation are preserved separately; no cap or tolerance was increased.

The actual package Source and canonical bundled emitted root/replay then pass
the selected API gate: sixteen actual Worlds and sixteen accepted steps,
including two internal reconstruction steps; six independent endpoint audits;
eighteen refused steps and twenty-four refused configurations. Recording restore,
forced-helper Error/NaN preservation, renamed labels and sphere/cube free-spin
compatibility pass. Public state/log retention and subsequent output were
observed; hidden cache identity was not directly observed in this canonical graph.
Strict root/replay declaration compilation and the published-map consumer pass.
This does not claim the full CAD SDK or every package subpath was rebuilt.

That checkpoint admitted only the exact one-step rotor. Its rejected-input and
one-step receipts remain unchanged. The later general implementation removes
that restriction and rechecks affected callers; it does not reinterpret those
older failures as passes.

The [roadmap](/physics-evidence/api-roadmap.txt) records source reports and remaining
dependencies. At that checkpoint longer forced trajectories, three-dt refinement, wider primitive inertia,
axisymmetry, forced frames, contacts, joints and motors remained open.
Studio/manufacturing/equipment HOLDs, original eight-box NO_GO, old error gates
and all first failures remain. No deployment or machine-safety claim follows.

## G1 general continuous rotation

The common World now uses actual mass, dimensions and orientation for free and
constant-torque primitive rotation. The literal G1e whitelist and one-step
horizon were removed without a legacy path. The model ranges and existing
error gates remain. The free map retains27 composition stages and4 Newton
updates; a priori conditioning subdivisions are capped at64. Forced rotation
uses modified midpoint2/4/6/8 with eighth-order extrapolation, not a torque kick.

Actual Source and canonical compiled root/replay each pass31 Worlds and3925
accepted steps, including reconstruction. The23-case matrix includes nine
mass/length scalings, transported frames, all three box symmetry axes, sphere,
cube, capsule, zero spin and an arbitrary impulse. Source and Native match at
every captured endpoint and every frame in the grid/long-run hashes. This is
same-runtime deterministic evidence, separate from physical accuracy.

| Check | Independent reference | Maximum measured error |
| --- | --- | --- |
| Constant world torque,0.1s, dt1/60,1/120,1/240 | Directed80/120 Taylor32 p/R/work ODE, six shared physical times | R entry3.073e-16; omega2.299e-15rad/s; work1.253e-16J |
| Free axisymmetric primitive endpoints | Closed symmetric-top solution with rational exponential tail | R entry7.142e-16; omega1.018e-15rad/s |
| Triaxial free rotation,3600steps,30s | Independent volume inertia and E/L,32 retained samples | L component2.039e-14N·m·s; energy2.664e-14J; squared-q norm4.499e-16 |

Trajectory gates remain `1e-11+1e-12*abs(reference)`. E/L/work gates remain
`1e-12+1e-12*max(1,abs(actual),abs(expected))`; squared-q norm stays1e-12.
All three forced grids are below the old1e-11 rounding floor. This establishes
no empirical order from refinement. Long-time phase accuracy is NOT_RUN.
Large-inertia scale cases use the unchanged relative gate; their absolute
E/L errors must not be compared with the small body's2e-12 absolute bound.

Capsule validation first preserved a physical failure from the former enclosing
sphere inertia: L error0.004422625739232428N·m·s against2e-12. The current capsule
uses uniform-volume cylinder/hemisphere COM moments and passes the analytic
free-rotation check. Forced capsule checks cover L and norm; its independent
trajectory and work remain NOT_RUN. The original capsule failure is retained.

Known numerical refusal and an injected unknown forced-solver exception leave
accepted state and recording unchanged. Recovery, record/restore and actual
continued execution against a fresh two-step control pass on both graphs.
Strict root/replay compilation and declaration consumers pass. The existing
compiled rotation, oriented-collider and broad-phase probes also pass with
unchanged inputs and physical criteria. Full CAD SDK/subpath closure, browser
physics proof and release-gate closure are NOT_RUN.

The execution contract, raw observations, reference bank, freezes, numerical
errors and commands are in `examples/physics-general-rotation-2276/RESULTS.md`.
The original8-box NO_GO and connected-mechanism/contact/CCD limits remain.
Studio, manufacturing and equipment HOLDs, old tolerances and all first
failures are preserved. No deployment or equipment-safety claim follows.

## G2 rounded sphere/static-box CCD

The former expanded-box boundary reported C03 atTOI0.16666666666666663
although squared distance0.0125m² exceeded the radius gate and the public World
had0 contacts. Both the old helper witness and an additive compiled-World
baseline remain preserved. The current unreleased kernel replaces this geometry
with actual Euclidean sphere/box contact; it has no old-sweep fallback.

Exact local dyadic integer predicates decide initial ownership, at most7 plane
intervals, polynomial discriminants and root-domain membership. Stable roots
and projection numerators produce floating TOI and normals with NUMERIC_LIMIT
guards. An independently authored oracle enumerates6faces/12edges/8vertices
and uses exact Fraction decisions plus directed80/120 enclosures.

All16 original cases pass Source then Native, each with immediate independent
audit. Maximum TOI error2.384e-17; normal component error1.388e-16; squared-normal
error3.645e-16. Existing gates stay1e-12 for TOI/normal and1e-12m for contact.
The original C03 now reportsTOI0.18899576603592683, normal approximately
[-0.8660254038,0.5,0] and1 actual contact.

Public Source and canonical compiled root/replay each pass26Worlds/29steps,
plus a separate1World/1step unknown-error rollback check. Rectangular,
cyclic-frame, translation/scale, earliest/tie, recording restore/continuation
and numerical/unknown failure retention pass. Four existing compiled probes
pass unchanged. This does not certify the full CAD SDK or every package subpath.

The dedicated desktop scene (`node examples/physics-rounded-ccd-2276/scene/server.mjs`,
localhost port52900) passes9 actual Chrome checks across all16 original boundary cases plus five feature scenes and desktop
widths1280/1440/1920. It verifies accepted positions/XYZW, real GPU pixels,
TOI distance and normal/contact marker, camera and playback clock. An initial
renderer duplicate-surface-ID failure is retained separately; distinct display
IDs fixed it without changing physics or criteria. Screenshots prove presentation.

Existing1e-9 inward bias and remaining-time discard are unchanged. Initial
penetration remains owned by the existing discrete path; static-box sweep
qualification does not imply rotating-body CCD, arbitrary scale guarantees,
all material branches or exact CAD collision. Remaining G2 restitution/friction
switch evidence, original8-box NO_GO and all HOLDs remain. Source/command/error
records are in `examples/physics-rounded-ccd-2276/RESULTS.md`. No deployment,
release or machine/manufacturing acceptance follows.
