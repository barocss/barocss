# D1021 — preserve rectangular cut pockets when the cutter misses the stock

2026-11-13 · FEATURE · P0 rows 05, 08, 15 and 16 · [#2447](https://github.com/barocss/barocss/issues/2447)

- **FAIL, baseline** Studio accepted cutter Start Z 4 → 12 mm. All six pockets disappeared from the 60 × 40 × 10 mm stock and the result became 24,000 mm³. The cut pattern still appeared in History.
- **PASS, fixed** The cutter editor names Cut pattern 3 × 2 (n5) and reports that it removes no material. Start Z = 12 mm and exact stock contact at Z = 10 mm preserve the accepted six-pocket body, document, selection and history. The attempted value stays editable.
- **PASS** Set Start Z = 6 mm in the same editor. Six shallower pockets pass strict B-rep validation. Their volume is 23,808 mm³ versus 23,712 mm³ before the change. Undo and Redo restore both exact documents. A second case preserves four pockets made by later cells even when the first tool misses, and accepts shallower cuts at Z = 9 mm.
- **PASS** Older patterns that already removed no material remain editable. The controls include all cells missing in XY, a 64-cell span outside the modelling coordinate range, and a small translated corner overlap lost to native area rounding. Independent native checks confirm pocket counts, floor Z and volume within 1e-7 mm³.
- **PASS** Visual review, 52 focused Model tests, 18 focused Studio tests, both type-checks, driver syntax and diff check.
- **NOT_RUN** XY-only loss, other stock or cutter families, parameter panel changes, fresh Save/Open of the recovery, pre-Apply model preview, production build, full suites and mobile.

The guard applies to Studio History cutter edits on a direct subtract followed by a lateral rectangular cut pattern. It requires an ordinary positive-height stock and cutter, a previous cell with proven overlap, and exact candidate Z separation or contact. It preserves general Boolean evaluation and legacy Open behavior. #2447 remains open pending the reported suppression and recovery guidance. Desktop QA remains 8/54 and initial scenarios 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
