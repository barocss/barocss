# D1237 — Check the authored rounded inset width before translation

2026-11-14 · FEATURE · P0 desktop QA, rows 09 and 21 · [#2481](https://github.com/barocss/barocss/issues/2481)

The width editor first checks the authored width minus twice the radius. It still checks the represented straight segments before constructing the candidate. Existing v1 files continue to validate their stored coordinates, so a previously accepted boundary solid can reopen unchanged.

| Result | Check |
| --- | --- |
| FAIL | Parent Studio refused new 3.01 mm at X0 and X25 but accepted it at X100 because the represented span rounded above 0.01 mm. |
| PASS | In Chrome WebGPU at 1024 × 800, new 3.0099 and 3.01 mm widths were refused at X0, X25 and X100. The R1.5 notice, drafts and accepted geometry were retained. Width 3.010001 mm applied at all three positions. Undo and Redo passed. |
| PASS | Studio Save to the browser project and fresh Open retained the tightened edit and the materialized legacy X100 document with nominal width 3.01 mm. Strict closed B-rep and all eight cylinder radii passed. |
| PASS | Independent volumes were 142.12231115025708 mm³ for 3.010001 mm and 142.1222971502571 mm³ for the legacy document. Native and Studio matched within 1e-7 mm³. The oracle was `7 × (10w − (4−π) × 1.5² − 8(w−2) + (4−π) × 0.5²)`. |
| PASS | Independent Sol High source and numerical review, R2 Studio control, 12 focused Model tests, Model and Studio type checks, scoped lint, driver syntax, build and frozen-source checks. The parent reproduction fails if the authored-width guard is absent. |
| NOT_RUN | Every floating-point origin near the strict boundary, other radii in translated Studio files, full suites, CI and assistive technology. |

Inputs just above the nominal limit must still be representable at the stored coordinates. Desktop QA is **34/93 (37%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
