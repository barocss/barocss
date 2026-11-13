# D1147 — Draw and select native circular Band rails in desktop Top Ortho

2026-11-14 · FEATURE · P0 desktop QA, rows 08, 20 and 21 · [#2473](https://github.com/barocss/barocss/issues/2473)

A committed upright two-patch circular Band now has its own visibility and appearance key. A view packet draws and picks its named native trims with the same tessellation as the fill in ordinary Top Ortho. The view preserves the selected trim across refinement and clears it on Escape or Hide. The canonical Model edge table remains unchanged. The packet admits this bounded Band family and uses at most 192 KiB per cached mesh. Rail selection stays in the viewport.

D1146 correctly found an empty canonical edge table. Its description of Band visibility was incorrect. Studio showed all three bodies hidden when only the two source cylinders were hidden. Band inherited its first source's look key. Existing documents with that source hidden now show the Band unless the Band has its own hidden setting.

| Result | Check |
| --- | --- |
| FAIL | Before the visibility fix, Studio reported hidden bodies 0, 1 and 2 and returned no rail despite having three refinement tiers available. |
| PASS | WebGPU and WebGL2 each selected lower `n4.a\|n4.band0` and upper `n4.b\|n4.band0` with both source cylinders hidden. The upper rail increased from 32 to 64 segments at zoom. The maximum measured chord error was 0.034352 CSS px, with a 0.25 CSS px refinement target. The selected rail, native area and accepted authoring nodes were retained. |
| PASS | The equal-radius WebGPU control picked the nearer upper rail at both coincident positions. Its maximum error was 0.080587 CSS px after refinement. |
| PASS | The cylinder zoom regression and the Studio Band lifecycle passed, including R20→25, Undo/Redo, Save/Open and refusal after loss of a source rail. The native Band areas for the two controls were 2980.376479738825 and 1884.955592153881 mm². |
| PASS | 33 focused Model tests, Model and Studio type checks, production Studio build, scoped TypeScript lint, driver syntax and diff check. |
| FAIL | Full-file lint on App.tsx reported the existing unused `_k` at line 2111, verified against the parent. |
| NOT_RUN | Full suites, mobile and rail selection outside this display scope. |

Keep [#2473](https://github.com/barocss/barocss/issues/2473) open for Sketch and Direct Bézier zoom. Next is D1148, active and settled Sketch Bézier in desktop orthographic view. Desktop QA is **24/54 (44%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
