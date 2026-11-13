# D910 — plan one rounded-rectangle inset through corner collapse

2026-11-13 · FEATURE · P1 rows 09 and 16 · [#2232](https://github.com/barocss/barocss/issues/2232) stays open.

The internal planner admits one numeric axis-aligned CCW rounded rectangle that starts on its lower straight edge in +X. It validates the straight supports and four equal forward tangent quarter arcs. It takes an explicit map from each authored side ID to a distinct derived ID. The rounded branch uses the existing offset calculation. At and above the common source radius it intersects the four translated straight supports, returns their derived IDs in source order, and reports the four retired arc IDs. Every distance uses the same immutable source and map.

The planner refuses nonpositive and nonfinite distances, invalid or overlapping IDs, non-tangent geometry, unsupported traversal, a collapsed opening and a positive residual radius at or below 0.01 mm. There is no new file format, product command or supported API. A standalone inspector generates native documents from the planner, and Studio opens those documents through the existing file path.

## Results

- **PASS** The internal planner generated the 1 → 2 → 2.5 → 1 mm sequence. Desktop Studio checked native ring volumes of 534.247779607693, 1005.6637061435913, 1215.663706143591 and 534.247779607693 mm³. Independent volumes match within 1e-7 mm³. Native cap coordinates match within 1e-8 mm.
- **PASS** Straight tags `e9, e11, e13, e15` survive the sharp states. Arc tags `e10, e12, e14, e16` are absent from both sharp solids and return on a new 1 mm plan from the same input. OPFS Save and fresh Open preserve the exact 2.5 mm native document.
- **PASS** 82 Model tests, 4 Studio identity tests, Model type check, affected lint and driver syntax. The focused tests use a shuffled source-to-derived ID map and translated geometry. D906 confirms that the ordinary Offset action still refuses the 2 and 2.5 mm values.
- **FAIL** The first browser navigation used a 10 s cap and timed out before any product interaction. The retry used the 30 s navigation cap already used by the Round driver. Geometry budgets did not change.
- **NOT_RUN** Persisted recipe, live distance/history transitions, retired reference enforcement, general profiles, full suites and mobile.

[Commands, numeric results and receipt hashes](qualification.json).
