# D1153 — Mark an Extrude end face complete after its preview is accepted

2026-11-14 · SMALL · P0 desktop QA, rows 07 and 21 · [#2464](https://github.com/barocss/barocss/issues/2464)

Keep the candidate face name and refusal reason visible. Give the End face step its completion mark only when the current native preview succeeds. The same HUD guard covers initial To face and Change end face. The Profile step and other commands keep their existing marks.

| Result | Check |
| --- | --- |
| FAIL | In the original Studio, select a planar end cap with one native circular trim. The evaluator refuses it and disables Apply, but the named End face step is still checked. |
| PASS | The same holed cap, a nonparallel wall and a curved wall leave the completion mark off. Studio preserves the name and refusal reason where the native preview received a candidate. No accepted document, history or selection changes after the refused picks. |
| PASS | Select the valid replacement n1.bottom. The End face mark and Apply become available when its preview succeeds. The accepted result is one valid 2000 mm³ extrusion. The Change end face history and its pending-target ownership regression pass. |
| PASS | 4 focused Studio tests, Model and Studio type checks, scoped lint, driver syntax and diff check. |
| NOT_RUN | Full suites, mobile and remaining Cut/Join cases. |

Keep #2464 open. Next D1154 checks a Cut through empty space before Apply. Desktop QA is **25/54 (46%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
