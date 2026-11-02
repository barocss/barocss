---
work_id: D432
artifact_type: cpu-camera-project-ray-precision
status: qualified-bounded-cpu-project-and-ray
owner_role: executor
source_request: "Continue autonomously by roadmap while owner sleeps"
last_updated: 2026-11-02
---

# CPU camera projection and rays — bounded qualification

D432 corrects the CPU camera-query losses measured by [D431](../viewer-cpu-world-precision-2026-11-02/README.md) on rows 6, 13 and 16. Overall progress remains about 43%. [Exact source hashes, commands, budgets and results](qualification.json).

OrbitCamera.project now subtracts the represented eye before Number basis dot products, then applies the existing Float32 projection coefficients and OpenGL depth. Its nine-field cache and invalid-basis legacy path remain. Viewer.Camera.ray constructs a valid ray from the represented basis and public Number projection, while retaining the old inverse first for admission and legacy fallback. Perspective origin remains the eye alias; orthographic origin stays on the signed near plane. All raster matrix methods, camera pose/FOV/clipping policy, stored fields, analytic Orbit ray and public unproject remain unchanged. There is no GPU-origin, shader, geometry or B-rep change.

PASS: 194 unique focused checks (38 new and 156 existing/updated compatibility), independent 18 checks, four clean assertion-killed mutants, GPU build/types, Studio/Model types and scoped lint. The old source produces 14 clean physical assertion failures. An independent body certificate verifies 24 unchanged public/raster/navigation methods. Ordinary CPU projection changes stay within the predeclared Float32 coefficient-aware envelope: maximum 3.57628e-5 CSSpx against 4.07367e-5; this is not bit equality to the old packed query.

The first actual attempt failed in its driver before query/projection/upload proof: historical JSON stores -0 as 0, so its comparison with current raw matrices was invalid. That FAIL receipt remains immutable. The correction normalizes only historical signed zeros, keeps every other value exact and records current raw Float64/Float32 matrix bytes. Within-run bytes remain strict. A separate old/new-source reconstruction at the three retained poses passes 9 raw and 9 rounded matrix byte comparisons; it is not historical runtime byte capture. Final driver syntax/lint and Model types pass after the driver correction.

Accepted run02 uses the original far perspective, far orthographic and centered orthographic inputs. All 24 product Orbit projection witnesses pass the predeclared coefficient-aware pixel/depth budgets. Canvas-local __studioProject and page __studioScreenOf are compared in their correct frames; page offset equality is exact. All 12 genuine face/body pointer selections pass across independent-relative and actual product routes. Public rays and native triangle hits pass separate direction/origin, primary intersection and propagated basis-hit checks.

| Profile | Maximum CSS error | CSS envelope | Maximum native point error (mm) | Primary point budget (mm) |
| --- | ---: | ---: | ---: | ---: |
| Far perspective | 5.81984136e-6 | 5.81987462e-6 | 3.53356121e-11 | 9.31322677e-10 |
| Far orthographic | 3.65361188e-6 | 3.65364126e-6 | 3.79214513e-11 | 9.31323291e-10 |
| Center orthographic | 8.59451825e-6 | 8.59454758e-6 | 1.38777879e-17 | 7.72421283e-16 |

Every CSS envelope stays below .001 pixel. The ray-origin error is 0; maximum direction error is 1.11023e-16 against about 1.42e-14. Both routes retain triangle 55 / face 0 for far and 8 / 0 for center. Strict interior barycentric>1e-6 and incidence>.1 are required. The primary native-intersection budget remains8 ULP+64 EPS*localScale. A separately predeclared plane-perturbation formula propagates independently admitted ray deltas for the basis hit; no tolerance was widened after a failure. The far perspective basis/public local hit difference falls from D431's descriptive 2.50e-7 mm to at most 1.36e-20 mm in this bounded sample.

Native arrays, seven quantity fields, camera values and scene controls match D431. Before/hide/Undo retain exact current raw matrix bytes, document and native/prepared arrays. Passive actual GPUQueue.writeBuffer positions still match D431: 6264 bytes far, 6624 center. These are CPU submission bytes, not device readback. Both far submissions retain 1 unique position and 964 degenerate triangles; both far images remain blank and hardware GPU picks FAIL. Center renders, changes 114244 contrast pixels and passes GPU picks. This CPU query qualification does not qualify far raster rendering, hardware picking, public unproject or nonempty edges (the native sphere edge arrays are empty).

All 799 frozen/after/cleanup source entries match. Unexpected errors, console errors, changes and downloads are 0. Three contexts, browser and server close; the own gate releases. Root viewed center visible/hidden/restored and both far visible images. Sixty passive runtime source responses are recorded; api/scene.ts remains honestly missing without a fetch. Raw evidence stays under /tmp. Independent actual review is recorded in qualification.json before commit.

Next is D433, the coherent relative GPU raster-frame boundary. GL and full-kernel checks are NOT_RUN because neither path nor B-rep core changed; D424 remains the latest 2052 PASS/0 FAIL/2 SKIP full-kernel checkpoint. Issue #2263 stays open: complete exchange acceptance is absent. No dependency, further develop integration or release is included.
