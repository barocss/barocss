# D1205 — Offer Linked Inset on eligible planar outlines

2026-11-14 · FEATURE · P0 desktop QA, rows 09 and 21 · [#2481](https://github.com/barocss/barocss/issues/2481)

The Sketch panel uses the same native outer-loop and edge checks as Linked Inset evaluation. The mesh reports eligibility for an original planar face of one solid without running another kernel evaluation. The native resolver still checks the selected source and inset value before constructing a profile. A rounded outline can still be copied as an independent sketch.

| Result | Check |
| --- | --- |
| FAIL | Parent Studio offered Link face outline + inset on a planar 20 × 10 mm cap with four R2 corners. The link then refused its native curved edges. |
| PASS | The rounded face shows a recovery instruction next to Use its outline. Copy and Finish saved the outline on the same face without a live link. Undo restored the original document. |
| PASS | The straight face kept the link control. A 2 mm inset on a straight 20 × 10 mm face recorded n3.top and produced a separate 4 mm extrusion of 416 mm³ within 1e-7 mm³. The D1204 focus and relink case still passed. |
| PASS | 31 focused Model tests, both type checks, scoped lint for the panel and Model files, browser driver syntax, production build and frozen-source checks. |
| NOT_RUN | Fresh Studio recovery for oversize distance, a transformed or perforated cap, an independent export read, full suites, CI and mobile. |

Keep #2481 open for remaining source and refusal guidance. The live #2492 checklist contained 71 unique entries and 29 checks, or **41%**, including 17 added open entries beyond the previous 54. Initial scenarios remain **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
