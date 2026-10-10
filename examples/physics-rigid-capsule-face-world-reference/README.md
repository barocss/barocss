# Private original-size capsule face world reference — #1298

This example composes the adopted #1280 selected negative-X capsule face law with a private copy of the original Physics world transaction. It uses the unchanged original `CAPSULE_THIN_CCD` fixture. It is a bounded native qualification, not a public capsule world API.

## Scope

- Physics metres, kg, seconds; XYZ/Y-up.
- Capsule radius 0.1 m, centreline half length 0.2 m, mass 1 kg, identity orientation and zero spin. Original material/inertia/default metadata remains.
- One static box at [0,0,0], half extents [0.001,1,1]. Identity or one literal Y yaw 0.2 only.
- Configured full step 1/120 s or derived half step 1/240 s, zero gravity, empty commands, absent or empty joints.
- Original free integration, all eight ordinary discrete contact passes, normal/friction arithmetic, final validation, queries and atomic commit remain in the copied world.
- Selected face response overwrites staged centre/linear velocity once from accepted start and staged velocity. It never advances a second time from the unconstrained endpoint.

`getCapsuleFaceStepDiagnostics()` adds a private copied record. Initial value is null. Clear null and a real zero-time touching hit remain distinct. Body/CCD/contact/event/stat/clock and the accepted diagnostic commit together. A refusal or unexpected copied-observer exception preserves the previous accepted state.

## Verification boundary

`CONTRACT.md` records the before-code contract, exact adopted dependency and frozen error precedence. `SOURCE-DIFFERENCE.md` records permitted copied-source changes. `adoption-receipt.json` verifies 46 exact native/adopted mode/blob pairs and 28 actual native artifact hashes. `parent-provenance.json` checks all 276 historical source pins at the immutable parent native; current CAD index gained exports. Historical source pins are never rewritten or presented as a current replay.

Root freezes every candidate, literal input, control, reference and reused source before builds or numerical execution, commits the measured source, runs the original CAD/Physics build helper and strict private types, then freezes actual emitted dependencies before ONE source/source-repeat/genuine compiled-original-helper consumer. Generated local dependencies and emitted artifacts are ignored, owned leases.

The independent Python reference imports the unchanged #1280 scalar Decimal 80/120 reference. It qualifies geometry, TOI, time, actual accepted pose and finite-face membership independently. Source/repeat/compiled records and raw Float64 bits must match. Full/half worlds compare final body/time and first absolute contact-episode time; their cursors, step-local fractions/events and entire last states need not match.

Any nonzero final spin, changed fixed orientation, or original numerical gate failure is retained as a physical NO-GO. No coefficient tuning, solver suppression, reset, slop or hidden retry is permitted. A passed selected profile does not establish general CCD, angular/friction accuracy, arbitrary capsule dimensions, 10-second stability, Viewer/cost or public reusable engine acceptance.

Exact actual commands, first failures, source/emitted graphs and measured result will be added in `RESULT.md` after the native flow. No product push, PR, deployment, package publication or release is authorized.
