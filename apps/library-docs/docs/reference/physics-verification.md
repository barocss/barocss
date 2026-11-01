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

Recorder attachment was outside that P1b slice. The current P2 recorder is described below. Common fluid/cloth migration, Viewer product acceptance, hardware and manufacturing remain outside this work. Existing Physics/Studio/manufacturing HOLDs, public
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
