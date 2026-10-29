# D319 actual Viewer SDK consumer plan

Plan recorded before execution. Final scoped PASS and its first fixture failure are recorded in README.md and
validation.json. The parent confirmed production source freeze and the serial heavy slot before execution. The High lane owns Presenter production changes and focused ownership/failure-path tests.

Use the existing `packages/barocss-viewer/tests/viewer-browser.test.mjs` HTTP/esbuild harness. It bundles this
worktree's actual `src/index.ts` and dependency source, then imports public `createViewer` in real Chrome WebGPU.
The app at `apps/cad-viewer` uses a separate server; this selected regression is the direct SDK path, not a claim
that every app interaction was exercised. No dependency installation, public telemetry, mock core or product patch
is used. The optional evidence output records every bundle input's real path and SHA-256 and rejects product source
outside the specified worktree. Existing audit `.omx/research` files are read-only and remain untouched.

The selected D319 case must fail rather than silently skip when Chrome, Playwright or a WebGPU adapter is missing.
Use Node 22.19.0, actual Chrome, DPR 1 and the serial heavy gate. From the Viewer package directory:

```sh
CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright \
VIEWER_D319_ARTIFACT_DIR=/tmp/d319-viewer-first \
node --test --test-name-pattern='D319' tests/viewer-browser.test.mjs
```

## Scope

- A public packet creates one actual visible square Surface. Real pixel readback and public CPU picking provide
  positive rendering controls. 64 rounds each perform orbit, pan and zoom, followed by real readback. Three direct
  setView changes and 16 packet replacements follow.
- Reuse the same packet and positions array, edit one corner, re-admit it and assert actual pixels change. This
  rejects an identity cache that hides authored in-place changes without claiming unsupported implicit mutation.
- Load the repository's genuine native weighted-curve example, hide its Surfaces through public visibility and
  fit the curve-only scene. Actual capture and public Curve pick must work. Perform 16 further orbit/readbacks.
- Load one native plane and use the public fixed-capacity 256-particle fluid frame as the existing dot-rendering
  route. Actual captured pixels must change. Perform 16 frame replacements/pans/readbacks and remove the layer.
- Every readback records retained Geometry Set size, Geometry with a non-null `gpu` upload and active Mesh count.
  The counts must equal active Geometry after each capture. Created, clear and disposed states must all be zero.
  Test-only TS-private fields are read; nothing hooks or replaces production callbacks.

Counts are logical retained/upload-object diagnostics, not driver bytes, VRAM, allocation pressure or natural OOM.
The browser cannot certify natural device loss/recovery or failure-path cleanup; those remain separate proofs.
Capture PNGs, raw count/frame receipt, browser errors, bundle source inputs and cleanup/exit records are retained.
The original audit baseline (one -> 33 after 32 orbit -> 36 at clear) remains original historical evidence. Whole
bundles must not be called identical merely because the index/Core files match; the archived original Presenter
and relevant source identity must also be checked. No whole suite, remote action or release is planned here.
