# D319 Presenter Geometry lifetime

This fixes retained scene Geometry in the Viewer. It does not claim a speed improvement or driver-memory/OOM result. Production changes are limited to `packages/barocss-viewer/src/presenter.ts`.

## Original failure and repair

`baseline-identity.json` binds the original checkout (`b1a9ed8c9dbbbe463fae1600151041870914937d`), archived source, package/TypeScript build inputs, and pre-existing output files. `original-*` files preserve their exact bytes. `baseline-bundle.mjs.gz` preserves the self-contained source bundle used by the baseline; its dependency inputs and hashes are in `baseline-bundle.inputs.json`.

`reproduce.mjs` runs the archived original Presenter with actual GPU Core scene methods, Mesh and Geometry classes. It does not create a WebGPU device. The original retained Geometry count is **1 → 33** after 32 camera/drawing replacements. An empty scene leaves **33 Geometry / 0 Mesh**. Core final disposal clears the registry. An actual Mesh color-construction error also leaves **1 Geometry / 0 Mesh**. Raw results and original error text are in `baseline-results.json` / `.txt`.

The original Presenter removed Meshes only. Core `add(rawGeometryInput)` creates a new Geometry and retains it in the Core registry. Core `remove(mesh)` deliberately retains Geometry for other meshes and later reuse. Geometry `dispose()` already releases its own buffers and removes itself from the registry.

The repair keeps that Core contract. Presenter now explicitly creates its own Geometry, adds a Mesh using it, and tracks the successful Mesh immediately. If add fails, it disposes that newly created Geometry and propagates the original error. Replacing the drawing removes each old Mesh first, then disposes its Presenter-owned Geometry. Earlier successful items remain if a later item fails; the existing partial-show/outer rollback policy is not widened.

No Core remove/clear behavior, shared Geometry API, material/texture ownership, caller array, render parameter, or camera arithmetic changes are included. There is no identity cache: every accepted replacement still prepares a new copy, so caller arrays edited in place are reflected. Dot instance scale still updates with camera distance.

## Scoped verification

All executions used Node v22.19.0 and the existing heavy gate, serially. The final gate was released before consumer verification.

- `build.txt`: `node node_modules/typescript/bin/tsc -p packages/barocss-viewer/tsconfig.json`, **PASS**, exit 0. This emits the full Viewer package and checks its types. An empty TypeScript log is normal for success.
- `unit-after-initial.txt`: seven new ownership tests, **7 PASS / 0 FAIL / 0 SKIP**.
- `related-tests.txt`: new tests plus existing `review-state.test.mjs` and `device-events.test.mjs`, **40 PASS / 0 FAIL / 0 SKIP**.
- `external-texture-test.txt`: after strengthening one test to attach the caller texture to an actual mesh material, only that changed test was rerun: **1 PASS / 0 FAIL / 0 SKIP**. The other successful tests were reused.
- `lint.txt`: changed production, test, and harness lint **PASS**, exit 0. `lint-test-final.txt` confirms the strengthened test file, exit 0.
- `after-results.json` / `.txt`: the same reproduction now retains **1 → 1 → 0 → 0**, and the actual Mesh-construction failure leaves **0 Geometry / 0 Mesh**. All 33 replaced Geometry objects are explicitly disposed. Original error code/text and source input remain unchanged.

The focused harness uses real production Presenter and GPU Core scene methods/classes with a minimal recording Core setup. Rendering/device startup is absent. Recording buffers prove destruction calls, including geometry/scalar buffers, per-Mesh buffers, and shared-zero-UV exclusions. They do not measure driver bytes. The tests also cover triangles, lines, dots, empty drawings, public Viewer.clear, idempotent final disposal, external explicit Geometry shared by two Meshes and re-added after removal, source-array preservation and in-place changes, actual Mesh constructor failure, and an injected failure after Geometry/Mesh construction but before scene insertion. External ImageTexture remains live across Presenter changes; final Core disposal retains its existing owner policy.

`unit-baseline.txt` preserves the first pre-fix run: seven failures. Six are expected ownership regressions. The initial injected-add test failed its harness assumption: it threw before Geometry creation and then accessed the absent recorded Geometry. The injection was moved to Core object-slot growth, after Geometry/Mesh construction. `unit-baseline-addfault.txt` preserves that corrected pre-fix test's expected **1 retained versus 0 expected** failure. No original log was rewritten.

`source-review.md` records ownership boundaries. `unit-report.json` and `verification.json` bind outcomes and final source/test/output hashes. `artifact-manifest.json` covers this lane's evidence files. Baseline/after bundles are lossless gzip artifacts and can be decoded independently.

Actual Chrome/WebGPU checks belong to the consumer lane. This lane did **not** run browser tests, the full Viewer/GPU/Kernel/Model/Studio suites, or a benchmark. No commit, push, PR, new public telemetry, driver-memory claim, or OOM change was made by this lane. Source and tests are frozen for the consumer run.
