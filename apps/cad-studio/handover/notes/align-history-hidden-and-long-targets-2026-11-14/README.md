# D1241 — Identify the current hidden or long-name Align target

2026-11-14 · FEATURE · P0 desktop QA, rows 07 and 21 · [#2525](https://github.com/barocss/barocss/issues/2525)

The Align editor shows the current Browser name and persistent face ID in text that can wrap. When the saved target is hidden, the current option appears disabled and the text reports Hidden. Hidden bodies remain excluded from replacement choices. Opening the chooser remains optional to read the current target.

| Result | Check |
| --- | --- |
| FAIL | Parent Studio showed only the face ID for the hidden target. The first driver used an incorrectly scoped Browser locator. Two later checks needed a face span and a fresh page locator after Open. |
| PASS | Chrome WebGPU at 1024 × 800 displayed the complete hidden Charlie name and n5.side1. The alternative long name had the same prefix and wrapped without clipping. No hidden replacement option was enabled. |
| PASS | Choosing Bravo showed its exact n3.top and the draft moved before Apply. Reset and Close preserved the accepted hidden target. Apply retargeted the same feature. Strict B-rep, independent 720 mm³ volume and centre [50, 8, 13] mm, Undo, Redo, Studio Save and fresh Open passed. The new target stayed readable at 1440 × 1000. |
| PASS | Named-target History control, 20 focused Studio tests, type check, scoped lint, syntax, build and frozen-source checks. |
| FAIL | Whole-file App lint retains the inherited unused `_k` from D1228. |
| NOT_RUN | Native OS menu navigation, all alternate bodies hidden, assistive technology, full suites and CI. |

The stated #2525 acceptance is met. Desktop QA is **37/97 (38%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
