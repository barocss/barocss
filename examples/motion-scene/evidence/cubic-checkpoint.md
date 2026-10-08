# glTF cubic bake checkpoint — 2026-10-08

Issue: [#724](https://github.com/barocss/barocss/issues/724). Native parent: `7572948f8fabfa4c171c56c1ad1dcba9882ab885` (#721). Scope: `packages/barocss-motion/**` and `examples/motion-scene/**` only.

## Executed evidence

- The affected `pnpm --dir packages/barocss-motion build:library` passed on its first run with Node 22.22.0. The two preceding compiled glTF and GLB probes passed after the shared importer refactor.
- The first `node examples/motion-scene/cubic-probe.mjs` attempt failed with ENOENT because the copied fixture retained a `motion-` temporary filename. The fixture names were corrected. The next run passed against the real Khronos InterpolationTest JSON and binary data: five source rotation keys became 17 SLERP keys at four subdivisions per interval, duration 2 s, with a glTF-polynomial value at 0.125 s near `[0,0,-0.0576771314,0.9983352886]`. Original source bytes were unchanged. A synthetic two-channel fixture produced 750 mm translation and scale `[1.625,1.625,1.625]` at 0.5 s. Invalid subdivision and cubic accessor count refused.
- Headed Chromium loaded `cubic-demo.html` from a repository-root server on port 52219. At 0.125 s, the drawn box was rotated and the owned pose readout showed `[0,0,-0.0576771,0.9983353]`; [quarter screenshot](cubic-quarter.png). The old import API then refused the same cubic source with `UNSUPPORTED` while the 0.125 s pose stayed visible; [refusal screenshot](cubic-refusal.png). Playwright console: zero errors and warnings.

## Boundary

The v0 clip reproduces the evaluated glTF cubic at baked keys and approximates it between them. This checkpoint does not establish a uniform error bound, general glTF compatibility, native spline storage, Viewer adoption, Integration adoption or release acceptance.
