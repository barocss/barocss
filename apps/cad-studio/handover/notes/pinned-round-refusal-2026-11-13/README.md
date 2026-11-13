# D905 — verify finite Round refusal and adjudicate the first pinned profile

2026-11-13 · SMALL · P1 rows 09 and 16 · [#2282](https://github.com/barocss/barocss/issues/2282).

Desktop Studio picked the R20 arc's already-tangent junction at `[20, 40]`. The forward tangent of the arc and the outgoing line both point left. The Round action refused the junction and preserved the outline, document, visible history and dirty state. Cancel retained the exact strict native solid at 7141.5926535897925 mm³. On the same stock, the sharp junction admitted R3, produced 7116.460269574863 mm³ and replayed exactly through Undo and Redo.

The focused Model matrix verifies input retention for the already-tangent junction, a zero-length retained side, the opposite circle branch, a self-crossing outline and an open terminal with no outgoing side. It keeps the existing invalid radius, out-of-segment, missing pins, locked trimmed entities, unsafe identity and unsupported arc/curve tests. The already-tangent Studio refusal uses the existing generic arc message.

## Issue acceptance

| Criterion | Evidence for the first pinned profile |
| --- | --- |
| Independent contact, radius and finite branch | [D890](../pinned-line-arc-round-2026-11-13/README.md), [D891](../reflected-pinned-line-arc-round-2026-11-13/README.md), [D902](../reversed-pinned-arc-line-round-2026-11-13/README.md) and [D904](../pinned-round-oblique-plane-2026-11-13/README.md) verify native contacts, volume, winding, reversal and world transform. |
| Radius edits, constraints and branch continuity | D890 verifies R3/R4/R5. [D892](../pinned-round-source-radius-2026-11-13/README.md) verifies source R16/R18 and source-limit refusal. [D903](../pinned-round-fillet-relock-2026-11-13/README.md) verifies fillet re-lock and retained geometry. [D350](../sketch-conflict-proof-2026-10-30/README.md) retains the existing distinction between redundant constraints, proven rectilinear conflict and solver nonconvergence. |
| Refusal and retention | D890 covers invalid and oversized radius, unsupported inputs, attached outlines and insufficient IDs. D905 adds the finite wrong-branch, tangent, degeneracy, crossing and missing-side controls. D892–D904 verify exact-limit refusal and accepted-state retention in actual editors. |
| Side IDs and downstream references | D890 and D902 retain the original IDs and add exactly one fillet ID. The focused Model test retains an unrelated tagged construction sibling. [D893](../pinned-round-face-measure-2026-11-13/README.md) verifies real Measure picks on both named native walls before and after source edits. |
| Studio lifecycle and regressions | D890 verifies the straight-corner control and existing Round → Finish/Extrude → radius edit → refusal → Undo/Redo → project Save/fresh Open → re-edit path. D891–D904 retain further exact Studio evidence. D905 runs the affected Model and Studio identity tests again. |

Adopt the first pinned profile and retain the refusals outside it. Arbitrary sketch-line angles and constraint layouts, arc–arc, spline/ellipse, disconnected geometry, batches, virtual sharp points and general blends remain outside this acceptance. There is no new schema, solver or dependency.

## Results

- **PASS** Desktop Studio WebGPU, independent geometry review, 64 Model tests, 4 Studio identity tests, Model type check, affected lint, driver syntax and diff checks.
- **FAIL** No new failure in this scope. The historical first failures remain in their original decisions.
- **NOT_RUN** Other tangent fixtures in Studio, general curved conflict proof, full suites and mobile.

[Commands, numeric results and receipt hashes](qualification.json).
