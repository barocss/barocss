# D942 — verify Detail diameter output when the source hole is removed

2026-11-13 · P2 rows 11 and 16 · SMALL evidence supplement · [#2322](https://github.com/barocss/barocss/issues/2322)

- **PASS** In desktop Studio, Hole suppression preserved both saved dimension references and reported `DIMENSION_LOST` and `DETAIL_EMPTY`. Hole deletion removed the two dependent diameter dimensions and displayed the removal count. The Detail crop stayed in both cases.
- **PASS** Actual SVG and DXF omitted both diameters and the source arc in both cases. First Undo after each operation restored the exact pre-operation document. Both restored SVG files matched the original byte for byte and retained the Ø8 dimension and the 0.15 mm tolerance.
- **FAIL** Four initial observer runs exposed the Delete shortcut label, the expected deletion cascade, legacy fixture signature capture and an incorrect toast locator. The final run used the current saved signature format. The deletion notice also stayed visible after Undo restored the dimensions. This record qualifies geometry and document recovery; the stale notice is a separate product defect.
- **PASS** Driver syntax and diff check. This evidence supplement changes the browser driver only and retains the D940 product checks.
- **NOT_RUN** Restored DXF comparison, crop center/radius edits, remaining alternate-arc and display-profile matrix, production build, full suites, PDF and mobile. #2322 stays open. B06 remains 6/7 with PDF held.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
