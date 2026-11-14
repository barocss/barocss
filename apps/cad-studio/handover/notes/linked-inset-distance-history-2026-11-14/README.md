# D1214 — Edit a straight-face Linked Inset distance in History

2026-11-14 · FEATURE · P0 desktop QA, rows 09 and 21 · [#2481](https://github.com/barocss/barocss/issues/2481)

The numeric History field writes the stored link distance and uses the normal candidate evaluation. Geometry from the cached sketch is not exposed as editable source dimensions. The field requires a positive length and does not bind parameters. A refused distance leaves the accepted model in place.

| Result | Check |
| --- | --- |
| FAIL | Parent Studio showed the accepted 2 mm distance as read-only. The first final driver held a locator from a closed context after a successful fresh Open. The driver now locates the reopened panel on the current page. |
| PASS | Studio disabled Apply at 0 mm. The refused 12 mm edit kept the document, History, bodies and selection and gave a link-specific recovery. Applying 3 mm changed only the stored inset distance. Source n1.top, target n1 and the 4 mm extrusion persisted. |
| PASS | The ring measured 1392 mm³ within 1e-7 mm³. Undo and Redo restored each binding, and fresh Open of the accepted JSON through the actual file chooser displayed 3 mm and 4 mm in their respective fields. The reopened screenshot was inspected. |
| PASS | Separate Studio runs passed source-dimension refusal and a valid source replacement with keyboard return. |
| PASS | 25 focused Model and 4 focused Studio tests, both type checks, scoped lint, driver syntax, production build and frozen-source checks. |
| NOT_RUN | The product Save button in this scenario, direct free-sketch History distance editing, linked distance with a later consumer, full suites, CI and mobile. |

Keep #2481 open. The GitHub desktop checklist has one additional open entry, #2510. Desktop QA is **29/72 (40%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
