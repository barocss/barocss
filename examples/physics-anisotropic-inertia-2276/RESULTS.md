---
work_id: physics-anisotropic-inertia-2276
artifact_type: verification
status: bounded_library_source_compiled_reference_desktop_pass
owner_role: independent-physics-algorithm-work
source_request: fix rotated anisotropic precontact refusal in the library and assess CAD consumers
last_updated: 2026-11-04
---

# Rotated anisotropic precontact tensor

Work continues on `codex/physics-anisotropic-inertia-2276`, based on1493071bf.
The actual library change is `packages/barocss-physics/src/stack/frictionless-island.ts`.
The common World calls this same kernel; no example-only replacement, public
factory, compatibility route, tolerance or runtime dependency is added.

Changed files are the kernel and its generated provider manifest, the independent
contracts/reference/public/consumer/desktop sources in this example directory,
`apps/library-docs/samples/physics-anisotropic.test.mjs`, the Physics README /
roadmap, two documentation pages, the roadmap site copy and the Work status.
Checkpoint 14 stores the authored sources separately from actual proof, with
checkpoint 13 as an immutable dependency. Extracting evidence is not a new test
execution; its receipts retain the original run status and hashes.

## Preserved first failure and cause

`anisotropic-baseline-01` passes its **expected old refusal** check in365.302167ms.
Each old Source/Native graph creates record/direct Worlds, attempts one step
each and accepts0. The original upper2kg box, half-extents[.25,.5,.75], initial
quaternion[.1,.2,.3,sqrt(.86)] andY5 refuse exact matrix symmetry while clear of
other bodies. Complete owner state/model/clock/log and paid first-failure words
match. This baseline PASS does not mean the old physics accepted the input.

`anisotropic-capture-01` passes in486.121917ms. Each original provider copy
captures the actual post-G1 FREE before the island call, throws its one-shot
unknown marker without commit, then calls the unchanged old private candidate
once to retain its real refused tensor/diagnostics. Each graph uses1 old World,
0 accepted steps,1 capture and1 old candidate refusal. Copies are explicitly
untrusted diagnostic providers. Full capture/diagnostic numeric words match
between graphs. The actual lower/floor contact remains in the captured data;
the upper is unreferenced by its contact rows.

The old method assembled world inverse inertia from separately rounded
operator columns. That represented matrix can be nonsymmetric even for a
physically symmetric inertia. The repair directly constructs the bilinear
tensor R diag(d) R^T, evaluating each independent entry once. It does not average
old bad columns or weaken exact symmetry/SPD checks. Static and exactly
isotropic branches stay unchanged. Existing actual inverseInertia/inertia,
point applications, applied KKT/wrench checks, budgets and all tolerances stay.

## Build and independent tensor checks

The first build `anisotropic-public-build-01` fails before physics: TypeScript
TS2542 reports writes into a readonly Mat3 local buffer. Exact source8452db24…,
build contract and first logs are preserved under baseline/first-compile-01.
Root changes only the erased local tuple annotation to a mutable tuple; the
calculation and return type remain. New production source SHA is
7b61afb5c0f4651f04c95d82d4e92901fc148d21818d2cfe0e14d3dc7280d128.

`anisotropic-public-build-02` passes in10692.042417ms: fresh strict NodeNext
Source plus the actual canonical types/root/emitted-provider commands and
authenticated canonical byte copy. The existing source-provider generator is
the only allowed source mutation during build. Installed tools/backend remain;
no download, dependency, environment or security change occurs.

`anisotropic-private-01` passes in1430.314625ms. Each graph has20 private calls
(12 solved literal cases,7 typed refusals and1 actual captured-FREE case),13
independent reference replies and0 World steps. Actual input words remain.
The reference uses exact normalized Hamilton quaternion sandwiches, not the
production bilinear formula. It checks tensor/spectrum, actual unchanged
angular operator action, momentum round trips and rotational energy.

| Maximum across26 actual independent replies | Value | Gate |
| --- | --- | --- |
| Physical inverse tensor |3.581937048374748e-15/(kg m²) |1e-10 |
| Angular action/increment |3.581937048374748e-15rad/s |1e-10 |
| Operator momentum round trip |7.771561172376096e-16Nms |1e-10 |
| Angular-load energy |1.790968524187374e-15J |1e-10 |

Captured reference scope is explicitly **isolated upper tensor and standalone
operators**, not independent certification of the whole lower contact phase.
Full actual contacts/applications stay in the packet. Old frozen noncontact
oracle/contract are preserved under baseline/oracle-v1-noncontact; a separately
documented scope addendum precedes all new reference execution.

## Actual public World

`anisotropic-public-api-01` passes in2681.088209ms. Each Source/Native graph
uses8 Worlds/212 accepted steps/8 independent references: natural64 and
principal-spin64, plus both cases at60/120/240Hz through the matched0.1s time.
All complete state/command words agree between graphs; providerDigest string
normalization is separate. New Source digest6635c23d574ba8ac5086aacf47bbff6f3368d6bbd48921a720fb578991638ea7;
actual Native digest4e389106d07a787e5c87b9df7f3736c3ec3b48b4bb8563721dc24de37ba01011.

The original natural case now advances64 steps instead of refusing at0. For
principal spin, quarter-Z initial orientation maps bodyX to worldY. A single
worldY angular impulse1/8Nms gives exact physical I_x13/24kgm², omegaY3/13rad/s
and rotational energy3/208J. The independent reference uses exact ballistic
kick-drift and high-precision analytic sine/cosine for the principal rotation.
Maximum angular-speed residual1.8169226806846313e-15rad/s, quaternion-component
residual2.342983327270066e-16, angular-momentum residual9.841664520375086e-16Nms
and rotational-energy residual2.271153350855798e-16J pass the original gates.
The lower cube's floor impulse and representative1e-12m geometry also pass.
A positive enclosing-radius clearance proves upper never touches other bodies
in this fixed horizon. This is precontact/principal-axis proof only.

**Discretization is separate from algebraic residual.** At64/120s, upper
continuous-position error is0.021800000000002005m and energy defect−0.427716J.
At matched0.1s, position errors are0.008175/0.0040875/0.00204375m and energy
errors0.1603935/0.08019675/0.040098375J. Their ratios remain about2 within the
original[1.99,2.01] gate. This confirms existing first-order kick-drift behavior;
it is not energy conservation or micrometre continuous-trajectory accuracy.

## Failure, restore and affected regression

`anisotropic-failure-regression-01` passes in3424.840084ms. Each graph uses7
Worlds,82 external attempts,78 external returns and4 actual restore replays
(82 accepted steps total). Admissible but excessive impulses refuse at cursor4;
the fixed poorly conditioned public box refuses at cursor0 with the original
positive-definite/well-scaled-inertia guard. Record/direct operation, candidate
phase, model/state/clock/log/caller commands stay exact. Empty retry matches
paid step5. A genuine4-frame recording restores4 and continues4 to paid states.

Two/three-cube isotropic regressions each compare32 new accepted steps and all33
states/words to the original paid traces; only providerDigest strings differ.
These64 regression steps are included in the82 accepted count. No unaffected
3600-step stationary campaign is rerun or relabeled as fresh qualification.

## Independent observer controls

`anisotropic-oracle-controls-01` passes in 1164.386458 ms. Sixteen CLI controls,
three analytical-helper calls and four helper-restore calls use no World or
candidate execution. Both paid positives remain byte-exact. Wrong symmetric
and asymmetric tensors, angular action, captured upper contact/state, public
orientation/spin/free fall, a 1e-11 m lower witness shift and forbidden upper
contact are rejected as physical violations. Malformed words, NaN and trailing
wire input retain the distinct invalid-input classification. Signed zero passes
its defined control. Source integrity passes; no observer tolerance changes.

## Additive authored initial-frame audit

Final source review finds a reference-observation gap: the frozen natural
reference compares later orientations to the received first orientation, without
binding that first orientation to the authored model. This is not a newly
observed production failure. All old observer sources, replies and accepted
trajectory words remain intact.

The new `anisotropic-frame-audit-01` passes in 459.910917 ms. A separate finite-
word decoder and 90-digit normalized authored-quaternion calculation check all
16 paid Source/Native packets and all 48 initial body orientations. The original
1e-10 component / 1e-12 squared-norm gates remain. Maximum component residual is 6.269e-17; maximum squared-norm residual is
1.774e-16. No World, candidate, compiler,
capture or replay runs again.

Five fixed negative controls pass: both complete natural upper traces changed
to identity, initial principal upper attitude changed to identity, initial floor
attitude changed, and inconsistent finite raw words. The first four are physical
violations; the fifth is invalid wire input. Two diagnostic calls explicitly
show the unchanged old observer accepting the modified natural traces. Those
old replies are preserved as **reference blind spots, not physical PASS**;
the additive audit rejects both. Its 21 audit calls close the initial-frame gap
for these paid packets without altering past results or creating new trajectory
qualification. See `INITIAL-FRAME-AUDIT-CONTRACT.md` and
`evidence/frame-audit-01/result.json`.

## CAD consumers and desktop

`anisotropic-consumers-02` passes in 2616.184833 ms: each Physics Source/Native
graph runs two Worlds and 16 accepted steps. Actual CAD Surface proxy and
CAD-model primitive/MMGS conversion feed the same World. Actual CAD tessellation
and CAD-model meshes pass the GPU scene facade's CPU validation. The other
three libraries use their current workspace Source APIs in both graphs; this
is not their compiled-package or GPU-render-device qualification. All complete
Physics state/command words agree, with provider strings handled separately.
See [consumer readiness](CONSUMER-READINESS.md) for units, boundaries and gaps.

The first `anisotropic-consumers-01` fails in 939.236583 ms before any consumer
child or World runs. The authorizer tried to open the virtual esbuild stdin
entry as a physical file. Its exact source/contract/log are retained under
`baseline/first-consumer-auth-01`. The repair binds only the exact virtual entry
to its actual source/bytes/hash; every physical input still hashes its file.
No library or numerical criterion changes to obtain consumer PASS.

`anisotropic-desktop-build-01` passes in 845.514750 ms. It bundles the actual
qualified canonical Physics root/replay, with no Physics source fallback.
`anisotropic-desktop-01` passes in 15734.679208 ms in real headed Chrome/WebGPU:
three Worlds (including one initial zero-step reset), 128 accepted steps, and
65 complete states/commands per scenario equal the actual Native numerical
packets including every Float64 word. The original rotated box falls; the
quarter-turn box falls and rotates under its one angular impulse. The lower
cube is supported from step 1; neither upper touches in the fixed horizon.

GPU readback measures 927 / 2172 changed pixels for natural / principal cases.
Independent display-corner checks pass their separate 1e-6 m Float32 display
gate, which is not a solver tolerance. Displayed rotational energy uses body-
local angular velocity with local diagonal inertia; the principal value is
0.01442307692307715 J against exact 3/208 J at the unchanged 1e-10 J gate.
Controls, camera isolation and desktop widths 1280/1440/1920 pass with zero
page/console errors. Root also inspects the initial and terminal screenshots.
The renderer owns neither physics commands nor the accepted clock. This is a
standalone WebGPU sample, not CAD Studio or GPU-library product integration.

Preview the already built local sample with:

```sh
node examples/physics-anisotropic-inertia-2276/server.mjs anisotropic-desktop-01
# http://127.0.0.1:53049/
```

The local VitePress build `anisotropic-docbuild-01` passes in 11343.482791 ms.
The scoped built-link, snippet-region and immutable historical-copy check
`anisotropic-docsite-01` also passes in 176.898625 ms. No network link checks,
publication or deployment run.

The first checkpoint archive attempt `stack-anisotropic-checkpoint14-01`
fails in 1046.850291 ms before creating an archive. Its generic terminal-result
filter rejects the build artifact status ending in `PREPARED`, although all five
compiler commands and its owner guard completed successfully. Original helper
source and command evidence remain under `baseline/first-checkpoint-01`. The
archive helper now validates that exact completed compiler chain and PASS guard
separately. The generic numerical-result predicate and all physics checks stay
unchanged. This is evidence packaging, not a new physical NO_GO or simulation.

## Actual command receipts and remaining scope

All commands below actually ran under the existing lane and 180 s command
guards with Node 22.19.0 or Python 3.13. A receipt's original run ID is immutable;
reproduction requires a fresh ID and its declared prerequisites, not overwrite.
Each `result.json`, stdout and stderr is retained under
`examples/physics-world-p5-2276/evidence/<receipt>/`.

| Receipt | Target command after the guard wrapper | Actual result |
| --- | --- | --- |
| anisotropic-baseline-01 | `node examples/physics-anisotropic-inertia-2276/baseline.mjs baseline-01` | Expected old refusal reproduced |
| anisotropic-capture-01 | `node examples/physics-anisotropic-inertia-2276/capture.mjs capture-01` | Actual FREE retained; old refusal reproduced |
| anisotropic-public-build-02 | `node examples/physics-anisotropic-inertia-2276/build.mjs public-build-02 --baseline examples/physics-anisotropic-inertia-2276/evidence/baseline-01/result.json` | Strict Source and actual canonical build PASS |
| anisotropic-private-01 | `node examples/physics-anisotropic-inertia-2276/private-run.mjs private-01 --build-manifest examples/physics-anisotropic-inertia-2276/evidence/public-build-02/result.json` | 20 calls / 13 references per graph PASS |
| anisotropic-public-api-01 | `node examples/physics-anisotropic-inertia-2276/public-run.mjs api-01 --private examples/physics-anisotropic-inertia-2276/evidence/private-01/result.json` | 8 Worlds / 212 steps per graph PASS |
| anisotropic-failure-regression-01 | `node examples/physics-anisotropic-inertia-2276/failure-regression.mjs failure-regression-01` | Rollback, restore, continuation, isotropic regression PASS |
| anisotropic-frame-audit-01 | `python3 -B examples/physics-anisotropic-inertia-2276/initial-frame-audit.py --out "$PWD/examples/physics-anisotropic-inertia-2276/evidence/frame-audit-01"` | 16 packets / 48 initial attitudes / 5 negative controls PASS |
| anisotropic-oracle-controls-01 | `python3 -B examples/physics-anisotropic-inertia-2276/oracle-controls.py --out examples/physics-anisotropic-inertia-2276/evidence/oracle-controls-01` | 16 observer controls PASS |
| anisotropic-consumers-02 | `node examples/physics-anisotropic-inertia-2276/consumers.mjs consumers-02 --public examples/physics-anisotropic-inertia-2276/evidence/api-01/result.json` | Bounded CAD / CAD-model / GPU CPU flow PASS |
| anisotropic-desktop-build-01 | `node examples/physics-anisotropic-inertia-2276/server.mjs --build anisotropic-desktop-01` | Actual Native bundle PASS |
| anisotropic-desktop-01 | `node examples/physics-anisotropic-inertia-2276/browser-run.mjs anisotropic-desktop-01` | Native words, motion, GPU pixels and desktop controls PASS |
| anisotropic-doc-example-01 | `node samples/run.mjs physics-anisotropic` in `apps/library-docs` | 2 executable examples PASS |
| anisotropic-docbuild-01 | `node node_modules/vitepress/bin/vitepress.js build docs` in `apps/library-docs` | Local documentation build PASS |
| anisotropic-docsite-01 | `node examples/physics-motion-docs-2276/check-site.mjs` | Built links, regions and historical copies PASS |

General anisotropic contact, off-principal contact dynamics, arbitrary four-body
topology, friction and moving eight-body dynamics remain unqualified. The next
work is the coupled family's matched-time step refinement and longer horizon
within current limits; tilted contact then needs an independent angular/contact
reference before public expansion. CAD arbitrary COM/full-tensor/collider-offset
admission remains the separate G3 prerequisite. Existing Studio/manufacturing/
equipment/old-worker HOLDs, first failures, resource limits and tolerances remain.
No mobile test, deployment, release or real-machine claim follows.
