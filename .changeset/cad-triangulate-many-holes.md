---
"@barocss/cad": patch
---

Planar faces with many holes tessellate far faster, with the same triangles: a hole's bridge tries the outline's points nearest first and stops at the first that passes, an ear is tested only against the ring points near it (a grid), and a hole point shared with the outline is found without scanning it. A 240 × 120 plate with 120 holes builds its display mesh in a sixth of the time (4.3 s → 0.73 s) and its drawing views in about a quarter (17.8 s → 4.6 s).
