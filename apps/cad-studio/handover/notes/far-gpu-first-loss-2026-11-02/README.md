---
work_id: D430
artifact_type: far-coordinate-gpu-first-loss-assessment
status: qualified-diagnostic-product-failures-unresolved
owner_role: executor
source_request: "Continue autonomously by roadmap while owner sleeps"
last_updated: 2026-11-02
---

# Far-coordinate GPU first loss — diagnosed, product failures remain

D430 measures the retained original far-coordinate STEP after D429 on rows 6, 13 and 16. Overall progress remains about43%. Product files are unchanged. [Numbers, commands and proof boundaries](qualification.json).

The sphere has radius.001mm and center[999000,-998000,997000]. Model retains native Float64 world positions. Studio passes them to Viewer geometry preparation, which converts them to Float32 before upload and derives bounds from those rounded samples. Float32 spacing at each center component is.0625mm, with a half rounding cell of.03125mm. Every sphere vertex therefore rounds to the same center before matrix arithmetic.

| Current actual profile | Native valid triangles | Prepared valid / degenerate | Changed hide-contrast pixels | Render / pick / product projection |
| --- | ---: | ---: | ---: | --- |
| Original far, Top perspective | 964 | 0 / 964 | 0 | FAIL / FAIL / FAIL |
| Original far, Top orthographic | 964 | 0 / 964 | 0 | FAIL / FAIL / FAIL |
| Centered Top orthographic control | 1024 | 1024 / 0 | 114244 | PASS / PASS / PASS |

Both far contexts retain522 native Float64 vertices,484 unique positions and extents approximately.00198878/.00198876/.00200000mm. The actual matched Viewer surface has522 Float32 vertices but only1 unique position, collapsed bounds atC and identity model transform. A camera-relative Number oracle predicts native widths about489/482CSS pixels while prepared width is0. These are numerical bounds, not rendered pixels.

At a predeclared interior point, genuine independent-oracle-route face/body UI attempts miss in both far contexts; public CPU raycast and hardware pick also return null. Existing Orbit ScreenOf returns page coordinates outside the canvas (far perspective approximately[1520.117,322.121], ortho[-8417.096,-1635.098]), so those product-route clicks are explicitly not exercised. The centered control passes both real UI routes and both public query routes. Software F32 matrix witnesses are recorded separately and do not certify exact GPU arithmetic.

Public Browser Hide body/Undo supplies contrast without requiring successful selection. It restores exact documents, native/prepared data, helpers, effects and cameras. Pixel contrast includes helper effects and cannot alone prove a valid surface; collapsed triangles remain FAIL_RENDER even if helpers were to change. Native volume, mass, area, centroid and inertia exactly match retained D425 values. Edge arrays are empty on these spheres; no actual native-edge precision acceptance is claimed.

Diagnostic integrity PASS is separate from the unresolved product failures above. All793 frozen files match before/after/cleanup; unexpected errors, source changes and downloads are zero. Three contexts, browser and server close and the own gate releases. There is no retry or product repair. Sixty passive module bodies are retained; api/scene.ts was not loaded by this direct Studio path and remains an honest missing response. Root viewed the recorded full-page and visible/hidden/restored controls. Raw evidence stays under `/tmp`.

Other Float32 object/instance/frame matrices and large world shader intermediates are additional loss boundaries. Local geometry plus a large Float32 model translation alone is insufficient. A coherent later raster frame must preserve camera, lighting, clip/cap/shadow, grid, material-world and picking semantics. A CPU authority checkpoint can be qualified separately, with raster and Orbit projection failures kept explicit.

Next is D431: preserve Viewer CPU world-coordinate authority and verify CPU bounds/picking without byte-reinterpreting doubles as GPU floats. Relative GPU raster and product Orbit projection remain later boundaries. Current GL and full-kernel checks are NOT_RUN; no B-rep core changed. Issue #2263 remains open because complete exchange acceptance is absent. No downloads, further develop integration or release are included.
