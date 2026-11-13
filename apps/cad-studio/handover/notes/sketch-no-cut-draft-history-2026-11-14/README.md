# D1079 — verify draft history through Trim without a cut

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2455](https://github.com/barocss/barocss/issues/2455)

Replay the remaining no-cut and refused Trim flows from the desktop checklist.

- **PASS** Switch Select → Trim → Select without a cut. Cmd+Z restores X40. A refused click on blank sketch space preserves pending Redo. Toolbar and keyboard replay X40 and X44 after either route. Finish retains the original edge IDs and changes the 2 mm solid from 1,600 to 1,760 mm³. Document Undo and Redo restore both exact documents.
- **PASS** The current no-op Finish replay preserves the 3 mm document Redo and restores the 2,400 mm³ solid. Thirteen focused tests, driver syntax, diff checks and visual review passed.
- **FAIL → PASS** The first no-op replay stalled in Chrome startup. The same replay passed after restarting the test-owned browser.
- **NOT_RUN** Full suites, production build, other browsers and DPI values.

## Issue acceptance

| Requirement | Desktop evidence |
| --- | --- |
| Undo in reverse and Redo in forward order across tools | D1056 and D1079 verify numeric X and Trim. D1071 and D1072 verify a reopened arc profile and a new rectangle. D1073 verifies repair Line after Drag Trim. D1063–D1068 and D1077–D1078 verify Offset, Extend, Split, Clear and Band. |
| Restore authored values, constraints and references | D1056 verifies coordinates and construction. D1059–D1061 and D1075 verify Rectangle, Circle and Bézier dimensions. D1065 verifies derived arc midpoints. D1067–D1068 verify Band source IDs. D1069 verifies both kinds of face-outline copy. D1062 and D1070 verify linked geometry and source regeneration. D1076 verifies unlinked work plane placement. |
| Keep document Redo after unchanged Finish | D1057 and the current no-op replay. |
| Prevent Drag Trim from cutting behind the tool rail | D1058 cancels the stroke at the rail and replays a fully visible three-interval stroke. |

These checks cover the issue's stated desktop cases. Existing-circle Gap availability is tracked in [#2489](https://github.com/barocss/barocss/issues/2489). Broader direct dimension and constraint editing is tracked in [#2456](https://github.com/barocss/barocss/issues/2456).

Desktop QA was 18/54 at verification. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
