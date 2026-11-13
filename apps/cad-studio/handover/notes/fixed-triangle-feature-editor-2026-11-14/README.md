# D1082 — apply a fixed-triangle length from Extrude history

2026-11-14 · FEATURE · P0 desktop QA, rows 09 and 21 · [#2456](https://github.com/barocss/barocss/issues/2456)

Use the existing guarded D858 solve for the literal third side of the selected reopened fixed triangle. Keep the original Sketch node fields and side tags. A refused value leaves the last valid draft intact and blocks Apply, including Enter. Reset restores the original draft.

- **FAIL** Parent Studio shows the entered 124.05 mm but disables Apply.
- **PASS** Desktop WebGPU stages 124.05 mm and shows an invalid input and its reason at 132.05 mm. Enter and a change to Distance leave the document intact. Correcting the length clears the reason. Reset restores both fields. A second 124.05 mm edit applies, supports exact document Undo and Redo, and survives project Save and Open in a fresh page.
- **PASS** The 128 mm side and both fixed points remain exact. The independent analytic check matches the third point within 1e-8 mm. The 6 mm native Extrude has five named faces, nine edges, six vertices and a valid B-rep. The measured 238.33719912328928 mm³ matches the analytic volume within 1e-6 mm³.
- **PASS** Studio and Model type checks, 27 focused tests, scoped lint, driver syntax and diff checks. Sol High reviewed geometry and ownership. The root visually checked the parent, refusal and reopened states on the prior candidate run. The final browser run repeated the measured flow with zero console errors and closed its contexts, browser and server.
- **NOT_RUN** Studio replay of a successful parameter binding after a refused literal input, broader feature-editor families, full suites and production build.

#2456 remains open. Desktop QA is 19/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
