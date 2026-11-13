# D1136 — Open Circle gap in a saved ordinary sketch

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2489](https://github.com/barocss/barocss/issues/2489)

An ordinary independent circle can use Cut circle gap when reopened from History. A bound circle, face attachment, linked sketch or other mixed sketch retains its existing admission limit.

| Result | Check |
| --- | --- |
| FAIL | Parent Studio reopened the saved R10 cylinder sketch and entered Trim. Cut circle gap was absent. |
| PASS | Current Studio opened the same tagged circle and applied a 4 mm gap. Finish refused the open arc and retained the accepted cylinder. Draft Undo restored the complete circle and cleared the refusal. Redo restored the same arc. Undo and Finish retained the exact opened document and its 628.318531 mm³ cylinder. |
| PASS | The new-circle gap and chord-confirmation history Desktop controls passed. A new gap repaired with Line persisted through browser project Save and Open and produced a valid native 627.260486 mm³ solid. Studio 18/18 focused tests, type check, scoped lint, driver syntax and diff passed. |
| NOT_RUN | Repaired geometry applied and saved from an existing sketch, bound and linked Studio refusal controls, full suites and mobile. |

#2489 remains open for the saved-history repair path. Desktop QA is **22/54**. Initial scenarios are **8/10**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
