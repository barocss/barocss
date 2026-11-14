# D1219 — Explain why a rounded Linked Inset source width is refused

2026-11-14 · FEATURE · P0 desktop QA, rows 09 and 21 · [#2481](https://github.com/barocss/barocss/issues/2481)

The existing rounded-inset planner reports when the offset closes the opening. The worker preserves that reason for History edits. The visible notice names the inset distance and the two existing controls for recovery.

| Result | Check |
| --- | --- |
| FAIL | Parent Studio refused Source width 5 mm with a 2.5 mm inset. The visible hint only confirmed that the accepted part was unchanged. The reason was in Details. |
| PASS | Studio showed the closing-opening reason and offered increasing Source width or reducing Inset distance. The 5 mm refusal kept the prior document, strict native result, history controls, selection and dirty state. |
| PASS | Increasing Source width to 24 mm accepted a 1415.6637061435924 mm³ ring. Undo restored the 20 mm source and 1215.6637061435915 mm³. Redo restored the 24 mm source. Native vertices, radii, side names and analytical volumes matched within 1e-7 mm³ for volume and 1e-8 mm for opening vertices. |
| PASS | 27 focused Model tests, both type checks, scoped lint, browser driver syntax, production build and frozen-source checks. |
| NOT_RUN | The reduce-distance alternative after this width refusal, fresh Save/Open for this change, unsupported rounded recipe variants, full suites, CI and mobile. |

Keep #2481 open. The live desktop checklist now shows **30/81 (37%)** with #2510 checked. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
