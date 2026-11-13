# D1142 — Refuse zero before Box, Extrude and Fillet Apply

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2461](https://github.com/barocss/barocss/issues/2461)

The HUD and history share the tested numeric rules. Box width and depth and a constant edge Fillet radius need a positive value. Ordinary Extrude distance, including the distance of a Box extrusion, accepts a finite nonzero value. The field shows its range and units. Blank and zero remain distinct from the last accepted value. Native evaluation retains its existing checks for geometry and references.

| Result | Check |
| --- | --- |
| FAIL | Parent desktop Studio refused zero in all three creation previews. Their history Apply buttons remained enabled at zero. The before run preserved the original documents. |
| PASS | In desktop Studio, Box Height Z/Distance, Extrude Distance and constant Fillet Radius kept blank and zero visible and blocked Apply and Enter in preview and history. Reset recovered the accepted value. Valid Apply, Undo and Redo passed. Box edited to 13 mm and 13,312 mm³. Extrude accepted a −12 mm preview and a −13 mm history edit, which produced 15,600 mm³ at its unchanged 40 × 30 mm section. Fillet edited to radius 2.5 mm. |
| PASS | Rectangle R from the focused ordinary Circle input, direct Circle 0 mm refusal and 18→22 mm recovery, attached Circle, Box and Fillet blank history controls from D1139/D1141, 3D Sketch Length from D1140, and Circular Count preview/history from D1141 cover the reported desktop inputs. |
| PASS | D1138 blank Extrude, D1141 Count, separate Z-pattern lifecycle, 43 focused Studio tests, both type checks, production build, scoped lint, syntax and diff checks. |
| FAIL | The separate D541 flanged-shaft replay passed zero refusal, native measurements, Undo/Redo and project Save. After Open, Studio put the top-rim Fillet on hold because it found another edge candidate. Its saved document remained exact. This is a reference ownership follow-up under [#2445](https://github.com/barocss/barocss/issues/2445). |
| NOT_RUN | Full suites, mobile, other numeric field families and D541 edits after the reference hold. |

The focused suite initially failed because its Fillet picking fixture did not supply the current scene input. The fixture now supplies that input. Initial browser setup used the wrong Box/Sketch selector, and the first D541 replay needed palette focus restored. The valid runs and the observed D541 failure are in [commands and hashes](qualification.json).

The recorded desktop scope satisfies [#2461](https://github.com/barocss/barocss/issues/2461). Desktop QA reaches **24/54** after issue reconciliation. Initial scenarios remain **8/10**. Whole CAD and core readiness remain **NOT_MEASURED**.
