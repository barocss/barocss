# D906 — measure the rounded-rectangle inward Offset boundary

2026-11-13 · SMALL · P1 rows 09 and 16 · [#2232](https://github.com/barocss/barocss/issues/2232) stays open.

The tested outline is a 20 × 10 mm rounded rectangle with R2 quarter-circle corners and an existing 10 mm Extrude. Studio's 1 mm inward Offset makes a separate inner loop with 18 × 8 mm bounds and R1 corners. At 2 mm the inner arcs reach zero radius. At 2.5 mm they would require a topology transition. Studio refuses both values and preserves the active sketch geometry, accepted document, history and dirty state.

The independent area is `width × height − (4 − π) × radius²`. The ring volume from the difference of the two areas is 534.2477796076939 mm³. The strict native result is 534.247779607693 mm³. The original eight side IDs survive and the hole receives eight distinct IDs. Independent positions of the four outer and four inner cylinder axes and all 32 cap vertices pass at 1e-8 mm. Undo restores the solid stock, Redo restores the ring, and project Save/fresh Open preserves the exact ring document and native result.

The current Offset action adds independent sketch geometry. The separate planar-face inset association accepts native straight edges only. A curved associative sketch-to-sketch recipe and retiring and reviving corner IDs still require a bounded decision. The 2.5 mm sharp candidate would have area 75 mm² and must never inherit a retired arc ID.

## Results

- **PASS** Actual desktop Studio WebGPU, 82 Model tests, 4 Studio identity tests, driver syntax and diff checks.
- **FAIL** None in the measured current contract.
- **NOT_RUN** Sharp-corner admission, association, corner ID restoration, other rounded profiles, full suites and mobile.

[Commands, numeric results and receipt hashes](qualification.json).
