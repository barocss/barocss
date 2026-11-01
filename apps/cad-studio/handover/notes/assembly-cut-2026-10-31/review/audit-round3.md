# D392 audit round 3 (targeted) — CHANGES_REQUIRED (Opus)

A (flexible sub-assembly cut) verified at 0°, 90°, 37°, −120° and one level deeper: π·9·5 = 141.37 mm³ out of each lid, BOM == checkAssembly (241.274 g), one line qty 2, no CUT findings; `savedPlacement` absent from saved JSON. C verified: no wrong merges in 14 cases (only harmless over-splits). B: 8000/9700/9800 mm bars cut full length, 9900 refused in words; far parts cut correctly; a forged file opens and is reported.

Remaining (wrong results, so fixed in this record rather than deferred):
1. (medium) The through-cut box was cached by the part's own document but built after the part took the assembly's rows: widening a row reused the old box → the cut removed ~0 (fresh session 169.6 mm³) and "removes nothing" was reported.
2. (medium) A cut plate/gusset lost its BOM plate line (the cut body had no `element`).
3. (UI) The Studio draft check ran a kernel build trial per keystroke: ~4 ms on the fixture, 620–670 ms on two 60-hole 300×300 plates.
Low: bought elements left whole is a fair v1 rule but silent; tests missing for sign normalisation, foot point and the rectangle x axis in the shape key; one dead term.

Mutations 41/48 caught (M29 caught by a kernel hang; M37 equivalent).
