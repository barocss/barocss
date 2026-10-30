# D325 baseline actual SDK clipping preparation

Status: **SOURCE_PREPARED; SYNTAX/LINT/BUNDLE/ACTUAL_NOT_RUN**. Root serial approval is required. Production remains baseline `d85558ce0031d812341d5871743f8535520eb8d4`; other workers own production and CPU tests. No source edits outside the new consumer harness.

Selected test: `packages/barocss-viewer/tests/clipping-contract-browser.test.mjs`. One selected test has three observations: control near0.01/far100, near7/far100, near0.01/far5. It uses the existing SDK source-esbuild/loopback workflow at 320 by 240, DPR1, mmToSceneUnit1, eye[0,0,6], target[0,0,0], fovY45.

The original audit/audit_patch fixture is a public authored packet: square z0, positions±1, four vertices, two triangles, normals/parameters/bounds. It is not an actual user sample file or Studio UI-produced document. Public setPackets/setView/readPixels/pick run on actual SDK/native WebGPU; no GPU, geometry acceptance, result or application stage is mocked. The source bundle uses current worktree SDK source, not a stale dist build. Four critical source hashes and the single bundle hash/input count are sufficient small binding; no repeated broad input provenance inventory.

Persist each original camera request, actual covered pixel count, center RGBA, complete public CPU hit and PNG before assertions. The control must really display and hit at distanceScene6; failed control is setup failure and stops the case. Record both near/far mismatches before checking safe assertions: the excluded square should not display and public CPU pick should be null. Expected baseline safe-contract Node failure after all observations is a product reproduction, distinct from a setup failure. Historical 9600/[51,138,201,255] are not fixed current PASS oracles. Same coverage/center does not establish full pixel-byte equality.

Public pick is the SDK CPU path. Internal GPU pick remains NOT_RUN here. No private Core camera inspection is needed; in particular, JSON-null is not interpreted as runtime far=null or Infinity. Missing adapter is explicit SKIP, never native PASS. Preserve original raw log/receipt and all three actual PNGs, exact driver capsule and small source profile. Close only owned Viewer/context/browser/server and return gate; no dependencies, full suite, commit or push.

Proposed serial commands after root approval (Node22 PATH, existing Chrome/PW_DIR):

```sh
node --check packages/barocss-viewer/tests/clipping-contract-browser.test.mjs
node node_modules/eslint/bin/eslint.js packages/barocss-viewer/tests/clipping-contract-browser.test.mjs
CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright VIEWER_D325_ARTIFACT_DIR=/tmp/d325-clipping-baseline-first node --test packages/barocss-viewer/tests/clipping-contract-browser.test.mjs
```

The final command performs exactly one source esbuild bundle plus one selected native browser test/three observations. Raw outputs/exits will use `/tmp/d325-clipping-baseline-first*.txt`; artifacts `/tmp/d325-clipping-baseline-first/`. No command above has run yet.
