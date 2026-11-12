# D886 — Retire a placed evaluation notice with its source

P0, rows 10 and 16. FEATURE qualification for the stale notice reproduced in [D885](../placed-snap-lifecycle-2026-11-13/README.md).

Regular placed evaluation failures now use the existing document-scoped notice state. The publisher and the visible notice require the same authored document, displayed evaluation view and Worker generation. An expired notice is hidden before cleanup. Cleanup removes only that notice. The placement result, error message, source document and notice layout use the existing contracts.

| Result | Check |
| --- | --- |
| FAIL | Product baseline. A current zero-height Rev B correctly showed the native failure while the other occurrence evaluated. The same alert stayed visible after each independent Undo, Remove, New and healthy File Open with the same file name, occurrence IDs and body keys. |
| PASS | The fixed desktop run showed the current Rev B error in each case. Undo restored Rev A, Remove retained the independent sibling, New opened an empty part and File Open showed both healthy occurrences. The previous error was absent after each transition. |
| PASS | A separate held original Worker failure reached its callback after direct same-ID File Open. The healthy replacement retained its document and both placed meshes, with no old alert. The baseline already passed this late-delivery control. |
| PASS | D885 snap lifecycle, D707 nested BOM notice ownership and D571 body clipboard notice ownership passed in actual desktop Studio. Independent source review, focused tests, Model and Studio type checks, Studio build, syntax and diff checks passed. |
| FAIL | Scoped App lint reports the pre-existing unused `_k` in both the parent and current source. The lint diagnostic comparison passed. |
| NOT_RUN | Placed preparation-error and variant-switch desktop cases, Worker restart in this flow, full suites and mobile. |

[#2333](https://github.com/barocss/barocss/issues/2333) was closed after the D885 acceptance and evidence comment. Its snap scope is separate from this notice fix. Initial scenarios remain **8/10**. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt digests](qualification.json).
