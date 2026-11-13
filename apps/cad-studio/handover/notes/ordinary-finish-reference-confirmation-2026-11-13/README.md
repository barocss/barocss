# D1004 — hold an ordinary finish edge until confirmation

2026-11-13 · FEATURE · P0 rows 05, 15, 16 and 21 · [#2445](https://github.com/barocss/barocss/issues/2445)

- **FAIL, baseline** Actual desktop WebGPU Studio File Open replaced the original R2 Fillet edge with its unique match and removed material before confirmation. The stored signature pointed to the old corner at [10, 10, 3] mm.
- **PASS, fixed** File Open held the individual, signed single-edge Fillet and Chamfer at 630 mm³. References showed the original and the unique candidate. Explicit selection stored the new signature at [10, 9.5, 3] mm. The confirmed volumes matched 630 − 6(4 − π) and 618 mm³. Undo restored the exact held document and choices. Redo and project Save/Open retained each confirmed result.
- **FAIL, intermediate** Confirming a unique Fillet candidate with a 0.5 mm incident wall released the hold even though R2 could not build.
- **PASS, fixed** Studio evaluates the full candidate before accepting a held Fillet or Chamfer choice. The rejected R2 retained the 630 mm³ stock, held document, reference choices, selection and Undo/Redo.
- **PASS** Visual review, 66 focused Model tests, 16 focused Studio tests, Model and Studio type-check, driver syntax and diff check. GPT-6.1 Sol High reviewed the geometry and matching scope.
- **NOT_RUN** Opening a damaged or previously auto-marked finish directly from project storage, shared signatures, general varying or multi-edge recovery, the full legacy browser flow, production build, full suites and mobile.

The added hold covers a single Chamfer edge or a circular constant-radius Fillet edge with an individual signature. The direct Split rule and same-live-edge aliases retain their existing behavior. Desktop issue acceptance remains 7/54. Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
