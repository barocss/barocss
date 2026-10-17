---
"@barocss/cad": patch
---

Polyhedral Booleans (mesh bodies, faceted solids) are 9–22× faster with the same results. A face the
classification point or ray clearly misses is skipped by a binary64 test with a generous error bound,
and the exact rational test runs only on the faces that remain. Face normals are worked out in integers
on the corners' common power-of-two denominator. T-junctions are found through vertices sorted by x
instead of by testing every vertex against every edge. Union with a box: a 2k-triangle mesh 16.3 → 1.0 s,
a 5k mesh 49 → 2.2 s.
