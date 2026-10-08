# GLB animation list checkpoint — 2026-10-08

Issue: [#732](https://github.com/barocss/barocss/issues/732). Native parent: `5213573ed868d83dbd72befcef44edc31807c2c9` (#729). Scope: `packages/barocss-motion/**` and `examples/motion-scene/**` only.

## Executed evidence

- The first affected `pnpm --dir packages/barocss-motion build:library` passed with Node 22.22.0. A second build after metadata admission refinements also passed. The existing compiled GLB and cubic GLB probes passed.
- `node examples/motion-scene/glb-list-probe.mjs` passed against the real Khronos InterpolationTest GLB. The list returned nine named animations in source order. Index 4 reported CUBICSPLINE rotation on node 4; feeding that discovered index and node into `bakeMotionGlbAnimation` yielded 17 keys and the expected 0.125 s quaternion. Changing a returned summary did not change a later list result; source bytes stayed identical. Long name, invalid sampler index, unknown target path and interpolation refused. A GLB without animations returned an empty list.
- Headed Chromium loaded `glb-list-demo.html` from a repository-root server on port 52249. It displayed all nine name/node/path/interpolation summaries; [list screenshot](glb-list-discovered.png). Selecting index 4 produced the owned 0.125 s pose `[0,0,-0.0576771,0.9983353]` and 17 baked keys; [selected screenshot](glb-list-selected.png). Playwright console: zero errors and warnings.

## Boundary

Discovery reads only bounded GLB animation metadata. It does not decode keyframe accessors or guarantee that another listed animation can be imported into a v0 clip. This checkpoint does not establish general GLB scene loading, Viewer adoption, Integration adoption, or release acceptance.
