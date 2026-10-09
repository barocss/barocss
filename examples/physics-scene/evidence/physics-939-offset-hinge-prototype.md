# RIGID-04a offset hinge: local candidate

Issue: [#939](https://github.com/barocss/barocss/issues/939). This candidate starts from the unmerged #823 dynamic hinge child `ab70324feb84d3853dce488ade966035c463aa1c`. It is a serial dependency, not an Integration result or release claim.

## Admitted first fixture

- Two 1 kg dynamic spheres, each radius 0.1 m, start at X = -0.1 m and +0.1 m. Local anchors +0.1 m and -0.1 m meet at the origin. Gravity and initial velocities are zero.
- One +Z hinge limits the relative angle to [-0.8, 0.8] rad. Its motor targets 0.5 rad/s, caps its per-step impulse at 0.0001 N·m·s, and refuses angular constraint reaction above 0.01 N·m·s.
- A centre and B centre have separate positions. A symmetric anchor projection updates both positions, linear velocities, orientations and angular velocities. Each original CAD Surface follows one complete accepted pose. The screen overlay marks both sphere proxy centres and the shared pivot; it does not test depth occlusion.

## Local numeric evidence

Node 22.22.0 built `@barocss/cad` and `@barocss/physics`. `node examples/physics-scene/offset-hinge-probe.mjs` passed 120 steps at 1/120 s and exact state replay. It measured:

| Measure | Peak or result | Issue bound |
| --- | ---: | ---: |
| Anchor gap | 2.78e-17 m | 1e-5 m |
| Centre-of-mass drift | 0 m | 1e-5 m |
| Linear momentum drift | 0 kg·m/s | 1e-7 kg·m/s |
| Angular momentum drift about pivot | 0 kg·m²/s | 1e-7 kg·m²/s |
| Angular constraint reaction | 1.201e-6 N·m·s | 0.01 N·m·s |
| Step p95 | 0.307 ms | Report only |

The angle and kinetic energy traces were: step 1 = 0.000416667 rad / 2.50e-6 J; step 60 = 0.231178394 rad / 2.57857e-4 J; step 120 = 0.480951302 rad / 2.84467e-4 J. The first motor impulse reached its 0.0001 N·m·s cap; step 120 used 1.1916e-6 N·m·s. These are one pinned run, not load certification.

The probe refused a 1 mm initial anchor mismatch with `INVALID_CONFIG`. Linear and off-axis commands returned `INVALID_COMMAND` while retaining step 120. A +0.1 N·m·s external Z angular impulse returned `NUMERIC_LIMIT` and retained step 120. The centred hinge baseline remained at 0.48125 rad and 0.00025 J at step 120. The separated fixed pair, anchored joint and anchored motor probes passed after the shared anchor projection was extracted.

## Actual Viewer evidence

Node 22 built `@barocss/viewer` and its dependencies. The local HTTP demo ran in Chromium 155 with WebGL2. At steps 0, 60 and 120, both original `flat_panel` and `rational_panel` Surfaces, both coloured proxy-centre markers and the white pivot marker were visible. The CAD source was not rewritten. Step 60 and 120 angles read 0.231178 and 0.480951 rad. Viewer GL error was 0.

The overload control retained the last accepted Physics and Viewer frame at step 120. Invalid binding and stale source controls also retained that frame. Reset then one step reached step 1. Play advanced to step 15; Pause held step 15. Browser console errors and warnings were 0/0.

- [Step 0](physics-939-offset-hinge-step-000.png)
- [Step 60](physics-939-offset-hinge-step-060.png)
- [Step 120](physics-939-offset-hinge-step-120.png)

The candidate still needs serial Integration of its #823 parent, an exact merged-head receipt and merged-head numeric plus browser checks before #939 can close.
