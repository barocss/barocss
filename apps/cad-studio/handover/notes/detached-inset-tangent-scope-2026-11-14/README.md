# D1226 — Verify tangent expansion on a detached rounded inset

2026-11-14 · SMALL · P0 desktop QA, rows 09 and 21 · [#2481](https://github.com/barocss/barocss/issues/2481)

The product flow detaches the 1 mm rounded inset and picks one straight inner top edge in Edges mode. A separate geometry review derives the removed volume by integration over the fillet band. No product change was needed.

| Result | Check |
| --- | --- |
| FAIL | One repeat stalled before creating a Chrome context. Only the run's owned Chrome was stopped. A clean retry passed. |
| PASS | The actual R0.1 preview showed one picked edge, n2.side[e9], and seven tangent additions, n2.side[e10] through n2.side[e16], all bordering n2.top. The viewport selection retained only the picked edge. The feature stored only that edge. |
| PASS | The result had eight fillet patches and passed strict B-rep inspection. With radius r = 0.1 mm and inner perimeter P = 44 + 2π mm, removed volume is P r² (1 − π/4) + π r³ (5/3 − π/2). The analytical and native final volumes were 534.139569782967 and 534.1395697829699 mm³. Studio agreed within 1e-7 mm³. Undo and Redo restored both exact authored states. |
| PASS | Driver syntax, diff and frozen-source checks passed. Chrome and Vite closed. |
| NOT_RUN | A different continuation, visual pixel sampling of the selection cue, another radius, full suites, CI and mobile. |

Keep #2481 open for remaining recorded cases. Desktop QA is **30/81 (37%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
