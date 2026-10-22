---
"@barocss/cad": patch
---

Feature reuse no longer builds keys out of the keys upstream: a feature is reused when its resolved definition is the same and each input is the very result it was made from. A chain of more than about twenty features no longer fails with "Invalid string length", and evaluating an unchanged 20-feature part takes 0.1 ms instead of 109.
