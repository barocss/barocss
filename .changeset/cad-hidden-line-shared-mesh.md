---
"@barocss/cad": patch
---

`projectBrepHiddenLines` tessellates a B-rep once per quality and reads each face's plane or cylinder once, sharing them across the views of a drawing (the same segments). Four views of a 120-hole plate: 4.0 s → 1.2 s; of a modelled M8 bolt: 1.8 s → 0.8 s.
