# D1245 — withhold pitch annotations that carry an earlier hole pattern count

2026-11-14 · SMALL · P0 rows 11, 13 and 16 · [#2511](https://github.com/barocss/barocss/issues/2511) and [#2494](https://github.com/barocss/barocss/issues/2494)

- **FAIL, baseline** On a 60 × 60 × 12 mm plate with stored M6×1, Ø5 × 6 mm bores, editing Copies 4→6 removed the old size quantity through D1244. The existing Drawing and all three exports still showed an incomplete “Ø30 PCD” for the circle and “3× 8” for the linear pattern.
- **PASS** An automatic standard-view dimension that names one current circular pattern now checks the saved ring membership count. This also covers its dependent pitch-centre locations. A counted linear pitch naming one authored linear pattern checks the current copy count. Stale annotations remain in the file, explain the old count in the issue list, and are omitted from screen and output until refreshed. Manual annotations and protected controls retain their authored references.
- **PASS** Direct Studio History edits, Undo/Redo, two actual native Save downloads and fresh Open. The fresh circular file can rematch drawing edges by signature. Its feature nodes, outputs, dimension IDs and withheld quantities remain correct. Undo restores the four-hole SVG, PDF and DXF byte for byte.
- **PASS** Ten browser drawing states and 30 actual output downloads. An independent reader matched SVG text nodes, PDF Tj strings and DXF TEXT records to the sheet. Explicit Auto-dimension prints “6× M6×1 × 6 DEEP” with “Ø30 PCD · 6× EQ SP” or “5× 8”. Studio volumes were 42,728.76110196153 and 42,493.14165294231 mm³ within 1e-7 of 43,200 − copies × 37.5π mm³.
- **PASS** Replayed D1244's eight Studio counterbore states with its native checks and SVG/PDF readers. Visual review, 95 Model tests, Studio and Model type-check, focused lint, production build, driver syntax and diff pass.
- **FAIL, harness** The first reopen assertion required byte-identical in-memory annotation signatures after Open. The corrected assertion checks the model, stable drawing IDs, and actual output. The first corrected product run stalled in the owned Python process while sending a large payload. The final reader opens each exported file from a short input record with a timeout.
- **NOT_RUN** New catalog tap creation, manual reattachment, third-party CAD rendering of DXF, external pagination/ASME PDF golden, mobile and full suites.

The actual export acceptance is met for the scoped circle and line in #2511 and for the tapped-pattern cross-check in #2494. The desktop checklist was 38/104 (37%) before issue closeout. Whole CAD readiness remains **NOT_MEASURED**.

[Commands and receipt hashes](qualification.json).
