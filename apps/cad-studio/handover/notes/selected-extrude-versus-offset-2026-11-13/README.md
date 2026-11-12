# D895 — compare an Extrude driver edit with Offset face

2026-11-13 · SMALL · P1 rows 08 and 16 · [#2285](https://github.com/barocss/barocss/issues/2285) remains open.

Reused [D342](../offset-face-native-2026-10-30/README.md) for the supported native-cap and refusal boundaries. Desktop Studio WebGPU opened a 20 × 10 × 5 mm prism and physically selected its native top cap `n1.top` in two independent document paths. The first path dragged the selected Extrude height handle to open its editor, then entered an absolute distance of 7 mm. The second invoked Offset face and entered a relative offset of +2 mm. Preview in each path kept the accepted document unchanged.

| Operation | Driver and graph | Native top at Z7 | Output |
| --- | --- | --- | --- |
| Edit Extrude | Change `n1.height` from 5 to 7. Keep two nodes. | `n1.top` | `b1` |
| Offset face | Keep the source prefix. Append a cap sketch at Z5, a +2 mm extrusion, and Union. | `n3.top` | `b4` |

Both accepted results have six external box support planes, a single strict closed solid, bounds [0,0,0]–[20,10,7] mm, centroid [10,5,3.5] mm, and volume 1400 mm³. Native length and volume tolerances were 1e-7 mm and 1e-7 mm³. The original four side names and the bottom name survived both paths. The Offset branch refused the exact −5 mm collapse with Apply disabled. Cancel kept the accepted seed. The first Undo and Redo returned the exact documents in both paths. Both independently saved OPFS files opened in fresh contexts.

After reopening Offset face, changing original `n1.height` to 6 mm retained the append-only cap sketch and its original Z5 plane, +2 mm extrusion, and top at Z7. The selected Offset recipe uses a saved footprint and plane. The final height does not follow the source height by a constant +2 mm. The graph still references the original solid in the Union.

Studio and native checks passed, with no page errors, console errors or downloads. Focused Model 35/35, driver syntax and diff checks passed. Commands and hashes are in [qualification.json](qualification.json). Downstream cap-reference custody and rematch, concurrent source change during a preview, equal-value handle/field candidate comparison, general direct-edit operations, full suites and mobile were NOT_RUN. Next, verify one downstream named cap reference across an edit to this supported source and across fresh Open.
