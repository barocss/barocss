# D1025 — verify Path tracing uses the applied Assembly Cut

2026-11-13 · SMALL · P0 rows 05, 13, 16 and 20 · [#2448](https://github.com/barocss/barocss/issues/2448)

- **PASS** Six fresh desktop WebGPU Path tracing stills cover stock, Ø8 creation draft, creation Cancel, applied Ø8, Ø12 edit draft and edit Cancel. All PNGs are 640 × 561. The six stops show 54, 49, 65, 59, 57 and 60 samples.
- **PASS** All three 9 × 9 pixel probes agree between stock and both uncommitted creation states. All three agree between applied Ø8 and both edit states. The applied cut changes the centre probe by 185.89 average channel levels. The radius 5 mm probe remains on the plate in the pending Ø12 still. The draft remains visible and editable in Model after each Render return.
- **PASS** Native volumes before and after Apply match 12,000 and 12,000 − 80π mm³ for each plate within 1e-7 mm³. Visual review, 19 focused Studio tests, driver syntax and diff check pass.
- **FAIL** None on the current source. The previous failing comparison is in the issue's historical desktop evidence.
- **NOT_RUN** STEP, Drawing, 3MF, delayed worker handoff, production build, type-checks, full suites and mobile.

The current D1024 scene selection passes with no new production change. This proof starts a new still in each state. PNG bytes can vary with the sample count. Desktop QA remains 9/54 and #2448 stays open. Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
