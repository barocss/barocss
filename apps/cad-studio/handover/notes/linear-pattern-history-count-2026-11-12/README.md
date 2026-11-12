# D832 — Preserve the typed linear pattern count for native validation

P1, rows 08 and 16. SMALL. The One body history editor passes Count to the existing native integer validation. The change removes one rounding step from the shared edit field.

| Result | Check |
| --- | --- |
| FAIL | Parent Studio saved Count 3 when the history editor applied 2.5. The one output changed from four disconnected native solids and 768 mm³ to three solids and 576 mm³. |
| PASS | Current desktop Studio retains the typed 2.5, 0 and 65 and refuses each value. The exact accepted document, body, selection, dirty state and history remain intact. |
| PASS | First Undo restores Count 3 and 576 mm³. First Redo restores Count 4 and 768 mm³. Count 5 then produces one output with five native solids, 40 exact corners, 960 mm³ and centroid (84, 13, 4) mm. The same source features and named 16 mm pitch remain bound. |
| PASS | D831 Separate bodies passes again in desktop Studio. Model 48/48, Model and Studio types, scoped lint, driver syntax, diff check and root visual review pass. |
| NOT_RUN | Full suites, production build, project Save/fresh Open, other axes, mobile and other browsers. |

Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**. Next D833 takes [#2386](https://github.com/barocss/barocss/issues/2386), beginning with the existing spacing semantics and old-reader refusal boundary for a distinct total-span representation. [Commands and receipt digests](qualification.json).
