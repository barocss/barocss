---
"@barocss/cad": patch
---

Mass properties of B-reps with B-spline faces are much faster. A curved face that is its whole patch (its one
loop runs along the patch's domain boundary, and is as long as it) is integrated by tensor Gauss–Legendre
over each knot span with the surface's analytic derivatives, without tessellating it. A planar face is
integrated along its exact edges with its normal from its surface. Only trimmed curved faces are still
tessellated, and when there are none the second (Richardson) pass is skipped. A helical M8×30 bolt
(207 faces): 5.9 s → 0.43 s, with the same volume to 3e-11.
