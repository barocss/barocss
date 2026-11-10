---
work_id: D608
artifact_type: bounded-product-qualification
status: implemented-and-verified
last_updated: 2026-11-11
---

# D608 — Compare a saved nested failure with its approved repair

P0 automation, B09 follow-up, rows 04, 10, 12 and 16. FEATURE qualification in the existing Studio Versions inspector. The baseline loaded the exact D607 failure and approved snapshots. It listed a placed-host change and omitted the nested requirement evidence.

A nested comparison resolves only the leaf named in the one approved parameter operation. Both snapshots must resolve that leaf. The recorded decision and root evidence pair must match. If the first snapshot includes the pending proposal, that record must also match. The existing proposal preview replays the recorded operation on a private copy of the first snapshot. Recovery requires the replay to reproduce the entire approved authored revision and both scoped checks to have current results. The approval authority is the project's local history record.

| Group | Result | Evidence |
| --- | --- | --- |
| C01 | PASS | Real project Reload and Open preserve the two exact D607 snapshot byte sequences. Versions shows only `p1/p1`, with HEIGHT changing from 6 mm fail to 4 mm pass. The working document still shows 8 mm fail. Independent arithmetic verifies six heights across the saved failure, saved repair and working document. |
| C02 | PASS | Selecting the later working failure as the comparison target shows no approved recovery. Releasing a held, decoded Worker read from the previous target does not restore its result. Reselecting the saved repair still gives 6 mm to 4 mm. The working file, version log and snapshots keep their exact bytes. |
| C03 | PASS | Focused tests refuse an unrelated operation, reused path with additional geometry edits, stale endpoints, a false model hash and malformed approval records. The sibling does not become a recovery option. Both a saved failure with the pending proposal and one saved before the proposal are supported. |
| C04 | PASS | The D595 legacy desktop flow still compares a saved top-level approval while a later working document fails. It retains version-log replacement and overlay separation controls. |

The first harness tried to save a detached file over a same-name project document. Studio correctly refused the overwrite. The final harness stages the exact prior files as a separate project writer, then uses Studio to reopen, save named versions and compare. Independent review also found that malformed operation names could reach inherited parser entries. The classifier now recognizes the two actual parameter operation forms directly, and focused controls include inherited names and malformed workflow records.

Root reviewed the final saved-comparison and retired-read images. The nested and legacy desktop runs captured 3 and 10 states, with zero page errors, console errors or downloads. Focused Model and Studio tests passed 62/62 and 93/93. See [commands and hashes](qualification.json).

An agent-facing structured approval report, an independent defect ledger, external signer authentication, whole suites, mobile, and live providers are **NOT_RUN**. B09 remains 9/9 scoped groups. Four of ten initial scenarios have accepted ledgers. Whole CAD and core readiness remain **NOT_MEASURED**. [#2279](https://github.com/barocss/barocss/issues/2279) and [#2402](https://github.com/barocss/barocss/issues/2402) remain open.
