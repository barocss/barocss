# D1152 — Preserve Through all on an upright stock edit

2026-11-14 · FEATURE · P0 desktop QA, rows 07 and 21 · [#2464](https://github.com/barocss/barocss/issues/2464)

For a new zero-draft Cut on an attached vertical sketch with one supported upright target behind the plane, save the Through all mode on its cutter. The old numeric height and Start Z remain a compatibility snapshot. The current Model gets the attached target from the native prefix, verifies a valid upright solid and extends the tool one millimetre beyond its rounded-up far extent. History indicates Through all and omits fixed cutter dimensions. No kernel geometry or tolerance changed.

Unmarked documents preserve their fixed tools. Other historical one-sided authoring cases remain available, and the HUD states that the applied depth stays fixed. A marked one-sided Cut refuses a stock edit that extends across the sketch plane. This does not move a sketch with the stock or implement a bidirectional cut. Model dependencies keep the target through deletion, renumbering and duplication. The raw reader rejects malformed mode, cutter and target combinations. Native evaluation checks the full plane and target geometry.

| Result | Check |
| --- | --- |
| FAIL | Before the fix, author Through all from the actual HUD, save and reopen, then increase stock thickness 10→14 mm behind the same Z=10 opening. The 11 mm cutter remained fixed. The internal floor at Z=−1 left 3 mm of web and the body volume was 16096 mm³. |
| PASS | The saved mode returns in History. The cutter lowers from depth 11 to 15 mm when the stock grows. Native volume is 15904 mm³, matching (40×30−8×8)×14. The Z=−4 cap contains the through loop and the intermediate floor is absent. The same authoring nodes survive Undo, Redo, Save and fresh Open. |
| PASS | A stock that starts 4 mm above the fixed sketch plane shows the fixed-depth notice, retains the unmarked 11 mm cutter and preserves 16160 mm³. D847 modes and D1151 History Distance pass in real Studio. |
| PASS | Sol High source review. 33 Model tests include nonmarked readback, native depth, malformed mode and target mutations, rollback, deletion and duplication. Model/Studio types, production build, scoped lint, syntax and diff pass. |
| NOT_RUN | Full suites, mobile, tilted or drafted persistent Cut, high-count native-prefix performance and complete Cut/Join issue acceptance. |

A first driver attempt used an indexed selector on a free Sketch history button. The exact role identifies the sole free sketch. Keep #2464 open for refusal feedback, empty cuts and Join result counts. Desktop QA is **25/54 (46%)**. Initial scenarios are **8/10 (80%)**. Whole CAD and core readiness are **NOT_MEASURED**. [Commands and hashes](qualification.json).
