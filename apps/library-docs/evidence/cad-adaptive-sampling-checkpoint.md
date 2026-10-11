# CAD adaptive sampling checkpoint

The first synchronous browser flow completed. It also produced three browser-control deadline failures. The responsive Worker implementation is final, and root generated its browser module. The affected Worker development-browser checks passed. The second production build and docs check passed. These states are separate.

## Existing CPU result

The first focused Node consumer passed. Its unchanged receipt is `cad-adaptive-sampling-consumer.json`: 791,994 bytes, SHA-256 `61d6fb9314c433f70618aad5e29f0d89dadb026f33d8f5901a77f1bf1e05bd6d`. This checkpoint did not run that consumer again. The whole validator cold reconstruction is separate from each sampling construction's direct counts. The application made no additional D0/D1 calls for drawing.

## First synchronous browser observations

Root session `01a12561-ce8c-7ce0-9284-535e6ceb4daa` supplies the existing observations. The JSON receipt retains timestamps, log lines, original output text and extracted `adaptive-*` receipts.

- Tab 45 startup: `Runtime.evaluate` reached the 3,000 ms control deadline. A later read observed ready=true, tolerance 0.05 mm, 27 segments, 28 points, depth 5 and both negative-zero witnesses true. The displayed full report had 1,231,507 characters. This later read was not a repeated computation.
- Tab 46 startup after the UI summary change: the same 3,000 ms deadline occurred. A later read observed ready=true, 27 segments and 28 points. The smaller report had 52,604 characters. The size reduction does not prove that payload size was the sole startup cause.
- Coarsen to 0.2 mm: 14 segments, 15 points and depth 4. Complete native Model/Curve retention, exact source retention, unchanged projection, source-editor alignment and both signed-zero witnesses were true. The host native comparison uses recursive `Object.is`; the separate displayed Curve comparison used JSON text and does not itself prove signed-zero retention.
- Tolerance 0 produced actual INPUT refusal. Segment budget 2 produced actual BUDGET refusal. Both preserved the exact accepted displayed report. Browser warn/error logs were empty at the recorded refusal check. No separate frame-byte retention comparison is claimed by these synchronous receipts.
- One Reset click reached the `Input.dispatchMouseEvent` deadline. A later read observed ready=true, tolerance 0.05 mm, 27 segments, 28 points, both signed-zero witnesses true and no alerts. Reset was not clicked again.
- The CAD screenshot attempt logged clip metadata, but no image file was saved. It is not an accepted image artifact.

These are browser-control failures with later completed numerical state. They are not silently discarded and are not recast as failed native candidates.

## Worker implementation and bundle

The separate immutable source remains `733428030029a65797c26e3daadcae94c4762b09`, with 204 manifest/source blobs. The old gallery pin remains `5f5ad866205a21510ac69552e704cc162fa253b5`. Root's browser-only module generation recorded 202 own source inputs and zero dist inputs from the Worker metafile. The main app closure has zero CAD source inputs. The embedded Worker is 170,963 bytes; the main browser module is 190,255 bytes. Exact root provenance and implementation hashes are in the JSON receipt.

Only `sampleSourceCurveAdaptive` executes in the application Worker. The Worker parses the same complete request and transfers the complete returned value by structured clone. Inputs, tolerances, caps, full accepted data and negative zero remain unchanged. The main thread uses the same projection and stages its Canvas2D drawing before adoption. The UI view still omits heavy span/subdivision audit arrays; the complete accepted result and unchanged CPU receipt retain them.

The factory, update and actions return Promises. Request generations prevent stale candidate adoption. Logical cancellation rejects a pending Promise and ignores its later response; it does not stop a queued synchronous computation. Disposal terminates the Worker, rejects pending requests, removes listeners and revokes the Blob URL. Initial creation failure uses the same cleanup. Actual public error name/code/message are relayed into an ordinary main-thread Error. No cross-realm public `instanceof` claim is made.

Node 22 syntax checks and scoped whitespace checks passed before root regeneration. This extraction performed no API execution, CPU replay, build or browser operation. The actual Worker development-browser receipts are now recorded below. The selected production receipts are recorded below. Selected compute milliseconds measure only the public sampling call; they do not measure startup, cloning, drawing or benchmark performance.


## Affected Worker development-browser result

Root ran one affected flow in tab 48. This extraction did not repeat it. The `adaptive-worker-dev-*` receipts and original text are retained in the JSON file. No Runtime.evaluate or Input.dispatchMouseEvent deadline occurred in this selected flow.

- Initial: ready=true, 0.05 mm, 27 segments, 28 points, depth 5 and both signed-zero witnesses true. The displayed report had 53,092 characters.
- Coarsen: 0.2 mm, 14 segments, 15 points, depth 4. Complete native Model retention, exact source, Curve, projection and editor alignment were true. Both signed-zero witnesses remained true.
- Tolerance 0 relayed actual INPUT refusal. Max segments 2 relayed actual BUDGET refusal. The entire accepted displayed report remained identical after each refusal.
- One Reset click returned while ready=false. The editor had the initial 0.05 tolerance and Reset was enabled. A later read observed ready=true, 27 segments, 28 points, both signed-zero witnesses true, no alerts and no warn/error logs. No repeated Reset was used.

Selected sampling-call measurements were 3949.5999999940395 ms initial, 1121.9000000059605 ms coarse and 4076.5999999940395 ms after Reset. These measure only the public call inside the Worker. They exclude startup, cloning and drawing and are not benchmark results. Application message ledgers are separate from provider direct counts.

Root saved the actual coarse browser output as `docs/public/examples/cad-adaptive-sampling.jpg`, 462×303 pixels, 14,300 bytes, SHA-256 `3079b2cea31ec136b9e6ec0add4f412e02aa951e3fb2d792da2ba59325caab89`. The prior synchronous image attempt remains unsaved; it has not been replaced with a success claim. Worker disposal is source-backed only. This flow does not provide instrumented termination or resource-release proof. The production result is recorded below.


## Final production result and first catalog failure

Root's first build passed in 13.94 seconds. Its docs check failed: `Example catalog: runtime label/anchor differs: viewer-display-pose`. Root corrected only the two catalog labels and stopped preview session 73846 before rebuilding. The second build passed in 13.78 seconds. The second docs check passed: 109 pages, 684 internal links, 56 images, 3 downloads, 44 presets (API 11, language 32, integration 1), 13 generated modules and 12 matched package manifests. The first failure remains in the JSON receipt.

The actual source and built CAD JPEG bytes matched: 14,300 bytes and SHA-256 `3079b2cea31ec136b9e6ec0add4f412e02aa951e3fb2d792da2ba59325caab89`. Old preview 9266 and dev 85217 were stopped before the build. Final preview session 33589 on port 52948 is protected.

Root's selected production flow used tab 49. Async navigation first observed the selected CAD example with ready=false while the previous `cad-curve` hash was still present. The later initial receipt observed `/examples/library#cad-adaptive-sampling` and ready=true. This is eventual navigation completion, not an immediate hash-change claim.

- Initial: 27 segments, 28 points and both signed-zero witnesses true. Selected Worker sampling took 4000.7999999821186 ms.
- Coarsen: 0.2 mm, 14 segments, 15 points, complete native Model retention true and both signed-zero witnesses true. Selected sampling took 1120.300000011921 ms.
- Tolerance 0 produced the actual INPUT alert. The entire displayed accepted report remained identical; warn/error logs were empty.
- Guide navigation succeeded. At the 390 px mobile viewport, the image loaded at 341.9921875 px wide with natural size 462×303. Body width and scroll width were both 390 px. The guide's return link selected the CAD adaptive example.

The production receipts do not claim a repeated BUDGET or Reset check; those operations passed in the separate affected development flow. Timings measure only the selected public sampling call and are not benchmarks. This checkpoint provides no instrumented Worker termination/resource-release evidence, Root-global runtime proof or Integration runtime acceptance. Extraction only: no API, CPU, build or browser replay was performed to write these files.


The live CAD example also completed at the 390 px viewport: ready=true, canvas 316×207.375 px, body width and scroll width both 390 px. The first unscoped “Browse the catalog” locator matched two real links and refused the click in strict mode; no navigation occurred. Root then scoped the link to `.visual-examples` and opened the catalog (44 of 44). Searching Viewer showed 1 of 44 with `/examples/library#viewer-display-pose`; its link returned to an actually ready Viewer example. This selector failure and its correction are retained separately from the sample's successful layout. Root restored the viewport. Final tab 49 shows Viewer, and preview 33589 remains protected.
