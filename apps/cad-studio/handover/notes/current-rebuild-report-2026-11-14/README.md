# D1246 — show the current evaluation in Rebuild

2026-11-14 · SMALL · P0 rows 12, 16 and 21 · [#2541](https://github.com/barocss/barocss/issues/2541)

- **FAIL, baseline** Actual Chrome WebGPU at 1440 × 900 and 1024 × 800 continued to show the previous Shell profile and success revision after File Open of a zero-height Extrude. The viewport marked its display as the previous result.
- **PASS** Rebuild consumes results for the exact current evaluation input. The panel shows a pending status while delivery of the genuine worker response is held. After release, it shows the current failure. Earlier feature rows, revision, frame tally and mate summary are withheld. The existing stale viewport state and error remain visible.
- **PASS** File Open of a valid 64 × 32 × 8 mm plate restores the current Sketch and Extrude rows and 16,384 mm³. No earlier Shell rows return. The source Shell and stale viewport retained 6,304 mm³ within 1e-7 mm³, consistent with the cuboid minus cavity oracle.
- **PASS** Actual stale-model consumer regression for click, context click, Hole, Sketch, Measure, STEP and corrected native Open. Visual review, six focused Model tests, Studio type-check, Rebuild panel lint, production build, driver syntax and diff checks passed.
- **FAIL, existing** App lint reports the unrelated unused `_k` sheet field.
- **NOT_RUN** Imported STEP Shell as the first document in this run, a multi-part mate fixture, assistive technology, full suites and mobile.

The desktop checklist was 38/105 (36%) at review. Whole CAD readiness remains **NOT_MEASURED**.

[Commands and receipt hashes](qualification.json).
