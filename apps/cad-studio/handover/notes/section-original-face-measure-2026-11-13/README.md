# D1013 — qualify Measure on original Section faces

2026-11-13 · SMALL · P0 rows 05, 15 and 16 · [#2446](https://github.com/barocss/barocss/issues/2446)

- **PASS** In desktop WebGPU Studio, use Measure from here on the retained top of B. The panel reads the original area of 800 mm². Click the retained top of A. The panel reads its original area of 760 mm². These areas distinguish both originals from their smaller clipped faces.
- **PASS** The parallel planes are 8 mm apart. The bounded top faces also have a 10 mm Y gap, so the nearest-point distance is √164 mm. The panel reports 8 mm normal distance, 12.81 mm nearest distance, and 0°. The overlay shows 12.81 mm. Its witnesses come from the full original faces and can lie outside the retained section.
- **PASS** The generated cap does not replace the first face or the completed pair. Its context menu has no Measure action. The document, history, and section plane remain unchanged.
- **PASS** Visual review, 20 focused Studio tests, driver syntax and diff check. The existing D1010 mapping passes this case with no production changes.
- **FAIL, setup runs** The exact accessible menu name omitted the shortcut. After correcting that locator, the driver expected plane separation for the nearest-point distance. The final driver asserts both.
- **NOT_RUN** Preselected vertex, clipped edge, assembly Mate, production build, type-checks, full suites and mobile.

Desktop QA remains 7/54 and #2446 stays open. Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
