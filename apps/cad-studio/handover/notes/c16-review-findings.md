# PERF3 C16 — read-only review findings (two agents, 2026-10-18), condensed

What was done is in decisions.md D82 § C16; this file is the rest, for C17 or later.

## Per-frame allocations (microseconds each; GC hygiene)
- viewer.ts:
  - `waiters.splice(0)`; the `{box}` object and `unionBox` per mesh in `sceneBounds`;
  - `clip`/`viewProjection`/`basis` small arrays;
  - `gridFrame()` called twice a frame;
  - `frustumPlanes` (Float64Array(24) + map closures);
  - transparent `{m,d}`, the key Map, `pipelineKey` template strings (also per mesh per pass in `drawMesh`);
  - `shadowFrame` filter/slice/find;
  - `packFrame` new buffers twice a frame (keep two and `fill(0)`);
  - `packOutput` ArrayBuffer and spreads;
  - `occlusionFrame`;
  - pass descriptors;
  - `setBindGroup` offset arrays per mesh per pass (a scratch Uint32Array);
  - `Mesh.pack` per dirty mesh.
- gpuRenderer.ts:
  - `eye()`, `[...target]`;
  - `bounds()` with its `grow` closure;
  - `lights()` (`toward` closure, maps);
  - the environment object every frame.
- Viewport.tsx: `setTick` re-renders the whole component every frame; `viewState()` makes a new Map every frame.

## Nested functions on hot paths (C17 list)
- **Per frame:**
  - viewer.ts:789 `run`; :868–871 the map and sort comparators;
  - lights.ts:123 forEach;
  - bounds.ts:63–67 `row` and maps;
  - gpuRenderer.ts:261 `toward`, :319 `grow`, :278 map;
  - Viewport.tsx handlers recreated by the per-frame render;
  - CageMarks: done in C16.
- **Per pick:**
  - geometry.ts:181 `rayTriangles`' `test` closure, and :177's spread bounds array;
  - viewer.ts:1196 `invert(multiply)` per instance per raycast;
  - Viewport.tsx:211 `vertexAt` (`[e.a, e.b]` and `project` arrays), :236 `nearestSnap`.
- **Per element:**
  - geometry.ts:99 `vertexNormals`' `at` (about 7 arrays a triangle); :145/148/155 the BVH build `tb.set([...])` and `reduce`; :280 `f.set([...])` per segment;
  - engine/mesh.ts:113–114 `pair`/`near` (the real cost is `edges.find`, O(E²)); :68 `groups.set(r, [...old, id])`, O(n²);
  - subd.ts:250/263 `netOf`'s `pt`/`mirror` per quad; :396 `avg`; :329 `keyAcross`; :311 `vertexAt`;
  - subd-sd2.ts:104/106/123–125/130 `fanOf`'s find/every/flatMap; :146/148/180 `refine`'s add/map/forEach and label strings; :609/612/623/625 `limitGrids`' local/forEach/reduce; :403/409–416/419/421/424 `capsAt`'s formAt/gridOf/polesOf/flatMap/deviation; :561 `closestOnCap`'s `dist` (report only);
  - subd-cage.ts:23/55/62/64/74 `cageTopology`/`validateCage` template keys, some/filter, `[w1, w2]` in `fanSize`;
  - subd.ts:91 `twoIrregular`'s filter.

## SubD cold build (open)
- `limitGrids` 38 ms a cold build (2k cage):
  - `sectorSizes` only for crease/corner;
  - refine without labels;
  - reduce → loops.
- `closestOnGrid` 14 ms (pack G into a Float64Array(147)).
- `fitWithin` 9 ms (`xp` the same in all 4 rounds).
- `formAt` 7 ms (one mutable Form).
- `assemble` 12 ms warm (`clamp`/`insert` knot arrays; `netOf` per quad).

## Other
- render_views section: the probe evaluates with mass (about 500 ms of 1.5 s), which views never read.
- STEP: the Value objects are most of the rest of parse time.
- `checkLibraryForSharing` re-runs `loadCadLibrary` on a loaded manifest and builds every part×variant cold (tslot 215 ms, enclosure 430–480 ms per share click).
