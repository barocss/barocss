# D985 — keep Drawing Note and dimension identities distinct

2026-11-13 · SMALL · P0 rows 07 and 21 · [#2443](https://github.com/barocss/barocss/issues/2443)

- **FAIL on parent** A Note and a 20 mm width dimension shared the ID `width`. Selecting the dimension marked both SVG groups. Delete removed the Note and left the dimension.
- **Change** Carry the selected annotation kind with its ID from the row or the painted mark through edit, highlighting and deletion. Keep the existing SVG data attributes and the legacy selection argument. Refuse an ambiguous same-kind removal on the active sheet.
- **PASS** Desktop WebGPU Studio selected only the dimension with Enter and removed it with Delete, leaving both Notes. After Undo, a real pointer click on the Note selected only the Note and opened its text editor. Delete kept width, datum target B1, the standalone frame and the second sheet's Note. Undo/Redo restored exact document states.
- **PASS** Visual review, 19 focused Studio checks, 10 Model drawing checks, both type-checks, driver syntax and diff check. The first Studio type-check found a nullable preview ID. The final run handles it and repeats the desktop proof. No page errors, console errors or downloads.
- **NOT_RUN** Overlapping Note/frame click order, Note Duplicate/Remove leader, edit Escape, WebGL2, production build, full suites and mobile. #2443 remains open.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
