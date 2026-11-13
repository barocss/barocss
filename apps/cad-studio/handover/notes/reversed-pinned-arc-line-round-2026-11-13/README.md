# D902 — round a pinned incoming arc and outgoing line

2026-11-13 · FEATURE · P1 rows 09 and 16 · [#2282](https://github.com/barocss/barocss/issues/2282) stays open.

The parent desktop Studio extruded the clockwise XY outline but refused Round at the selected arc-to-line corner. The corrected baseline preserved the accepted sketch and its native volume of 7141.5926535897925 mm³. The first driver attempt exercised the straight-corner control and did not qualify this baseline.

Keep the first outline point fixed when reversing traversal for the finite-contact calculation. Map the solved points and signed bulges back to the authored order. In the accepted XY outline the source arc remains at index 2 and the fillet goes at index 3. Its new ID is `e5`. The original side IDs and pinned endpoint remain, and the two horizontal locks, vertical lock and three tangent locks attach to their intended entities.

## Verification

- **PASS** Desktop Studio WebGPU created R3, accepted R4 in the panel and R5 inline, and accepted source R16 inline. Both locked R10 attempts were refused. Undo and Redo restored the exact documents, and local-project Save followed by fresh Open retained the R4 geometry and side tags.
- **PASS** An independent planar construction predicts both arc centers, the five boundary points and extrusion volume. Strict native B-rep and Studio Worker volumes agree within 1e-7 mm³. The native cylinder centers, axes and cap vertices meet the 1e-8 mm coordinate tolerance. The saved outline has side tags `e4, e3, e2, e5, e1`.
- **PASS** Independent Model review, 63 Model tests, 45 Studio tests, Model and Studio type checks, desktop build, affected lint and driver syntax. Actual forward XY source-radius and reflected XZ Round regressions passed separately. All desktop runs used cached Playwright and installed Chrome.
- **FAIL** An independent Model probe reproduced a separate exact-limit bypass after clearing the fillet radius lock. D903 will reproduce this sequence in Studio before changing the guard.
- **NOT_RUN** Reverse source clear/relock in Studio, reverse XZ Studio, arbitrary line angles and pin sets, full suites and mobile.

[Commands, numerical values and receipt hashes](qualification.json).
