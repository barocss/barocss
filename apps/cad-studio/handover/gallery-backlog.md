# cad-studio backlog from the CAD design galleries (#2029–#2093)

Surveyed 2026-10-17 at `2b73f423` (read-only: every gallery issue read, each feature checked against
`apps/cad-studio/src` and `packages/barocss-cad/src`). The galleries are target designs, not evidence;
board items that only state an engine contract are left out. Issue numbers are `barocss/barocss`.

Status of each line: [ ] open · [x] done (with the commit).

## A. App only, small

- [x] A1 Sketch Extend to a boundary, Split a segment at a point (#2051, #2038)
- [x] A2 Arc by centre, start and end (#2051)
- [x] A3 Concentric for two separate circles (#2053)
- [x] A4 Hole types Countersunk and Tapped (thread note) (#2037, #2093)
- [x] A5 IGES import (kernel `importIGES`) (#2060)
- [x] A6 Import / export reports: STEP import (what came in, units), STL fallback notice, PDF/SVG omissions (#2044, #2060, #2057, #2034)
- [x] A7 Mass: inertia (kernel `inertiaCentroidKgM2`, about a picked axis), the part's combined centre of mass, the bounds box drawn (#2056, #2041)
- [x] A8 Drawing title block: Rev field (#2057)
- [x] A9 Selection filter: faces / edges / bodies (#2049)
- [x] A10 Hide construction shapes in a sketch (#2069)
- [x] A11 Direct curves: chord next to length, raise curve degree, isocurve overlay (#2078, #2052, #2040)
- [x] A12 Render: point-light range, field of view, two-sided toggle (#2070)
- [x] A13 Direct transform: non-uniform scale and shear (#2086)
- [x] A14 Delete with dependents, after a review (#2058)
- [x] A15 Measure: coaxial check of two round faces (#2085)
- [x] A16 Direct loft lines up knots first (#2064)
- [x] A17 Grid on a face's sketch plane (#2054) — already there: the viewport draws the sketch plane's grid on any plane but the ground's (checked 2026-10-17)

## B. App (sometimes a small kernel adapter), medium

- [x] B1 Feature pattern: holes (and other features) in a row or on a bolt circle on their body (#2035, #2079, #2088)
- [x] B2 Named parameters panel and configurations (parameter sets) (#2036, #2047, #2063)
- [x] B3 Suppress / restore a feature (#2039)
- [x] B4 Reorder features, refused ahead of a parent (#2047)
- [x] B5 Boolean / cut results in several pieces as separate bodies (#2061, #2063)
- [x] B6 Exploded assembly view (#2038)
- [x] B7 Section view across part instances (#2055)
- [x] B8 Section outline to a sketch (#2038)
- [x] B9 Drawing hole callouts tied to the feature (#2057)
- [x] B10 Document version check and migration report; templates (#2058, #2059)
- [x] B11 Per-face colour (#2070, #2085)
- [x] B12 Vertex picking (#2036)
- [x] B13 Line tangent to a circle in a sketch (kernel `line-circle-tangent`) (#2068, #2039)
- [x] B14 Curves and surfaces made in the app: draw a curve, take a sketch or model edge as a curve (unlocks #2080, #2081, #2083, #2086, #2087, #2090)
- [x] B15 Direct tools: surface × surface curve, curve × plane points, point in / out (#2052, #2074, #2083, #2073) — the exact band between two plane cuts (#2082) is left to Extract region (a UV window) for now
- [ ] B16 Drag control points in the viewport (#2029, #2090)
- [ ] B17 Fasteners as assembly instances; cosmetic thread drawn in the viewport and drawings; countersunk screws (#2092)
- [ ] B18 Oblique split plane (#2072)
- [ ] B19 Texture maps (#2070)
- [ ] B20 Shared part definitions and explicit reference update (#2048)
- [ ] B21 STL / OBJ import with a unit choice (#2044)

## C. Kernel or GPU, large

- [ ] C1 Real helical threads: helix + profile sweep (#2092, #2094 stage 4)
- [ ] C2 Sweep along a sketched / 3D path (#2030)
- [ ] C3 Draft on chosen faces; offset face (#2037)
- [ ] C4 Thicken an open surface (#2089)
- [ ] C5 Surface trim by a loop, fill, extend, sew into a solid (#2042, #2043, #2050)
- [ ] C6 Least-squares curve fit; knot removal (#2042, #2052)
- [ ] C7 Splines in sketches (#2051)
- [ ] C8 Symmetry constraint (#2039)
- [ ] C9 Zebra / curvature maps (#2033); image-based lighting, alpha cutout (#2070)

## Carried over

- [ ] Fillet of mitred box tops ~130 ms (tools trimmed apart at the mitre)
- [ ] ISO 4017 lengths other than M6 cross-checked against a source
- [ ] A countersunk hole shows as three history steps (hole, revolve, subtract): one step, editable as a hole
