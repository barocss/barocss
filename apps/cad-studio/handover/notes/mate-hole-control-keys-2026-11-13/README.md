# D975 — qualify Assembly Mate and Hole Type control keys

2026-11-13 · SMALL · P0 rows 15 and 21 · [#2440](https://github.com/barocss/barocss/issues/2440)

- **PASS** Desktop WebGPU Studio opened Add mate with Shift+Enter, kept focus navigation from Mate type to Distance, picked the base XY plane with Space and canceled with Shift+Enter. The two-instance assembly document stayed exact.
- **PASS** On the selected top face of a 40 × 30 × 10 mm plate, a valid 8 mm blind Hole preview was active. Enter and Space on Type retained the draft and field focus. Tab moved focus to Diameter. Shift+Enter canceled the Hole and the accepted plate stayed exact.
- **PASS** Visual review, driver syntax and diff check. No product source changes, page errors, console errors or downloads.
- **NOT_RUN** Native select popup navigation. Headless Chrome did not expose the highlighted option through keyboard events in the attempted runs. The final driver sets the starting option with Playwright and sends real key presses to the focused control. Delete confirmation, WebGL2, fresh reopen after the tested actions, type-check, production build, full suites and mobile were also not run. #2440 remains open.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
