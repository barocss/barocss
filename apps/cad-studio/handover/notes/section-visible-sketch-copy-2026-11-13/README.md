# D1011 — copy only visible bodies from Section

2026-11-13 · FEATURE · P0 rows 05, 09, 15 and 16 · [#2446](https://github.com/barocss/barocss/issues/2446)

- **FAIL, baseline** At X = 25 mm, hiding source `b3` in the Browser left both source bodies in the exact section and its hatch.
- **PASS, fixed** Source visibility now filters Section before it assigns split keys. The settled section and hatch show one body after Hide, down from two. Kept volume falls from 9,600 to 3,600 mm³ within 1e-7 mm³. The exact reply is scoped to its source body array. The same filter feeds the immediate clip path.
- **PASS** In desktop WebGPU Studio, Sketch the section describes the copy as independent. Finish Sketch writes only the visible 20 × 12 mm outline at X = 25 mm. The sketch has no source reference and remains unchanged when the hidden body is shown again. Both source solids and their authored outputs are preserved.
- **PASS** Visual review, 25 focused Studio tests, Model and Studio type-check, driver syntax and diff check.
- **FAIL, setup run** The first driver toggled off the default hatch. The corrected baseline reached Hide and reproduced the source visibility defect.
- **NOT_RUN** Actual drag and fallback transitions, placed instances, all-hidden input, Mate and Measure, face-derived position, production build, full suites and mobile.

Desktop QA remains 7/54 and #2446 stays open. Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
