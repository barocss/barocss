---
work_id: physics-world-p3-2276
artifact_type: independent-gate-index
status: ready_for_build
owner_role: independent-physics-algorithm-work
source_request: fix numerical criteria before P3 source trial; preserve original exact and physical gates
last_updated: 2026-11-02
---

# Gate index

This index clarifies the abbreviated CONTRACT before fresh World calls. It does not replace or change the original
reference implementations. Candidate comparison requires the conjunction, not a choice of a convenient column.

| Original gate family | Unchanged bound / method |
|---|---|
| Original public HINGE2 bank correspondence | Exact input, accepted BEFORE/AFTER body/state/report and416B F64LE comparison, signed zero included. A one-ULP report mismatch is a failure. |
| Original World geometry | Anchor gap≤.002m, axis deviation≤π/180rad, angle/report and limit excess≤1e-9rad, quaternion norm error≤1e-9; COM drift≤1e-5m from pair origin. |
| Original World motion/conservation | Plane drift≤1e-12m; accepted-to-final motion≤10m; command-accounted linear/angular momentum step residuals≤1e-7 in their SI units. |
| Parent coupled projection expected physics | Raw AND normalized: anchor gap≤1e-9m, norm error≤1e-9, limit/report error≤1e-9rad, axis≤π/180rad; COM change≤1e-12m; momentum changes≤1e-7. Anchor relative speed/transverse relative omega/outward stop speed≤1e-9 in their units. |
| Independent expected phase agreement | Position/quaternion≤1e-12; velocity≤1e-10m/s; angular velocity≤1e-10rad/s, except projected≤1e-9rad/s. |
| Report/correction/work comparison | Report angle≤1e-9rad; motor speed≤1e-10rad/s; other report/correction and measured metric errors≤1e-12 SI; work errors≤1e-12J except projection objective≤1e-10J. |
| Decimal80/120 agreement | Algebra≤1e-25 per original unit; scalar repeat≤1e-12rad. Raw-normalized geometry difference≤1e-12. |
| Linear/KKT/certificate | Full original rank/row-count, exact primal/stationarity/stop KKT and expected certificate correspondence; original scaled solver thresholds remain. No new certificate is inferred from a boolean alone. |
| Physical caps | Motor impulse≤.0001Nms; correction cap strict>.01Nms refusal. Energy/objective nonnegative where specified; blocked motor at original limit. |

Exact correspondence allows reuse of the authenticated original independent calculation on the SAME recorded
input/output. It does not call that old calculation a new execution. No full certificate is reused for a mismatched
phase, report or operand-dependent result. Candidate source observation and ordinary repeat/compiled output parity
are reported separately. Complete rule authorities are:

- `examples/physics-rigid-hinge-velocity-world-reference/world_observation.py`
- `examples/physics-rigid-hinge-velocity-world-reference/reference-reply.mjs`
- `examples/physics-rigid-hinge-velocity-world-reference/world-quality.mjs`
- `examples/physics-public-disjoint-hinge-reference/expected-gates.py`
- Authenticated original per-step reference replies/certificates in the f401 bank.

The actual freeze pins those files before trials. Original step77 angle/report failure remains a failure even though
its numerical size is much smaller than a geometric bound in another gate family.
