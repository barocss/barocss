# D949 — retain a clipped Detail diameter through project reopen and precision changes

2026-11-13 · P2 rows 11 and 16 · SMALL evidence supplement · [#2322](https://github.com/barocss/barocss/issues/2322)

- **PASS** Studio set inch precision to four decimals in a dual-unit drawing. The saved dimension, tolerance, source and model remained equal. Browser Project Save wrote 2,220 native bytes to OPFS. Close, page reload and Project Open restored the exact accepted document.
- **PASS** The actual SVG shows `Ø.3150 THRU +.0058/-.0059 [Ø8 THRU +0.15/-0.14]`. The independent reader confirmed the same clipped tip at (307.5,94.6825) paper mm and exact 8 mm DXF measurement. The two exported SVG/DXF pairs before and after reopen match byte for byte.
- **FAIL** The first observer read the drawing before its projection finished after reload. The final observer waits for the current dimension mark and verifies the exact document and output.
- **PASS** Driver syntax and diff check. This supplement changes the driver only and retains the D948 product checks.
- **NOT_RUN** A source bore size edit and an on-crop interior label in desktop Studio. The remaining issue closeout uses these checks and a Detail paper translation. Production build, full suites, PDF and mobile were not run. B06 remains 6/7 with PDF held.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
