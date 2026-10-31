# D392 audit round 4 (narrow re-check of the round-3 wrong results) — ACCEPT (Opus)

1. Stale box fixed: the same part object at row 40 then 400 removes 169.646 mm³ both times (fresh build equal), no "removes nothing". Key is the full evaluationKey string (eviction only recomputes), LRU bounded at 64. Box keyed by the definition object (pre-fix) is caught by a test.
2. Plate line kept: end caps 3 and 5 mm cut at top, bottom, both, and one of two occurrences: items stay n1/n2, no element swaps, 8000 − π·25·5 = 7607.30. Plate area staying the uncut stock's: acceptable stated limit (now in document.md).
3. HUD trial off the typing path: 0.02–0.2 ms per keystroke on two 60-hole 300×300 plates; the ~190 ms trial runs after a 250 ms pause; Apply repeats the trial in the model, so a stale result never lets a wrong cut through.
Low: CUT_LEAVES_BOUGHT non-failing (tested); M33, M39 and M34 (claimed equivalent — refuted, now caught) caught; M37 removed.
Follow-up: the HUD trial is keyed by the draft, not the document — after an Undo with the HUD open an old result can show for up to 250 ms (Apply still re-checks).
