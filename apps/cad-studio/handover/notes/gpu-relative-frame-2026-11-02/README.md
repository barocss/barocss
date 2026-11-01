---
work_id: D434
artifact_type: gpu-relative-raster-frame
status: bounded-qualified
owner_role: executor
source_request: "Continue autonomously by roadmap while owner sleeps"
last_updated: 2026-11-02
---

# Relative GPU raster frame — bounded native profile

D434 is BOUNDED QUALIFIED after D433 on rows6/13/16 at source checkpoint `24fbabbf59a355130b0015d3996653eb9b6beec9`. Overall progress remains about43%. [qualification.json](qualification.json) records counts, commands, hashes, first failures and limits. The six declared native profiles have bounded actual and independent qualification. This does not close rows6/13/16 or general GPU precision.

D430 measured the first Float32 loss: the original distant native sphere collapses to one submitted point. D431 retained authoritative CPU data and D432 corrected CPU camera queries; neither repaired raster rendering. D433 fixed the independently reproduced native polyhedral inertia prerequisite. This change conditions the private raster frame before narrowing, so local vertex detail is not lost or recreated as a large packed world translation.

## Selected representation and limits

Public/native geometry, authored transforms, world bounds/culling/BVHs, camera fields/matrices, CPU rays and returned world hits remain in world coordinates. Relative mode selects exact public target O and geometry bounds midpoint G. It uploads numeric Float32(P−G), and packs Number-composed B=T(−O) M T(G). Actual translation evaluates A*G+(t−O). The private camera uses eye−O and target−O. Normals keep the authored M normal matrix. Independent helpers derive O/G from public data; they never infer origins from uploaded bytes.

The first profile supports uninstanced affine native surfaces with caller-supplied finite nonzero normals, lines/points/contours, constant materials, default AO/post effects, visible bounded ground, hard directional shadows and cardinal-up grid. The existing zero-intensity directional shadow pass remains coherent. Exact raw input snapshots and a generation prevent stale asynchronous picks; readback decode captures VP32, its Number inverse, pixel mapping and DoubleO, restored once. Hardware supplies mesh/depth/instance semantics; returned triangle/face are CPU mesh-ray semantics, separately compared to native pixel-centre geometry. Public Camera.unproject is unchanged and has no new far precision guarantee.

Target magnitude65536 and world-AABB residual65536 are representation admission thresholds, not geometry tolerances. Unsupported residents select one whole legacy frame: labels, instances, scalar/maps/custom materials, procedural finish/clearcoat/film, active clipping/caps/hatching, point/spot lights, soft shadows, manual clipping or unsupported grids/finite states. Hidden residents participate; no content/effect is hidden to pass. Generated normals without valid supplied normals, already collapsed Float32 inputs, general mixed-scale scenes, path tracing/compute and unsupported far profiles remain unqualified. The ordinary legacy profile keeps old coefficient/prefix arithmetic.

Studio uses explicit grid cell10mm/major5 (50mm), not auto-grid. Minor and major balanced phases are computed independently before Float32; absolute axes retain distinct offsets. Raster-only material-coordinate restoration leaves the shared legacy trace material prefix unchanged. Geometry color/line/point/contour updates and device recovery reconstruct the selected representation from canonical CPU data.

## Private ABI and verification

Frame bytes grow2320→2368 (+48); all old prefix offsets remain. Main plus14shadow buffers add720GPUbytes, and two CPU frame scratch buffers add96bytes. Object payload grows256→272, with dynamic stride256→512: each allocated object slot adds256GPUbytes and256CPU staging bytes. Instance stride68 is unchanged. Ordinary prefix/coefficient/vertex/instance comparisons pass; equality of old and new total buffer lengths is not claimed.

Geometry implementation and independent mathematics use GPT-6.1 Sol High; the actual driver uses GPT-6.1 Sol Medium. GPU build/types/scoped lint/code shape pass, with8production files and0new functions inside iteration. Focused tests pass218unique (42new,176existing), independent checks12, mutation5clean assertion kills (4physical,1lifecycle), no survivor/crash. Seven generic real WebGPU tests pass on apple/metal-3: new relative primitives/recovery/fallback, basic Viewer, contours, finishes, selected trace, directional shadows and selected cap AA. Their538 source/dist hashes match before/after/cleanup. Generic line/point/contour image coverage and recovery are separate from native integration proof.

Final driver syntax/lint and post-final-driver/test-edit Model types pass; unchanged flow syntax/lint and Studio types are retained. The new grid source also passes GPU build/types/owned lint/code shape. Performance benchmarking is NOT_RUN; recorded memory costs are allocation arithmetic. The shared flow helper now places Vite cache under the run's /tmp directory, preserving the literal worktree freeze. No B-rep core changes: full kernel is NOT_RUN here; latest D433 remains2066PASS/0FAIL/2existingSKIP. No broadened full suite or browser CI is claimed.

## Actual Studio and preserved failures

The six literal profiles are qualified through scoped runs and a pinned source-change certificate. Original run01 remains FAIL at its driver-only ordinary comparator, with01/02 complete. Run04 remains FAIL at positive grid, with04/05 complete. Final run05 is PASS for fresh03/06 after the shared shader correction. Certificate `7587be5e…` checks the sole grid source delta, other49 runtime pins, unchanged perspective math and a full-screen far02 fade-discard margin greater than996998mm. This is source/control-flow and physical-margin reuse; compiled shader/pixel byte equality is not claimed. The original03 image is superseded.

All point numbers below are in mm. The physical oracle is the represented native triangle at the actual pixel centre. CPU continuous rays have their separate unchanged8ULP rule. Bounds include the actual Float32 packets, coefficient/depth reserve and native triangle conditioning. Each computed projection envelope must itself stay below.01CSSpixel; each point bound must stay below1e-4 of the smallest positive body span. No general analytic B-rep surface or manufacturing accuracy certificate is introduced.

| Profile | Receipt | Max native-mesh point error | Computed bound | Hard cap |
| --- | --- | ---: | ---: | ---: |
| 01-far-perspective | run01 | 5.820766e-10 | 4.007081e-08 | 1.988759e-07 |
| 02-far-orthographic | run01 | 0 | 1.073669e-07 | 1.988759e-07 |
| 03-centered-orthographic | run05 | 3.28681e-09 | 1.07858e-07 | 1.991209e-07 |
| 04-new-ordinary-box | run04 | 6.60113e-05 | 0.0005120222 | 0.0006 |
| 05-far-native-edges | run04 | 8.149073e-10 | 4.882223e-08 | 2e-07 |
| 06-positive-grid-box | run05 | 1.733409e-11 | 1.111222e-07 | 2e-07 |

Final independent review (`9babb86b…`, audit `fbacb119…`) accepts the scoped six-profile union. Current combined evidence contains24 genuine face/body UI selections,12 continuous CPU queries,12 hardware surface mesh/depth queries and48 product projections. Two additional genuine edge UI selections and public CPU pickLine ordinals are separate. Native line payload and public Mesh.visible diagnostic contrast contribute77ordinary/76far changed pixels atRGB20 (>10). There is no public shaded-only mode; the first fictional selector failure is preserved. Exact default snapshots/packets restore after line isolation, and the public Hide/Undo workflow restores the original document, native arrays, seven quantities and raw camera matrix bytes.

Far orthographic quality has mean.45459565625/bad-fraction.00234375. Current centered orthographic quality has mean.455039140625/bad-fraction.0028125. Both use the exact D429 centre+[40,120]80×80 ROI,12800 samples, mean<1 and fraction above1.5<.02. Current centered axes now appear outside the sphere; the interior remains depth-occluded and preserves the accepted quality bound.

The positive-grid box retains default10/50mm periods, all authored camera/effect/ground settings and original-world axes. Its true periodic cross is at[566.3180893286,511.0457314692], separated from a false local-origin cross. Four fixed130-sample strips have mean contrasts5.45037538/6.45378769/5.6424/5.6424 and fractions1, versus >2/>.7. All2600 near/reference DOM pixels and four positive nongrazing rays pass canvas, actual clip/depth, outside-body and ground-behind admission. Fabricated axes count0/1560. The existing STEP notice is recorded then publicly dismissed for this grid-only visibility check. Sample ranges were fixed from layout/geometry before the first06 execution; they are not selected from successful RGB data. The old left rail, bottom toolbar and notice occlusions remain recorded preexecution findings.

Final run05 has856 identical frozen/after/cleanup hashes, no page/console errors, source changes or downloads. Its two contexts, Chrome and server close; the sole heavy gate is released. Root views current03 restored and06 visible/hidden/restored; earlier bounded native images and the shader controls are also reviewed. Runtime response provenance remains explicit source bodies/maps; the two unloaded direct routes api/scene.ts and shader path-trace.ts are not fetched or claimed as runtime coverage.

## Reproduced grid prerequisite

The first actual positive-grid run04 fails all four strip contrasts with0, despite2600 exposed pixels and four valid physical rays. The orthographic shader measures fade from the inverse-VP signed near plane. Actual near=-.0433582393 puts that origin about.050585mm from worldZ0, beyond fadeEnd.0433582403. The grid discards with fade0. Correct minor/major phases are already present.

The shared correction retains the perspective distance expression and overrides orthographic distance with abs(dot(hit-eye,normalize(dir))). This is the distance from the parallel ray's camera eye-plane. It removes near/far dependence and preserves absolute distance for content admitted behind the eye by signed orthographic clipping. Intersection, depth, phases, opacity, grazing and clip policy are unchanged. Ordinary orthographic GRID pixels have an explicit behavior correction; global ordinary image identity is not claimed. The extra override adds no resident buffer or ABI cost.

One new real-production-WGSL test passes11 owned-device frames: axial3, behind-eye2, oblique3 and perspective3 signed clip controls. Axial/behind five RGBA images are byte-identical; other controls require admitted positive physical line probes. The actual WGSL hash equals the built production shader. All540 source/dist/test hashes match before/after/cleanup; resources close. This is a standalone shader pipeline with public Camera/packFrame, separate from Viewer manual-grid support. Fresh Studio03/06 supplies product integration proof.

## Commands and retained evidence

Use the named worktree and Node22.19.0. Each heavy execution uses gate.sh, global idle/load<40 admission and sole-own-holder/load<40 admission after acquire. Sources stay frozen through browser cleanup. Exact per-stage recipes, driver/source hashes and FAIL/PASS/NOT_RUN distinctions are in the qualification. The final checks are scoped to changed code.

```sh
export PATH=/Users/user/Library/pnpm/nodejs/22.19.0/bin:$PATH
pnpm --filter @barocss/gpu build:library
node --import ./packages/barocss-gpu/tests/cad-dist.mjs --test --test-concurrency=1 packages/barocss-gpu/tests/viewer-relative-raster.test.mjs
node --test --test-concurrency=1 packages/barocss-gpu/tests/viewer-relative-raster-payload.test.mjs
/bin/bash /tmp/barocss-d434-author/grid-fade-v2/browser-run01.sh
/bin/zsh /tmp/barocss-d434-root-checks/run06.sh
```

Final native command, inside the same sole gate with PW_DIR/CHROME and CAD_STUDIO_CHAT_PORT=52391:

```sh
RELATIVE_RASTER_SOURCE_FROZEN=1 node /tmp/barocss-d434-probe/relative-raster-browser.mjs /tmp/barocss-d434-probe/run05 /tmp/barocss-d434-probe/raster-cases.json /tmp/barocss-d434-probe/candidate-source-manifest.json 3,6 /tmp/barocss-d434-probe/run01/receipt.json /tmp/barocss-d434-probe/run04/receipt.json /tmp/barocss-d434-probe/scoped-grid-reuse.json
```

The driver is pinned to `e44648f8…`, cases `942a315d…`, current runtime source `ed044140…`, reuse contract `b6bf3e46…` and certificate `7587be5e…`. All117 readiness pins match. Final native receipt is `5dd2198f…`. These are provenance checks; independent physical/math/image checks establish the bounded result.

The record preserves the old numerical two-failure baseline; omitted CAD-dist loader module failure; real negative-remainder grid conditioning failure; four legacy test END-offset assumptions after the declared ABI append; private finite/snapshot review corrections; independent mathematical-normal signedzero test failure; generic analysis-only cross-projection image equality/scratch parser mistakes; and preexecution four-unused-function lint failure. No physical bound is widened. The independent executable helper was completed after initial author checks; the numeric proposal/caps predate them. Executable helper freeze is not misrepresented as pre-dating all tests.

Actual run01 retains three completed sphere profiles, then stops before ordinary GPU checks because the historical JSON tensor comparator distinguishes −0 and0. Independent review confirms all7 physical values and every nonzero entry exactly equal. Existing zero normalization is used only for historical JSON quantity comparison. Current-run raw/byte/snapshot equality and lifecycle Object.is remain strict. Later driver-only failures cover the unsupported shaded selector and hidden-line pickability-as-identity filter. Initial native adoption remains strict; known public line IDs and exact endpoint/ordinal data track hidden meshes. Run04 then exposes the real fade-origin defect. Final selected03/06 execution and certified reuse preserve each original FAIL status.

No dependency, OCP reinstall/download, paid execution, external customer file, further develop integration, release or publication is included. OCP/native tool directories remain removed. Source hashes establish provenance, not geometric truth. Raw arrays/logs/PNG/STEP/bundles remain under /tmp; only source tests and small records are committed. #2263 stays open for assemblies, presentation/names/PMI, other offset bases and remaining topology acceptance; #2248/#2266 and owner HOLDs remain unchanged.
