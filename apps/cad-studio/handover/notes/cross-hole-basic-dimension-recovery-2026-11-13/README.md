# D935 — clear the horizontal basic dimension in the cross-hole drawing

2026-11-13 · P2 rows 11 and 16 · SMALL drawing placement repair

After accepting geometric tolerances on the 60 × 30 × 30 mm block with an Ø8 cross-hole, the Right view showed `TEXT_OVER_LINES` for the 15 mm horizontal basic dimension. Its boxed value crossed its own ruler. The first alternate put the ruler on the upper edge of the view and failed the geometric check.

- **PASS** The existing automatic move now admits this plain-mm Right-view basic dimension when its original frame crosses its own ruler inside an unbroken view. The rebuilt ruler and heads must clear the upper edge. Its strokes must clear other view areas. The existing payload, text and issue checks still apply.
- **PASS** The desktop Studio Open and Drawing flow reproduced the parent warning and cleared it on the candidate. The independent paper-mm check measured a 15 mm ruler 8 mm above the Right view and verified the leader anchor. Only the Y placement of dimension `d4` and its mark group changed. The two references, datums A/B/C, Ø0.2 position frame, note, nodes and output were equal to the parent. The D934 desktop regression and Sol High source review passed.
- **PASS** The expanded Model run passed 90 tests, including the cross-hole case. Four Studio roundtrip tests, both type checks, driver syntax and diff check passed.
- **FAIL** Two inherited Model conformance cases still report `TEXT_OVER_LINES`: hole-row geometric and hole-row plus-minus. The expanded run has 90 PASS and two FAIL.
- **NOT_RUN** Clicking Accept all in Studio for this exact cross-hole case, actual SVG/DXF output, production build, full suites, PDF and mobile. The browser consumed the accepted native document. B06 remains 6/7 with PDF held.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
