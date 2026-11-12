# D803 — Cut a path-length gap in one construction line

P1, rows 09 and 15. FEATURE. The gap mode in Trim accepts a single identified straight construction segment. It projects the pointer onto the line and uses the same 8 CSS px reach, two-end preview, refusal, ownership and Select transition as the arc path.

| Result | Check |
| --- | --- |
| PASS | Existing Trim removes the complete isolated 30 mm reference. The new Cut line gap mode refuses a hidden source, a pointer outside reach, and a 4 mm gap that would cross the start. |
| PASS | With a preview visible, actual File Open replaces the document with another sketch that reuses n0. The old preview and source are absent. Reopening the original starts with the gap mode off. |
| PASS | The desktop cuts 4 mm from a 30 mm line along the 3–4–5 direction. Stored cut points (30.400001,27.800001) and (33.600001,30.200001) mm match the analytic ends within 3e-6 mm. The measured gap is 4 mm within 1e-5 mm. Each retained piece is 13 mm within 1e-5 mm. A repeated click preserves both pieces. |
| PASS | Outer endpoints and IDs e5 and e6 remain. The cut points get e7 and e8. Undo and Redo restore the exact documents. The stock extrusion is valid at 50 mm³. Project Save, Close project and fresh Open restore both open pieces and the exact 1,506-byte document. |
| PASS | The existing arc gap flow passes again on the shared implementation. Six focused Studio tests, both type checks, production build, driver syntax, source review and visual review pass. Both final desktop runs have zero page errors, console errors and downloads. |
| NOT_RUN | Full-circle gap, ordinary open-profile gap, per-edit Undo before Finish, full suites, mobile and other browsers. |

The feature checks rounded gap and retained lengths at 1e-5 mm and refuses ends that would rejoin at the existing 1e-4 mm distance. [Commands and receipt digests](qualification.json). Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**. [#2315](https://github.com/barocss/barocss/issues/2315) remains open.
