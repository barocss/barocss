---
"@barocss/cad": patch
---

Curved Booleans with many B-spline faces are about 3× faster. Whether a point lies on a B-spline face is
answered from the face's control-point box when the point is clearly outside it, without inverting the
point onto the surface, and each face's 25 × 25 sample grid is made only when an inversion needs it.
Cutting a helical M8×30 bolt in half: 5.7 s → 1.8 s, with the same faces and volume.

Stitching the result no longer inverts the edges' control points onto B-spline faces it keeps as they are,
and finds edges by index (1.8 s → 1.5 s on the same cut).
