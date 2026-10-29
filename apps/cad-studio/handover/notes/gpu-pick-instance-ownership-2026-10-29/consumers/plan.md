# D324 actual native GPU consumer preparation

Status: **SOURCE_PREPARED / ACTUAL_NOT_RUN / SYNTAX_LINT_NOT_RUN**. Root must coordinate producer final build/focused/type/lint and source freeze before any checks or execution. Production source and CPU delayed-mock tests are owned by other agents and were not edited here.

New selected test: `packages/barocss-gpu/tests/pick-instance-readback-browser.test.mjs`. It reuses the existing GPU browser runner pattern: serve current `dist/viewer` modules and core error module over secure loopback, launch actual Chrome WebGPU/DPR1, and use public Core createViewer/createGeometry/add/frame/capture/pick/Mesh.setInstances/remove/dispose. A final producer build receipt must bind dist to final source. The small receipt hashes viewer.ts/scene.ts and their emitted viewer.js/scene.js; no broad provenance inventory is planned.

One selected browser test contains **six verification groups**, not six unique browser tests. Each group owns a fresh Viewer/Geometry/Mesh and native read buffer:

| Group | Public action after native map fulfilled | Delayed result | Fresh positive pick |
| --- | --- | --- | --- |
| Unchanged | None | instance 1, triangle 0, face 71 | instance 1 |
| Matrix replacement | Change second translation | null | new second translation, instance 1 |
| Reorder | Swap the two transforms | null | original right position now instance 0 |
| Shrink | Keep only first transform | null | remaining instance 0 |
| Instances null | setInstances(null) | null | original base triangle, instance null |
| Mesh removal | remove old mesh | null | public add of actual replacement mesh, instance 1 |

Before every hold, actual red capture pixels and public GPU pick of face71/triangle0/instance1 establish a native positive control. The scene is one triangle with two translations and a fixed front camera. No fixed wait is a success condition.

The test-only GPUBuffer prototype wrapper forwards original native mapAsync receiver/arguments, awaits its actual fulfilled native Promise, then holds only the return for one armed buffer with label `pick read`, size768 and mode READ. It never changes getMappedRange bytes, GPU IDs/depth, queue submission, draw commands or pick results. getMappedRange and unmap are forwarding observations only. Before a fresh pick the selected buffer must have exactly one native unmap; after the next public pick its unmap count must be two. Raw hits/trace are persisted before semantic assertions. Buffer counts are cleanup observations, not driver bytes, VRAM, performance or OOM evidence.

Missing WebGPU adapter is explicit SKIP with no native proof. Positive-control or scheduling failure is FAIL, not stale-result proof. No CPU mock PASS is promoted to native PASS. Cleanup releases only an owned hold, disposes the owned Viewer/device, and closes its context/browser/server in finally. The report records the Node process; the final execution owner also checks owned process exit/gate release. Preserve first failure raw, two actual representative PNGs and core JSON. No actual execution or syntax/lint has happened at preparation time; no new dependency, commit or push.
