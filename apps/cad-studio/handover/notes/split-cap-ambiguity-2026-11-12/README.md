# D791 — Refuse a Shell when its Split cap has two native faces

P0, rows 08, 12 and 16. SMALL fix to reference admission. The existing geometry builders and tolerances are unchanged. The prepared document contains one 60 × 30 × 10 mm box, a through-notch tool at X28–52 and Y5–12, a Split and a 2 mm Shell on its negative cap. Studio verifies live edits and both Open paths.

| Result | Check |
| --- | --- |
| FAIL | Before the fix, the X30 edit and the standalone File Open built a 4,745.699111843078 mm³ Shell from one stored cap name with two native descendants. Their independent areas are 50 and 180 mm². |
| PASS | The native Shell checks direct Split cap cardinality before its signature validation. X30 refuses at Shell `n6` with `REFERENCE` and two named native members. The focused native test checks cached edits, cold rebuilds, unsigned inputs, a symmetric notch and the unchanged inherited-wall signature refusal. |
| PASS | X24 → X26 keeps the same cap. Studio and strict native results match the independent outer-box/cavity volumes of 3,768 and 4,056 mm³ and the centroids at 1e-8. Project Save writes 1,670 bytes and cold Open restores the exact X26 document and measurements. |
| PASS | The public X30 edit leaves the X26 document, bodies, feature history and Undo/Redo controls fixed. The chat edit also refuses. Standalone File Open preserves the stored cap name, holds Shell and identifies the reference as ambiguous. The displayed untouched Split volumes are 8,860 and 7,460 mm³. Visual review covers live refusal and the held file. |
| PASS | Native build and 47/47 focused Kernel tests, 66/66 focused Model tests, all three type checks, driver syntax and diff check. The D790 missing-cap desktop regression passes. Passing browser runs report zero errors and downloads. |
| FAIL | An initial read-only native source run exposed a shadowed variable. The corrected source passed both Shell groups before the main gated run. |
| NOT_RUN | Full suites, mobile, other browsers, an explicit replacement-cap workflow, non-Shell consumers and a general native topology lineage mapping. |

[Commands and receipt digests](qualification.json). Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**. The broader reference and topology contracts remain open. [#1659](https://github.com/barocss/barocss/issues/1659), [#1658](https://github.com/barocss/barocss/issues/1658).
