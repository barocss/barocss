# D802 — Cut a path-length gap in one construction arc

P1, rows 09 and 15. FEATURE. In Trim, select Cut arc gap and give a length in mm. Select an interior point of the eligible arc within 8 CSS px. The preview marks the removed path and both new ends. A successful cut returns to Select and leaves two construction arcs. Finish retains the existing closed profile and both open references.

| Result | Check |
| --- | --- |
| PASS | The existing Trim removes an isolated semicircle. Split keeps one continuous chain of 31.4159265378 mm and removes no length. Both paths pass again on the final source. |
| FAIL | The first baseline driver expected an exact midpoint from a fractional pointer event. The recorded Split point differs by 1e-6 mm. The corrected baseline checks the point within 2e-6 mm. A test-only module alias also failed the first Studio type check and was corrected. |
| PASS | The live feature refuses 0 mm, a gap longer than the arc, and a pointer outside the reach. Editing the length clears a stationary preview. Escape clears the pending gap and preserves the accepted document. |
| FAIL | On the first candidate, a repeat click after a 1 mm gap ran ordinary Trim and removed one of the retained pieces. The final implementation switches to Select in the same state change and keeps both pieces even though the nearest cut point is 2.7913 CSS px away. |
| PASS | The actual desktop requests 4 mm on a radius-10 mm semicircle. Both preview ends project to the independent endpoints. Independent chord readback gives a removed arc length of 4.0000003919 mm and a chord of 3.973387 mm. The retained arcs preserve e5 and e6 and get new cut IDs e7 and e8. |
| PASS | Undo and Redo restore the exact documents after Finish. The unchanged 2 mm stock extrusion is valid and gives 50 mm³. Project Save, Close project and fresh Open restore the exact 1,526-byte document and both open references. |
| FAIL | One final ordinary Trim/Split run reached the accepted geometry but logged Chromium's ERR_NETWORK_CHANGED. The exact same source passed on retry. |
| PASS | Sol High source review, four focused Studio tests, both type checks, production build, driver syntax and visual review. Final desktop runs have zero page errors, console errors and downloads. |
| NOT_RUN | Straight and full-circle gaps, ordinary open-profile edits, per-edit Undo before Finish, full suites, mobile and other browsers. |

The first profile accepts one identified open two-point construction arc with independent geometry. The stored ends use 1e-6 mm and bulges use 1e-9, as in existing Trim. A cut that would rejoin at the existing 1e-4 mm distance is refused. Reconstructed centres, radii and retained lengths must agree within 1e-5 mm. [Commands and receipt digests](qualification.json). Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [#2315](https://github.com/barocss/barocss/issues/2315) remains open.
