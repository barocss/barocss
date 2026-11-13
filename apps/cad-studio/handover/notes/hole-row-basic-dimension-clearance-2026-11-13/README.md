# D936 — clear the 20 mm basic dimension in the hole-row drawing

2026-11-13 · P2 rows 11 and 16 · SMALL drawing placement repair

In desktop Studio, Accept all geometric tolerances on the 100 × 40 × 10 mm hole-row plate produced `TEXT_OVER_LINES` for the Top view's horizontal 20 mm basic dimension. Its frame crossed its own ruler. The next ruler on the usual side blocked the centered outward candidate.

- **PASS** The existing same-station fallback now admits an automatic plain-mm Top horizontal basic dimension above its unbroken view. The usual candidates must fail and the original frame must cross the ruler. The alternate keeps 1.2 mm clearance from the arrowheads and stays between the ruler and view, with the existing obstacle checks.
- **PASS** Desktop Studio reproduced one warning on the parent and showed zero on the candidate. Accept all, first Undo and first Redo produced the expected documents. The two accepted documents compare equal, including all dimensions, their references, the hole callouts, datums A/B/C and position frames Ø0.3 and Ø0.6. Only d2 text and frame ink changed. Its ruler, extensions and arrowheads stayed fixed.
- **PASS** Independent paper-mm and emitted A4 SVG checks verified the 20 mm ruler at Y=35, Top view at Y=53, and basic frame Y=36.925–42.095. Studio generated 18,954 SVG bytes. The D934 and D935 desktop regressions, four Studio roundtrip tests, both type checks, driver syntax, diff check and Sol High source review passed.
- **FAIL** The expanded Model suite passed 91 of 92 tests. The inherited hole-row plus-minus case still has `TEXT_OVER_LINES`. The first baseline observer truncated JSON at 65,536 bytes. A synchronous write corrected the observer, and the second baseline reproduced the product warning.
- **NOT_RUN** Actual DXF output, PDF, production build, full suites and mobile. B06 remains 6/7 with PDF held.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
