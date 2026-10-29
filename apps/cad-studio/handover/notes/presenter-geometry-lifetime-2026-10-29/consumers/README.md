# D319 actual Viewer SDK Geometry lifetime evidence

The selected D319 real-browser test passes on the second run: 1 test / 1 pass / 0 fail / 0 skip, 4522.139292 ms
(total runner time; test4440.569375 ms). The other existing browser test is unselected, not a capability skip.
Node22.19.0, Chrome156.0.8078.48, actual default WebGPU adapter Apple metal-3 and DPR1 were used. Browser errors are
empty. Post-run script syntax and final changed-harness lint pass. Browser/server and serial heavy gate are closed.

## Actual source and product path

The existing Viewer browser harness bundles this worktree's actual `packages/barocss-viewer/src/index.ts` and
imports public `createViewer` from the served ESM. It uses no mock Core or product replacement. The optional
metafile records580 real input paths and SHA-256 values. Every product input is inside the specified worktree;
external node_modules dependencies are identified separately. The final Presenter hash is
`96ce81cb3be6bc06060a7114a518a0b9925f139c7ce71ce9e7fab3ca0a8a3892`.
This is the real SDK path, not an assertion that the entire `apps/cad-viewer` UI was tested.

## Geometry and visible behavior

A genuine public Surface packet draws a square and public CPU picking finds its reference. Sixty-four rounds each
perform orbit, pan and zoom, then actual pixel readback. Three direct setView calls and16 packet replacements
follow. The same packet and position-array identity are reused; moving one corner and re-admitting the packet
changes actual captured pixels. This checks supported re-admission, not implicit mutation without an API call.

The repository's weighted native Curve example is loaded. Public visibility hides its Surfaces and fits a
curve-only scene. Actual capture shows the line and public Curve picking finds `native_loader_demo/reference_edge`.
Sixteen curve orbit/readbacks follow. The dot case uses the existing public qualified ModelSet URL loader with
one authored native plane, then public fixed-capacity256-particle fluid frames. Actual dots change captured pixels;
16 frame replacements/pans/readbacks follow. Removing the layer returns to one plane Geometry.

Across122 actual readbacks, the test reads TS-private `core.geometries`, active `meshList`, and `Geometry.gpu`.
After every capture, retained Geometry count equals uploaded-object count equals active Mesh count. Surface,
camera, replacement and curve-only stages stay at1. Plane+dots stays at2. Created, clear and dispose are all0.
Clear captures zero covered pixels. These are logical retained/upload-object diagnostics, **not** driver bytes,
VRAM, leak bytes, allocation pressure or natural OOM. No public telemetry was added.

Five PNGs are encoded directly from real GPU readback. The consumer agent inspected all five: source square,
changed corner, curve-only line, visible dots and empty clear background. Raw pixels are not substituted by fixture
images. The receipt preserves each readback length/coverage, every count sample, both public picks, source-edit
pixel change, adapter and browser errors. Allocation/add failure cleanup remains the separate High focused proof.

## Historical baseline and first consumer failure

The original audit's actual1->33 after32 orbit->36 at clear receipt is copied unchanged into `historical-baseline/`;
its original `.omx/research` harness/artifacts remain read-only. The High lane's archived pre-fix Presenter is byte
identical to the historical Presenter. The current Viewer index and GPU Core source are also identical to their
historical counterparts. `source-identity.json` records those hashes. This establishes relevant ownership-path
identity, not full bundle identity: the historical run had577 inputs and the current run580. No new before-browser
run or unchanged intervening dependency bundle is claimed.

The first consumer run failed at dot fixture preparation with `Fluid layer requires a qualified native scene`.
It used legacy `loadNative`, while public `setFluidFrame` requires the qualified ModelSet/Document route. The test
fixture was repaired to use existing public `loadModelSetUrls`; no production source, ownership assertion or pixel
expectation changed. `page.evaluate` threw before returning its full receipt, so earlier readbacks in that run are
not counted as a partial PASS. Exact first stdout, metafile and source inputs are retained.

Whole suites, other browsers/DPR/adapters, complete Viewer app UI, natural device loss/recovery, VRAM/OOM and
additional exploration are NOT_RUN. No dependency installation, commit, push or release was made by this lane.
`validation.json`, `cleanup.json` and `artifact-manifest.json` preserve scope, cleanup and exact artifact hashes.

## Final name-only cleanup

After the successful actual browser run, the new local fluid-position variable was renamed to `positions`. The
existing public `positionsM: positions` field remains unchanged. `local-name-equivalence.json` records the original
actual-run harness hash, final hash and exact allowed textual replacements. All numeric inputs, assertions, public
protocol fields and execution flow are unchanged. Validation timing keys use `duration`, `testDuration` and
`timeUnit: "ms"`. Original raw logs and readback artifacts are unchanged. Only syntax and changed-harness lint
are checked for this cleanup; the successful actual browser case is not repeated.
