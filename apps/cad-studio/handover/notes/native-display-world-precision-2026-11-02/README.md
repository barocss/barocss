---
work_id: D426
artifact_type: native-display-world-precision-qualification
status: qualified-bounded-native-model-profile
owner_role: executor
source_request: "Continue the roadmap and report the row and overall progress"
last_updated: 2026-11-02
---

# Native Model world coordinates — bounded qualification

D426 fixes a reproduced Model precision loss on rows 13 and 16. Overall progress remains about 43%. Native display coordinates, actual transported arrays and sample bounds now retain doubles. Ordinary WebGL byte compatibility also passes. GPU precision and tiny-shape picking remain D427 work. [Counts, commands, source hashes and limits](qualification.json).

The kernel produces Float64 world samples. Model previously narrowed positions and edge lines to Float32 and computed bounds from those narrowed positions. At the literal far center, Float32 spacing is 0.0625 mm, much larger than radius 0.001 mm. Bounded replay retains 484 distinct vertices and 964 nondegenerate triangles in the kernel, then only one distinct vertex and 964 degenerate triangles in Model. The result equals a direct Float32 cast. A private placeBody call similarly collapses a centered tiny sphere after far translation. Native inputs remain unchanged.

Native bodyMesh now creates Float64 position/edge-line copies and computes bounds from them. Existing placement/copy/transfer operations preserve their constructors and ownership. The shared CAD MeshData coordinate types explicitly accept Float32 or Float64 while preserving world millimetres and Z-up. Model retains the original shared type identity, including inherited StudioPart.meshes. CAD runtime/B-rep math, mass, units, tolerances, IDs and normals are unchanged. Private consumer input annotations widen without changing algorithms. The current [API conventions](../../api-conventions.md) state this contract.

WebGL reads gl.FLOAT attributes, so its upload boundary explicitly converts Float64 values to Float32 buffers. Normals, existing Float32 arrays and integer indices retain their existing handling. Clearance and print draw adapters likewise retain their Float32 drawing contract with explicit copies; canonical coordinates/indices stay intact and clearance normals use the original data. These conversions preserve existing draw compatibility. They do not fix large-world rendering. Section-derived, triangle/direct, compact/explode and other existing Float32 producers remain separate profiles. Private placement tests do not authorize Model translations beyond the existing limit.

Before the fix, 13 regression cases fail: eight on numeric collapse and five on storage contract. An initial out-of-range fixture hits the unchanged translation guard and is corrected before that recorded baseline. Final checks pass: Model 60 (14 new + 46 existing), CAD API 6, Studio 11, stable CAD build/types, final Model/Studio types, lint and driver syntax. Initial Model and Studio type failures remain recorded; they exposed shared inheritance and consumer boundaries, which are corrected explicitly. No B-rep code changes, so compatible D424 kernel evidence is reused without another full kernel suite.

Independent source/math/API audits pass. Four mutants preserve Float64 array classes while narrowing values. All four are caught by numerical bounds, edge endpoints, placement or transferred-value assertions; none is counted from a class-only assertion or crash. Existing native inputs, mass arithmetic and the placement algorithm remain unchanged, verified by an exact minimal-delta source certificate.

Actual WebGPU passes ordinary Bracket and both original STEP inputs. The far fixture retains 522 vertices, 484 distinct vertices and 964 nondegenerate triangles with zero degenerates. Its measured spans are [0.0019887833623215556, 0.001988759497180581, 0.0020000002114102244] mm. Centered counts are 552 vertices, 514 distinct vertices, 1024 nondegenerate triangles and zero degenerates. Bounds equal extrema of the actual transported Float64 coordinates. Body and Part now show 1.99e-3 × 1.99e-3 × 2.00e-3. All observed volume, mass, area, centroid and inertia fields exactly match D425. A separate actual WebGL2 run visibly renders ordinary Bracket correctly and confirms its native worker data is Float64.

Both actual runs keep all 746 capsule files identical through cleanup; page/console errors, source changes and downloads are zero. All owned contexts/browser/server close. The two type-only machining/RB9 helpers are outside those runtime capsules and have separate type/test/hash proof. Root and reviewer inspect all four images; reviewer also recomputes geometry statistics from the real wire data. The far tiny shape is still not visible and the centered shape is a tiny point. Rendering, camera fit, GPU picking and far overlays remain NOT_QUALIFIED, with D427 next before further exchange admission.

The historical D423 full-run failure remains unexplained and preserved. Raw samples, logs, module bundles and screenshots stay under /tmp. OCP remains removed. No dependency, further develop integration, release or publication follows.
