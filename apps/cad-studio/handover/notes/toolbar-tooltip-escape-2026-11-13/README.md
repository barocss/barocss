# D978 — let Escape dismiss More tools when Undo's tooltip is visible

2026-11-13 · SMALL · P0 rows 15 and 21 · [#2441](https://github.com/barocss/barocss/issues/2441)

- **FAIL on parent** With Export STEP focused in More tools, the Undo tooltip consumed Escape. More tools and its focus stayed open with Chat closed at 1024 px and open at 1280 px. The first harness run could not reach Export STEP reliably with repeated arrows. The reproducing run focused the reported menu item directly before hovering Undo.
- **Change** Remove the hover tooltip at window capture on Escape so the existing menu or dialog can process the same key. Keep the native menu dismissal and focus return.
- **PASS** In both desktop WebGPU Studio conditions one Escape dismissed the menu and tooltip and returned focus to More tools. The Box document was exact.
- **PASS** D685 regression with all 14 tools reachable, keyboard and pointer Insert part chooser dispatch, and normal Escape. Choosers were canceled before supplying files. Visual review, Studio type-check, driver syntax and diff check passed.
- **NOT_RUN** Splitter drag, selecting a file, downloads, WebGL2, production build, full suites and mobile. D977–D978 cover the reported desktop #2441 acceptance.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
