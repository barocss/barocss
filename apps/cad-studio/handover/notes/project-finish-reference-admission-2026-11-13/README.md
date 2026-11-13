# D1005 — admit a project finish reference before changing the active file

2026-11-13 · FEATURE · P0 rows 05, 15, 16 and 21 · [#2445](https://github.com/barocss/barocss/issues/2445)

- **FAIL, baseline** Opening a project file with a displaced signed Fillet changed the active project document to a failed model. The References decision did not appear.
- **PASS, fixed** Actual desktop WebGPU Studio opened a validated held model and offered the original and candidate references. The 630 mm³ stock had no Fillet before confirmation. Selecting the candidate stored [10, 9.5, 3] mm and produced 624.849556 mm³. Undo restored the hold and candidate. Redo, project Save and reload followed by Project Open retained the confirmed result.
- **PASS** A second project fixture could not rebuild when its dependent Chamfer lost the Fillet-generated edge. Project Open refused it before adoption. The document, active file, geometry, title, dirty state, selection and Undo/Redo remained unchanged.
- **PASS** Visual review, 51 focused Studio tests, Model and Studio type-check, driver syntax and diff check. Focused tests verify the full repair and retirement after a superseding Open.
- **FAIL, earlier harness** The first fixed run read the accepted geometry before deferred mass completed. The final run waited for both geometry and mass.
- **NOT_RUN** Direct File Open of the same unusable repair, previously auto-marked finishes, general shared and multi-edge recovery, production build, full suites and mobile.

The project preadmission check is for signed Fillet and Chamfer reference problems. It keeps the original on-disk identity for save conflict checks and uses the repaired document as the working input only after a full rebuild. Desktop issue acceptance remains 7/54. Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
