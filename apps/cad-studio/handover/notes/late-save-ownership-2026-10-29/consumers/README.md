# D322 late Save: baseline and repaired-source actual validation

Production baseline: `a386c8705beda2c72d215da61a55fd6119351ca2`. No production repair is included in this consumer record.

The second actual Chrome 156.0.8078.48 / WebGPU / DPR 1 run reproduced the product defect. Its one selected safe-contract test failed after all native schedule checkpoints completed: **0 pass, 1 fail, 0 skip**, exit 1. This is `BASELINE_REPRODUCED_PRODUCT_FAIL`, not a repaired-product PASS.

Public UI created and saved a Box in a fresh browser project. Render Grid edit A was saved through actual native OPFS write and close. Only that close return was held. Public Render Grid edit B completed its actual native autosave before release. Native returned-tag read and project refresh completion then established that the old Save had completed.

| Checkpoint | Live document | Dirty | Native main file | Native autosave |
| --- | --- | --- | --- | --- |
| Before Save | A | true | Initial document | absent |
| Native close held | A | true | A | absent |
| Newer edit completed | B | true | A | B |
| Old Save released | B | **false** | A | **absent** |

The old Save did not overwrite live B or the valid saved A bytes. It incorrectly marked B clean and removed the completed autosave B. The exact first semantic assertion was `late Save A must not mark newer Render edit B clean / false !== true`. Raw states and bytes were persisted before that assertion. Local recovery was null at both measured checkpoints; this case does not prove local-recovery loss. The private project tag ref is not exposed; native file tags and public active-part UI are retained.

The first actual attempt was a separate driver schedule failure. Installed Playwright treated an async predicate Promise as truthy, so the driver inspected autosave too soon and reached a null access. Its original source capsule, log, receipt and cleanup are retained under `first-run/`. The second driver awaits actual native records from Node and requires complete document equality before release. No elapsed-time threshold determines success.

See [report.json](report.json), [second raw failure](baseline-second-product-failure.txt), [second receipt](second-run/receipt.json), [source profile](second-run/source-profile.json), [first observation](first-failure-observation.json) and [plan](plan.md). Source profiles retain exact new driver/helper gzip capsules and verify five relevant runtime files against the fixed Git baseline. Actual PNGs and native `.bcad` bytes are retained beside each receipt. The after-release PNG was directly inspected: one Box and the active project part remain visible.

The native scheduler forwards original receivers, arguments, objects, bytes and results. It changes only one owned native close-return schedule. Inspection I/O is separately marked from production I/O. It does not alter App state or stage documents. Own OPFS namespace removal and absence, context/browser/server closure, process exit and heavy-gate release were confirmed.

The baseline run did not cover pending New/Close/project switch or a repair. Its Close was cleanup only. Final New/Close and repaired-source results are recorded separately below. Project switch, other tabs, external folders, crash and real user-file loss remain **NOT_RUN**. No broader product acceptance is claimed.

## Final selected actual validation

The repaired-source run passed **3 selected tests, 0 failures, 0 skips**, exit 0 in Chrome 156.0.8078.48 / WebGPU / DPR 1. The exact driver/helper capsule and six runtime hashes are in [final source profile](final-run/source-profile.json); these runtime hashes were rechecked unchanged after execution. This result is separate from the preserved baseline product FAIL above.

- Same document: after native Save A completed and its real project refresh finished, live B remained dirty with native autosave B intact. Original after-A states, bytes and safety assertions were captured first. A subsequent public Save B completed cleanly with native saved B and no self-conflict, proving same-path successful tag advancement through this actual route. A physical saved-equal autosave checkpoint may remain; no physical deletion requirement was added.
- New document: public New plus a 12 by 13 by 14 Box and a new name completed local recovery before release. After late A returned, the new document, exact recovery record, dirty state and name remained, with no active old project part. Actual fresh/massReady one-body volume was 2184. The old part remains listed as an ordinary available file in the still-open project; it was not reattached.
- Close project: late A returned after public Close; the current document stayed and project metadata/document list/active part/version view did not reappear. Native saved A bytes remained valid.

New/Close observed the real returned-tag read and the reviewed synchronous stale-session return; they did not require a refresh which the repair correctly skips. Same-document required actual refresh completion. All snapshots preceded safety assertions. Four representative actual PNGs and all relevant raw native bytes/receipts are under [final-run](final-run). Three final PNGs were directly inspected: normal Save B clean, new Box/name/dirty with inactive old part, and closed project UI.

The existing D321 affected direct-setter regression also passed on the identical frozen runtime: **1 selected case plus 1 starter smoke**, exit 0. See [raw regression log](stop-regression.txt) and [regression states](stop-regression/d321-states.json). This is an affected integration rerun, not additional unique Stop coverage. No D318 or full suite was run by this consumer.

See [final-validation.json](final-validation.json) and [final raw log](final-run.txt). All owned contexts, browsers and Vite servers closed; all three test OPFS namespaces were removed and confirmed absent. Target processes were absent and heavy gate had no holder after exit. No production change, commit or push was performed by this consumer.
