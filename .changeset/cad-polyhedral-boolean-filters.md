---
"@barocss/cad": patch
---

Polyhedral Booleans (mesh bodies, faceted solids) are 30–130× faster with the same results. A face the
classification point or ray clearly misses or clearly crosses is decided in binary64 with a generous error
bound, and the exact rational tests run only on the cases that remain. Face normals are worked out in
integers on the corners' common power-of-two denominator. Face pairs are found through faces sorted by x,
and T-junctions through vertices sorted by x, instead of testing every pair. Union with a box: 2k-triangle
mesh 16.3 → 0.44 s, 5k 49 → 0.94 s, 20k 409 → 3.2 s (its volume agrees with an independent mesh Boolean
to 0.02 mm³).
