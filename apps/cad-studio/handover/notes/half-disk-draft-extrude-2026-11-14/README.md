# D1253 — Inward Draft Extrude for a half-disk

2026-11-14 · FULL · P5, rows 07 and 30 · [#2261](https://github.com/barocss/barocss/issues/2261)

The existing Draft Extrude now handles a half-disk whose diameter is parallel to the local sketch X or Y axis. The kernel recognizes exact antipodes in the existing normalized profile. The diameter produces a flat wall and the semicircle produces two conical surface patches. Each outer junction is a shared quadratic parabola, with neither a straight approximation nor a fitted seam. The arc patches retain separate names under the authored arc segment tag.

At the top, the remaining circular segment has sag `R - 2 H tan(angle)`. Refuse a sag at or below the existing linear tolerance. For the new local-profile producer, refuse any generated vertex or curve or surface control point outside the existing ±10000 mm modeling range. This does not constrain later general sketch-plane placement or the existing Extrude Start Z transform. The earlier tangent-profile paths remain intact.

- **PASS, actual Studio** Opened a prepared editable R10 XY half-disk sketch through the native file chooser. Selected it from the Browser and used Extrude at 10 mm. The open HUD refused +35° with no model or history change. Applied +10°, edited to +14° in History, then verified Undo, Redo, native Save, fresh Open and the reopened History angle.
- **PASS, geometry** Strict B-rep validation: one solid, one closed shell, five faces, nine edges and six vertices. Each seam has nine measured points on the plane and the cone. Both cone supports were independently sampled. Largest strict edge-to-surface gap was 2.224e−15 mm.
- **PASS, independent volume** The 4,096-interval Simpson integral of the circular-segment area gives 1155.037175905234 mm³ at +10° and 1005.4515839447032 mm³ at +14°. Native quadrature differs by at most 1.227e−8 mm³. Current Studio differs by at most 1.152e−8 mm³. Both are within 1e−7 mm³. The repeated +14° file result agrees.
- **PASS, checks** 35 kernel and 44 Model tests, all three type-checks, kernel targeted lint and code shape, Studio production build, driver syntax and visual review. The kernel covers a reversed tagged loop, a tilted sketch with negative height, small remaining sag, positive and negative coordinate controls, and existing out-of-scope profiles. A separate High source audit confirms the analytic case and identified the range and sag guards. The external mutant with a straight seam middle fails; the unmutated geometry passes.
- **FAIL, first Studio attempt** The driver used the History editor's feature index locator on an unused sketch, which has no index attribute. The product opened the sketch correctly. The passing driver selects the public Browser sketch row. Both runs have equal manifest before and after cleanup within each run.
- **NOT_RUN** Full suites, general RB/fuzz, outward half-disk Draft, oblique local diameters, arbitrary mixed joints, display/volume immediately above the near-collapse limit, STEP and mobile. #2261 remains open.

[Commands and receipt hashes](qualification.json).
