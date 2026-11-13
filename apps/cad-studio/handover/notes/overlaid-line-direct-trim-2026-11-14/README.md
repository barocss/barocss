# D1135 — Trim the selected overlaid line occurrence

2026-11-14 · FEATURE · P0 desktop QA, rows 09 and 21 · [#2459](https://github.com/barocss/barocss/issues/2459)

Overlaid Lines can trim the selected source occurrence in a new sketch with no assigned side IDs. The target stays explicit when two exact line spans occupy the same position. Intersections remain inputs to the ordinary Trim operation. At a midpoint crossing, the action asks the user to click the intended interval with Trim. Reopened or tagged sketches retain the existing edge identity instead of applying direct Trim.

| Result | Check |
| --- | --- |
| PASS | Actual 1024 × 800 Studio selected Shape 2, segment 4 with the keyboard. Trim highlighted edge opened only the second outline and retained the first. Finish refused the open endpoints. Draft Undo and Redo restored the exact visible geometry. |
| PASS | Ordinary Trim removed the first remaining occurrence. Finish and 2 mm Extrude made a strict native 400 mm³ body. The earlier canvas Trim and Select highlighted edge paths also passed on this source. |
| PASS | Reopened tagged outlines refused direct Trim with a reason. The document and outline geometry stayed exact. A focused test refused a midpoint crossing and checked distinct side IDs in the untagged control. |
| PASS | Sol High reviewed occurrence and crossing ownership. Studio 21/21 and Model 5/5 focused tests, both type checks, build, scoped lint, driver syntax and diff passed. |
| FAIL | The first focused oracle expected particular fresh side IDs for an untagged outline. The corrected test checks exact geometry and ID uniqueness. |
| NOT_RUN | Direct Trim on stored or currently tagged occurrences, arbitrary partial-overlap diagnostics, full suites and mobile. |

D1129–D1135 meet the declared #2459 desktop flow for the authored rectangles. Desktop QA becomes **22/54** on closeout. Initial scenarios are **8/10**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
