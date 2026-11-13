# D1006 — admit a File Open finish repair before replacing the current document

2026-11-13 · SMALL · P0 rows 05, 15, 16 and 21 · [#2445](https://github.com/barocss/barocss/issues/2445)

- **FAIL, baseline** File Open adopted a signed Fillet document that could not rebuild its dependent Chamfer after holding the Fillet. Studio replaced the current file and reported a kernel error.
- **PASS, fixed** File Open and Project Open share the signed-finish preadmission check. Actual desktop WebGPU Studio admitted the usable held Fillet at 630 mm³ and exposed its candidate. Selecting the candidate built 624.849556 mm³. The unusable File Open retained the exact current document, geometry, selection, title, dirty state, active project association and Undo/Redo.
- **PASS** Undo restored the held choice. Redo restored the accepted result. Project Save under a new name and Project Open after reload preserved the accepted document and signature.
- **PASS** Visual review, 51 focused Studio tests, Model and Studio type-check, driver syntax and diff check.
- **FAIL, earlier harness** The first corrected run tried to save a detached file over an existing project file and hit the save conflict guard. The next run used a textbox accessible name that did not resolve while dirty. The final run used a distinct name and the actual title input.
- **NOT_RUN** Previously saved auto-matched finishes, broader shared and multi-edge replacement, production build, full suites and mobile.

Desktop issue acceptance remains 7/54. Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
