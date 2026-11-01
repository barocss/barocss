# D398 audit round 2 (targeted) — CHANGES_REQUIRED (Opus)

1. (wrong result) Weld symbols: a joint seen only in a view on another sheet got no symbol and no issue (15 placed, W1 unshown, silent); a joint seen in no view lost its WELD_NOT_SHOWN warning in any split — even where sheet 1's weld views equal the one-sheet case that warns (regression). Cause: the warning was turned off whenever the weld sheet lacked any weld view, and symbols searched only the weld sheet's views. → each joint's view chosen across all shown weld views of the set; warning judged on the whole set.
2. Datums pass: a letter repeated across sheets reported once (same count as one sheet), undefined letters still raised, no false DATUM_UNDEFINED.
3. Chat pass: auto_dimension/fix_drawing keep sheet ids and views, create no sheets, move nothing across sheets (a view dropped by auto layout leaves its sheet list).
4–6 pass: deleted sheet's notes untagged, stale ids skipped; renamed letters carried to same-edit dependents; an unticked view leaves every list.
Mutations: round-1 24 → 21 caught, M17 (no set coverage) survives; 16 new → 12 caught, N3/N6/N14/N16 survive → tests requested. No-sheets output byte-identical; merge fuzz 0 failures.

Root after the fix (round 3 by the root, targeted at the weld finding only): the auditor's own p7 probe on the final tree — W1 hidden in front only: 16 symbols placed in every split (W1 on top's sheet), no issue, as on one sheet; W1 hidden everywhere: 15 placed and one WELD_NOT_SHOWN naming W1 in every split, as on one sheet. Implementer added tests for M17, N3, N6, N14, N16. Model 2513/2513, Studio 624/624; actual run03 PASS.
