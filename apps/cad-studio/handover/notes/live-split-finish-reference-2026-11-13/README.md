# D997 — qualify live Split edits with signed edge finishes

2026-11-13 · SMALL · P0 rows 05, 15, 16 and 21 · [#2445](https://github.com/barocss/barocss/issues/2445)

- **PASS** Actual desktop WebGPU Studio moved the +X Split from X24 to X30 for both a signed R1 Fillet and a signed 1 mm Chamfer. Both retained the original generated edge name. Undo and Redo restored the exact documents.
- **PASS** Reversing the normal from +X to −X with the signed distance changed to −30 removed the original edge. Each Apply refused. The editor named the dependent feature and the missing edge. The accepted geometry, selection, document and history stayed exact.
- **PASS** Independent rectangular stock and round or triangular subtraction agreed within 1e-7 mm³. Visual review, driver syntax and diff check passed. Product source required no change.
- **NOT_RUN** A live linked inset edit, History direct repick, Draft/Flange/Hole, Save on this live-edit driver, WebGL2, type-check, production build, full suites and mobile. D995/D996 cover native Open and the separately confirmed project Save profiles.

Desktop issue acceptance remains 7/54. Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
