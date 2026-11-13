# D947 — verify the equal-distance Detail diameter anchor

2026-11-13 · P2 rows 11 and 16 · SMALL evidence supplement · [#2322](https://github.com/barocss/barocss/issues/2322)

- **PASS** On the two-interval crop from D945, the saved label ray bisects the two eligible clipped endpoints. Actual Studio and an independent SVG reader found one mathematical minimum at (291.0016,101.25) paper mm. Native Save and fresh Open reproduced that choice and all 6,295 SVG bytes. The authored references and 8 mm measurements stayed equal.
- **PASS** Ordinary Top diameters on the complete circle retained two inward heads for the inside label and one head for the outside label. All three ordinary tips were on the 8 paper-mm radius at 2:1. The reader used a 0.0001 paper-mm coordinate bound.
- **PASS** Driver syntax and diff check. This evidence supplement changes only the browser driver and retains the D946 product checks.
- **FAIL** The D946 native point-contact crop still describes its saved source as missing from the part. The source edge exists in the parent view and has no positive-length crop ink. This does not satisfy the issue's requirement to distinguish unavailable attachment from source loss.
- **NOT_RUN** Exact tie DXF, additional precision overrides, production build, full suites, PDF and mobile. #2322 remains open. B06 remains 6/7 with PDF held.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
