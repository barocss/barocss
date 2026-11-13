# D1155 — Show the Extrude target and result pieces before Apply

2026-11-14 · FEATURE · P0 desktop QA, rows 07 and 21 · [#2464](https://github.com/barocss/barocss/issues/2464)

Show the target resolved from the appended Union or Difference and the piece count from that operation's current native preview. An upright solid result uses “solid pieces”. Other result families use “pieces”. The summary is scoped to the exact live values and command context. Pending and refused previews hide the summary.

| Result | Check |
| --- | --- |
| FAIL | Before the fix, Studio showed neither the target nor the result count for Join. Native checks still found one piece at face contact and two at edge contact and across a 2 mm gap. |
| PASS | Studio showed Join stock and one, two, and two solid pieces before Apply, in that order. All three accepted results were valid with 1000 mm³ native volume within 1e−7 mm³. Only the edge-contact result had a native contact pair. All three saved Join features referenced the selected stock. Undo and Redo restored each exact document. |
| PASS | Clearing Distance hid the separated result summary and disabled Apply. Reentering 5 mm restored the two-piece summary. Visual review of the desktop Studio preview passed. Empty Cut and saved Change end face regressions passed. |
| PASS | Sol High review of native count scope, 7 Model and 4 Studio focused tests, both type checks, production build, scoped lint, driver syntax and diff check. Two regression invocations stopped before browser launch because of the filename and freeze flag. The corrected invocation passed. |
| NOT_RUN | Full suites, mobile, sheet or general B-rep Join wording, whole-target consumption and multi-region Join. |

Keep #2464 open. D1156 checks whether the 3MF notice discloses separate solid pieces grouped in a single mesh object. Desktop QA remains **25/54 (46%)**. Initial scenarios remain **8/10 (80%)**. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and hashes](qualification.json).
