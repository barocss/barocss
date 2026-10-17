---
"@barocss/cad": patch
---

Booleans of curved bodies find each face piece's interior point faster: a candidate stops being measured once it cannot beat the best so far, and a general curve whose padded sample box is no nearer than the nearest edge so far is skipped. The same points are chosen; a 16-hole plate evaluates about 15% faster.
