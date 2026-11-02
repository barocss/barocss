---
work_id: physics-motion-foundations-2276
artifact_type: experiment-contract
status: implemented-validation-pending
owner_role: kinematics-executor
source_request: "Issue #2276: independent Physics/Motion unit and pose boundary checks"
last_updated: 2026-11-01
---

# CAD proxy unit and pose boundary contract

Frozen before the first run of `units.test.ts`. Use the existing public
`@barocss/physics/cad-proxy` source adapter. Do not create a World or use UI.
Do not change previous passing tests or product source.

## Fixture and independent answers

Use sourceVersion 0, length-unit mm, model `units_fixture`, and a degree-1
NURBS Surface `asymmetric_panel`. Its control points are `(20,-30,40)`,
`(20,-30,100)`, `(120,10,40)`, `(120,10,100)` mm. All weights are 1.
The literal control bounds are min `(20,-30,40)`, max `(120,10,100)` mm.
The center is `(70,-10,70)` mm. The X span is 100 mm, which is 0.1 m.

Admission of a box uses half extents `(0.05,0.02,0.03)` m. The dynamic
body has a +0.1 m X initial offset, so its center is `(0.17,-0.01,0.07)` m.
The identity pose must display a `(100,0,0)` mm translation.

The second body pose uses +pi/2 radians around Z. Its quaternion is
`(0,0,sin(pi/4),cos(pi/4))`, in x,y,z,w order. Its center stays at the
admitted body center. With source center C, body center B, source point P,
and literal quarter-turn matrix R, the display formula is
`P_display = R*P + (1000*B - R*C)` mm. This is equivalently a turn around
the off-origin source center followed by a +100 mm X translation.
The expected display translation is `(160,-80,0)` mm.
The four displayed control points are `(190,-60,40)`, `(190,-60,100)`,
`(150,40,40)`, `(150,40,100)` mm. Use these literal answers, not the adapter's
rotation helper. Invert the literal display matrix to recover all four
original points. Verify the source center maps to `(170,-10,70)` mm.

Sphere admission uses control-bound radius `sqrt(0.05²+0.02²+0.03²)` m.
Both the sphere radius and the box bounds are control-net approximations.
They do not establish an exact Surface mesh or collision shape.

## Frozen gates

- Linear admission errors: at most 1e-9 m.
- Display and inverse linear errors: at most 1e-6 mm (the same SI gate).
- Returned unit quaternion components: at most 1e-12 absolute error.
- Exact source mismatch with unchanged revision: STALE_SOURCE.
- Revision mismatch with unchanged source: STALE_SOURCE.
- Each stale refusal retains the admitted proxy, request, body pose, and
  original source text. A later call with the original source/revision works.
- Record measured maximum errors in Node test diagnostics.

These gates must not be widened after a failure. Parent-run receipts record
execution. This is a public source-adapter check. It is not a compiled CAD
package build, released consumer, Studio/Viewer, simulation, or rendered
geometry claim. Existing HOLD and historical NO_GO decisions stay in force.
