# D397 audit round 3 (targeted) — ACCEPT (Opus)

1. Printed limits: the auditor's own 20k-case probes found 0 outside the true zone for inch default / 4 / 5 places, mm precision 0 / 1 / 2, plain mm, plain ISO and dual secondaries (mm→inch, inch→mm, inch p4 with mm p1), incl. both-positive / both-negative / one-zero-side deviations and 1000–2000 mm nominals at 5 inch places.
2. Fits: Ø20 H7, H7/g6 pairs and single H7 at five sizes in inch, mm and dual secondaries — 135 limits inside; the size prints at its deviations' places.
3. Plain mm: 10.004 ±0.005 → `10.004 ±0.005`; golden coarse sheets byte-identical, fine sheets differ only where HEAD widened or shortened the tolerance (`±0.13` → `±0.125`, `+0.01` → `+0.0125`).
4. Inch frames (20k values): widths down, projected heights up, unequal amounts nearest within 5 %, 0 failures across sheet, 3D and issue checks.
5. Survived round-2 mutants now caught; three extra mutants caught; 26/26 tests.
Follow-up: a zero-width zone (upper = lower) is accepted by the validator and in inch prints an inverted pair (e.g. `+.00038/+.00039`), flagged by UNIT_PRECISION.
