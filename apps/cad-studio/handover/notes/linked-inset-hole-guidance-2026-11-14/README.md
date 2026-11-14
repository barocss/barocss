# D1211 — Distinguish an inner hole from a curved outer boundary

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2481](https://github.com/barocss/barocss/issues/2481)

Face guidance gives priority to an inner hole over the general curved-boundary cue. The two existing outline and reference buttons provide the available next actions. The native eligibility test is unchanged.

| Result | Check |
| --- | --- |
| FAIL | Parent Studio described only curved edges on a 20 × 10 mm rectangular cap with a Ø4 through hole. Its straight outer boundary was already eligible on its own. |
| PASS | Desktop Studio stated that Linked Inset needs a face without holes. Both outline actions remained visible. Finish after outline copy retained one hole and no association. A 4 mm extrusion of the copy measured 749.7345175425619 mm³, equal to the analytical volume within 1e-7 mm³. Two Undo operations restored the copied sketch and then the stock. |
| PASS | The hole-free rounded cap stated that Linked Inset needs a straight outer boundary and still copied. The straight control created a 416 mm³ linked ring. The perforated-cap screenshot was inspected. |
| PASS | Studio type check, driver syntax, production build and frozen-source checks. |
| NOT_RUN | Actual reference-outline activation, other hole and face types, full suites, CI and mobile. |

Keep #2481 open for the remaining History edit and refusal conditions. Desktop QA is **29/71 (41%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
