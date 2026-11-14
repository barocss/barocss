# D1250 — expose focused Sketch and Drawing tool help

2026-11-14 · SMALL · Desktop QA, rows 09, 11, 15 and 21 · [#2499](https://github.com/barocss/barocss/issues/2499)

- **FAIL, baseline** Actual desktop Chrome WebGPU at 1024 × 800 and 1440 × 900 did not show a description when Tab reached Rectangle, Linear dimension or Diameter. Drawing did not open help on `?`.
- **PASS** The existing tooltip layer displays the focused tool's name, shortcut and use, with its description linked to the button. The tools expose their pressed state. Drawing's help uses the same tool entries as its key handler, including the letter O for Diameter.
- **PASS** Drawing `?` opens its keyboard shortcuts. Escape closes the dialog and restores the previous tool's focus. Enter activates the focused Diameter tool. D and O activate Linear dimension and Diameter. A first Escape cancels a partially placed linear dimension and a second returns to Select. The document is unchanged.
- **PASS** Drawing omits the idle Select directions and bottom key list. Active placement, deletion, errors and reference recovery remain in their existing locations. The More tools hover and Escape regression, two Studio model-rail tests, type-check, targeted lint, build, driver syntax and visual review passed.
- **FAIL, existing** Whole-file DrawingWorkspace lint reports five unused identifiers present at the parent. Preliminary browser attempts used an exact Finish sketch name that ignored its key label and exposed a duplicated dialog name from the title's nested Close button. The final driver uses Tab and the dialog title has a separate Close button.
- **NOT_RUN** Screen reader, full suites and mobile. Live desktop QA was 44/110 (40%). Whole CAD readiness remains **NOT_MEASURED**.

[Commands and receipt hashes](qualification.json).
