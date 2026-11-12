# D829 — Preserve source identity in an overlaid sketch scan

P1, rows 09, 15 and 16. SMALL verification of D828 and precise wording for excluded geometry. Actual Studio reopens a rectangle with four stored side IDs and a driving 6 mm length. The draft adds a neighboring ordinary rectangle and one construction circle.

| Result | Check |
| --- | --- |
| PASS | Studio checks eight straight segments, reports one exact group and excludes the construction circle. The stored edge remains shape 1, segment 2, ID e2. The draft edge remains shape 3, segment 4 with its own locator. Their directions run oppositely between (36, 10) and (36, 15) mm. |
| PASS | Selecting each row highlights its projected segment within 1 CSS pixel. The accepted document, shape graphics, selection, dirty state and history controls stay exact. |
| PASS | Actual Undo restores the previous empty document and retires the diagnostic and draft. Redo restores the exact stored sketch. Its locked 6 mm length and side tags remain intact. The new scan checks four straight edges and finds zero groups. Finish keeps the exact document. |
| PASS | D828's adjacent-rectangle, geometry/plane change and exact native project flow passes again. Studio 38/38 focused tests, type check, scoped lint, driver syntax, diff check and root visual review pass. Both desktop runs have zero page errors, console errors and downloads. |
| NOT_RUN | Full suites, mobile and other browsers. |

[D828](../overlaid-sketch-lines-2026-11-12/README.md) and this decision qualify the read-only exact straight-segment scope in [#2392](https://github.com/barocss/barocss/issues/2392). Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and receipt digests](qualification.json).
