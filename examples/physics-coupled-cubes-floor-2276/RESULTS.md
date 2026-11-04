---
work_id: physics-coupled-cubes-floor-2276
artifact_type: verification
status: bounded_public_256_failure_controls_and_desktop_pass
owner_role: independent-physics-algorithm-work
source_request: expand passed separated contacts into an independently checked coupled chain
last_updated: 2026-11-04
---

# First coupled-chain failure, preserved

Stage A separated cubes/floor passes numerical, public World and actual desktop
checks. This new case has an upper2kg cube falling onto a lower2kg cube already
supported by the floor. Its two contact constraints share a dynamic body and
must be solved together. No iteration, tolerance or production change precedes
this baseline. No moving8 or broader coupling qualification follows.

Actual `baseline-02` reports `COUPLED_BASELINE_NO_GO`. Source and actual Native
each use one World/recorder, accept27steps and independently pass only26. Both
stop immediately when the reference rejects step27. All28observed frames match
between graphs, including every numeric word; only providerDigest is normalized.
Source authentication passes; there is no execution timeout or fatal harness
error in this run. Owner command exitsFAIL because the physical exit is NO_GO.
The physically rejected27th state was accepted by the old engine and recorded;
it is not reported as a rollback or successful27-step physical prefix.

The first attempted runner fails parsing before any World call. Its original
source/receipt is preserved in baseline/first-source-parse-failure. Closing the
missing parity-block brace and formatting that block changes no input/gate.
The next run produces the actual physical failure below in3007.751042ms.

| Measured error at first coupling | Actual maximum | Original gate |
| --- | --- | --- |
| Global projected velocity |0.008623153568856012m/s |1e-10 |
| Global projected position |0.00002934570312507212m |1e-10 |
| Normal multiplier |0.03449232534878372Ns |1e-10 |
| Floor closing speed |0.008623009105535429m/s |1e-10 |
| Normal complementarity |0.03917870804958754J |1e-10 |
| Representative face-plane error |0.00002934570312501661m |1e-12 |
| Unexpected angular speed |0.000003850396767757225rad/s |1e-10 |
| Global kinetic projection error |0.00014871506866048515J |1e-10 |

Measured linear momentum/stationarity is about1.034e-15Ns. Applied impulse
balance alone therefore does not prove normal feasibility, complementarity or
the global minimum. Pairwise corrections leave floor penetration and closing
motion when the upper contact loads the lower body.

The candidate-free Fraction reference enumerates four active sets of the fixed
two-DOF mass-weighted position and velocity projections. It checks the actual
reported multipliers and full momentum/KKT equations. At step27 the independent
global solution has both vertical velocities0 and positionsY0.5/1.5. These are
derived solutions, not target poses passed to the engine or a reused stationary8
certificate. The public representative point is geometric, not a measured
center of pressure. Aggregate-point torque residuals are not a proof of the
actual internal per-point torque distribution; unexpected spin and the global
velocity/position/KKT failures above independently establish NO_GO.

Exact loaded baseline inputs are preserved before library changes in
baseline/pre-library-fix/loaded-inputs.tar.gz:484workspace files,579996bytes,
with SHA/byte manifest and separate external-tool pins. Original cases, model,
all failed prefixes, Source/Native graphs, owner logs and first failures remain.

Next is a private candidate reusing the existing global normal QP and all-pair
position solver, with actual mass/inertia and generated points. It must check
actual rounded per-point applications and fresh geometric witnesses. Increasing
the old8x8passes, snapping rest poses or copying the reference's four-set solver
is outside this repair. Public World adoption and desktop are **NOT_RUN** for
the coupled fix. Existing HOLDs, limits and first failures remain; no mobile or
deployment.

Actual owned command:

```
node examples/physics-coupled-cubes-floor-2276/baseline.mjs baseline-02
```

This output ID is immutable. Its commandFAIL and physicalNO_GO are intentional
reported results, not a test definition or code-presence claim.

## Private repair gate: actual captured FREE27

`private-04` reports `PRIVATE_FREE27_SOURCE_NATIVE_PHASE_CONFIRMED`.
Both private emissions compile; Source and strict NodeNext Native each execute
one detached candidate and one independent phase reference. Source reuses the
authenticated paid FREE capture after26 accepted steps; it creates no new
World. Native independently captures the same phase with one original World,
26 accepted steps and one deliberately refused capture attempt. Captured input,
complete candidate output and all numeric words match between graphs.

The candidate generates8 actual normal points, applies8 rounded per-point
impulses, and runs one existing global normal solve and one all-pair position
phase with3 geometric rows. The original solver budgets and gates remain.
An exactly isotropic local inverse inertia uses the identity R(cI)R^T=cI;
unequal local values do not enter that branch. Actual impulse application still
uses the existing operator and is checked after application. No quaternion,
velocity or position is snapped to the independently derived target.

| Independent private-phase error | Maximum | Original gate |
| --- | --- | --- |
| Global projected velocity |4.440892098500626e-16m/s |1e-10 |
| Global projected position |5.551115123125783e-17m |1e-10 |
| Point normal primal |8.881784197001252e-16m/s |1e-10 |
| Point complementarity |1.960431816883101e-15J |1e-10 |
| Actual point linear momentum |3.5718144453371127e-16Ns |1e-10 |
| Actual point angular momentum |5.73316704659901e-17Nms |1e-10 |
| Post representative face and finite bounds |5.551115123125783e-17m |1e-12 |

Unlike the old public aggregate torque diagnostic, this reference checks the
actual per-point applications and full J/JT-lambda wrench. It proves this
captured phase only: `publicWorldAcceptedCandidate=false`, desktop NOT_RUN.

Earlier private failures remain under their original IDs: private-01 tool-pin
alias mismatch before physics, private-02 implicit-any compile error before
physics, private-03 strict asymmetric represented inertia refusal before the
normal solve. The old qualified native backend remained unchanged; no tool was
downloaded or replaced. Original candidate versions and sources are preserved
in the corresponding baseline folders. The first isotropy-bank run also stays
FAIL:9 positive calls pass, but a test expected the subclass name instead of
its inherited PhysicsError name and stops at13 calls. That assertion is being
repaired without changing production error contracts.

The corrected isotropy bank passes in Source02 and Native01:15 private calls
per graph,0World calls. `coupled-phase-controls-01` also passes in2699.115541ms:
17 independent CLI controls (2 paid byte-exact positives,10 semantic negatives,
4 invalid-word controls and1 signed-zero positive), followed by4 actual private
repeat calls. Both Source/Native repeats preserve inputs and match the paid
complete JSON and1891numeric words. Synthetic data controls are not physical
World runs. The original isotropy failure receipt and original assertion remain
in baseline/isotropy-first-01; only the assertion uses the exported subclass
identity instead of its inherited name string.

## Actual common World adoption:32-step gate

The production change is in `packages/barocss-physics/src/world.ts` and the new
package-private `src/stack/frictionless-island.ts`. Existing persistent profile,
bodycap4 and sole common World factory remain. Dynamic/static, awake, unfiltered
boxes with no joints/sensors/CCD and zero restitution/static+dynamic friction
select one global cold normal/position candidate after the one actual G1/FREE
integration. That route skips the old pair iterations and cache. A typed
candidate refusal never falls back. The same subset with AABB is explicitly
INVALID_CONFIG at creation; the newly qualified route uses direct broadphase.
Other contact laws keep their own unexpanded qualification. Stationary8's early
branch and evidence remain. Input admission is not proof of every admitted
box, mass, orientation, command or contact topology.

The existing shared events/collider mapping, validation, recorder preparation
and assignment-only commit own all accepted state/time. Known island failures
retain actual candidate/validation/prepare-output phase and accepted cursor;
unexpected values retain identity. These failure guarantees still need their
separate actual control bank below, rather than a code-presence PASS.

`coupled-public-build-01` passes in15099.8135ms: generated source provider,
strict fresh NodeNext Source, actual existing canonical types/root/emitted
commands, then authenticated immutable canonical byte copy. Only generated
source provider metadata is an authorized source mutation during that build.
No private emission is relabeled as the public build and no tool is installed.

`coupled-public32-01` passes in5703.328792ms. Each graph creates one real public
World/recorder, accepts32steps, and passes32 calls to the **unchanged original**
baseline oracle. All33 public states and numeric words match across graphs;
only providerDigest strings differ and are explicitly normalized for structural
comparison. Source digest is1315f48936826783866b751668a8cc9969ef5e636a8629057ac766812360ee88;
actual Native digest is4ff775ef30fd0de633b84a78c71fe8535661776a988e4fcb2643e355a9e4f5c4.
Floor contact begins at1 and the shared-body interface at27 in both graphs.

| Original32-prefix independent metric | Maximum | Unchanged gate |
| --- | --- | --- |
| Global projected velocity |2.914335439641036e-16m/s |1e-10 |
| Global projected position |1.1007775516719892e-16m |1e-10 |
| Normal multiplier |8.335045616666055e-16Ns |1e-10 |
| Momentum/stationarity |1.304930700533428e-15Ns |1e-10 |
| Normal complementarity |1.9604318168831016e-15J |1e-10 |
| Public representative face/bounds |5.551115123125783e-17m |1e-12 |

This closes the original32-prefix failure only. The source-authored256
follow-on oracle differs from the preserved original by exactly the state
upper bound and its diagnostic wording on one line; all mathematics and gates
are unchanged. Its trajectory, restore/continuation, actual failure controls
and same-Native desktop remain separate gates, not inferred from32steps.

## Actual256 trajectory, restore and affected regression gate

`coupled-trajectory-01` passes in23416.814708ms. Source and actual Native each
use6 Worlds and786 accepted steps:256 coupled,4 actual restore replay plus4
continuation,256 separated cubes/floor,256 single gravity fall,8 existing
positive-restitution pair smoke, and2 stationaryALIGNED wiring steps. Main
restore equals the original states4–8 in complete structure and all numeric
words. All257 main states and each regression's full states/words match across
graphs; providerDigest string normalization never changes numeric data or
restore identity. Graph evidence is2243294bytes each, below16MiB. No solver,
World, recorder, transport, reference, time or iteration limit increases.

The whole257-frame independent Fraction reference passes with these maxima:

| Coupled256 metric | Maximum | Original gate |
| --- | --- | --- |
| Global projected velocity |3.1589314497537653e-15m/s |1e-10 |
| Global projected position |2.886579864025407e-15m |1e-10 |
| Normal multiplier |6.273597382329873e-15Ns |1e-10 |
| Normal complementarity |1.9604318168831016e-15J |1e-10 |
| Unexpected angular speed |9.549652735252323e-15rad/s |1e-10 |
| Public representative face/bounds |8.88178419700134e-16m |1e-12 |

The original32-state oracle also checks the new run's first32 transitions.
The two regression trajectories use their original independent oracles, not
the old engine's trace as truth. The positive-e pair is an8-step smoke only;
the stationary2-step body-word comparison is wiring evidence, not a repeated
3600-step qualification. Fresh algorithm regression here uses120Hz; StageA's
old60/240 convergence receipts remain historical and are not relabeled as fresh
new-solver trajectories. Contact occurs at1/27 in the coupled chain,27/47 for
the separated cubes and27 for the single fall.

`coupled-trajectory-controls-01` passes in2150.470791ms with0 World calls. The
paid full256 reply stays byte-exact. Mutating only step256's vertical velocity,
removing its interface contact, or moving its representativeY by1e-11m each
produces PHYSICAL_NO_GO. The last control specifically fails the original
1e-12m face-plane gate. This checks the new endpoint population boundary; it
does not count synthetic records as accepted physics.

## Actual public failure and retry gate

`coupled-public-controls-01` passes in1067.476666ms. Each graph observes9 creation
attempts,7 successful Worlds,20 step attempts and13 returned steps. Two real
admissible-command movement refusals (record/direct) preserve model, state,
clock, recording and caller commands at step4; an empty retry equals actual
paid step5 in all words. The exact candidate phase and operation are retained.

The fixed natural rotated anisotropic box is still **NO_GO**: its represented
world inverse-inertia columns fail exact symmetry. Both direct and recorder
World calls refuse with NUMERIC_LIMIT/candidate at cursor0 and preserve complete
owner data. Passing this refusal test does not qualify anisotropic contact.
The rotated body is initially clear of the other boxes: this profile prepares
all admitted body tensors, so its refusal can precede that body's first touch.
AABB in the new zero-material regime and a5body persistent model reject at
creation with INVALID_CONFIG and unchanged authored input.

Error/object/null injected once after actual island preparation in separate
test-owned provider copies preserve thrown identity and owner data, then retry
to actual paid step1. These copies have untrusted diagnostic identity; their
embedded providerDigest does not make changed code canonical. They are kept
separate from the ordinary Source/Native trajectory PASS. No shipping hooks
or fallback are introduced.

The site adds an actual common-World two-cube example in
`apps/library-docs/samples/physics-island.test.mjs`. Its32-step example and
direct-broadphase refusal check pass2/2 through the site's source bundler in
`coupled-doc-example-01` (674.257291ms). This is executable API documentation;
the independent references above own physical accuracy. Actual desktop is the
remaining same-stage gate. General moving8, tilted/anisotropic/frictional
contact, restitution networks and real equipment validation remain outside
this bounded result.

## Actual same-Native desktop gate

`coupled-desktop-build-01` passes in558.03875ms and
`coupled-desktop-01` passes in13846.000917ms. The real desktop browser uses the
same authenticated canonical Native root/replay and authored model as the
numerical campaign. World1 is initialized and reset without stepping; World2
accepts256 steps. Its complete257-state observational capture is CAPTURE_EQUAL
to the actual Native numerical packet, including every F64 word and signed0.
Expected trace data stays on the host and never enters World or Worker inputs.

Floor/lower contact starts at1, upper/lower at27. At20 the lower is supported
while the upper is still falling. At256 both required edges support the stack;
there is no upper/floor edge. Actual GPU readback has21059 initial colored
pixels and2187 changed flight pixels with the original predicates. Independent
quaternion corner/marker checks, camera, contact display, separate KE/PE and
1280/1440/1920 layouts pass with no page/console errors. The Root viewed both
flight20.png and final256.png; display pixels are rendering evidence, while the
independent Fraction results own physical accuracy. No mobile test ran.

Final KE is2.0460833635676366e-28J and PE39.24000000000008J for the stated model.
This is not total-energy conservation: the impact is inelastic and the
kick-drift/position projection has the recorded discretization and work terms.
Whole desktop proof is2212545bytes before the final receipt, below16MiB.
The owned local preview is http://127.0.0.1:53047/; no deployment occurred.

The supported result is this aligned, equal-mass, zero-friction/restitution,
120Hz two-dynamic-cube/floor chain through256 steps. Original baseline27
failure and all earlier refusals/observer failures are preserved. The next
bounded dependency is three dynamic cubes plus a floor within existing cap4,
requiring an independent3DOF global reference before any qualification upgrade.
Rotated anisotropic contact remains the observed NUMERIC_LIMIT NO_GO. Friction,
elastic networks, arbitrary moving8, Studio/manufacturing/equipment and old
workers remain under their existing limits/HOLDs. No real-machine agreement
or safety claim follows.

Site verification: `coupled-docbuild-01` passes in13623.501ms and
`coupled-docsite-01` in292.269208ms. The latter checks5 built pages,837 links,
237 anchors,30 executable-snippet regions and14 byte-identical historical
evidence copies, plus the exact roadmap mirror. Network links were not probed.
These are local build/link checks, not publication or numerical qualification.
