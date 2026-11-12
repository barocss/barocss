# D841 — Author an Extrude to face in Studio

P1, rows 07, 08 and 16. FEATURE for desktop authoring of the D840 recipe. Start Extrude from a finished literal XY rectangle in a document with a current base solid. Select **Depth > To face**, then pick the original lower face. Studio uses the current body key, body reference and unique face name to map drawn picks back to the accepted context. The native evaluator checks the trim and positive Z distance. The operation makes a separate body with zero draft. Distance stays the default. Returning to To face requires a fresh pick. The public local-agent and verb command contexts retain their existing fields.

| Result | Check |
| --- | --- |
| PASS | Desktop WebGPU opens the source, selects its finished rectangle from History and enters To face. Apply stays disabled while the end is missing. Enter does not arm an Apply. Studio refuses the top cap and accepts the original bottom cap. |
| PASS | Switching back to Distance restores 8 mm. Returning to To face clears the old pick. Studio refuses the generated preview face and keeps the accepted draft target. A second original cap pick and one Apply create the bound extrusion. First Undo restores the exact three-node source. First Redo restores the recipe and two bodies. |
| PASS | The native output contains eight exact corners per body. The target and extrusion caps are both at Z20, Z30 and Z40 after the corresponding edits. The extrusion volumes are 2000, 3000 and 4000 mm³. Width 8 is refused with the accepted document, bodies, selection, dirty state and history intact. |
| PASS | The 958-byte browser project reopens after a reload. A subsequent target edit still drives the extrusion. Root visual review shows the selected original cap highlighted in the preview. |
| PASS | Model 129/129 and Studio 76/76, both type checks, scoped lint, driver syntax, production build and diff check pass. |
| FAIL | Full App.tsx lint reports the same pre-existing unused `_k` as the clean parent. |
| FAIL | The first Model test assumed the history prefix reset its next ID. The first type check used the sketch union without the Model node flags. The first two desktop drivers timed out on the free-sketch selector and on a perspective projection assumption. The corrected Model, type and desktop checks pass. |
| NOT_RUN | Saved mode conversion, held-worker and replacement Open cases, other source planes and profiles, independent STEP, full suites, mobile and other browsers. |

[Issue #2308](https://github.com/barocss/barocss/issues/2308) remains open. D842 specifies a saved To face feature's detach to Distance and verifies that the conversion retains the current native height. Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and receipt digests](qualification.json).
