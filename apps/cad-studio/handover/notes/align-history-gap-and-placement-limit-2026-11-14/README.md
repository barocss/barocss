# D1239 — Distinguish Gap bounds from the Align placement limit

2026-11-14 · FEATURE · P0 desktop QA, rows 07 and 21 · [#2531](https://github.com/barocss/barocss/issues/2531)

History connects an invalid input to its single field error. A valid numeric input still goes through native evaluation. If the requested placement exceeds the coordinate range or cannot maintain the gap, both the preview and Apply explain the condition and offer Gap reduction or Reset.

| Result | Check |
| --- | --- |
| FAIL | Parent Studio repeated the input range and showed a generic error for an in-range value that failed placement. |
| PASS | Negative and over-limit values used one range error associated with Gap and still blocked Apply. Blank input, Reset and zero passed the separate D1235 control. |
| PASS | In Chrome WebGPU, Gap 10000 mm against the +X face at X110 showed the actual placement limit before and after Enter. The accepted document stayed unchanged. |
| PASS | At X−10 the same Gap previewed and applied. Strict native B-rep had X bounds [9990, 9996] mm, centre [9993, 10, 6] mm and volume 720 mm³. Independent box dimensions matched within 1e-7. Undo, Redo, Studio Save and fresh Open passed. |
| PASS | Three focused Model tests, 20 focused Studio tests, both type checks, scoped lint, driver syntax, build and frozen-source checks. |
| NOT_RUN | Other axes and placements at the bound, assistive technology, full suites and CI. |

The stated #2531 acceptance is met. Desktop QA is **34/94 (36%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
