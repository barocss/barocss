---
"@barocss/cad": patch
---

Tessellation of trimmed cylinder faces keeps their (angle, height) frame right-handed. Before, a cylinder whose
axis lies at 45° between two coordinate axes could have a face wound inside out: two cylinders crossing at 45°
rendered with a hole, and their mass fell back to the wrong mesh, 38% low.
