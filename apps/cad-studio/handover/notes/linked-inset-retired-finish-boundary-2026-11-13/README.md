# D999 — qualify the linked inset boundary for a retired finish edge

2026-11-13 · SMALL · P0 rows 09, 15, 16 and 21 · [#2445](https://github.com/barocss/barocss/issues/2445)

- **PASS** Actual desktop WebGPU Studio opened the supported stored linked inset. Editing the inset from 1 to 2.5 mm retired the four inner arc names and retained the four straight names. Native and displayed volumes match the independent rounded-area oracle within 1e-7 mm³.
- **PASS** File Open refused both a stored Fillet and a stored Chamfer that addressed the retired inner arc. Studio named the exact edge and retained the existing document, title, solid, dirty state, selection and history. No replacement was proposed or applied.
- **PASS** Visual review, driver syntax and diff check. Product source required no change.
- **NOT_RUN** Live edits with an already accepted downstream feature, Draft/Flange/Hole, type-check, production build, full suites and mobile. The stored rounded-inset v1 boundary permits the source, linked profile and one direct Extrude. A dependent finish cannot be part of an accepted v1 file.

Desktop issue acceptance remains 7/54. Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
