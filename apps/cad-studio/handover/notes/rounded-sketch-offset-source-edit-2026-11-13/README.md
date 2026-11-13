# D907 — verify the independent offset loop after a source edit

2026-11-13 · SMALL · P1 rows 09 and 16 · [#2232](https://github.com/barocss/barocss/issues/2232) stays open.

Studio created a 1 mm inset from the same rounded rectangle with fixed source points. A later edit changed only the outer Arc 2 driver from the measured R2 to R2.25. The inner R1 loop, its side IDs and the other source side IDs stayed exact. The saved sketch has no association. This edit changes the outer arc's sweep and no longer preserves its two original tangencies.

The independent fixed-chord circle calculation uses the original 2√2 mm chord and the new radius. Its area prediction changes only the outer circular segment. The predicted center is `[17.762563132923542, 2.237436867076458]` mm. Strict native volume was 532.4916022460035 mm³ against 532.4916028124967 mm³. The absolute error was 5.665e-7 mm³. The final check uses the existing 1e-7 mm linear solver budget and a 1e-6 mm³ volume budget for the edited numerical solution. Inner-loop geometry and identity still require exact equality.

## Results

- **PASS** Desktop Studio WebGPU, strict native inspection, exact Undo/Redo, local-project Save and fresh Open. The D906 limit flow also passed at the final source.
- **PASS** Independent geometry review, 119 Model tests, 4 Studio identity tests, driver syntax and diff checks.
- **FAIL** Two observer attempts. The first required bitwise equality for numerically solved outer coordinates. The second required a 1e-8 mm center tolerance and saw an X error of 1.145e-8 mm. Both receipts are retained. No product code changed.
- **NOT_RUN** Persisted association, corner ID retirement/restoration, direct references through a topology transition, full suites and mobile.

[Commands, numeric results and receipt hashes](qualification.json).
