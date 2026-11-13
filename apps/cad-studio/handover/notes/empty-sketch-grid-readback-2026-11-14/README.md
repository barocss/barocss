# D1118 — verify the grid setting and saved points in an empty sketch

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2457](https://github.com/barocss/barocss/issues/2457)

Current desktop Studio shows the grid state in the existing bottom control. The empty Sketch panel has no separate grid value. This decision adds a desktop check for the earlier report of a stale 1 mm value.

| Result | Check |
| --- | --- |
| PASS | With all object snaps off, the empty Rectangle showed Grid 5 mm and stored (20, 15) to (30, 25) mm from fractional pointer targets. Grid off stored (21.2, 16.3) to (31.4, 26.3) mm. Neither empty panel showed the old fixed 1 mm label. Root reviewed the screenshot. |
| PASS | Both paths retained the original nodes and outputs. Undo and Redo restored exact documents. Studio 9/9 and Model 22/22 focused tests, both type checks, production build, scoped lint, driver syntax and diff check passed. |
| FAIL | No failure on the tested current source. |
| NOT_RUN | The original historical binary, other drawing tools and full suites. |

The original false Loft Centre is already covered by [D855](../native-circle-centre-snaps-2026-11-13/README.md). [D1060](../circle-numeric-draft-history-2026-11-14/README.md) covers the numeric Circle draft Undo. The remaining closeout compares the issue's acceptance with the actual receipts.

#2457 remains open. Desktop QA is 19/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
