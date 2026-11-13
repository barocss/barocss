# D987 — cancel a Drawing Note edit with Escape

2026-11-13 · SMALL · P0 rows 07 and 21 · [#2443](https://github.com/barocss/barocss/issues/2443)

- **FAIL on parent** Escape blurred the selected Note text and committed the changed text through the blur handler.
- **Change** Cancel the text draft on Escape and return focus to its selected Note row. Command or Control+Enter retains the explicit blur commit.
- **PASS** Desktop WebGPU Studio canceled the second-sheet Note draft, retained the original text, current selection and Undo/Redo availability, and restored its row focus. Command+Enter accepted a later edit. Undo and Redo restored exact states and the other sheet kept its own Note. The first fixed run assumed Open supplied no Undo entry; the final run compares the existing history availability.
- **PASS** Visual review, 19 focused drawing checks, Studio type-check, driver syntax and diff check. No page errors, console errors or downloads.
- **NOT_RUN** Overlapping annotation click verification, WebGL2, production build, full suites and mobile. #2443 remains open.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
