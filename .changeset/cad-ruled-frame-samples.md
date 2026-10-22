---
"@barocss/cad": patch
---

Ruled faces (a hole's wall, a loft's side) tessellate a little faster with the same triangles: each face's ruled frame is made once, and its edges' coarse samples are worked out once rather than for every point projected onto them.
