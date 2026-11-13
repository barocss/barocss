# D1031 — choose the occurrence for coincident Drawing diameter rims

2026-11-13 · FEATURE · P0 rows 10, 12 and 20 · [#2449](https://github.com/barocss/barocss/issues/2449)

Standard assembly views offer an occurrence choice when drawable rims share the picked circular projection. A single eligible rim proceeds directly and shows the selected occurrence before placement. The choice belongs to the current sheet settings and projection.

- **FAIL** On the baseline, opposite clicks on the coincident Ø8 rims placed dimensions on `p2` and `p1` without a choice.
- **PASS** Desktop Studio offers Plate 1 and Plate 2 at both picks. Selecting either stores that occurrence's exact edge. Hidden lines off retains both visible choices. Escape leaves the document unchanged. A settings change retires the open chooser. Raising Plate 2 by 5 mm leaves only its drawn rim eligible and excludes zero-piece records for Plate 1.
- **PASS** Independent native projection review, visual inspection, 85 Model tests, 17 Studio tests, Studio type-check, driver syntax and diff check.
- **NOT_RUN** Existing-dimension reattachment, loss warnings before export, DIMENSIONS deletion after Redo, ambiguous nested or same-occurrence rims, other tools and views in desktop Studio, full suites, production build and mobile.

#2449 remains open. Desktop QA is 10/54, initial scenarios are 8/10, and whole CAD and core readiness **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
