# D795 — Snap to the midpoint of an authored sketch arc

P1, rows 09 and 15. FEATURE. A finished authored circular segment contributes one midpoint at half its signed sweep. The normal Middle cue, 8 px acquisition and 0.0001 mm input rounding apply. The saved rectangle owns its corner coordinates. The snap creates no persistent relation.

| Result | Check |
| --- | --- |
| FAIL | On the baseline desktop, the Middle cue was absent near the bottom of a positive semicircle. The click stored (1, −10) mm from the 1 mm grid. The first driver failed to locate the standalone sketch step. The next attempt recorded the grid placement before failing on the fixture's omitted pending field. |
| PASS | Independent Model coordinates cover positive and negative semicircles, quarter and major arcs, reversed traversal, a rotated chord, and very small bulge. Open and closed chains keep valid candidates. Pending arcs and their zero-bulge placeholders, generated spline/ellipse arcs, degenerate chords and nonfinite or out-of-range candidates are excluded. |
| FAIL | The first candidate desktop retained the old Middle cue after a stationary tool change. The final run clears the cue on tool change and Hide. The first Model type check also found a fixture type mismatch, which the final run checks. |
| PASS | The final actual desktop shows Middle 4.4668 px from the point and no Middle at 12 px. A visible construction semicircle of radius 10 mm with endpoint Y = 1/32 mm gives (0, −9.96875) mm. The stored rectangle starts at (0, −9.9687) mm and ends at (6, −4) mm. The original profile, side tags and construction source are preserved. |
| PASS | Undo and Redo restore the exact documents. The 2 mm extrusion of the two regions yields a valid native output of 131.6244 mm³. Studio agrees within 1e-8 mm³. Project Save and reload/Open retain the exact 1,740-byte document and volume. The passing run has zero page errors, console errors and downloads. |
| PASS | Independent Sol High source review, both type checks, five focused Model tests, Studio production build, driver syntax and diff check. Visual review covers the Middle cue and the reopened geometry. |
| NOT_RUN | Desktop major and clockwise arc placement, source edit and replacement boundaries, the full suites, mobile and other browsers. |

[Commands and receipt digests](qualification.json). Initial scenarios remain 8/10. Whole CAD and core readiness are **NOT_MEASURED**. The wider acceptance remains open. [#2387](https://github.com/barocss/barocss/issues/2387).
