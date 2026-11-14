# D1227 — Name the Linked Inset blocked through Hole or Move

2026-11-14 · FEATURE · P0 desktop QA, rows 09 and 21 · [#2481](https://github.com/barocss/barocss/issues/2481)

History follows the accepted source's feature dependencies when the kernel identifies a blocked Linked Inset. The failure names the sketch, persistent face and inset distance. It advises increasing the source dimension or resetting the rejected edit.

| Result | Check |
| --- | --- |
| FAIL | Parent Studio refused 9 mm through Hole and Move but suggested Undo and omitted the blocked link. The accepted document, geometry, History and selection were preserved. |
| PASS | At 1024 × 800 in Chrome WebGPU, direct, Hole and Move paths named the blocked sketch and face with 4.5 mm and gave the same recovery actions. Reset restored 10 mm and cleared the notice. Applying 12 mm kept the link and all other authored fields. Undo, Redo, Save and fresh Open preserved the accepted states. |
| PASS | Strict B-rep checks passed for all solids at 10 and 12 mm. Ring volumes were 2,196 → 2,268 mm³ direct, 1,476 → 1,548 mm³ through Hole and 900 → 972 mm³ through Move. The independent formula was `4 × (w × h − (w − 9) × (h − 9))` with face widths 60, 40 and 24 mm respectively. Every measured volume differed by less than 1e-7 mm³. |
| PASS | Five focused Studio tests, Studio type check, scoped lint, driver syntax, production build and frozen-source checks. |
| NOT_RUN | Multiple failing insets from one edit, other intermediate features in Studio, assistive technology, full suites and CI. |

The existing error area can require vertical scrolling at 1024 × 800. Keep #2481 open for remaining criteria. Desktop QA is **30/82 (37%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
