# RIGID-04 dynamic pair hinge motor: local candidate

This is the third bounded #823 slice, based on local parent `5c80abb706a1d309dda8bc6af1ed294ee71ef103`. The first fixed pair and anchored motor were integrated locally at `923a832064f567047f2a23eaf9e5c9bbc8864b4d`. This file records the new candidate only; it does not claim Integration adoption or publication.

## Contract

- Exactly two dynamic spheres share their centre and zero local anchors. Gravity, initial motion and initial rotation are zero. One +Z hinge has limits `[-0.51,0.51]` rad.
- Both spheres have mass 1 kg, radius 0.1 m and moment of inertia 0.004 kg·m². Caller step is 1/120 s.
- Motor target relative speed is 0.5 rad/s. Its impulse cap is 0.0001 N·m·s per step, and its angular constraint reaction cap is 0.0005 N·m·s per step.
- At step 10, A/B angular speeds are -0.25/+0.25 rad/s. At step 120, relative angle is 0.48125 rad and pair kinetic energy is 0.00025 J. The pair's angular momentum stays zero before external input.
- An external +0.01 N·m·s impulse on B is accepted at step 121. The next step is refused with `NUMERIC_LIMIT`, retaining step 121 in Physics and Viewer.

## Local checks

- Node 22 Physics build passed. `dynamic-hinge-motor-probe.mjs` passed admission/refusal, momentum, energy, angle, overload retention and 30-step deterministic replay checks.
- Existing anchored motor, dynamic fixed pair, anchored joints, rotation and replay probes passed after the angular update sequence changed. Scoped ESLint and diff check passed.
- Actual compiled HTTP/Chromium 155/WebGL2 preview showed the two original CAD Surfaces at steps 0, 10 and 120. At step 10, the browser readout showed A/B -0.250/+0.250 rad/s; at step 120, it showed 0.481250 rad. The two panels visibly changed orientation in opposite directions.
- The overload control retained step 121 and its Viewer frame. The stale Surface and invalid binding controls retained the accepted pose. Reset plus one step reached step 1. Browser console errors/warnings were 0/0 and WebGL error was 0 after the overload check.

## Screenshots

- [Step 0](physics-823-dynamic-hinge-step-000.png)
- [Step 10](physics-823-dynamic-hinge-step-010.png)
- [Step 120](physics-823-dynamic-hinge-step-120.png)

The profile excludes offset anchors, gravity, linear motion, off-axis rotation, larger assemblies, calibrated loads and break/reconnect behavior. #823 remains open.
