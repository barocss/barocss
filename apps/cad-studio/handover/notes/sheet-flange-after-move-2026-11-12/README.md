# D813 — Flange a translated sheet on its persistent edge

P1, rows 07, 08 and 16. SMALL verification of the existing Flange consumer on D812's translated D546 bracket. The viewport pick is at the midpoint (47, 12, 11) mm from the Bottom right view in Edges mode. The selected native edge n0.end|n0.leg1.a is unique. The new flange is full-width, 20 mm to the outer sharp, 90°, material inside, with the sheet radius and zero end offsets.

| Result | Check |
| --- | --- |
| PASS | The real mouse pick, Flange HUD and accepted node n8 all use the named edge on the moved output n7. No new command implementation is needed. |
| PASS | Native and current Worker folded volume agree with the independent 3756.8113728476 mm³ calculation within 1e-9 relative. Native validation, centroid and bounds pass. The new bend-axis origin is (44, 27, 9.5) mm with direction (0, 1, 0). |
| PASS | The existing Flat dialog displays both bends and both holes. Native flat measures 30 × 84.7858401318 mm, area 2496.0586150671 mm², with two radius-2.75 mm holes at independent stations 10 and 52.3929200659 mm and the original DOWN and new UP bends. |
| PASS | First Undo and Redo restore the exact moved and flanged documents. Actual Save, Close and fresh project Open restore the exact 2,784-byte flanged document and native folded/flat quantities. |
| PASS | Editing only the reopened source sheet from 1.5 to 2 mm retains the Move and named Flange references. The valid result measures 4936.2057202674 mm³ and unfolds to 30 × 83.4769905155 mm with area 2456.7931265808 mm². Both holes keep their radius and match the new independent flat stations. |
| PASS | Actual desktop WebGPU, source freeze, syntax, diff check, independent Sol High oracle and root visual review. The same run repeats D812's Move, Flat, history and project consumer. Zero page errors, console errors and downloads. D812's focused package evidence applies to the unchanged product sources. |
| NOT_RUN | New invalid-flange refusal case, DXF export from this flange, Rotate, Mirror, pattern copies, full suites, mobile and other browsers. |

[Commands and receipt digest](qualification.json). [#2230](https://github.com/barocss/barocss/issues/2230) remains open for the wider rigid transform and copy scope. Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**.
