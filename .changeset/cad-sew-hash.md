---
"@barocss/cad": patch
---

Sewing many surfaces into a solid is about twice as fast with the same result. Corners are welded through
a hash of tolerance-sized cells, sides are paired through their corners, and curves and surfaces are
evaluated through evaluators validated once. A cube of 1536 patches: 2.4 s → 1.1 s.
