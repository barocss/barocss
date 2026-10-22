---
"@barocss/cad": patch
---

Curved faces tessellate faster: a boundary point's inversion keeps the four nearest grid seeds without filtering and sorting the whole grid, and the Delaunay flips and refinement look up neighbours and incircle tests without building arrays or callbacks per edge. A box with all twelve edges filleted tessellates in about 60% of the time (49 → 31 ms); the mesh is the same.
