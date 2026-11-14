# D1249 — return focus after closing Hole

2026-11-14 · SMALL · P0 rows 08, 15 and 21 · [#2495](https://github.com/barocss/barocss/issues/2495)

- **FAIL, baseline** Actual Chrome WebGPU at 1024 × 800 left the active element on the page body after Escape from the preset field, Cancel Enter, and Apply Enter.
- **PASS** Hole remembers its tool-rail opener. On close from its HUD, it returns focus to that connected tool or the existing Model workspace control. A newer document Open, a newly active command, or another focused control prevents the queued focus update.
- **PASS** Opened from Create > Hole with Enter. Two presets, arrow-key selection and Use preset Enter affected preview only. Escape and Cancel returned focus to Hole and preserved document, selection and history. Apply Enter created one Ø6 × 5 mm blind hole from the right face and returned focus to Hole. Undo and Redo passed. Native volume was 14,258.628330588454 mm³ against 14,400 − 45π mm³.
- **PASS** Existing Studio preset keyboard regression, three focused Studio tests, Studio type-check, production build, driver syntax, visual review and diff checks. One earlier driver attempt opened the preset disclosure with no selected row. The final driver selects the intended preset then verifies both arrow steps.
- **NOT_RUN** Escape while the OS-native select popup is open, assistive technology, fallback opener path, full suites and mobile. Desktop QA was 42/108 (39%). Whole CAD readiness remains **NOT_MEASURED**.

[Commands and receipt hashes](qualification.json).
