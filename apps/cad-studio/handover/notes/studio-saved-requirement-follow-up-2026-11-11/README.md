---
work_id: D650
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D650 — Show a saved requirement regression in Studio Versions

P0 automation evidence, rows 04, 12 and 16. FEATURE qualification.

The existing saved approval comparison offers the direct saved successor on the same branch for a verified nested occurrence repair. The option starts empty. Selecting a version runs the existing D610 follow-up check on the selected saved snapshot. The result retains the original failure and approval in the same panel. It shows passing, regressed, changed, withdrawn, or unresolved status from the existing checker.

| Check | Result | Evidence |
| --- | --- | --- |
| Original desktop behavior | FAIL | The saved pair shows 6 mm → 4 mm. A direct later saved version exists, and Studio offers no follow-up control. |
| Fresh Studio Open and exact successor | PASS | With a 5 mm limit, the same nested occurrence shows a saved 6 mm failure, a 4 mm approved pass, and an 8 mm saved regression. The restored working model separately passes at 4 mm. The selector offers the direct 8 mm version. It excludes the next 3 mm version because that version skips a parent. |
| Comparison ownership | PASS | The first result disappears when the selection clears. A held decoded Worker response is retired when the comparison changes. Reselecting the saved pair starts with an empty follow-up. The project document, version index and all four snapshot files remain byte-identical across the reads. |
| Independent fixture check | PASS | The Python reader checks the six local prism heights across both nested occurrences and the three relevant source snapshots, with a 5 mm requirement. It also checks the restored approved document and the Studio observation. |
| Existing approval paths | PASS | The D608 saved pair and D610 Studio agent/MCP flows pass. The D610 report keeps the same three saved results and separate working pass. |

The first baseline driver timed out because restoring a version clears the comparison. The next baseline selects the saved pair again and reproduces the missing control. The final driver uses the same product restore and compare actions.

[Commands and hashes](qualification.json). The panel calculates the follow-up from saved source snapshots on demand. Independent retention of the verdict is still pending. Live models, mobile and the whole CAD suites are **NOT_RUN**. Four of ten initial scenarios have accepted v1 ledgers. B09 remains 9/9 and whole CAD/core readiness remains **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) remains open.
