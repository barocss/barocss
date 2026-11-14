# D1238 — Explain an excessive mixed Chamfer distance

2026-11-14 · FULL · P0 desktop QA, rows 07 and 21 · [#2529](https://github.com/barocss/barocss/issues/2529)

The Part finish checks the names on the native intermediate body only after confirming all the original picks. If an earlier pass of the current Chamfer makes a later name unavailable, Studio advises reducing Distance. Missing original names retain the existing reselection guidance. The native error category remains SELECTION.

| Result | Check |
| --- | --- |
| FAIL | Parent Studio asked for edge reselection at 6 mm even though both selected edges existed on the original body. |
| PASS | Desktop Chrome WebGPU showed the distance recovery message for both mixed pick orders. Apply was locked, the old preview scope was hidden, and document, bodies, History and selection matched the valid pre-edit state. Returning to 0.1 mm restored the same native picks and preview. |
| PASS | Apply saved the two ordered picks, 10 finish faces and strict closed geometry. Volume 533.9952841677082 mm³ matched the reproduced baseline within 1e-7 mm³. Undo, Redo, Studio Save and fresh Open passed. |
| PASS | A separate actual Split History edit removed the original selected edge. Chamfer and Fillet kept the reselection guidance and preserved the accepted model. The native control distinguishes an absent original name from the intermediate failure. |
| PASS | Sol High native review, 13 focused Kernel tests, 5 focused Studio tests, three type checks, scoped lint, syntax, production build and frozen-source checks. |
| NOT_RUN | Other mixed geometries, assistive technology, full suites and CI. |

The stated #2529 acceptance is met. Desktop QA is **34/94 (36%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
