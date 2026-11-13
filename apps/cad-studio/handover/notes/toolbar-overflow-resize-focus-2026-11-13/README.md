# D977 — restore toolbar focus and close More tools on resize

2026-11-13 · SMALL · P0 rows 15 and 21 · [#2441](https://github.com/barocss/barocss/issues/2441)

- **FAIL on parent** With a Box, the focused Insert part went to the body at both desktop resize boundaries. An open More tools lost focus when expanded and reopened by itself when reduced. The first harness attempt added the Box to Studio's initial sample. The reproducing run started with a new part.
- **Change** Close More tools when its tool inventory is redistributed. If the focused control is removed, focus the same tool inline, the More tools trigger, or the last enabled inline button in that order.
- **PASS** In desktop WebGPU Studio, Chat closed at 1440 → 1024 → 1440 → 1024 and Chat open at 1800 → 1280 → 1800 → 1280. On reduction the trigger took focus, on expansion the focused menu item returned to Insert part, and More tools stayed closed on the next reduction. Both exact Box documents remained intact. No page errors, console errors or downloads.
- **PASS** Visual review, Studio type-check, driver syntax and diff check.
- **NOT_RUN** Escape with an active Undo tooltip, splitter drag, file chooser, downloads, WebGL2, production build, full suites and mobile. #2441 remains open.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
