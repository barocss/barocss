# D1032 — report lost Drawing occurrence references before export

2026-11-13 · FEATURE · P0 rows 10, 12 and 20 · [#2449](https://github.com/barocss/barocss/issues/2449)

Assembly Drawing shows hidden and missing occurrence references beside the sheet and in the issue list. The standard SVG, PDF and DXF actions offer Cancel or an explicit export without the listed dimensions. A pending confirmation belongs to its sheet, drawing settings, file name and DXF format.

- **FAIL** On the baseline, the hidden-plate SVG and the removed-plate SVG, PDF and DXF all emitted bytes without a warning.
- **PASS** Desktop Studio names hidden Plate 2 and shows the recovery action. Cancel emits no SVG. Undo restores the dimension and clears the warning. For removed `p2`, the three formats require confirmation and name `d2`. SVG keeps `d1` and omits `d2`. PDF and DXF file signatures are valid. Changing the DXF version retires the pending confirmation. A new confirmed export writes R12.
- **PASS** Independent review, visual inspection, 46 Model tests, 17 Studio tests, both type-checks, driver syntax and diff check. A separate desktop regression run verified that Duplicate and Insert part still retain the lost reference through Project reopen.
- **NOT_RUN** Desktop nested and multi-sheet controls, PDF visual or numerical acceptance, external DXF import, section-only DXF, explicit reattachment, DIMENSIONS deletion after Redo, production build, full suites and mobile.

#2449 remains open. Desktop QA is 10/54, initial scenarios are 8/10, and whole CAD and core readiness **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
