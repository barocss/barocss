---
work_id: D578
artifact_type: requirement-numeric-precision-qualification
status: fixed-and-qualified-for-selected-physical-requirements
last_updated: 2026-11-10
---

# D578 — Evaluate physical requirements before display rounding

P0, B09, rows 04 and 16. FEATURE qualification for the existing requirement checker and its consumers. [#2411](https://github.com/barocss/barocss/issues/2411).

## Change and evidence

Use existing display-mesh bounds for bbox and the evaluated body volumes and existing material-density conversion for volume and mass. Compare unrounded values with the existing predicate and tolerance. Keep compact three-decimal Facts, four-decimal report fields, and the scope and units of each check. The failure hint includes the unrounded value when the compact measurement would pass the same predicate. The local chat tool carries that hint into the hard-edit refusal. Its explicit `because` override still applies.

The checker preserves assumed-material and incomplete-bead results, body selection and zero for geometry with no volume. Pending, missing and nonfinite evaluated values are unknown. Studio retains the prior pass for a physical check while the worker's mass result is pending in its scope. A settled failure warns and keeps the manual edit.

Root opened a native rectangle at the origin and translated by +0.00048828125 mm along X in actual desktop Studio. The independent rational box calculation gives width and volume 40.000244140625 mm and mm³, respectively, with al6061 mass 0.1080006591796875 g. The width cap is 40.0001220703125 mm. The original cap verdict differed by placement, exact-width equality failed, and volume and mass caps passed incorrectly. The fixed run agrees with the oracle on five checks at both placements. Worker volume and centroid agree within 1e-9 in the selected units.

Editing the extrusion height from 1 to 1.000244140625 mm crosses the hard height cap. Studio reports the failure, keeps the edit, and restores each verdict through Undo and Redo. Public Save writes the native document to the browser project. The saved bytes match the accepted document and a fresh browser context reopens them through public Open. The separate pending test holds a genuine worker mass reply. The intermediate implementation lost both hard warnings after the unknown report. The final run warns once the body settles and keeps the same edited document. Root inspected the actual viewport and requirement panel. [Commands and receipts](qualification.json).

- **PASS** — final desktop WebGPU flow, raw threshold and body-scope checks, local hard gate and override, compatibility and mutation coverage, focused Model tests, type checks, affected lint and Studio build.
- **FAIL** — original focused regressions and desktop physical verdicts, intermediate missing deferred warnings and intermediate Model type check for the body selector, and one driver lint error. The final checks cover the corrected source.
- **NOT_RUN** — live model and MCP transport, whole Model/kernel suites, mobile, arbitrary native or tessellated geometry accuracy and broader B09 acceptance.

Bbox remains a display-mesh measurement. Tessellated volume provenance and the existing compact output precision remain as provided. The failure detail exposes the raw value for the qualified numeric queries. Whole CAD remains NOT_MEASURED. Next is D579, P0 B09, rows 04 and 16, for hard-requirement priority in recovery snapshot selection. [#2414](https://github.com/barocss/barocss/issues/2414).
