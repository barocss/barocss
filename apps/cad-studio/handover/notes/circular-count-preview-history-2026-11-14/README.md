# D1141 — Match Circular Pattern Count in preview and history

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2461](https://github.com/barocss/barocss/issues/2461)

Creation and history accept whole numbers from 2 through 4 about X or Y and from 2 through 36 about Z. Both show the range. These are the existing creation limits shown by Studio. Native document admission retains the kernel range for an existing stored pattern. The user can open such a document, edit Count within the Studio range and restore the original via Undo.

| Result | Check |
| --- | --- |
| FAIL | Parent desktop preview showed maximum 36, then accepted and saved Count 37 about Z. History displayed maximum 64 for the saved feature. |
| PASS | Desktop creation and history refused blank, 0, 1, 2.5 and one above the maximum for X and Z. Enter left the accepted document exact. Creating three then editing to four produced 768 mm³ at a 90° step. Undo and Redo passed for each axis. |
| PASS | A stored 37-copy Z document opened with 7104 mm³. A deliberate edit to four applied. Undo restored the complete original document. |
| PASS | Desktop Box and Fillet history controls, Z partial spread with displaced pivot through project reopen, and X/Y quarter-turn geometry for both result modes passed. The native quarter-turn test used independent corner and volume checks. |
| PASS | 20 focused Model tests, Model and Studio type checks, Studio production build, scoped lint, driver syntax and diff check. |
| NOT_RUN | Box, Extrude and Fillet creation HUD parity with history, full suites and mobile. |

The first fixed driver read mass before Studio marked it ready. The final run waits for the accepted document and mass. [Commands and hashes](qualification.json).

#2461 remains open. Desktop QA is **23/54**. Initial scenarios are **8/10**. Whole CAD and core readiness are **NOT_MEASURED**.
