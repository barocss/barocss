---
work_id: physics-contact-convergence-2276
artifact_type: verification
status: current_library_dt_and_hidpi_prefix_pass_long490_no_go
owner_role: independent-physics-algorithm-work
source_request: qualify contact timestep and longer horizons, then test actual Viewer; audit library completion
last_updated: 2026-11-04
---

# Contact convergence and longer horizon

Branch `codex/physics-contact-convergence-2276` starts at3a7975793. This stage
uses the actual library/common World. Initial campaigns reused the baseline
provider. The later explicitly qualified face-contact repair changes production
construction and requires a fresh canonical compiler/public campaign, recorded
below. Public exports, body cap, contact tolerances and work limits are unchanged.
Source/canonical bytes are authenticated before and after each campaign. No
published SDK or deployment is claimed.

Two and three aligned2kg half-.5 cubes rest/contact on the original floor, with
one initially falling top at a .25m gap. GravityY−9.81, zero restitution/friction,
identity local frames and direct `rigid-persistent-box-v1` apply. No recorded
trajectory or expected future state is an engine input. Each case uses one
retained direct World; no recorder, restore or hidden replay occurs in the
primary campaigns. The previous recorder proof remains separate.

## Preserved first reference failure

`contact-convergence-dt-01` fails in1456.102584ms after Source creates1World and
returns32steps. The new reference replies INVALID_INPUT / finite JS Number
required;0 transitions receive independent PASS and Native has0Worlds/0steps.
Its authored static floor position used exact Fraction values when calling a
strict binary64 word encoder. The repair converts only those fixed exact
dyadics0,−.5,1 to float at that serialization boundary. No calculation, actual
input word, physical gate or production source changes.

Original oracle/contract/runner/cases and failed receipts remain under
`baseline/first-dt-01`; full32-state input stays in `evidence/dt-01`.
`contact-convergence-diagnostic-01` then passes in232.388875ms: exactly one
reference call on that same paid packet,0World/candidate/compiler calls.
All original transitions pass with the repaired observer before a fresh campaign.

## Matched-time comparison: PASS

`contact-convergence-dt-02` passes in67437.756459ms. Each actual Source/Native
graph creates6Worlds and returns840steps, all840 independently passed, with14
reference replies. Both graphs of all cases first pass32 before any33. Models,
full states and all Float64 words agree; providerDigest string normalization
is separate. Cases use60/120/240Hz to the same1second end time.

Fixed windows `[0,32]`, then up to128 transitions, have one exact boundary
overlap. The host checks full state and raw-word continuity, not only numerical
closeness. All packets are immutable and below the original2MiB/512KiB-word
bounds. Graph evidence remains below16MiB; no growing-prefix archive or cap
increase is used. This window protocol was frozen before execution.

At smooth precontact time.1s, upper position errors are approximately
0.008175 /0.0040875 /0.00204375m and translational energy errors
0.1603935 /0.08019675 /0.040098375J. All measured ratios lie in the unchanged
[1.99,2.01] interval for both populations. This is first-order kick-drift;
it does not imply exact continuous dynamics or energy conservation.

Continuous ideal contact time is0.22576182049286544s. Actual discrete impact
indices14/27/54 give times.2333333333/.225/.225s. Contact timing is quantized:
120 and240Hz can tie. Every measured event satisfies the independently declared
one-step error bound; no ratio2 or uniform velocity convergence is claimed at
the instantaneous velocity jump. Away from the event band, the continuous
branch velocity passes the original1e-11m/s gate. The integrated top-contact
impulse agrees with the independent continuous momentum balance at window
boundaries. Independent analytic position envelopes and matched-grid Cauchy
bounds pass; settled roundoff is not reported as a measured convergence order.

| Maximum over paid DT windows | Actual | Original gate |
| --- | --- | --- |
| Global projected velocity |2.360e-15m/s |1e-10 |
| Global projected position |1.777e-15m |1e-10 |
| Public representative plane/bounds |6.662e-16m |1e-12 |
| Integrated continuous impulse residual |2.137e-15Ns |1e-10 |
| Continuous position error including precontact |0.017712500000000273m |Derived first-order envelope, separate from algebraic residual |

The observer uses independently authored exact fixed2/3DOF active-subset
projections plus a new analytic ballistic-to-rest solution. It imports no
production optimizer. Every observed attitude is tied to authored identity,
including window starts; initial-frame drift is not hidden by relative-only
comparisons. Public mean contact points are not treated as applied force
centroids; private applied wrench guards remain in the real library.

## Longer horizon: NO_GO at479

`contact-convergence-long-01` fails in85842.741750ms. Each case targets512steps
at120Hz (4.2666666667s), without increasing any World/recorder/solver limit.
Two cubes pass512 in each graph. Three cubes pass384 in both graphs, with exact
window-word comparison. Source then returns94 further states through478 but
refuses479 with NUMERIC_LIMIT: private feature contact requires valid box
witnesses. This later94-state suffix is observed, not independently qualified;
the next fixed reference window had not completed.

| Graph | Worlds | Returned accepted steps across both cases | Independently passed | Refused / unattempted |
| --- | --- | --- | --- | --- |
| Source |2 |990=512+478 |896=512+384 |Three-cube479 refuses |
| Native |2 |896=512+384 |896 |Three-cube385 onward not attempted after global stop |

The actual source failure preserves full accepted state, model and clock at
cursor478/time3.9833333333333334s; before/after JSON and every numeric word agree.
Direct mode has no recorder log. The complete refusal packet, current kernel /
geometry/witness/feature sources and original contracts remain under
`baseline/first-long-479-01`, with the original full run in `evidence/long-01`.
The full512 campaign remains NO_GO. No shorter accepted prefix is renamed as
full completion, and Native479 is not inferred from Source.

## Independent observer controls: PASS

`contact-convergence-controls-01` passes in974.563166ms:10CLI calls comprise2
paid byte-exact positives and8 fixed negative inputs;3 analytic contact-event
controls and1 host exact-boundary control (2 function calls) also pass. These
use0World/candidate/compiler/capture/replay calls. Wrong window anchors, a
changed boundary, a1e-11m representative shift, wrong quaternion norm/initial
attitude, a missing required contact and malformed raw words retain physical
versus invalid-input classifications. The geometry shift is rejected by the
unchanged1e-12m gate. Exact source/data/tool pins remain unchanged.

## Actual Viewer and completion boundary

Actual low-DPI `contact-viewer-prefix-01` passes in34584.248542ms:3Worlds
including the zero-step initial reset,896 accepted steps (two512/three384), nine
bounded full-state/word captures equal the paid Native windows, actual Viewer
pose/unit/binding checks, camera/three desktop widths and1275+ GPU pixel changes.
Its actual changed counts are1567/1717. Root viewed the real flight screenshot.
The fixed640×360 display backing was visibly blurred when enlarged; its PASS
proves the stated numerical/pixel checks, not adequate display density.
Original low-DPI code/results are preserved in `baseline/lowdpi-viewer-01`.

The host now sizes the backing store from CSS content size × actual DPR (up to2),
uniformly clamped to the existing4096-axis/4194304-pixel Viewer limits. Resize
and DPR changes do not submit new poses or step Physics. Actual native GPU
readback is retained as native dimensions/bytes;640×360 is only the bounded
nearest-centre pixel observer. It is not the display resolution.

The first `contact-viewer-hidpi-01` fails in15286.710875ms: the original CLI
context resets a manual DPR2 override to its default1 during screenshot/viewport
operations. Actual Viewer still draws the corresponding CSS-sized backing;
there is no physics or page/console error. Original source and failure remain
under `baseline/first-hidpi-01`. A separate about:blank protocol probe makes
zero World/Viewer calls and confirms the reset. Its new owned default-DPR2
context keeps actual DPR2 and produces native PNGs2560×1600,2880×1800 and
3840×2160. Root's first probe wrapper has an incorrect expected status string
and fails after all four real observations succeed; that outer failure and
source remain preserved. A data-only PNG/header/protocol audit passes in
57.060417ms without repeating browser or World execution and does not relabel
the original wrapper failure.

`contact-viewer-hidpi-build-02` passes in987.353459ms. The corrected driver opens
its CLI controller at about:blank, starts the actual app once in the proved
owned DPR2 context and closes that context after the checks. It records an
actual-target failure before closing if needed; controller snapshots are not
misrepresented as app evidence. `contact-viewer-hidpi-02` passes in37133.004708ms:
three Worlds/896steps, nine complete Native window/word matches, ten actual
DPR/density observations, both scenarios, real GPU samples and zero errors.

| Desktop CSS viewport | Actual DPR | Native backing | Effective scale |
| --- | --- | --- | --- |
|1280×800 |2 |2460×1312 |2 |
|1440×900 |2 |2777×1510 |1.9978443714 |
|1920×1080 |2 |2894×1448 |1.5480009564 |

Actual canvas content sizes exclude its border. The larger sizes hit the same
4MP cap; no limit is raised. Native readback at the largest size is16762048 RGBA
bytes. The bounded sample detects1275/1422 physically changed pixels for the
two/three cases. Root inspects the3840×2160 flight screenshot and confirms the
previous fixed-buffer blur is removed. This is real raster-density/pixel proof,
not a perceptual accuracy metric or a physical correctness oracle. Whole HiDPI
proof is7369187bytes before the final receipt, below16MiB.

The authored full two/three512 desktop campaign remains NOT_RUN because its
numerical prerequisite failed; exact unrun sources/contracts are retained under
`baseline/unrun-viewer-512-01`. This separately bounded two512/three384 display
proof does not complete the failed long horizon. No private GPU matrix/buffer,
contact-marker, native CAD, React, assembly override or Studio test is claimed.
Use `node examples/physics-contact-convergence-2276/server.mjs contact-viewer-hidpi-02`
for the already built local preview at http://127.0.0.1:53050/.

## Exact479diagnosis and private candidate boundary

`contact-convergence-capture479-01` passes in25873.760709ms in an explicitly
untrusted instrumented Source copy:1World/479attempts/478returned; all479 paid
Source frames0..478 and385 available Native frames0..384 match full words.
One actual island diagnostic and one independent Fraction audit capture the
original refusal with unchanged error/owner. It is not Native479 execution or
ordinary provider/accepted-step qualification.

The actual site is face-contact ROUNDING_EXHAUSTED, floor/lower, after the same
16 allowed placements; final witnessInside was never reached. Two filtered
contact candidates share the exact same X. Their centroid leaves X unchanged,
so moving toward it cannot correct that coordinate. The last lower witness is
only9.714494982401094e-18m outside a strict localX slab: within the separate
1e-12 witness tolerance, yet the strict line/surface-midpoint certificate fails.
The clipped polygon has an interior X direction. No tolerance, pose or velocity
snap follows from this diagnosis.

Private candidates01/02 construct a polygon guide under unchanged16-step and
movement/geometry limits. Both pass the isolated479point and its independent
positive/negative reference checks, then stop at the old20-case classification
comparison. The saved case shows OLD NUMERIC_LIMIT and NEW accepted geometry;
Root initially read the assertion diff in reverse. These are preserved test
expectation failures, not evidence that the candidate breaks an old success.
At that historical point, no production adoption followed yet: every old successful geometry and original
32 saved points must retain words, and every newly accepted old refusal needs
independent strict geometric proof before any library change. Inputs, original
refusals, both private failures and all tolerances remain intact.

The library is not complete as a general engine. P0/P1/P2 have selected local
World/recording/admission proof. Selected hinges, primitive rotation and visual
cloth/fluid profiles have their own bounded prior evidence. P4 moving-stack,
changing-normal persistent friction, general anisotropic contact, G3 generic
CAD COM/tensor import, connected mechanisms and full physical domain coupling
remain separate NO_GO/unsupported/open exits. Those earlier suites are not
reported as freshly rerun here. Studio/equipment/manufacturing/old-worker HOLDs
remain; CAD React belongs to another Work. No mobile, deployment or release.

Actual commands run under existing lane/180s owner guards with installed
Node22.19.0 or Python3.13; each named receipt keeps stdout/stderr, exit and time
under `examples/physics-world-p5-2276/evidence/<receipt>/`. Run IDs are immutable.

```sh
node examples/physics-contact-convergence-2276/run.mjs dt-02 --mode dt \
  --public examples/physics-anisotropic-inertia-2276/evidence/api-01/result.json
node examples/physics-contact-convergence-2276/run.mjs long-01 --mode long \
  --public examples/physics-anisotropic-inertia-2276/evidence/api-01/result.json
python3 -B examples/physics-contact-convergence-2276/controls.py \
  --out "$PWD/examples/physics-contact-convergence-2276/evidence/controls-01"
```

Historical next dependency at the first479failure was independent witness
diagnosis. The following later runs address that dependency without erasing it.


## Current production repair and fresh qualification

Private03 passes in1306.356875ms. Per graph42geometry calls/3references/20bank
cases preserve19old successful geometries and all32saved point words. One old
NUMERIC_LIMIT is newly accepted only after independent strict Fraction geometry
proof. The two earlier private expectation failures remain unchanged. Production
`stack/face-contact.ts` now takes its inward rounding guide from the full clipped
polygon, before depth filtering, rather than the filtered candidate centroid.
This is the only algorithm change here: no tolerance,16-step placement limit,
solver iteration, body cap, velocity/pose snap or compatibility branch changed.
New face source SHA256 is
`c164a34d6245cf52a3f13274439eb6bb2dad471a47344e92aa1c30e5c94c99b6`.

Fresh actual pipeline, each with its own closed owner receipt:

| Receipt | Actual result | Time ms |
| --- | --- | ---: |
| contact-production-build-01 / public-build-03 | PASS;5actual compiler commands |11018.950667|
| contact-production-private-01 / private-02 | PASS;20candidate/13references per graph |1676.594083|
| contact-production-public-01 / api-02 | PASS;8Worlds/212steps/8references per graph |3473.103958|
| contact-post-initial-01 | PASS;16packets/48initial attitudes;data-only |145.097542|
| contact-post-regression-01 | PASS;7Worlds/4typed refusals/4restore+continue per graph |3655.633208|
| contact-convergence-dt-03 | PASS;6Worlds/840independent transitions/14references per graph |64788.8885|
| contact-convergence-long-02 | **NO_GO**,new Source-three attempt490 |79892.372042|
| contact-viewer-current-hidpi-build-01 | PASS;fresh canonical Physics+actual Viewer/GPU source bundle |1160.840916|
| contact-viewer-current-hidpi-01 | PASS;bounded prefix actual desktop HiDPI |36100.715|

New Source provider is `sha256:bdff69b55d4effb0deda83bb1dfc298e82f17578e0c3dec127e5ca66a03fee00`;
new Native provider is `sha256:ea44ebf2cd364b917b3c063a2393a13dd1d4b918dc9333c47fe0cf33eee7cb58`.
The build's PREPARED status denotes completed emitted artifacts, not a World PASS;
the separate public and convergence executions supply runtime proof.

The original long02 target remains two512/three512. Source-three attempt490
refuses NUMERIC_LIMIT: `frictionless island: fresh post contact normal feasibility`.
Complete owner state/model/clock/words remain at489/time4.075. Source makes1002
attempts/1001returns in2Worlds, but only896transitions independently pass, with
9references. Native has896accepted/independently passed transitions in2Worlds,
9references. Both pass two512 and three384. Source-three385..489 is observed
only; Native beyond384 and Native490 are NOT_RUN. The old479point repair does
not prove all trajectory frames through479 or the full512case. Exact original
479 and new490 failures/source/provider pins remain in baseline snapshots.

The separate current-provider HiDPI proof uses that same explicit qualified
prefix,3Worlds including zero-step reset,896steps and9full-word Native window
captures. Ten actual DPR1→2/resize checks preserve Physics state/time/World count.
Real owned Chrome DPR2 screenshots are3840×2160 at viewport1920×1080; the actual
GPU backing follows the unchanged4MP budget:2460×1312,2777×1510,2894×1448 for
1280/1440/1920viewport widths. Native readback is distinct from the bounded
640×360observer sample. No page/console/network errors; context closed and
source integrity true; retained proof7371685B before final receipt. Root viewed
the real long-three20 screenshot. These are actual public Viewer/GPU source
paths and canonical Physics, not freshly emitted Viewer/GPU package qualification.
Original full512/512HiDPI and fullCHECKPOINT15 remain NOT_RUN, preserved under
baseline/unrun-postrepair-full-512, blocked by numerical490 rather than UI failure.
Current local preview: `node examples/physics-contact-convergence-2276/server.mjs
contact-viewer-current-hidpi-01`, http://127.0.0.1:53050/ .

```sh
node examples/physics-contact-convergence-2276/run.mjs dt-03 --mode dt \
  --public examples/physics-anisotropic-inertia-2276/evidence/api-02/result.json
node examples/physics-contact-convergence-2276/run.mjs long-02 --mode long \
  --public examples/physics-anisotropic-inertia-2276/evidence/api-02/result.json
node examples/physics-contact-convergence-2276/server.mjs --build contact-viewer-current-hidpi-01 \
  --dt examples/physics-contact-convergence-2276/evidence/dt-03/result.json \
  --long examples/physics-contact-convergence-2276/evidence/long-02/result.json
node examples/physics-contact-convergence-2276/browser-run.mjs contact-viewer-current-hidpi-01
```

Next dependency: independently measure actual post-position normal-speed
operands at490 and the observed suffix before designing a coherent normal and
position phase. Preserve the guard and earliest observed violation. No whole
engine,three512,original8-box1200,genericCAD or manufacturing safety PASS follows.

## Actual490normal audit and earlier observed drift

`contact-convergence-capture490-01` PASS24534.7885ms validates diagnostic
capture only. One untrusted Source copy reproduces490attempts/489returns;
490Source frames and385available Native frames retain all paid words. One
Fraction child,0extra private/normal/position solves/compiler calls. Exact
Hamilton point-velocity derivative gives middle/upper point2 closing speed
−1.0932118170260969e-7m/s; recorded Float is−1.0932118170722891e-7m/s.
Original gate is−1e-10m/s. This is an actual closing violation, not solely a
Float rounding disagreement. Production490is not committed; Native490NOT_RUN.

The SAME data-only reference audits saved384..489 observed states. Earliest
observed suffix violation is478: normal-direction residual
1.0310569142331814e-12 against the unchanged1e-12. At488 supported middle/upper
linear/angular motion reaches .04905m/s/.0981rad/s; at489 maximum supported
position error is.00040891502866235996m. These invalidate a claim of supported
rest across all returned489frames. This diagnostic does not replace the failed
fixed384..512window with a smaller passing window: qualifiesWindowfalse,
independentFullTrajectoryAccepted0. The9paid windows/two512+three384scope remain
unchanged. Earliest observed analytic violation478, engine refusal490 and
historical pre-repair geometric refusal479 are distinct records. Next algorithm
work must address the onset of drift and contact/velocity/position coherence,
not just suppress490. HOLDs,original tolerances and first failures remain.

```sh
node examples/physics-contact-convergence-2276/capture-490.mjs capture-490-01
```

Current-source documented example checks: `node apps/library-docs/samples/run.mjs
physics-island` PASS3/3 in2058.567875ms owner time; `physics-anisotropic` PASS2/2
in259.025209ms owner time. These use bundled package source; they do not replace
the separate actual canonical compiler/public/desktop gates above. Provider
regeneration is deterministic on the unchanged current source.

Documentation verification after final ROADMAP/site copy freeze:
`contact-docbuild-01` PASS15016.46925ms via `vitepress build docs` in
apps/library-docs; `contact-docsite-01` PASS133.1085ms via
`node examples/physics-motion-docs-2276/check-site.mjs`:6pages/967links/273anchors/
33snippet regions/14byte-identical historical evidence copies and current
ROADMAP mirror. Network link probes NOT_RUN; no deployment. Local checkpoint
archive IO verification is separate from physical qualification and never
upgrades the original full512/512NO_GO or any historical failed receipt.
