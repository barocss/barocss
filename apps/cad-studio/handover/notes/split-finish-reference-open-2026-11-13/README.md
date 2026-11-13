# D995 — hold direct Split edge finishes until explicit confirmation

2026-11-13 · SMALL · P0 rows 05, 15, 16 and 21 · [#2445](https://github.com/barocss/barocss/issues/2445)

- **FAIL, baseline** Both Fillet and Chamfer on a signed generated Split edge rebuilt on a different edge immediately after native File Open. The accepted original edge at X24 was gone after the plane reversed at X30. The reference panel marked the substitution after geometry had changed.
- **PASS, fixed** Actual desktop WebGPU Studio holds each finish and keeps the original edge and signature. Both unmodified solids are 9,000 mm³. The reference panel offers the new edge as an explicit candidate. Only Use candidate 1 changes the shape and stores the new X30 signature.
- **PASS** A fresh context reopened the exact confirmed document bytes for each finish without a new reference choice. Fillet and Chamfer match 9,000 − 10(1 − π/4) and 8,995 mm³ within 1e-7 mm³.
- **PASS** Visual review, 41 model reference tests, 13 Studio document-file tests, both type checks, driver syntax and diff check. The first fix exposed a lost signature write during held feature release. The final code writes the signature before copying the released feature.
- **NOT_RUN** Native Save, Undo restoring the choice panel, live Split and linked inset edits, History repick, Draft/Flange/Hole, WebGL2, production build, full suites and mobile.

The check follows D399/D400's existing held-reference flow. It is limited to signed Fillet or Chamfer edges of a direct generated Split cap. Desktop issue acceptance remains 7/54. Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
