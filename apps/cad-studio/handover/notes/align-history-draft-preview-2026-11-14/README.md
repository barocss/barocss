# D1232 — Preview the Align draft in History

2026-11-14 · FEATURE · P0 desktop QA, rows 07 and 21 · [#2491](https://github.com/barocss/barocss/issues/2491)

A changed Align target, Gap or Line up now previews the candidate geometry in History. The viewport uses the current worker result and preserves the accepted document and selections. Reset removes the preview. Apply uses the existing History evaluation and commit.

| Result | Check |
| --- | --- |
| FAIL | Parent Studio selected the named new target but showed only the accepted placement. |
| PASS | Real Chrome WebGPU moved the body from C to B before Apply. With Gap 2 the draft bounds were [44, 3, 10]–[56, 13, 16] mm. Gap 4 moved it up 2 mm. Touch only moved it to [0, 0, 12]–[12, 10, 18] mm. Preview picks left the accepted selection unchanged. |
| PASS | Negative Gap discarded the current preview and showed recovery. Two deliberately delayed valid worker replies could neither replace a newer preview nor restore a preview after Reset. The accepted document was unchanged during the draft. |
| PASS | Apply, strict B-rep, Undo, Redo, actual Studio Save and fresh Open passed. The applied centre [50, 8, 13] mm, bounds and 720 mm³ volume matched independent box dimensions within 1e-7. The separate D1231 named-target control passed. |
| PASS | 20 focused Studio tests, Studio type check, scoped lint, driver syntax, production build and frozen-source checks. |
| FAIL | The first type check found a missing required hint in the fallback type. The corrected type check passed. Whole-file App lint retains the inherited unused `_k` from D1228. |
| NOT_RUN | Rolled-back, placed or curved targets, full suites, CI and assistive technology. |

Scale pivot editing is already qualified in the #2491 issue evidence. The target label, draft preview and file lifecycle now meet #2491's stated scope. Keep #2506 separate for numeric input bounds and command waiting-state guidance. Desktop QA is **31/85 (36%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
