# D1206 — Recover from an oversized Linked Inset distance

2026-11-14 · FEATURE · P0 desktop QA, rows 09 and 21 · [#2481](https://github.com/barocss/barocss/issues/2481)

The existing native resolver attaches the field and reason to an offset refusal. Studio puts the reason and first recovery step next to Offset distance. It marks the field invalid and returns keyboard focus to it. Editing the value clears the message. Source and selection refusals keep their existing handling.

| Result | Check |
| --- | --- |
| FAIL | With a 6 mm inset on a 20 × 10 mm cap, parent Studio showed the outline failure in a global toast. It did not mark Offset distance or put recovery guidance next to the input. |
| PASS | Desktop Studio refused 6 mm with no document, History, body or selection changes. The value remained 6 mm. The inline alert was linked to the focused input and no duplicate toast appeared. |
| PASS | Changing the distance to 2 mm cleared the alert. Retrying recorded n3.top, and a new 4 mm extrusion measured 416 mm³ within 1e-7 mm³. |
| PASS | 22 focused Model tests, both type checks, scoped lint, driver syntax, production build and frozen-source checks. |
| NOT_RUN | Other distance and profile failure classes, retained-source History edits, full suites, CI and mobile. |

Keep #2481 open for the current source and its editable scope in History. Desktop QA is **29/71 (41%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
