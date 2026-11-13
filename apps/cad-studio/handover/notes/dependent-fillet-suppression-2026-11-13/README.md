# D991 — protect dependent Fillet when suppressing from rollback

2026-11-13 · SMALL · P0 rows 15 and 21 · [#2444](https://github.com/barocss/barocss/issues/2444)

- **FAIL, baseline** The 40 × 30 × 20 mm box had an R4 Fillet and an R0.5 Fillet on the R4 end arc. While rolled back before R0.5, suppressing R4 installed a failing full history. Native evaluation failed on n3, with the previous rounded body still visible.
- **PASS, fixed** Desktop WebGPU Studio refused the same action before adoption. The notice names the R0.5 step and advises updating or suppressing it first. The rollback marker, accepted geometry, document, selection, dirty flag and Undo/Redo remain exact.
- **PASS** Suppressing R0.5 first allowed R4 suppression from rollback. The result was the 24,000 mm³ stock within 1e-7 mm³. Undo restored the rolled-back accepted state and Redo restored both suppressions. The R4-only body also matched the quarter-circle stock subtraction within 1e-7 mm³.
- **PASS** Visual review, 16 Studio tests, Studio type-check, driver syntax and diff check. The first fix refused the failure, but valid suppression captured an unrelated signature from the rolled-back body. The final suppression commits without capturing signatures because it authors no references.
- **NOT_RUN** Save and project overwrite after another evaluation failure, stale face commands and exports, Drawing PDF, other Fillet types, WebGL2, production build, full suites and mobile.

The independent worker read checks the full candidate and returns only to its current document, history position and worker. Desktop issue acceptance remains 6/54. Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
