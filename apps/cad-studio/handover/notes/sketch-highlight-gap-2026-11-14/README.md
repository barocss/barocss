# D1053 — keep the gap between Sketch highlights

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2460](https://github.com/barocss/barocss/issues/2460)

Draw Sketch curve selection, hover and inspection strokes at 2 CSS px. Keep their colors, opacity and dash patterns.

- **FAIL** The 4/5/8 CSS px hover, selection and inspection strokes left zero clear device pixels at a roughly 4 CSS px separation in each tested theme and DPR. The 2.25/2.5/3 CSS px candidate still filled the gap at DPR 1 when both edges were selected or when one was inspected and the other selected. Two earlier driver attempts needed SVG attachment and zoom calibration fixes.
- **PASS** At 1024 × 800 WebGPU, dark and light each retain at least one clear device pixel per column at DPR 1 and three at DPR 2 across 44 CSS px. All three highlight combinations pass. Click and Shift removal pick the expected edges. Escape clears mobility inspection and keeps the selected edge. The document is unchanged.
- **PASS** Visual review, circle-picking and existing Fixed mark desktop controls, seven focused tests, driver syntax and diff checks.
- **NOT_RUN** Circle/line pixel-gap measurement, adjacent dimension overlap, full suites, production build and mobile. The circle-picking replay covers input identity.

#2460 remains open. Desktop QA is 17/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
