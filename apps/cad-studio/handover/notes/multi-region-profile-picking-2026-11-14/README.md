# D1129 — Pick a finished sketch from each filled region

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2459](https://github.com/barocss/barocss/issues/2459)

Finished profile hit testing now uses the same even-odd fill rule as the selection overlay. Outline proximity retains priority. A click in any filled region selects its owning sketch, and the Extrude HUD names the full region count.

| Result | Check |
| --- | --- |
| FAIL | The parent desktop Studio selected Sketch 1 from the main interior. A click in the second rectangle beyond the shared edge selected nothing. |
| PASS | The fixed desktop selected Sketch 1 from the main, shared-edge and isolated interiors. A click inside the hole and a click in the empty gap both cleared selection. |
| PASS | The HUD named all three regions and showed the combined outline, hole and isolated prism in preview. The preview preserved the document. Apply at 2 mm retained the source sketch reference. Independent strict native evaluation reported one output with two B-rep bodies and 648 mm³, equal to (100 + 120 + 120 − 16) × 2. Undo and Redo restored the exact documents. |
| FAIL | The first fixed run expected two separate outputs. The corrected oracle verifies the two bodies within one output and the independently calculated volume. |
| PASS | 22 focused Studio tests, 35 focused Model tests, both type checks, production build, scoped lint, driver syntax and diff check. |
| NOT_RUN | Region-level Extrude selection, explicit refusal for several selected sketches, Save/Open of the result, full suites and mobile. |

#2459 remains open. Desktop QA is **21/54**. Initial scenarios are **8/10**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
