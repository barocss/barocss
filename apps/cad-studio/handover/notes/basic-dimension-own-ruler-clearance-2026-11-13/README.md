# D934 — clear the basic dimension box from its own ruler

2026-11-13 · P2 rows 11 and 16 · SMALL drawing placement repair with independent geometry review

The existing controlled drawing proposal for a 100 × 40 × 10 mm four-hole plate produced one `TEXT_OVER_LINES` error in desktop Studio. The 12 mm vertical basic dimension `d3` had a frame that crossed its own ruler. The usual side had insufficient room between adjacent rulers.

- **PASS** After the existing candidates fail, an automatic vertical plain-mm basic dimension with no attached control can try the other side at the same station. Admission requires actual own-ruler overlap and an outward original label. The existing frame, obstacle and 1.2 mm clearance checks apply to the alternate. The authored dimension and its ruler do not move.
- **PASS** Studio displayed the corrected drawing with no issue for d3. Independent paper-mm arithmetic confirmed the 12 mm ruler at X=28.00252531694167 and the basic box at X=29.927525316941672 through 35.09752531694167. The box and text moved together by 6.725 mm and retained their station. The parent/final accepted drawing, parameters, native nodes and outputs compare equal. Only the d3 mark group changed. Its two extensions, ruler and arrowheads compare equal.
- **PASS** Independent Sol High source review, 75 focused Model and four Studio tests, both type checks, driver syntax and diff check. The final WebGPU run passed visual review and recorded zero errors or downloads. The existing controlled chat approval test now passes.
- **FAIL** The expanded current Model run returned 89 PASS and three inherited `TEXT_OVER_LINES` failures. Rebundling the exact parent sheet producer returned four failures in the 10-test tolerance file. The starter-plate geometric case now passes. The cross-hole geometric, hole-row geometric and hole-row plus-minus cases still have a remaining collision. The hole-row geometric case has one remaining warning where the parent had two.
- **NOT_RUN** The other tolerance corrections, actual SVG/DXF export for this change, production build, full suites, PDF and mobile. B06 acceptance stays at 6/7 with PDF held.

Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
