# D927 — measure the current opposite faces after a numeric edit

2026-11-13 · SMALL · P1 rows 07 and 16 · [#2337](https://github.com/barocss/barocss/issues/2337)

The existing Measure tool uses transient display body and face indices. Starting Measure clears the normal editing selection and the History editor. This baseline uses fresh manual picks from Top and Bottom for each accepted result.

- **PASS** In desktop Studio, a 20 × 12 mm rectangular Extrude returned face area 240 mm² on both caps and distance and normal distance of 8 mm. Editing Distance to 13.25 mm returned 13.25 mm. Undo returned 8 mm. Redo and a fresh File Open returned 13.25 mm. Both pick orders returned the expected signed Z displacement and 0° angle. The viewport label agreed with the panel.
- **PASS** The independent dimensions predicted 1920 and 3180 mm³. Strict native outputs gave 1920.0000000000007 and 3180.000000000001 mm³ within 1e-8 mm³. Both source face names and all eight native vertices were present. The measurement left the document, bodies, history controls and dirty state unchanged.
- **PASS** 52 Model and 12 Studio focused checks, driver syntax and diff check. The final WebGPU run had zero page errors, console errors and downloads. Visual review confirmed the edited readout and viewport label.
- **FAIL** The first driver clicked before the rotated camera had rendered and picked the same face twice. The second used a top action with insufficient framing after the edit and failed the camera check. The final driver uses the View Cube, Frame all, camera-side and animation-frame checks before both clicks.
- **NOT_RUN** Pinning, edits while a pin is displayed, stale target refusal, native Save, full suites, type checks, build and mobile.

The next bounded implementation will use explicit stable ownership for one planar face pair. The current measurement is the numerical baseline. Initial scenarios remain 8/10. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt hashes](qualification.json).
