---
work_id: D431
artifact_type: viewer-cpu-world-coordinate-precision
status: qualified-bounded-cpu-geometry-and-world-hits
owner_role: executor
source_request: "Continue autonomously by roadmap while owner sleeps"
last_updated: 2026-11-02
---

# Viewer CPU world precision — bounded qualification

D431 corrects the first CPU data loss measured by [D430](../far-gpu-first-loss-2026-11-02/README.md) on rows 6,13 and16. Overall progress stays about43%. [Source hashes, commands and detailed proof](qualification.json).

PreparedGeometry now owns a Float64 copy when the caller supplies Float64 coordinates. The caller's frame stays unchanged: native Model input is world data; a generic local ground quad remains local. Geometry bounds and CPU triangle/line queries use those retained numbers, and Mesh world bounds still apply the authored transform. Float32 and other ArrayLike inputs keep their old profile. Labels keep their old anchor path. Coordinate admission still requires finite Float32 representation; no overflow admission or geometry tolerance is widened.

Per-triangle scalar-expanded positions retain the source coordinate class and exact indexed numbers. Supplied normals and default raster-normal arithmetic remain unchanged. Triangle and scalar GPU uploads convert Float64 coordinates numerically to the old Float32 format before buffer sizing/writing. Doubles are never interpreted as float vertices. Existing point/line/contour packet behavior is checked. Explicit Float64 CPU positions use8bytes per coordinate instead of4; GPU coordinates remain4bytes. This is no general memory/performance qualification.

PASS:139 unique focused checks (22new plus117unchanged existing), GPU build/types/lint, final Model/Studio types, independent9 physical/byte checks and four clean assertion-killed mutants. The existing117 passed the initial run on unchanged product source; corrected22 passed separately. The initial focused run's one strict ray-parameter equality failed by1ULP and is preserved. The final assertion checks exact reconstructed membership of the authored plane; the product algorithm did not change. Corrected pre-fix22 yields16 clean failures (15physical/query,1class-only) and6passes. A separate off-center far line verifies CPU line geometry; actual spheres have empty edge arrays.

The first actual attempt stopped before CPU-query/upload acceptance because an optional own `volumeBasis:undefined` field differed from its omitted retained-JSON key. Its FAIL receipt remains immutable. The driver now compares the seven recorded quantity field values strictly, with no numeric coercion or tolerance change. Final driver syntax/lint and Model types pass after this correction.

Accepted run02 uses the three original D430 profiles. Native arrays, quantities, indices and face tables match D430 exactly. Actual Viewer CPU coordinates/bounds are Float64 and retain964 valid far triangles. All8 genuine face/body UI attempts pass at the valid routes:6 independent-relative-oracle attempts plus2 centered product-projected attempts. Public CPU hits match the independent native-triangle plane/barycentric oracle's triangle and face IDs.

| Profile | Triangle / face | Maximum world point error (mm) | Fixed budget (mm) |
| --- | --- | ---: | ---: |
| Far perspective | 55 / 0 | 4.43091718e-11 | 9.31322677e-10 |
| Far orthographic | 55 / 0 | 3.78492569e-11 | 9.31323291e-10 |
| Center orthographic | 8 / 0 | 0 | 7.72421282e-16 |

The primary oracle uses the exact public camera ray at the same continuous CSS query and original native triangles in a local frame. It is independent of the production triangle intersector. The predeclared8ULP+64EPS*localScale budget applies only to the interior nongrazing fixture sample, not every camera or geometry. A separate basis-ray comparison records an additional far perspective camera-query difference up to2.50e-7mm; it does not replace the primary geometry oracle or qualify camera accuracy.

Passive public GPUQueue.writeBuffer observation confirms one full-view Float32 position submission matching the native-derived witness per profile:6264bytes for far,6624for center. Far submissions still collapse to1 unique position and964 degenerate triangles. Consequently both far raster/GPU picks/product Orbit projections remain FAIL, with0hide-contrast pixels and out-of-canvas product-route clicks not exercised. Center still renders, changes114244pixels, and passes GPU/product projection. CPU selection recovery is not a raster repair. Submit bytes are not device-buffer readback, and D430 prepared numbers are not historical queue-byte evidence.

All794 frozen source files match through accepted-run cleanup, with zero unexpected errors, changes or downloads. Three contexts, browser and server close and the own lease releases. Public hide/Undo restores exact document, source/prepared data, helpers/effects and cameras. Root viewed full-page and representative visible/hidden/restored controls. Sixty source responses are passive provenance; unrequested api/scene.ts remains missing without fetching. Raw evidence stays under `/tmp`.

Next is D432, the measured CPU camera projection/query boundary; a coherent relative GPU raster frame follows its own proof. GL and full-kernel checks are NOT_RUN: no GL or B-rep core changed, and D424 remains the latest full-kernel checkpoint. Issue #2263 stays open because complete exchange acceptance is absent. No dependencies, further develop integration or release are included.
