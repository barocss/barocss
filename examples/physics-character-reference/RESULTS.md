# #830 raw character composition: bounded NO-GO

Clean measured source `48cd4f65c2ae5483ab0be67fc8dfcfc74d0aeb72`, parent `bc38df4cf2251f53101ae045e616012866b3e6b3`, branch codex/physics-character-830. Node22.22.0. Original Physics build and actual ordinary public source bundle/consumer pass:22own src/0dist, no aliases/plugins/custom conditions. No CAD operation, new controller/kernel/API or Viewer test.

## Actual intended movement results

| Case | X progressm | Max capsule axis tilt | Verdict |
| --- | --- | --- | --- |
| REST |0|0deg|pass|
| FLAT |1.9999999999999978|0deg|pass|
| STEP10 |1.9805787805041213|89.95171021816772deg|fail upright|
| SLOPE15 |1.9293073655344224|77.05750814100222deg|fail slope policy/upright|

The0.10m step is crossed, but tilt exceeds5deg first at139. Raw motion on15deg slope exceeds the intended0.02m positive advance allowance at3, then exceeds5deg tilt at15. Peak positive progress is checked across all240accepted states, not only final position. The raw scene contains no slope-rejection policy. These failures justify investigating a controller; they do not contradict an earlier rigid-body guarantee.

All four240step runs remain finite and satisfy position≤5m, velocity≤100m/s, unitq and residual overlap lower-bound≤5mm. REST/FLAT final plane gap2.7755575615628914e-17m. Maximum contact-free analytic position/velocity error1.1102230246251565e-16. Max independent overlap lower bound1.1102230246251565e-16m. A segment inside an OBB gives only a conservative lower bound; no exact MTD certificate is claimed.

Independent reference controls verify plane/touch/separation/inside distances, rotated capsule endpoints, translated-box corner distance and a rotated asymmetric OBB. The published capsule inertia is the approximate[.1,.1,.1]kgm2 for mass1, not exact capsule inertia.

## Actual API boundaries and controls

13control records pass. Original configs/state copy independently; invalid nonunit ray/negative overlap/invaliddt/unknownbody retain full accepted state. CapsuleCCD and inertia override refuse; doubleDispose/disposedmethods refuse. A centre ray hits actor at0 and returns only bodyId/distanceM. Foot overlap IDs contain actor+floor; known-ID filtering adds no normal/sweep.

Kinematic capsule+static floor alone refuses (no dynamic body). With a far dynamic sentinel, one kinematicTarget accepts actor[0,-.2,0] and overlaps the static floor by at least.15m. Kinematic-static pairs are excluded. This is an actual boundary of the existing API, not automatic obstacle blocking. Sentinel is excluded from primary character quality metrics.

## Exact repeat and cost

Each case has two exact complete240runs; selected full states/queries and F64body hashes0/60/120/180/240 match.20raw states independently reconstructed and verified against their F64/fullSHA. Config/geometry/units/IDs and hashes saved; no source parameters were retuned.

One warm/case then three serial240trial p95 around public world+Xservo+copied output:

- REST .113125/.104042/.104584ms.
- FLAT .096292/.055833/.058334ms.
- STEP10 .132250/.129625/.132625ms.
- SLOPE15 .114250/.078959/.097291ms.

All8.33ms Node targets pass. Geometry/queries/hash diagnostics are outside timing; construction reported separately. This is not browser/GPU/FPS or actual character-controller cost.

First reference failures are preserved: missing control velocity/spin and exactzero expectation for finite convex search. Proof fixes filled synthetic fields and used1e-12 analytic reference tolerance; no scene/product target change. Review added peak slope-progress, precontact horizontal reference and corner/rotated-OBB controls. Canonical run at clean48cd4f65 passed the harness but `rawCharacterGO:false`.

#830 remains OPEN for exact Integration adoption and selected controller/query discovery decisions. Future bounded capsule sweep/upright state/slope/step rules must have their own frozen tests before package APIs. Actual visual capsule/originalfloor representation, Viewer pixels/camera/clock/resource/playback are unrun. No arbitrary terrain, stairs, dynamic pushing, ragdoll, exact CAD collision, product push/PR/deploy/publish/release.
