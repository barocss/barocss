# Physics verification

This page records bounded numerical evidence available on this independent development branch. It does not clear
the existing Physics, Studio or manufacturing HOLDs. Historical two-hinge and eight-box failures remain preserved.
A new stationary-only eight-cube qualification and bounded disjoint-hinge qualification are recorded separately below. General moving eight-box dynamics remain NO_GO. No measured machine validation,
manufacturing approval or deployment follows from these results.

Read [Physics](/packages/physics/), [Units and frames](/packages/physics/units-and-frames) and
[Profiles and lifecycle](/packages/physics/profiles-and-lifecycle) before selecting a test. For prescribed joint
motion, use [Robot motion](/guide/robot-motion). A supported input is not a claim that every admitted parameter
has been verified to the errors below.

## Stationary eight-cube World and actual desktop checkpoint

`rigid-stationary-cube-stack-v1` uses the same public World/clock/recorder.
The independent private ALIGNED/OFFSET/YAW campaign passes1200 steps each,
including original32-point contacts,36-row position, ledger, quality, complete
archive recovery and additional exact Fraction certificate checks. Original
scene limits170s/owner180s and shared293601280-byte cap remain; actual evidence
uses186002682 bytes. Global64MiB/RSS is not qualified.

Strict NodeNext Source and actual compiled root/replay each pass public controls
and all3600 body-word comparisons. Actual desktop Chrome WebGPU also accepts
all3600 steps; its full captured body streams equal the independently checked
private traces exactly. GPU vertices/markers, camera, controls and1280/1440/1920
widths pass. No mobile tests. Source/native failure tests preserve state/log/
clock, including20 injected throws per nonzero first-step gap bank. The gap has
one independent physical step, not a long-trajectory certificate.

This profile maintains unforced equilibrium. Near-zero visible movement is
expected. Eight1kg half0.25m cubes, yaw-only initial poses, zero motion, fixed
floor/materials/gravity/dt1/120 and empty commands are required. Generated
contact-chain and exact witness checks can still refuse unsupported geometry.
The persistent-box cap remains4; recorder caps remain512frames/1MiB. A1200-frame
observation is not a PhysicsRecording. General falling/collapse/frictional
settling of eight bodies remains unqualified. See this branch's
`examples/physics-stack-stationary-world-2276/RESULTS.md`.

The same-stage dynamic screen check reuses existing1/2-body centered impact
with actual emitted Physics. Eleven desktop checks pass six presets and verify
post-impact velocity0.5m/s, impulse5Ns and energy0.25J for the minimum restitution
case; the body travels upward and actual GPU pixels change. This is zero-gravity,
zero-friction impact, not a gravity-driven eight-body test. Next are small-island
gravity trajectories and corresponding desktop motion before expansion.

## Gravity flight and delayed collision with desktop motion

The existing public persistent-box profile now has separate bounded trajectory
evidence: a cube falling from Y0.75m to a floor, and two equal2kg cubes with an
initial0.125m surface gap. Source and actual compiled root/replay each pass
11Worlds/1018accepted steps, record/restore/continue, repeat and known/unknown
failure retention. The fall contacts at27 and remains supported through256;
the pair contacts at8 and then separates through256. Independent Fraction
ballistic, Newton/momentum/energy/gap checks pass, with exact Source/Native
numeric-word parity. Five paid observer positives and12negative controls plus
signed-zero restoration pass separately, with no new World calls.

Three1second free-gravity controls at60/120/240Hz show continuous-position
errors0.08175/0.040875/0.0204375m and signed energy defects
-1.603935/-0.8019675/-0.40098375J. Both error ratios are~2 under the original
criteria. The integrator is first-order; this is not mechanical-energy
conservation, exact TOI or millimeter accuracy. Projection work is separate.

Actual desktop03 uses the same Native inputs/provider, passes all256steps per
scene and compares all257public states/numeric words exactly with paid Native
data. Fixed-resolution real GPU readback changes3149/1554pixels during motion;
camera, step/play/pause/reset, separate kinetic/potential fields and
1280/1440/1920 widths pass with zero page/console/network errors. Screenshots
prove rendering only. First transparent-readback and scene-reset failures are
preserved with their original source/proof; neither changed physics criteria.
See `examples/physics-stack-dynamic-next-2276/RESULTS.md` on this branch.
No new solver/profile, moving8, mobile, equipment validation or deployment follows.

## Two cubes sharing a floor and a bounded coupled chain

Two separated2kg cubes and a finite static floor pass actual Source/compiled
World checks at60/120/240Hz, with9Worlds/1022accepted steps per graph including
restore4. Each cube's still-free flight is checked until its own first contact.
Both later floor contacts coexist; exact rotated projection bounds prove a
positive0.5m cube separation. Public representative plane/boundary checks use
1e-12m, independently of SI1e-10. Same Native desktop verifies all257states/
words at120Hz, left contact27/right47, actual GPU motion and desktop controls.
This is independent support, not a dynamically coupled stack. See
`examples/physics-two-cubes-floor-2276/RESULTS.md`.

The preserved first vertical upper/lower/floor chain fails on coupling at27 in
both actual graphs. Independent global position/normal projections measure
velocity error0.008623153568856012m/s and position error2.934570312507212e-5m
against1e-10; representative geometry fails1e-12m. The engine accepted27steps
but only26independently pass. Exact Source/Native reproducibility does not
establish physical correctness. First failures/loaded inputs remain preserved.
A package-private global normal/all-pair position repair now runs through the
sole public World. It uses real inertia and generated point impulses, checks
their applied wrench/KKT, and prepares fresh geometric representatives before
the shared commit. The zero restitution/friction, awake dynamic/static box
regime requires direct broadphase; AABB explicitly refuses. Typed candidate
failure does not fall back to the old iterative law.

Actual strict Source and canonical Native32/256 trajectories pass. Each graph
uses6Worlds/786accepted steps including256 coupled,4restore+4continuation and
522 regression steps. All257 coupled states/words match. Independent full
reference maxima: velocity3.159e-15m/s, position2.887e-15m, representative
face/bounds8.882e-16m against unchanged1e-10SI/1e-12m gates. Terminal256
mutations are rejected, including a1e-11m point shift. Actual known numeric
refusals preserve state/model/clock/log; empty retries equal paid clean states.
Unexpected Error/object/null retain identity in separate instrumented provider
copies, which are explicitly not canonical-provider trajectories.

Actual same-Native desktop passes256steps, all257 public states/words,2187
changed GPU pixels, separate kinetic/potential display and1280/1440/1920
controls with no page/console errors. The executable
[two-cube example](/packages/physics/profiles-and-lifecycle#two-cubes-and-a-floor)
passes2 tests. This qualifies the aligned equal2kg cubes/floor at120Hz through
256steps. Rotated anisotropic contact still refuses with NUMERIC_LIMIT and
retained state; friction, elastic networks and general moving8 remain outside.
No screenshot is used as a physical oracle. See
`examples/physics-coupled-cubes-floor-2276/RESULTS.md`. HOLDs and original gates remain.

## Sphere-pair CCD checkpoint

Exact represented endpoint/radius predicates fix an observed false graze: the
original positive closest gap9.999999987147026e-12m exceeds the old1e-12m gate.
Original failure/provider/input remain. Each Source and actual compiled public
graph passes29Worlds/33steps and22direct helper calls. Independent exact
closest-approach classification and fixed80/120 chord audits check88results;
maximum TOI residual3.906e-17 and distance residual1.607e-16m meet unchanged
1e-12 gates. Actual desktop GPU Viewer tests pass8checks/four inputs at
1280/1440/1920. Tiny display radii are labelled1000×; accepted centers stay exact.

The first browser driver failure from a closed details panel is preserved;
opening the actual panel resolves visible-data verification without changing
physics or criteria. No mobile or deployment. This finite two-sphere profile
does not qualify extreme outputs, rotating non-spheres, remaining-time flow or
friction-coupled impacts. See
`examples/physics-sphere-pair-ccd-2276/RESULTS.md` on this branch.

## Axis-aligned box CCD and quaternion sign

The original public baseline records negative-identity quaternion admission
refusals. The repaired check accepts q and -q for the same identity rotation;
all existing1e-12 orientation/angular thresholds remain. Each Source/compiled
graph passes20Worlds/24steps across20 cases, with two creation and two angular
command refusals. Independent exact face-event references give zero recorded
residuals on the fixed dyadic inputs. Refusals preserve state, clock and recorder.

Strict compilation and original thin-box assertions pass. A dedicated actual
GPU Viewer passes9desktop checks/four presets at1280/1440/1920 in Chrome156,
with zero page/console errors. This proves accepted-pose display, real mesh
pixels and controls; screenshots are not the numerical oracle. Setup import
and module-externalization failures remain preserved separately. General box
rotation, corner/tied-axis and angular-neighbor boundaries stay unqualified.
See `examples/physics-box-slab-boundaries-2276/RESULTS.md`. No mobile or deployment.

## Offline P4 reference checkpoint

An integer SAT observer candidate matches2592saved numeric words exactly over
six saved frames,432PRE/HYPpair stages and12960axes. Independent saved numeric
authority and a separate Fraction rounding-cell observer are used. No World,
QP or old-reference computation is rerun. Its measured534.484msCPU is for this
numeric subset only, and is not a whole-reference speed or stack certificate.

The next explicit compact V2 protocol matches432 records and13926 retained
physical payload leaves. Full cold-position V2 matches6 fresh cold QPs and
17394 retained leaves, including selection, points, ties, lambda and KKT.
These are saved-frame numeric/output checks, not independent feature geometry.
The baseline core CPU is773147000ns. Primitive-axis and owned-Node candidates
both fail their predeclared10percent cost improvement gate. The Node comparison
includes its ENTIRE reaped child CPU and uses a conservatively wider boundary;
one saved pairing is not a general benchmark. Neither candidate is retried for
a better timing result. See `examples/physics-p4-position-v2-2276/RESULTS.md`
and `examples/physics-p4-node-sat-2276/RESULTS.md`.

Full32-point line/paired witnesses, ledger/quality and whole-trajectory cost
remain unqualified; original1200-step eight-box settling stays NO_GO. The
first rounding-boundary certificate failure is preserved. Engine/API/desktop
evidence remains separate from these offline calculations. See
`examples/physics-p4-sat-2276/RESULTS.md`. The updated19-branch G2 map retains
explicit gaps, including persistent friction, general projection/coupled work
and remaining finite CCD cases; it is not a blanket engine PASS.

## Unequal discrete restitution and persistent geometry

Sixteen centered discrete impact cases pass both Source and compiled public
World paths: fixed box/sphere, fixed box/cube and unequal-mass sphere pairs.
An independent Fraction bank solves momentum and relative-velocity constraints
before any World execution. Unequal material minima,0/1 endpoints, orders and
the strict0.5m/s switch neighbors are covered. Maximum velocity residual is
4.441e-16m/s, impulse8.882e-16Ns and energy1.333e-15J, below unchanged1e-10
gates. The reference setup's first zero-pivot failure is preserved separately.
No engine change or new rendering claim follows from this finite test. See
`examples/physics-discrete-restitution-2276/RESULTS.md`.

A separate persistent-box public baseline remains NO_GO. One Native World
accepts two steps, but step2 tangent-plane residual7.192e-9Ns exceeds1e-12Ns.
Independent native line audits find accepted aggregate paired gaps8.509e-6m
and5.692e-5m against1e-12m. These audits do not establish every internal PRE
force point. Geometry, phase correspondence and cache repair must pass before
this profile can be expanded. A private feature candidate's construction and
Source/compiled parity passed, but its first independent rounded midpoint-line
check failed. Private construction is not public physical qualification. A
separate fixed27-member cell algorithm now passes20cases/62points per graph.
Independent Hamilton/Fraction calculations verify all3348 cell members and124
exact certificates across the two graphs. All32 original rows match RAW
coordinates exactly, with zero movement. The old single-rounded-line failure
remains. This proves nearest-feasible selection inside that finite cell only.
Force application phase, cache handling, public persistent physics and full P4
remain NO_GO/NOT_QUALIFIED. See
`examples/physics-box-quantized-witness-2276/RESULTS.md` and
`examples/physics-persistent-friction-plane-2276/RESULTS.md`.

The separate32-point force/moment recheck gives exact ZERO residual for all48
scalar balances per saved graph, using nonnegative cumulative-weight loads and
the unchanged RAW coordinates. No World or QP runs. Saved PRE force balance
does not prove feasible gaps, complementarity or dynamic settling. See
`examples/physics-box-quantized-equilibrium-2276/RESULTS.md`.

The next SOURCE_PRIVATE phase audit commits one actual step and captures168
impulse applications. Native geometry, correction, momentum and work prefix
checks pass, but the old aggregate report fails: its X impulse differs from
the actual applied sum by0.06810993686254845Ns against1e-10Ns. Final active
cache rows are zero while earlier applied impulses survive in other rows.
The first failure is preserved. Later moment/rollback/retry/restore gates and
Native/public/desktop promotion are NOT_RUN; warm-frame reuse is NOT_COVERED.
This motivates a separate accepted-geometry and integrated-wrench contract;
it does not qualify a new public API. See
`examples/physics-contact-phase-wrench-2276/RESULTS.md`.

A separate SOURCE_PRIVATE producer implementation passes3 Worlds/8 attempts/
6 accepted steps, with800 actual applications and58 geometry queries. It reports
both bodies' integrated impulses and world-origin moments independently of
accepted end-pose geometry. Independent geometry, momentum and work checks,
known/unknown fault rollback, retry, clean control, prefix restore/continue and
nested state isolation pass. Recording2 rejects old shapes before World creation.
Successful wire round-trip is private pure-codec evidence; successful public
serialization/deserialization, Native, current package integration, desktop and
performance are NOT_RUN. There are zero actual warm applications. See
`examples/physics-contact-wrench-producer-2276/RESULTS.md`. The original report
failure and public persistent-friction failures remain preserved.

Later private typed Source and actual NodeNext emitted modules each pass3 Worlds/
8 attempts/6 accepted steps. All22 retained packets match between those graphs;
old Source comparison maps only providerDigest. Earlier strict compile and
whole-emission CAD dependency failures remain preserved. Actual reachable-entry
closure and declaration consumer pass; unused CAD execution and full typing of
two inherited suppressed modules remain unqualified. See
`examples/physics-contact-wrench-native-2276/RESULTS.md`.

A separate real warm-frame case first fails9.141407e-5 Ns against1e-12. Its
warm-only projection repair passes unchanged inputs,1 World/2 steps and9 exact
Gram helper cases. Maximum tangent-plane residual1.301150e-18 Ns and energy
ledger4.673587e-16 J pass existing gates. The immutable Source provider then
passes4 Worlds/8 attempts/6 accepted steps, including failures after actual
projected warm application/map mutation and exported wire serialize/deserialize,
live restore and continuation. Hidden replay public output is not retained;
its raw equality is NOT_PROVEN although full actual trace parity passes. See
`examples/physics-warm-transport-2276/RESULTS.md` and
`examples/physics-warm-replay-2276/RESULTS.md`. The composed typed Source and
actual emitted Native each then pass4 Worlds/8 attempts/6 accepted steps;
38 complete packets and all4791 wire bytes match with no new-graph normalization.
See `examples/physics-warm-native-2276/RESULTS.md`.

The actual emitted browser consumer passes10 desktop Viewer checks at
1280/1440/1920 with zero page/console/network errors. It renders accepted poses
and contact points on explicitly display-only GPU triangle packets. Its complete
browser proof is retained after the original capture-path failure, whose missing
full history stays NOT_RETAINED. The first independent physical audit did not reach
an observer: the old decoder refused its1M-fragment work budget. The new data-only verified-span algorithm passes21
controls, every480 original pool hash and the full original root SHA/byte count.
It preserves the old resource NO_GO and uses bounded authenticated byte reuse
with a stricter cumulative1M emitted-span counter. The SAME retained browser
proof then passes independent native geometry, Gram, momentum/work/wrench,
actual A2/D2 warm coverage and wire/live restore checks. Eight browser/Node
word observations match for this one campaign; no global identity follows.
Screenshots remain visual evidence and are not physical-observer input. Current package adoption, general cache/cone laws, full P4,
original CAD surface rendering and broader performance remain unqualified.

The next source-only cone before-case commits one real step, passes exact
contact geometry and the full work/wrench ledger, then fails the coupled
constitutive gate:0.1410596011492487 m/s exceeds1e-10 for a contact whose exact
3x3 sticking solution is feasible. All64 tangent updates use dynamic friction
against a partial normal load. Later at/after cases are NOT_RUN. See
`examples/physics-persistent-cone-2276/RESULTS.md`; that NO_GO does not invalidate
or broaden the separately qualified Viewer finite profile above.

A separate private coupled static solve passes the unchanged before/at inputs
in Source and actual strict NodeNext emitted JavaScript. Each graph uses3 Worlds,
3 attempts and2 accepted steps. The independent virtual-unit-impulse/Gaussian
reference and original physical/cone observers pass. Contact-velocity,
momentum/spin and work-ledger residuals are zero; maximum current tangent-plane
residual1.8973538018496328e-19 Ns passes the unchanged1e-12 gate. One total world
impulse and63 actual zero applications use the original64 slots. All33 retained
Source/Native packets match without normalization. Three pure reference cases
and eight separate refusal controls pass per graph.

The unchanged after input returns COUPLED_DYNAMIC_REQUIRED before application;
raw accepted model/state/cache/time/recording remain unchanged. This proves a
refusal, not dynamic contact accuracy. The original first build's esbuild
launcher authentication failure is retained; an exact-source continuation uses
the already installed native binary with its original hash. No download or
physical-gate change occurs. See `examples/physics-coupled-contact-2276/RESULTS.md`.
Only the first cold single-point unit-cube/static-box interval is qualified.
The new candidate's separate actual emitted desktop consumer passes6 checks
at1280/1440/1920 with zero page/console/network errors. The complete original
browser proof passes SHA/DAG/input/full-history census checks and15 unchanged
independent geometry/physical/cone/target observers. Its3 Worlds/3 attempts/
2 accepted steps remain separate from the earlier warm provider's browser
proof. See `examples/physics-coupled-viewer-2276/RESULTS.md`. GPU triangle packets
are display-only; actual native points and integrated wrenches are separate.
Post-application rollback, wire, warm/multipoint and public adoption are still
separate pending gates. Whole P03 and original P4 remain NO_GO.

The first transaction Source campaign passes actual post-application/bucket
fault rollback, independent prefix physics, retry and complete raw clean
public/recording/private-world storage checks. Actual one-frame serialization
executes, then the hidden World's post-disposal storage comparison fails because
that storage is already cleared. The prefix is2 Worlds/4 phase attempts/
2 accepted steps and129 applications. Full hidden pre-dispose accepted data is
NOT_RETAINED/NOT_PROVEN. Native, deserialization, live restore and parity stay
NOT_RUN after the first failure. The old gate remains NO_GO. A separate bounded
pre-dispose observer is required; reconstructing hidden state is not evidence.
See `examples/physics-coupled-transaction-2276/ROOT-FIRST-FAILURE-01.json`.

A new distinct lifecycle provider captures genuine accepted public/private state
before disposal, without changing solver/geometry/codec code. Observation is
bounded before allocation, cannot mask cleanup/errors and returns independent
copies. Fresh Source/Native controls match40 static packets. One-frame fault
rollback/retry, actual wire roundtrip and live restore then pass4 Worlds/
6 phase attempts/4 accepted steps per graph;44 packet/wire artifacts match.
Hidden B/C accepted public state and full private.world equality now use real
pre-dispose captures. Across-World diagnostic cacheFrames/provenance remain
NOT_PROVEN; the original failed run is unchanged. See
`examples/physics-coupled-lifecycle-2276/RESULTS.md`. The new provider's browser
consumer then passes7 desktop checks and15 unchanged physical observers, plus
full original-DAG/report comparison for three real pre-dispose captures. Two
bounded reads prove copy isolation without advancing Physics. The three-case
browser census remains3 Worlds/3 attempts/2 accepted steps, with zero UI errors.
See `examples/physics-coupled-lifecycle-viewer-2276/RESULTS.md`. Browser wire,
dynamic/warm composition and public integration are separate pending gates.

The independent dynamic reference certifies the complete physical parameter
domain at80/120 digits and matching RNE words on the original inputs. The first
pure candidate reaches a work-limit NO_GO on after;262146 is a denied attempted
charge against the unchanged262144 cap. A separate integer pseudo-remainder/
bounded memo candidate passes3 physical inputs and8 admission controls per
Source/Native graph (13 top-level calls,14 complete packet matches). Its complete
after count is241975 integer primitives. Prices, work limits, precision and
physical gates remain unchanged. See
`examples/physics-coupled-dynamic-efficient-2276/RESULTS.md`. Zero Worlds are
called. General arithmetic boundary banks and actual World integration remain
required; this pure result does not clear dynamic World/P4 NO_GO.


## Discrete friction checkpoint

The discrete contact solver now solves both static tangent constraints and uses
geometric sphere/static-box radius arms. A non-unit normal no longer creates a
false tangent for axial support. Existing dynamic ray/clamp law, material mixing,
iterations and thresholds remain. Original wrong-branch/surface-slip failures,
first candidate regression and invalid test input are preserved separately.

Each actual Source/emitted public API passes27Worlds/31steps with20valid cuboid
controls and one expected creation refusal. Original22sphere boundary inputs
pass unchanged per graph. Independent scalar physical constraints audit40cuboid
impacts; maximum surface-slip residual2.221e-16m/s meets the unchanged1e-10 gate.
Original3000-step support and240-step sliding/rolling tests pass both graphs.
The actual GPU Viewer scene passes9desktop checks/four presets at1280/1440/1920,
including real mesh pixels, accepted poses, contact readings and recorder time.
No mobile, deployment or real-machine validation follows.

This qualifies centered principal-normal contacts with zero normal/tangent
coupling. Persistent friction, finite-overlap unequal-mass sphere pairs,
arbitrary off-center/simultaneous impacts and original eight-box settling remain
separate. Full commands, numerical errors and preserved failures are in
`examples/physics-tangent-response-2276/RESULTS.md` on this branch.

## Persistent box impact checkpoint

The persistent manifold now applies minimum material restitution from point
velocities captured before each pair's warm start. The strict closing-speed
switch is `>0.5 m/s`; iteration counts, friction mixing and public four-body
limit stay fixed. The original outgoing-zero failure remains recorded.

Source and actual emitted public root/replay each pass28Worlds/287steps;
separate warmed-cache restore/fault checks each pass3Worlds/9steps. Independent
exact-rational Newton/momentum audits pass40finite impacts. Maximum velocity
error2.221e-16m/s and impulse/energy errors8.882e-16SI pass the unchanged1e-10
criteria. Actual desktop GPU Viewer tests pass11checks/six inputs at1280,
1440 and1920pixels, with real pixels, accepted poses, motion and recorder
clock. No mobile check or deployment was performed.

This qualifies centered principal-axis zero-friction impacts. It does not
qualify general tilted/off-center or simultaneous impacts, friction transitions,
projection work or original eight-box settling. Source, compile and rendering
proof remain separate from the published browser SDK and real equipment.
Implementation, commands and raw evidence are in
`examples/physics-persistent-impact-2276/RESULTS.md` on this branch.

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

## G2 private coupled contact: first interval

The new private staged provider qualifies the original before/at/after contact
inputs through arithmetic, actual World calls, failure/recording recovery and
the actual Native browser graph. This does not adopt the new contact schema in
the canonical package or qualify long stacking.

| Gate | Actual executed evidence | Boundary |
| --- | --- | --- |
| Shared arithmetic | Source/Native each13 production calls, all14 complete files and counters equal the prior candidate; separate52 independent literal boundary cases and53-file parity | Separate cap16 and cap64 processes; zero Worlds |
| Clean actual World | Source/Native each3 Worlds/3 accepted intervals,192 applications,18 independent observations;26 full files match raw | One cold point, first interval, unit cube/static box |
| Dynamic rollback and wire | Each4 Worlds/6 phase attempts/4 accepted,257 applications,20 independent observations;38 raw packet/wire matches | Actual post-J/bucket failure and genuine serialize/deserialize/restore; empty commands only |
| Desktop Native browser | Each fresh campaign7 checks,18 independent observations and6 complete decoded packet matches with actual Native Node | Desktop1280/1440/1920; latest GPU campaign explicitly selects after1 |

The actual after normal-speed residual is2.245727290605634e-18m/s and cone
magnitude residual3.26936304418379e-18Ns, within unchanged1e-10m/s and1e-12Ns
gates. Before/at retain the original static result and complete certificate.
Every original8x8 slot remains: one full J and63 actual zero applications.
Actual body response, cache, event ledger and separate pair wrench are audited;
screenshots are presentation evidence only.

Hidden accepted replay outputs use genuine pre-dispose public/private/owner
captures. Hidden initial getters are NOT_RETAINED; explicitly labeled
same-model initial controls are bound to actual creation/start/free-input
records. Cross-World diagnostic trace/cacheFrame equality remains NOT_PROVEN
without ID normalization. The second interval is a typed pre-phase refusal,
not a successful second physical interval. Inherited private typing boundaries
remain explicit; no new type waiver was added.

The original desktop campaign captured before1 GPU images. Its PASS remains.
A separate same-census campaign captures after1 at all three widths. Page,
console and network errors are zero. No mobile test ran. A load-gate refusal
before the first offline audit is retained as NOT_RUN; the later normally
admitted audit reused the original browser data. Initial strict/type/module
setup failures and original numerical NO_GOs remain preserved.

See the executed [clean World report](/physics-evidence/coupled-dynamic-clean.txt),
[transaction report](/physics-evidence/coupled-dynamic-transaction.txt) and
[desktop report](/physics-evidence/coupled-dynamic-desktop.txt). Their commands,
input/output hashes, full observations and immutable archives remain in the
named repository example folders. No public API compatibility path, warm or
multiple-point extension, general inertia, browser wire, long-stack PASS,
deployment or equipment claim follows.

## Current priority for the original eight-box exit

The original P4 cold-normal path already passes matched16-step
ALIGNED/OFFSET/YAW prefixes. A separate ALIGNED run accepted308 steps and hit
the fixed180s limit before309. The earliest observed blocker on this path is
full-reference/runtime cost. Historical public persistent-friction plane/gap
failures belong to their actual providers and remain preserved.

P4 uses eight half-.25m boxes, inverse inertia24I and gravity. The newly
qualified one-point G2 profile uses one half-.5m cube, inverse inertia6I and
zero gravity. Their results do not qualify each other. The original32-point
force balance and the full36-row position problem are also distinct.

The next proposed reference candidate reconstructs an exact KKT certificate
from an explicitly untrusted active-basis witness and checks every position
row. It is DESIGN_ONLY. It requires independent saved cold-QP authority,
numerical proof and one frozen cost comparison before runtime expansion.
Ended cache/Node-SAT/axis cost candidates remain ended. A subset speedup will
not establish a1200-step/180s fit. The original inputs, tolerances,8x8 loops,
first failures and HOLDs remain. Public producer/schema cutover is a separate
qualified lane; it must not retain a legacy compatibility route. See the
[current roadmap](/physics-evidence/api-roadmap.txt).
