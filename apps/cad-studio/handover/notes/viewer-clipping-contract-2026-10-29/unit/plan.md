# D325 CPU contract preparation (not executed)

The entire archived #2239 body was read. The parent/consumer subsequently reproduced current native near/far display/pick mismatches before runtime source edits. That native receipt is separate from this CPU work.

New file: `packages/barocss-viewer/tests/clipping-contract.test.mjs`.

Five grouped tests use an own-source esbuild bundle of actual SDK Viewer, Presenter, Core Viewer and Camera. The fixture follows existing CPU lifetime/assembly tests, with actual camera/frame preparation and scene objects; no GPU transport/rendered-pixel claim is made.

- Literal z0 square, eye `[0,0,6]`, closed scene-unit axial-depth interval: control, near/far endpoints and binary-exact offsets outside. Manual clipping must survive actual Core prepareCamera, including a visible grid.
- FOV90, 320x240, pixel `[220,120]`: independent point `[3,0,0]`, axial depth6 and Euclidean ray distance sqrt45. Camera clipping remains scene-unit values with mmToSceneUnit1 and0.001; geometry uses literal millimetre coordinates4 and4000. Nonunit up `[0,7,0]` remains valid.
- Finite accepted min/max camera controls and Infinity/NaN/invalid bound refusals preserve accepted state, mesh identity, camera and hit.
- SDK camera replacement and Core manual/auto, orthographic/perspective transitions use current policy.
- Literal Core box fit preserves the infinite default near value and exact numeric projection bytes. Manual perspective endpoints map near1/far0 with beyond-plane rejection, and restoring auto returns the original infinite projection. This is a numeric behavior oracle, not a source/file checksum test.

Registration approved: add only `scripts.test = node --test tests/clipping-contract.test.mjs` to Viewer package.json. Existing unregistered files remain outside this change. Root/release recursive tests and manual/pre-release full regression will run it. **Ordinary affected package CI intentionally excludes runtime tests** (`affected-ci-run.mjs:64–66,171–175`), though the plan records the new script; it will log that runtime test as external. The initial suggestion that generic affected package checks execute tests was corrected to the parent before implementation. No affected-ci-run change is made. Remote CI is not run here.

Test and registration are written only. Build, runtime, type and lint checks wait for High's final source/API boundary and root's serial approval. High owns runtime source, and other owners' files are preserved. No dependencies, API, schema, lockfile, commits or pushes are added by this worker.

## Updated bounded manual-finite support

The parent subsequently fixed unsupported manual-finite combinations: grid and positive SSAO/contact/active DoF explicitly refuse with CLIP_INVALID; path-trace creation/pending/active work refuses with PATH_TRACE_UNSUPPORTED. Default auto and manual Infinity remain outside that finite-only guard. The first boundary group now uses SDK gridfalse/AOfalse and makes no grid-pixel claim.

Four further meaningful groups were written, still unexecuted: actual render/prepareCamera pre-submission effect refusals with zero/disabled/auto controls; initial and lazy-import path-trace refusal; async actual PathTraceSession creation/publication cancellation and once-only owned cleanup; actual active progressive session stop/dispose ownership. The fixture initializes pendingPathTraces0 and retains the actual source guard. A structural fake device controls compute-pipeline/work completion; the real session factory and guards are not replaced. This proves lifecycle decisions only after execution, never pixels/shader correctness.
