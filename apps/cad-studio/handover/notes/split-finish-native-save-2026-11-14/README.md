# D1243 — persist an explicitly confirmed Split finish in a standalone file

2026-11-14 · SMALL · P0 rows 05, 16 and 21 · [#2445](https://github.com/barocss/barocss/issues/2445)

- **PASS** Actual desktop WebGPU Studio held both R1 Fillet and 1 mm Chamfer until explicit confirmation. It displayed the original binding and its proposed replacement. Undo restored the held stock and choice. Redo restored the accepted feature.
- **PASS** Four native Save downloads and fresh File Open runs preserved exact descriptors, signed edge signatures and volumes. References confirmation saved the X30 edge and reopened Fillet at 8,997.853981633976 mm³ and Chamfer at 8,995.000000000002 mm³. History repick saved the X60 edge and reopened both accepted finishes; the second held feature in the Chamfer fixture still had one pending choice.
- **PASS** Independent volume comparison used two 9,000 mm³ split solids and removal of either 10(1 − π/4) or 5 mm³, with 1e-7 mm³ tolerance. Visual review, driver syntax and diff checks passed. No product source changes.
- **FAIL** None in this run. **NOT_RUN** Strict native B-rep validation, full suites, mobile and live edit of a planar linked inset with a signed finish.

## Retained issue evidence

| Issue requirement | Evidence |
| --- | --- |
| Pending versus automatic versus confirmed | [D995](../split-finish-reference-open-2026-11-13/README.md), [D1001](../draft-flange-reference-comparison-2026-11-13/README.md), [D1007](../legacy-unconfirmed-finish-open-2026-11-13/README.md) and this standalone run. |
| Original and candidate; confirm and reopen | [D996](../split-finish-reference-history-2026-11-13/README.md) verifies project persistence. D1243 verifies standalone native Save. |
| History repick and Undo | [D998](../held-finish-history-repick-2026-11-13/README.md) and [D1003](../concave-fillet-history-reference-2026-11-13/README.md), with standalone persistence in D1243. |
| Hole axes and missing Split face | [D1000](../hole-history-centre-axes-2026-11-13/README.md) and [D1002](../split-hole-reference-open-2026-11-13/README.md). |
| Linked Inset | [D999](../linked-inset-retired-finish-boundary-2026-11-13/README.md) qualifies the retired arc refusal. The live planar Linked Inset case remains unadjudicated. |

Keep #2445 open for its unresolved live topology-edit case. Desktop QA was 38/98 (39%). Whole CAD readiness remains **NOT_MEASURED**.

[Commands and receipt hashes](qualification.json).
