# D397 audit round 1 — CHANGES_REQUIRED (Opus, full tier)

Wrong numbers (fixed in this record):
1. Tolerances and deviations printed at the dimension's decimals: inch ±0.005 / ±0.01 mm → `±.000`, +0.009/-0.004 → `+.000/-.000`; mm precision 0: ±0.05 → `±0`; precision 1: ±0.05 → `±0.1` (twice the tolerance). A unit test locked one in.
2. GD&T frame values: inch 0.01 mm → `.000`; mm precision 1: 0.01 → `0.0`, 0.05 → `0.1`.
3. Fit deviations: -0.009 mm → `-.000`.
4. Inch conversion rounded to nearest, so converted tolerances could widen (+0.1 → +.004, flatness 0.1 → .004) — decided: limits round inward, a converted zone never widens.
5. Weld list SIZE header `[inch]` over mm cells; 6. weld symbol sizes and other string sizes left in mm unlabelled.
7. Chat hint does not list units/dual/precision/standard (per-turn budget full) — follow-up.
8. Pre-existing: plain mm tolerances rounded to 0.01 (±0.005 → ±0.01, ±0.125 → ±0.13).
Root (actual run01 image review): a dual text longer than the space between the arrowheads (`.24 [6]` on the 6 mm height at scale 2) ran over its dimension line and arrowhead.
Verified fine: conversion (25.4 → 1.000, 12.7 → .500, 0.127 → .005, 0.0635 → .0025, negatives, no -0), ASME mm leading zero, brackets after the value, UNITS cell, holes/PCD/radii/targets/ring grooves routed, typed notes as typed; byte identity with units absent 127/127 hashes over 6 documents × plain/ISO/ASME; Studio commits through readDrawing, precision input validation; budget 24,997. Mutations 13/13 caught (none for 1–3).
