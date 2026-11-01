---
"@barocss/physics": minor
"@barocss/cad-model": patch
---

Add a separate fixed-axis planar pendulum API with explicit SI inertia and fixed-step Verlet integration. Reject nonfinite path values, times, and rates before robot motion timing. Existing World hinge and contact profiles remain unchanged.
