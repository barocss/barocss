# D838 — Verify fixed-span preview ownership and creation bounds

P1, rows 08 and 16. SMALL verification for [#2386](https://github.com/barocss/barocss/issues/2386). The desktop test delays two successful real Worker replies and delivers their original payloads. It also exercises the existing native provider refusal for a cylindrical wrap.

| Result | Check |
| --- | --- |
| PASS | While a valid Z-span preview is held, Enter queues Apply. Switching to Spacing and entering zero supersedes that request. The current native zero-spacing refusal clears the preview and retains the accepted document, bodies, selection, dirty state and history after the old success arrives. |
| PASS | A second held success and queued Enter are retired by Open of a document that reuses the same feature IDs. Its 9 mm extrusion, selection, bodies and history stay exact after the reply arrives. First Undo returns the 8 mm source. |
| PASS | Actual Z Count 2 at 20 mm span gives one output with two closed native solids, 16 corners, 960 mm³ and centroid (35, 13, 14) mm. Actual Y Count 24 at 184 mm span and 8 mm spacing gives 24 closed native solids, 192 corners, 11520 mm³ and centroid (35, 105, 4) mm. Both exactly match their spacing-mode B-reps. |
| PASS | An accepted cylindrical wrap refuses the new fixed-span command at the native provider. Apply and Enter leave the exact source intact. Cancel then first Undo returns the Y row. Redo restores the exact wrap. |
| PASS | Model 7/7, Studio 36/36, Model types, browser syntax, diff check and root visual review pass. |
| NOT_RUN | A continuous new-command-to-project lifecycle, full suites, build, mobile and other browsers. |

D839 verifies the continuous lifecycle from actual creation through a post-Open Count edit before issue closure. Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and receipt digest](qualification.json).
