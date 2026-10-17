---
"@barocss/cad": patch
---

Filleting every edge of a box: each corner's ball is turned so that its poles lie outside the corner. The
corner patches are then regular pieces of the sphere, and the box's mass and area agree with the rounded
box's closed form 5× more closely (volume within 7.5e-6, area within 2.8e-6, up to half the shortest edge).
The geometry was already exact. The corner pieces keep their names; which piece carries which `#k` may
differ.
