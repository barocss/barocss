---
"@barocss/cad": patch
---

Analytic Booleans of curved faces are faster: surface intersection refines a grid crossing only when no traced chain or known edge already lies within half a step of it, and curve segments keep their samples, sample box and area. Fillets of a box's eight edges evaluate in about 60% of the time.
