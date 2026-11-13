# D1062 — restore a linked inset with coordinate Undo

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2455](https://github.com/barocss/barocss/issues/2455)

Use the existing complete draft history step for geometry edits in a linked or detached inset draft. Match the document and sketch generation and keep the latest queued draft for consecutive history input.

- **FAIL** Desktop Studio changes the two X coordinates 20→22 mm and detaches the link. The parent restores both coordinates on Undo but leaves Link detached.
- **PASS** In WebGPU Studio, Undo restores coordinates and link. Redo restores the edited geometry and detached state. Cmd+Z restores the link again. Finish retains the exact accepted document. Editing the source height from 10 to 12 mm moves the linked ring centroid from Z12 to Z14 mm. Ring volume stays 224 mm³.
- **PASS** Visual review, the unlinked numeric/Trim desktop regression, six focused tests, Studio type-check, driver syntax and diff checks.
- **NOT_RUN** Linked plane edits, Offset and other draft actions, arbitrary curved sources, full suites, production build and mobile.

#2455 remains open. Desktop QA is 18/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
