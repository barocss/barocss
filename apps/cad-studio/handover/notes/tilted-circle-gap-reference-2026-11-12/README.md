# D824 — Keep the neighboring sketch dimension after a tilted circle gap

P1, rows 09 and 16. SMALL verification of existing behavior. The saved sketch plane is tilted +30° from XY and translated +7 mm along its normal. The fixture has one identified radius-10 mm construction circle and one 8 × 6 mm rectangle with a driving 8 mm edge length and side IDs e1–e4.

| Result | Check |
| --- | --- |
| FAIL | The first browser driver used the index attribute of a solid history item to locate a free sketch. The free sketch is an accessible profile button. The second run uses that route before extrusion and Edit sketch from the consumer after extrusion. |
| PASS | Actual Studio previews a 4 mm circle gap. Both projected cut marks agree with independent coordinates within 1 desktop CSS pixel. Finish retains one open construction arc, retires e5, and assigns e7 and e6. Its measured world chord is 3.9733870000 mm, removed path length 4.0000003919 mm and retained length 58.8318587574 mm. Length tolerance is 1e-5 mm. |
| PASS | The rectangle outline, driving length, side IDs and plane stay exact. First Undo restores the circle, and first Redo restores the gap. |
| PASS | Actual Extrude 2 produces a valid native solid of 96 mm³. The eight corners, centroid and all four corners of the original n1.side[e1] wall agree with the independent tilted-frame calculation within 1e-8 mm. Worker volume and centroid agree. |
| PASS | Actual project Save, Close and fresh Open restore the exact 1,828-byte document and native wall. Edit sketch shows the original locked 8 mm field. |
| PASS | 58 focused Model and 20 focused Studio tests, driver syntax, diff check, root visual review and Sol High source review. Final desktop has zero page errors, console errors and downloads. |
| NOT_RUN | Target-linked constraints, ambiguous neighbor selection, per-edit Undo before Finish, other geometries on the tilted plane, full suites, mobile and other browsers. |

[Commands and receipt digests](qualification.json). [#2315](https://github.com/barocss/barocss/issues/2315) remains open for its other reference and editing cases. Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**.
