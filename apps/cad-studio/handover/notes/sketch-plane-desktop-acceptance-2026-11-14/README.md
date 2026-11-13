# D1128 — Qualify sketch plane recovery in desktop Studio

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2458](https://github.com/barocss/barocss/issues/2458)

| Result | Check |
| --- | --- |
| PASS | Desktop Studio selected the two native oblique caps in both orders and returned the same midpoint frame. Top and Frame all changed the projected 6 × 4 mm draft aspect ratio to 1.875000. Normal to sketch restored 1.500000 within 1e-6 and preserved both draft dimensions and the uncommitted document. The restored view retained the stock framing, so the outboard rectangle reached the edge of the viewport. |
| PASS | Finish retained the exact frame. A 3 mm Extrude produced a valid 72 mm³ solid. All eight independent corner checks, Undo/Redo, native Save and fresh Open passed. |
| PASS | Studio displayed the exact-parallel requirement on the fractional oblique control and retained its document, selection and history. The axial flow verified a truly nonparallel pair, a valid midpoint, Extrude and fresh Open. D1126 provides distinct mixed-body and collinear refusals. |
| PASS | D1124 covers history edit and arbitrary orbit, D1125 covers the visible placed-face limitation and root recovery, and D1127 covers the visible vertex at orthographic overlap. Together these meet the explicit #2458 criteria. |
| PASS | 26 focused Studio tests, 14 focused Model tests, driver syntax and diff check. |
| FAIL | Three preliminary Studio driver attempts used an inactive cube control, began a drag over the active dimension editor, or applied the geometry tolerance to a browser projection ratio. The final run uses the Top rail and a 1e-6 ratio tolerance. |
| NOT_RUN | Widened exact-parallel admission, direct placed-face attachment, full suites and mobile. |

Desktop QA becomes **21/54** when #2458 closes. Initial scenarios are **8/10**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
