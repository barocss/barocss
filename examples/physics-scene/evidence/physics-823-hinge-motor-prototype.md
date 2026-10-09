# RIGID-04 anchored hinge motor: local candidate

This is the second serial #823 slice. It depends on the two-dynamic fixed-pair candidate at `6b923cb2932cb293e954fcfddfb7723fcbb44c81`. It does not prove Integration adoption or release acceptance.

## Fixed fixture

- Static sphere A and dynamic 1 kg sphere B, each with radius 0.1 m and coincident centres.
- One +Z hinge, angle limits `[-0.5,0.5]` rad, zero gravity, caller step `1/120` s.
- Motor target `0.5` rad/s, impulse cap `0.0001` N·m·s per step, constraint reaction cap `0.0005` N·m·s per step.
- At step 20, speed is `0.5` rad/s. At step 120, angle is `0.4604166667` rad within `1e-6` and there is no limit reaction.
- At step 121, an external `+0.01` N·m·s impulse is accepted. Step 122 exceeds the reaction cap and returns `NUMERIC_LIMIT`; state stays at step 121.

## Local checks

- Built CAD, Physics, GPU, CAD Interop and Viewer packages with Node 22.22.0.
- `hinge-motor-probe.mjs`: caps, invalid config, 120-step angle, overload retention and 30-step deterministic replay passed.
- Existing `joints-probe.mjs`: anchored fixed/hinge behavior and failed-step retention passed.
- Chromium 155/WebGL2: two original CAD Surfaces visible. Angle and readout checked at steps 0, 20 and 120. Stale Surface reference, invalid binding and overload controls retained the last accepted Viewer pose. Browser console had zero errors and warnings.

## Screenshots

- [Step 0](physics-823-motor-step-000.png)
- [Step 20](physics-823-motor-step-020.png)
- [Step 120](physics-823-motor-step-120.png)

This fixture does not measure a calibrated mechanical load or break law. Dynamic-to-dynamic motors, assembly networks and publication remain outside this slice.
