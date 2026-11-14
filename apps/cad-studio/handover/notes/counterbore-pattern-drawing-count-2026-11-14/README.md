# D1244 — verify the quantity of current counterbore locations

2026-11-14 · SMALL · P0 rows 11, 13 and 16 · [#2494](https://github.com/barocss/barocss/issues/2494)

- **FAIL, baseline** Chrome WebGPU changed only the counterbore circle centre from [20,20] to [17,17] mm. Existing Drawing and SVG retained “4× Ø4 THRU CBORE Ø6 × 3 DEEP”. Fresh Auto-dimension printed “7×”. The native stock already contained three through locations, three blind locations and one compound location.
- **PASS** The common Drawing callout path checks individual copy ownership, whole native shoulder and concentric floor circles, then groups by unrounded hole sizes and depth. Auto-dimension on the shifted part prints three Ø4 through, three Ø6 × 3 deep and one compound callout. The existing incorrect quantity is unresolved, gives the Auto-dimension recovery step, and is omitted from screen and export until refreshed. Stored dimensions stay authored. Protected callouts direct the user to their controls.
- **PASS** Eight actual Studio drawing states, eight SVG exports parsed as XML, eight PDF exports checked against the content-stream text and one native Save/fresh Open. Undo recovers byte-identical aligned SVG and PDF. Editing only counterbore Copies 4→2 safely omits the old four-pair count. Refresh prints two Ø4 through and two compound locations.
- **PASS** Independent stock volume formulae give 19,200 − 252π mm³ aligned, 19,200 − 288π mm³ shifted and 19,200 − 222π mm³ after recess count 4→2. Measured volumes are 18,408.31865129536, 18,295.22131576613 and 18,502.566430903058 mm³ within 1e-7 mm³. Strict native checks passed in every captured state. The only shifted compound shoulder is centred at [28,20,9] mm with radius 2 mm.
- **PASS** Independent Sol High source/geometry review, visual review, 95 focused Model tests, Model and Studio type-check, targeted lint, production build, driver syntax and diff checks. Initial driver attempts failed on an omitted oracle status, drawing signature enrichment and a stalled owned browser start. The final frozen receipt records no browser errors or worktree writes.
- **NOT_RUN** M6×1's existing pitch-circle count at 4→6, manual reattachment, multi-sheet exports, DXF, other body or axis combinations, the held ASME PDF golden case, full suites and mobile.

The confirmed feature pair is the adjacent same-entry axial pilot/recess on the base body. #2494 remains open for its companion tapped pattern. [#2511](https://github.com/barocss/barocss/issues/2511) specifies that count edit and the PCD recovery. The live desktop checklist had 38/102 checks (37%). Whole CAD readiness remains **NOT_MEASURED**.

[Commands and receipt hashes](qualification.json).
