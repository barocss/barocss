# D1191 — Explain automatic Sew tolerance and unmatched edges

2026-11-14 · FEATURE · P0 desktop QA, rows 13, 19 and 21 · [#2467](https://github.com/barocss/barocss/issues/2467), checklist lines 1969–1975

The direct panel, preview and History use **Tolerance (0: automatic)**. An unmatched-edge refusal shows the edge count and the affected surface positions in the ordered source list. The message asks the user to check the gap and tolerance. Sew retains its existing geometric matching policy.

| Result | Check |
| --- | --- |
| FAIL | An initial browser driver opened the pre-move fixture. A second driver read the Bézier control hull as the roof. After correcting both, the parent showed the misleading 0 tooltip and a generic error for the actual 0.02 mm gap. |
| PASS | Current desktop Studio selected the six original surfaces in order. At 0.019 mm the preview and History displayed eight unmatched edges on surfaces 1, 3, 4, 5 and 6 with Kernel detail collapsed. Preview Apply stayed disabled. History refused the edit and preserved the accepted solid. Root inspected the preview screenshot. |
| PASS | Automatic 0 previewed the gap. At explicit 0.021 mm, Apply saved one strict-valid solid with 6 faces, 12 edges and 8 vertices. It measured 1199.9999999999995 mm³, 0.019999999999997797 mm maximum native support gap, and midpoint roof Z13.02 mm. The fixture gives independent expectations of 1200 mm³ (10 × 10 × 10 plus the 200 mm³ quadratic dome), 0.02 mm and 13.02 mm. History 0 removed the explicit tolerance and retained the supported result. Undo and Redo passed. |
| PASS | 20 focused Model tests, Model and Studio types, scoped lint, both browser-script syntax checks, diff, frozen-source verification and production build. Updated existing Sew browser selectors follow the renamed field. |
| NOT_RUN | Unmatched-edge viewport highlighting, other selection order, STEP round trip, the complete historical Sew driver, full suites, CI and mobile. |

Keep #2467 open for STEP fidelity. Desktop QA is **29/54 (54%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
