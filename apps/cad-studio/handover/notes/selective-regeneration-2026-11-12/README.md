# D811 — Verify selective regeneration after a named height edit

P1, rows 07, 16 and 22. SMALL verification of existing behavior. The fixture is one 30 × 20 mm rectangular extrusion with a centered radius-2 mm through Hole, and an independent radius-5 mm cylinder. Parameter plateHeight drives only the first extrusion. D808 already supplies independent native geometry for the same physical profiles. This run measures the actual Rebuild panel and the current Worker bodies.

| Result | Check |
| --- | --- |
| PASS | On fresh Open, Rebuild shows both sketches as inputs and all three solid features built. |
| PASS | Changing plateHeight from 8 to 10 mm in Parameters rebuilds the plate n1 and Hole n4. The independent cylinder n3 is reused. The accepted Rebuild report has two built and one reused, and the Hole retains parent n1 and face n1.top. |
| PASS | Zero height is refused with “height must not be zero”. The accepted document, both current bodies and the exact accepted Rebuild report remain. The first Undo restores 8 mm and the first Redo restores 10 mm. |
| PASS | The Worker volumes and centroids agree with the independent formulas within 1e-5 mm³ and 1e-6 mm. The drilled plate measures 4699.4690350851 mm³ and 5874.3362938564 mm³ at the two heights. The independent cylinder measures 471.2388980385 mm³ at every checked state. |
| PASS | Six focused Model tests, driver syntax, diff check and visual review. The desktop run has zero page errors, console errors and downloads. |
| NOT_RUN | Performance comparison, general cache invalidation and arbitrary feature graphs, full suites, mobile and other browsers. |

[Commands and receipt digest](qualification.json). [#551](https://github.com/barocss/barocss/issues/551) remains open for the wider graph. Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**.
