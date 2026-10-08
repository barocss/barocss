# Issue 662 Motion clip file checkpoint (2026-10-08)

Parent: `db0b803a70ecbd050d78b71723a465d87fa581e3` (#659). This child edits only `packages/barocss-motion/**` and `examples/motion-scene/**`.

## Actual commands

- `PATH=/Users/user/.nvm/versions/node/v22.22.0/bin:/Users/user/.barocss-ai/v3/integration/node_modules/.bin:$PATH pnpm --dir packages/barocss-motion build:library` exited 0 on the first attempt. `tsc` emitted declarations and esbuild emitted `dist/index.js` (19.6 KB).
- `/Users/user/.nvm/versions/node/v22.22.0/bin/node examples/motion-scene/clip-file-probe.mjs` exited 0 on the first attempt. It wrote the 1,111-byte `assets/two-parts.baromotion`, then started a separate Node process that read the file from disk through the compiled package. The cold consumer observed six tracks, target order `part-a`, `part-b`, authored negative zero at start, part A translation `[-25,10,0]` and part B scale `[0.825,1.2,0.825]` at 2 s, and a negative authored part B quaternion endpoint at 4 s. Canonical text survived parse and reserialize byte for byte.
- The probe rejected bad envelope version, unit and frame, escaped duplicate JSON field, nonfinite number, oversized file and a getter-bearing clip. Getter call count stayed zero. The existing player's 2 s state remained unchanged after each refusal.
- `python3 -m http.server 52129 --bind 127.0.0.1` served `http://127.0.0.1:52129/examples/motion-scene/file-demo.html` from this child worktree. The parent demo on port 52119 remained HTTP 200.

## Actual browser file flow

- Separate headed Chrome Playwright session `motion662` loaded the real `.baromotion` file. The page reported ready with context `sample-assembly` and two unchanged target IDs.
- Browser Save emitted a download event named `two-parts.baromotion`. Playwright saved the download to `/tmp/barocss-motion-662-downloaded.baromotion`. `cmp -s` against the producer asset exited 0; both were 1,111 bytes. This establishes one actual browser download saved on the local host.
- The browser Open control selected that downloaded file. Status reported a validated clip, time 0, target IDs `part-a` and `part-b`, and `Object.is(partA.translation[1], -0) === true`.
- Clicking the 2 s button after Open produced part A translation `[-25,10,0]`, quaternion `[0,0,0.7071067811865475,0.7071067811865475]`, scale `[1.25,0.875,1]`, and part B translation `[30,20,0]`, scale `[0.825,1.2,0.825]`. The actual frame is in [file-open-midpoint.png](./file-open-midpoint.png).
- Importing `wrong-context.baromotion` reported `This scene needs context sample-assembly`; importing `unknown-target.baromotion` reported `This scene needs exact part-a and part-b TRS tracks`. Both left the prior 2 s time and part A translation `[-25,10,0]` intact.
- Play in repeat mode showed `playing=true` at `timeSeconds=3.5004999999999953`; Pause later showed `playing=false` at `timeSeconds=2.8339999999999956`. Browser console reported 0 errors and 0 warnings.

The core codec is pure text/data. File IO, Blob/download, File Open, host identity binding, time source and Three.js drawing belong to the reference consumer. This checkpoint does not establish native GPU/Loader adoption, alternate renderer support, broad validation, professional precision or registry publication. No first build or runtime failure occurred in this child flow.
