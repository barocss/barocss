# D894 — measure the native area of a cylindrical wall

2026-11-13 · FEATURE · P1 row 16.

D893 reproduced two selected cylindrical faces where Measure showed 62.73 and 250.92 mm² from display triangles. At R16, the quarter-cylinder oracle gives 62.831853 and 251.327412 mm².

Use the analytic area of one native cylindrical wall when its rational surface and complete rectangular trim prove the wall. Require an axial translation of the two rim rows with equal rational weights, a complete unit UV boundary, and matching native rim and strut curves. Compute the circular sweep from the native spans and multiply by radius and depth. Keep the separate display-triangle area used for mesh metrics and reference signatures. Measure labels curved-face fallback with `(mesh)`. The new native value describes the full source face. Current Studio Measure selects original bodies and blocks root picks in Section.

Desktop Studio WebGPU passed real picks on the two Round faces for source R20, R16, R16 after fresh Open, and R18 after another edit. The analytic areas agreed within 1e-8 mm² before display rounding. The R16 values now display 62.83 and 251.33 mm². The merged stock R5 cylinder still displays its triangle area, 313.65 mm² (mesh), and retains radius 5 mm. Focused tests matched both Round areas at display qualities 4 and 16 and refused altered or incomplete trims. Model 28/28, Studio 7/7, both type checks, Studio build, scoped lint, syntax and diff checks passed. Commands and hashes are in [qualification.json](qualification.json).

NOT_RUN includes direct noncardinal recognition in Studio, general trimmed faces, native aggregation of merged faces, native planar area, clipped-mesh measurement, full suites and mobile. Next, compare the selected Extrude driver edit with the existing Offset face command on a supported cap. Reuse D342 and measure the gap in graph, geometry and persistence.
