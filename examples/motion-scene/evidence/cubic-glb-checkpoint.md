# GLB cubic bake checkpoint — 2026-10-08

Issue: [#726](https://github.com/barocss/barocss/issues/726). Native parent: `7e99761232cbd177a6caf7ab02146d927f187f1e` (#724). Scope: `packages/barocss-motion/**` and `examples/motion-scene/**` only.

## Executed evidence

- The first affected `pnpm --dir packages/barocss-motion build:library` passed with Node 22.22.0. The existing compiled glTF, GLB, and cubic probes passed after extracting the shared GLB decoder.
- `node examples/motion-scene/cubic-glb-probe.mjs` passed against the real 7,952-byte Khronos InterpolationTest GLB. Animation 4 on node 4 baked five source rotation keys into 17 SLERP keys over 2 s. At 0.125 s the quaternion was near `[0,0,-0.0576771314,0.9983352886]`. Source bytes stayed identical. The old GLB import API refused CUBICSPLINE with `UNSUPPORTED`. Damaged magic and header length received matching error codes and messages from both GLB entrypoints.
- Headed Chromium loaded `cubic-glb-demo.html` from a repository-root server on port 52229. At 0.125 s the fixed box rotated and the owned pose readout showed `[0,0,-0.0576771,0.9983353]`; [quarter screenshot](cubic-glb-quarter.png). The old GLB import API then refused the same file with `UNSUPPORTED` while the accepted pose stayed visible; [refusal screenshot](cubic-glb-refusal.png). Playwright console: zero errors and warnings.

## Boundary

The API reads caller-loaded GLB bytes. It uses the existing bounded decoder and #724 finite sample bake. Between baked keys, the v0 clip approximates the glTF cubic. This checkpoint does not prove a uniform error bound, native spline storage, general GLB scene loading, Viewer adoption, Integration adoption, or release acceptance.
