# RIGID-04 first-slice native and Viewer result

Issue: [#823 frozen first-slice fixture](https://github.com/barocss/barocss/issues/823#issuecomment-6072507713). Parent local Integration commit: `d3b9498c`. This is an isolated candidate, not an integrated or released Physics profile.

## Bounded result

One `fixed` joint now admits exactly two dynamic sphere proxies, with no other bodies or joints. The joint solver is in `packages/barocss-physics/src/dynamic-fixed-joint.ts`; it distributes anchor and orientation corrections by inverse mass/inertia. It retains the existing static/kinematic anchored joint behavior. Connected pair contact remains disabled. This prototype does not admit dynamic hinges, motors, break forces, cycles, larger networks, exact CAD joint semantics or engineering loads.

## Frozen numeric fixture

Two 1 kg spheres of radius 0.05 m start at [0,0.3,0] and [0.2,0.3,0] m. Fixed-joint local anchors are [0.1,0,0] and [-0.1,0,0] m. Gravity is zero; the host steps at 1/120 s and applies +X 0.2 N·s to B at step 1. The compiled [native JSON](physics-823-fixed-pair-native.json) records 120 steps: centre-of-mass X speed 0.1 m/s, maximum joined-anchor gap 0 m, X-momentum error 0, energy drift from 0.01 J over steps 30–120 of 1.74e-18 J. The first-step A/B correction impulses were +0.10000000000000148 and -0.10000000000000148 N·s. The one-run Node step p95 was 0.342 ms; it is not browser or GPU time. Invalid initial anchors were rejected, and an out-of-range command retained accepted world state. A 30-frame replay restored equal state and rejected a changed CAD source revision.

Dynamic hinges and a third body were also refused on creation. They are outside this first admission profile.

The existing compiled anchored-joint and replay probes also passed unchanged. A separate transverse impulse diagnostic ran 120 steps and had a maximum anchor gap of 1.19e-16 m, but that exploratory case is not a declared broader acceptance profile.

## Actual 3D Viewer

`examples/physics-viewer-scene/joint-demo.html` uses built Physics and Viewer packages with the original `rational_panel` and `flat_panel` BaroCAD Surfaces. Headless Chromium 155/WebGL2 on macOS 15.6.1 and Apple M3 Max rendered one canvas. The display-bound body X positions were 0/0.2 m at step 0, 0.025/0.225 m at step 30, and 0.1/0.3 m at step 120. Viewer motion retained both original Surface IDs and converted metre positions to millimetre translations. Actual paired captures: [step 0](physics-823-pair-step-0.png), [step 30](physics-823-pair-step-30.png), [step 120](physics-823-pair-step-120.png). The start and end frames show both panels in distinct positions. GL error was 0; browser console had no errors or warnings in the checked start/end pages. Reset returned to step 0, One step advanced to step 1 and showed the -0.1 N·s B reaction, Play reached step 120, and an incomplete binding was refused with the last accepted Viewer pose retained.

## Reproduce and limits

With Node 22 and offline workspace dependencies, build `@barocss/cad`, `@barocss/physics`, `@barocss/gpu`, `@barocss/cad-interop` and `@barocss/viewer`. Run `node examples/physics-scene/dynamic-fixed-pair-probe.mjs`, `node examples/physics-scene/joints-probe.mjs` and `node examples/physics-scene/replay-probe.mjs`. Start `node examples/physics-viewer-scene/server.mjs`, then open `/joint-demo.html?step=0`, `?step=30` and `?step=120` in Chromium.

The accepted numeric fixture is one equal-mass, collinear impulse case. Other mass ratios, large rotations, contacts with third bodies, browser frame pacing and energy behavior outside this scene have not passed an acceptance gate. Browser screenshots prove visibility, not numerical or material accuracy. #823 remains open for motor/reaction-limit and break/failure decisions after this candidate is integrated and checked on the merged head.
