# D1001 — compare Draft and Flange references

2026-11-13 · SMALL · P0 rows 08, 15, 16 and 21 · [#2445](https://github.com/barocss/barocss/issues/2445)

- **PASS** Actual desktop WebGPU Studio retained the Draft's named Split cap as X moved from 24 to 30 mm. Reversing the normal at X30 removed that cap. History Apply refused the edit and retained the accepted model, selection and history. File Open held Draft with its original name and showed both undrafted 9,000 mm³ bodies.
- **PASS** Moving a disjoint cutter from X82 to X83 preserved the Flange. Moving it to X79.5 removed the original rim. History Apply refused that edit. File Open of the same geometry marked the unique new rim as matched again and displayed both names. Confirm stored the new edge signature.
- **PASS** At X70, File Open held the Flange with two named candidates and showed the 5,250 mm³ unbent sheet. Selecting the top rim built the 6,565.071880 mm³ Flange. Undo restored the exact held geometry and both choices. Redo restored the confirmed geometry. Project Save and Open preserved the exact confirmed document and did not restore the hold.
- **PASS** All volume assertions used analytic stock, Draft wedge and Flange cross-section formulas with 1e-7 mm³ tolerance. Visual review, 48 focused Model tests, Model type-check, driver syntax and diff check passed.
- **FAIL, harness** Three preliminary Studio runs used an incorrect file-tab suffix or expected a held output to take its parent's body key. The final run verifies the retained feature output keys and underlying unmodified geometry.
- **FAIL, existing HOLD** The wider `references sheet` test filter also matched drawing-sheets. The ASME PDF golden assertion failed. No product sources changed.
- **NOT_RUN** Named Hole face behavior, alternate Draft candidate and Flange History repick, production build, full suites and mobile.

Geometry fixture review used GPT-6.1 Sol High. Desktop issue acceptance remains 7/54. Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
