# D1220 — Explain what blocks Linked Inset source replacement

2026-11-14 · FEATURE · P0 desktop QA, rows 09 and 21 · [#2481](https://github.com/barocss/barocss/issues/2481)

The shared History and native readiness check names a later feature when History continues past the linked extrusion. A terminal extrusion with a nonzero Start Z gives the fixed value needed for source replacement. The scope of replacement stays bounded to the existing native workflow.

| Result | Check |
| --- | --- |
| FAIL | Parent Studio showed the generic final straight extrusion requirement when a terminal extrusion had Start Z 1 mm. |
| PASS | Studio told the user to set Start Z to 0 mm. Applying that value restored the replacement control and left the source binding intact. The ring centre moved from Z11 to Z10 mm and the volume stayed 960 mm³. |
| PASS | A separate document with a later Move told the user to undo or remove it. Removing the Move in History restored the replacement control, original centre and ring volume. Undo and Redo reverted and repeated each recovery. |
| PASS | 20 focused Model tests, both type checks, scoped lint, browser driver syntax, production build and frozen-source checks. |
| NOT_RUN | Multiple later steps with different feature types, actual replacement after these recovered states, fresh Save/Open in this run, full suites, CI and mobile. |

Keep #2481 open. Desktop QA is **30/81 (37%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
