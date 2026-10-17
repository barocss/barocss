---
"@barocss/cad": patch
---

Tessellations are watertight to the bit where faces meet at a corner: each edge's end samples are its
vertices' points, rather than its curve evaluated at its ends, which differed in the last bits between edges.
A helical bolt's display mesh and STL had 342 such cracks; there are none now, and the volume is unchanged.
