# D515 — current slow-preview drag cadence

The existing slow-preview case remains **NOT_REPRODUCED_BOUNDED** at merged HEAD `4d733c0f622dadf0b8d84d4395b696779e9b1e84`. No product defect or product change follows. One root Studio run serves D516 integration and D515 measurement; it is not two runtime proofs.

D403 already measured this conditional branch. D377's quick case is not the sole baseline. The current run uses the unchanged retained 51-node part: a 60×40×20 Box, 48 R1 holes and one R3 fillet. No scene was enlarged and no Worker delay was injected. The source audit and driver preparation used GPT-6.1 Sol Medium.

The root delivered all 70 pointer moves. Twelve previews comprise ten rolled and two whole previews, with zero unknown geometries. Whole Worker wall times are 230.5 and 217.4 ms, so the strict >120 ms condition is eligible. Rolled round-trip median is 1.0 ms; whole round-trip median is 231 ms. Moving animation-frame gaps have median/p90 16.7 ms, maximum 33.4 ms and zero gaps above the retained 50 ms indicator. Width shows 12 distinct snapped values, 60→71; width-update gaps are median150/p90 166.6/max166.7 ms. Width cadence is separate from frame cadence.

Escape preserves the exact document. All 290 helper and 1614 outer source pins remain equal through cleanup and root image review. The run has zero page errors, console errors, file changes and downloads. Its own context, browser and server close. Root reviewed two original PNGs. Fresh checks pass: 24 drag-wall tests, seven D516 navigation tests, Studio types/build and final Model types. Nineteen D513/D514 tests are reused, not fresh. The raw check receipt's prior-map count1684 is corrected to1633 by the root review; this is separate from the current outer1614 pins.

[Qualification](qualification.json) records exact metrics, commands and evidence hashes. Headless animation timing is not physical vsync; Worker round-trip excludes GPU upload. This is not general row20 completion. Issue #529 stays open with eight unchecked items. No issue comment or closure follows. Core NOT_MEASURED and existing HOLDs remain.
