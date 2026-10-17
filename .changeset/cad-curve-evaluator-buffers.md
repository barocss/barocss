---
"@barocss/cad": patch
---

`curveEvaluator` reuses its basis buffers and looks for constant coordinates once, not on every point (the same points, bit for bit). Booleans of curved bodies, which evaluate edge curves through it, run about a fifth faster.
