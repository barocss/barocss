# D1104 — focus both dimensions in a proven edge-to-circle conflict

2026-11-14 · FEATURE · P0 desktop QA, rows 09 and 21 · [#2456](https://github.com/barocss/barocss/issues/2456)

After a refused viewport edit, use the stored same-axis distance to the opposite edge and one perpendicular driving length. For unsigned distances the span must match either their sum or their absolute difference. Both branches must miss the span by more than 1.6e-6 mm. This margin covers two helper distances, one side projection, one endpoint tie, and floating-point roundoff. The current outline and document own both row targets.

- **FAIL** The parent refuses 19 mm without a way to locate either the locked 40 mm span or the opposite 22 mm distance. The refusal leaves the draft and document intact.
- **PASS** Desktop WebGPU at 1280 × 800 identifies both driving dimensions. Each keyboard action selects its row and highlights the correct geometry. Removing the 22 mm row lets the same 19 mm input apply, moves the centre to Y21 mm and keeps the 60 × 40 mm outline, named sides, and 5 mm Extrude. Document Undo/Redo and fresh native Open pass.
- **PASS** Native output is valid. Volume is 11607.30091830126 mm³ and agrees with the independent plate-minus-hole calculation within 1e-7 mm³. Both preceding conflict-focus Studio flows, 35 focused tests, Studio type check, scoped lint, driver syntax, diff, visual review and independent numerical audit pass.
- **NOT_RUN** Non-opposite or curved edge attribution, multi-rule proofs beyond the measured subset, vertical-axis Studio replay, full suites and production build.

#2456 remains open. Desktop QA is 19/54. Initial scenarios are 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
