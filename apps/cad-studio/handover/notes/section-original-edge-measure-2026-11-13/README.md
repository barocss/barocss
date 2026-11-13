# D1016 — qualify fully retained Section edges for selection and Measure

2026-11-13 · FEATURE · P0 rows 05, 15 and 16 · [#2446](https://github.com/barocss/barocss/issues/2446)

- **FAIL, baseline** The retained top edge of A at X = 38 mm was visible in the exact Section at X = 25 mm. A click in Edges mode left selection empty.
- **PASS, fixed** Desktop WebGPU Studio highlights the retained 20 mm edge. A regular click and a context click resolve to the same original edge on A. Measure from here reports 20 mm. The second retained top face has area 800 mm². The nearest distance is √164 mm, shown as 12.81 mm. The document and history stay unchanged.
- **PASS** A shortened original edge and the generated rim preserve the pending first pick. The rim's context menu offers no Measure action. A native evaluation trace confirmed that a shortened edge can keep its full name, while the retained edge keeps both endpoint coordinates even when its local vertex IDs change.
- **PASS** Visual review, 30 focused Studio tests, both type-checks, driver syntax and diff check.
- **FAIL, setup run** The first fixed run attempted a context menu during a view transition for the shortened-edge control. The final run confirms the hit with the renderer and uses a regular click during pending Measure.
- **NOT_RUN** Oblique and multi-plane edge mapping, curved edges, other root edge operations, placed-edge Measure, Zebra seam, production build, full suites and mobile.

The mapping covers a settled single axis plane and straight native edges with one unambiguous source name, matching adjacent faces and exact endpoint coordinates. Both endpoints must remain strictly within the kept side. Desktop QA remains 7/54 while the Zebra checklist entry is reviewed. Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
