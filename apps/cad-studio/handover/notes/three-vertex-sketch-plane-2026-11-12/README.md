# D792 — Start a Sketch on three selected native vertices

P1, rows 09 and 15. FEATURE qualification of one ordered plane on a native rectangular prism. Studio uses the existing Sketch action and the existing document plane. The first selected point is the origin. The second sets positive X. The third sets the positive Y half-plane. The finished sketch is an independent snapshot.

| Result | Check |
| --- | --- |
| FAIL | The baseline desktop run selected the exact three corners. Sketch opened on XY. The first expanded driver later failed while reading the saved OPFS file because it called `arrayBuffer` on the wrong value. |
| PASS | Each admitted point comes from the original vertex ID and point of an eligible native prism edge. The edge or face must pass the renderer's visibility test. The selection keeps its document and mesh identity, and points must be distinct and on the same current body. A grouped edge, ambiguous screen point or transformed preview pick cannot supply native authority. |
| PASS | The same ordered Top and Front picks produce the same stored frame in actual perspective and orthographic Studio. A single point and a hidden endpoint combined with two visible points are refused. The hidden endpoint control uses perspective. Both refusals preserve the exact document. |
| PASS | The exact first point, X axis and normal match independent vectors. Studio authors an 8 × 6 mm rectangle and extrudes it by 2 mm as an independent solid. Strict native B-rep, all eight world corners and the 96 mm³ volume match independent arithmetic within 1e-8. Undo and Redo restore the exact documents. |
| PASS | Both projections save identical 1,430-byte project documents. Cold project Open keeps the frame and body. Changing original Box width from 60 to 65 mm leaves the stored Sketch and its Extrude unchanged. Visual review covers the hidden-point refusal, the tilted grid and the independent solid. |
| PASS | Model 38/38, Studio 5/5, both type checks, driver syntax and diff check. Independent Sol High review found an occlusion gap in the first implementation and verified the revised source for the single box. Final desktop runs have zero errors and downloads. |
| NOT_RUN | Full suites, mobile, other browsers, broad native source families and route/proposal preview transitions. General selected-vertex support and the full issue acceptance remain open. |

[Commands and receipt digests](qualification.json). Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [#2292](https://github.com/barocss/barocss/issues/2292).
