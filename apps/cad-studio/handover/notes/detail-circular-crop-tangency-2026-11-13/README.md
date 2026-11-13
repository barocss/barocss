# D946 — reject a point-only contact when cropping an exact circular arc

2026-11-13 · P2 rows 11 and 16 · FEATURE drawing geometry repair · [#2322](https://github.com/barocss/barocss/issues/2322)

- **FAIL on the parent** An exact circular semicircle whose midpoint was the sole contact with a crop disk returned the entire semicircle. The 22-case focused Detail run reported this one failure. The first browser oracle wrongly expected the same failure from the native starter plate. Studio already omitted its tangent-only native crop.
- **PASS** For exactly round arc bases, the extrema of the circular distance equation classify whole-arc containment and point-only contact before the midpoint check. External and internal point-only contacts are excluded. A containing or coincident crop keeps its positive span. A crop radius 10⁻⁸ mm above exact tangency keeps the analytic short arc. Reverse orientation and the near-circular ellipse control pass. No tolerance band is added.
- **PASS** In actual Studio, the native tangent-only crop retains its authored dimension with a lost-reference warning. The SVG omits the source arc and dimension and the DXF omits the dimension. The D945 split-arc and seam desktop regression passes with four actual SVG/DXF pairs.
- **PASS** Model 144/144, both type checks, driver syntax and diff check. Sol High reviewed the distance equation and identified the near-circle compatibility case, now covered by the regression.
- **NOT_RUN** Exact mid-arc failure through native desktop projection, production build, full suites, PDF and mobile. #2322 remains open pending the remaining controls. B06 remains 6/7 with PDF held.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
