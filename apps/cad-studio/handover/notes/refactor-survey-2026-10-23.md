# Refactor survey (Phase R0), 2026-10-23

This was a read-only survey at `3ae4c8d85`; nothing was run. Line numbers are as of that commit, and each lane
rechecks them before acting. The owner asked for this pass for three reasons: code laid out flat is hard to find,
similar logic is duplicated, and UI code concentrated in one component hurts rendering.

The roadmap's Phase R table lists the steps. This file gives the evidence behind them.

## Rules for every R step

- **No behaviour change.** Keep refusal texts, error `name`s, `instanceof` and floating-point operation order
  identical. Merge only copies that are byte-identical in behaviour; zero-vector, −0 and degenerate-normal variants
  stay separate.
- **Import paths keep resolving:**
  - cad-model exports `./*`, so every src file is public. A moved file leaves a one-line `export * from` at its old
    path.
  - The kernel exports only `.`. Kernel importers point straight at the new paths, and basenames stay unique.
  - gpu exports only `.` and `./viewer`. Fix the deep `dist/` paths in tests and examples in the same commit.
- **Each step is its own checkpoint:** the touched package suites, tsc and lint. The full coordinator window and the
  full flow run at the end of the phase.
- **Measure, don't keep artefacts:** record render counts and frame times in the decision logs, never as evidence
  files.
- **Hot paths** keep no closures or nested functions, which the optimisation steps also enforce.

## Kernel, `packages/barocss-cad` (kernel lane)

**Layout:** 381 files, about 98k lines, all in a flat `src/`.

**What a move breaks:**
- External consumers import only `'@barocss/cad'`, so they are safe. `tsconfig` (`rootDir: src`) and eslint
  already cover subfolders.
- Deep paths break:
  - 92 tests import 59 modules as `../dist/<name>.js`;
  - 8 tests read `../src/<name>.ts`;
  - the esbuild entries in `scripts/*-test.mjs`;
  - 169 `examples/cad-nurbs/*.mjs`;
  - 7 files in `packages/barocss-cad-interop`;
  - 37 `apps/library-docs/scripts`;
  - `apps/library-docs/evidence/public-api.json`, which must be regenerated.
- **Trap tests:** 20 tests bundle `dist/modeling.js` and assert an exact module allowlist and count
  (`test/modeling-circular-pattern-four.test.mjs:14,32,90-104`).
  - A re-export stub, or a new helper inside the modeling closure (74 modules), fails them.
  - Update `pureModules` in the same commit (a test-only edit).
- **Import cycles:** there are 21. The largest is `part-model` ↔ bearing/connector/drive/fits/oring/shaft/shaft-parts,
  through `evaluateCadPart`.
- **Unreachable from `index.ts`:** 17 `*-v1` files.

**Proposed folders (file counts):**

| Folder | Files | Folder | Files |
|---|---|---|---|
| planar-solids | 52 | sketch | 49 |
| exact-proof | 33 | nurbs/curves | 27 |
| nurbs/surfaces | 20 | features | 19 |
| paired | 19 | brep | 18 |
| machine | 17 | mesh | 16 |
| intersect | 15 | core | 14 |
| nurbs/source-wide | 14 | translated-strip | 13 |
| modeling | 12 | document | 9 |
| blend, io, language, frame-sheet | 7 each | part | 1 |
| root | 5 | | |

**Duplications, largest first:**

1. **Own-data admission boilerplate.** `snapshot` appears in 158 files, `record` in 166, `check` in 182. Budgets
   differ, for example `affine-geometry-transform.ts:71` against `curve-wide-adaptive-sampling.ts:124`. The target is
   `core/own-data.ts`, with a budget object and messages kept byte-identical. Roughly 4k lines.
2. **vec3 copies while `vec3.ts` exists.** Examples: `brep-check-geometry.ts:291`, `brep-mass-quadrature.ts:44`,
   `convex-distance.ts:7`, `mesh-brep.ts:124`, `shaft-parts.ts:66`, `sheet-flat.ts:63`, `sweep-solid.ts:25`,
   `thicken-solid.ts:23`, and `brep-tessellate.ts:520,1067`, which already imports vec3. Not `connector.ts:89`,
   which has no `||1`.
3. **Checked arithmetic.** `finite/check/product/cross/dot` is identical in 13 files, and the
   `check→requireCurveValue` form is in 13 more. The target is `intersect/checked-arith.ts`.
4. **Gauss–Newton point-to-surface inversion.** Found in `brep-tessellate.ts:791`, `rolling-ball.ts:47`,
   `surface-intersection.ts:28`, `brep-mass-quadrature.ts:50`, `analytic-boolean.ts:82`, `facet-boolean.ts:302` and
   `subd-sd2.ts:545`. Share only a closure-free step kernel; each caller keeps its own loop and tolerances.
5. **Golden-section search, about 30 inline copies.** The constants differ (0.382, 0.381966, …). Merge only sites
   with identical constants; `brep-bounds.ts:27 goldenMax` exists.
6. **Gauss–Legendre.** `brep-mass-quadrature.ts:77` and `loft.ts:49` go to `core/quadrature.ts`. Leave the
   hard-coded tables.
7. **Perpendicular frame** `|n0|<0.9 ? cross(X,n) : cross(Y,n)`. The identical copies (`analytic-boolean.ts:638`,
   `edge-finish.ts:532,546`, `general-shell.ts:176,222,393`, `region-shell.ts:149`, `surface-revolution.ts:48`) go to
   vec3 `perpendicularUnit`. Variants stay.
8. **JSON and size admission.** `admitJSONText` ×8, `scanJSON` ×6, `jsonSize` ×5, `fileSize` ×13, UTF-8 `bytes`
   ×10. The target is `core/json-admission.ts`.
9. **Knot and parameter helpers.** `guardKnots` is identical in 5 files and `mapParameter` in 5. `same` is redefined
   in 26 files while `structural-equality.ts` exists.
10. **Whole-file templates.**
    - The four `convex-planar-*-internal.ts` files (65 lines each, about 24 lines differ) become one factory.
    - Near-twin pairs: `paired-surface-uv-split-faces` and `-b-uv-`, `xy-polygon-prism-ray-query` and
      `-shell-hole-`, `vlinear` and `multispan-vlinear`.

**Split seams:**
- **`part-model.ts` (4480):** split its `operation()` switch (1317-2450) by family. The rest divides into frames and
  weldments (2604-3589), beads and moves (3589-3935), shell (3989-4272) and finishes (4272-4445).
- **`analytic-boolean.ts` (1855):** surfaces, intersections (`cutPair` 503-867), classification, face split, merge,
  stitching.
- **`modeling.ts`:** option admission (257-773), then `createCadModel` (773-1104).
- **`rolling-ball.ts`:** the station solver, then the ring fillet (482-901), then corner and cliff (902-1424).
- **`edge-finish.ts`** and **`brep-tessellate.ts`:** ear-clip (28-265), the fast paths, then freeform (790-1061).

**Optimisation suspects (hot paths):**
- `rolling-ball.ts:95-110` (`solveStation`, and likewise `solveCorner`/`solveCliff`) builds 8 `.map` closures per
  Newton iteration. `:29-46` partials allocate 5 or more vectors each.
- `brep-mass-quadrature.ts:53-73`: a missed hint maps and sorts 625 grid points to take the 4 nearest.
  `brep-tessellate.ts:806` already does an insertion pick.
- `surface-intersection.ts:110-125` tests triangle pairs all-against-all (about 1.3M at grid 24), although
  `triangle-bvh` and `facet-bvh` exist. `onBoth` (`:44-55`) allocates through closures.
- `brep-tessellate.ts:887-918`: the refinement loop allocates edge arrays and closures per triangle.
- `analytic-boolean.ts:1364`: `nearestOn` uses a distance closure.

## cad-model, `packages/barocss-cad-model` (outer lane)

**Layout:** 249 files in 18 folders. Every file is a public path.

**Structure problems:**
- **`chat/` is too fat:**
  - `engine/doc.ts:8-11,415,417` imports document-schema types from chat/brief, drafts, proposals, questions,
    references and spec;
  - chat/analysis is used by mould/print/team;
  - chat/trace is image tracing.
- **Inverted layering:** `engine/shopRows` imports `chat/rowSources`, and `engine/doc.ts:411-412` imports
  assembly/mates and assembly/flatten.
- **`team/` mixes concerns:** it holds BOM files and the leaf utilities sha256/digest/revision.
- **Thin or misplaced:**
  - `io/` holds only zip; the natural home for the dxf/pdf/svg/3mf/stl/container writers.
  - `standards/` and `subd/` each hold one file.
  - `rb9/` is a test harness inside the published src.
  - `library/alignment.ts` is an analysis.

**`chat/tools.ts` (1698):** R3 splits it as `chat/part/*` plus `toolKit.ts` and `toolDefinitions.ts`. The facade
stays, and the tools list and prompt must be byte-identical. Shared patterns to fold in:
- the sub-tool result adapter (446/452/457/829, with variants at 400/428/440);
- the part-scoped dispatch, written twice (403-420, 474-494);
- the v2 translation, run twice per call (355-357, 389-391);
- the person-row actions set_stock, set_frame_stock and set_frame_sections (1054/1082/1095);
- ranged number and vec3 checks;
- module-level `responseFormat`/`because` (817-823);
- the duplicate `insideRing` (330-331).

**Duplications:**

| | What | Evidence | Home |
|---|---|---|---|
| a | vec3 helpers in about 30 files | e.g. frames/sketch3d.ts:116, chat/references.ts:82, machining/cavities.ts:17 | engine/vec3 (check zero vectors first) |
| b | 2D polygon helpers | sketch/offset.ts:27,56, machining/cam.ts:44, print/layers.ts:112, engine/trim.ts:63 | engine/geom2 |
| c | `r3`/`r6`/`r9`, about 45 definitions | team/bomCore.ts:60, machining/*, casting/* | util/round.ts |
| d | Union of body bounds, about 18 loops | chat/observe.ts:44, machining/report.ts:48, mould/quote.ts:68 …; `boxOf` exists at app/mass.ts:25 | one `boundsOf` |
| e | Mass = volume × density, and the 2.7 rescale | app/mass.ts:7,13, chat/analysis.ts:30, robot/inertia.ts:18, team/bomCore.ts:23, engine/evaluate.ts:69 | one `bodyMass` |
| f | Two material registries, and the "part's single material" lookup | app/materials vs library/materials; machining/report.ts:33, mould/quote.ts:64, casting/report.ts:46 | library/materials |
| g | Row editors | engine/bearings, orings, rings, drives, connectors, fastenerRows, fits; frames/sections.ts:33 | generic `editRows` |
| h | Placement and rotation math | engine/doc.ts:568-587 vs assembly/mates.ts:81; engine/evaluate.ts:383; robot/dynamics.ts:100 | engine/placement.ts (also fixes engine → assembly) |
| i | Evaluate every instance | team/bom.ts:21-32 is identical to team/assembly.ts:84-95 | assembly/instances.ts |
| j | Re-implemented eigen | robot/urdfCheck.ts:125, robot/mjcfCheck.ts:83 | the kernel's `symmetricEigen3` |
| k | Unit tables, `isObj` ×9, vec3 guards | engine/stepUnits.ts:7, engine/meshImport.ts:7, sketch/dxfRead.ts:41 | util/units.ts, util/guards.ts |
| l | First-free-id loops | chat/assembly.ts:88, chat/drafts.ts:21,64, drawing/auto.ts:321, library/libraries.ts:122 | `nextFreeId`, keeping each prefix |

**Recomputation:**
- `engine/evaluate.ts:489-499` `placedOutputs` re-evaluates every visible instance from scratch on each
  `stepFor`/`brepsFor`. Two snapshots are taken in `brepsFor({made})` (481, 461).
- `evaluateDoc` and `evaluatePart` are the same function, and the `friendly` wrapper appears 5 times.
- `leafBodies` computes `frameGeometry` twice per frame (doc.ts:681-682), and evaluate.ts:158 does it once per member.
- Inconsistency to check first: `skeletonsNow` is applied in evaluateDoc, evaluatePart and evaluateVolumes, but not
  in partBreps, stepFor, stlFor, brepsFor or baseBodyFaces.

**Built-in standards-like tables (an owner decision, not part of R):**
- `FASTENER_SIZES` (app/fasteners.ts:44-52): ISO 4017/4762/10642/4032/7089/273, M3 to M12.
  - It drives tapped holes and drill sizes (app/commands.ts:371-418), threads (app/threads.ts:25), drawing tolerance
    (drawing/tolerance.ts:54,62) and machining holes (machining/holes.ts:112).
  - Person-supplied fastener rows cover only what is bought.
- `library/builtin/materials.json`: sand-casting allowances from NPTEL, die-casting thresholds from efunda.
- `library/builtin/enclosure.json`: per-thread-size boss and insert variants, M2 to M3.

## gpu, `packages/barocss-gpu`, and the studio viewport (GPU lane)

**Layout:** 98 of 115 files sit at the top level.

**Proposed folders:**

| Folder | Files | Folder | Files |
|---|---|---|---|
| core | 2 | scene | 19 |
| geometry | 18 | material | 10 |
| engine | 13 | native/lights | 8 |
| native/uv01 | 7 | mesh | 15 |
| boolean | 5 | | |

- Exports are only `.` and `./viewer`, and the studio imports only those.
- Moving files breaks the deep `dist/` imports in tests/mesh-packet, material-colour-f32 and gpu-compiler, and in two
  examples/gpu-scene flows.
- `src/engine-uv-material-wgsl.ts` is untracked and imported by nothing.

**`viewer.ts` (2301) split seams, with the facade kept:**
- resources: 168-228, 1112-1209, 1272-1399;
- mesh and object blocks: 229-388, 976, 1474-1503;
- pipelines: 731-975, 1433;
- clipping and caps: 549, 1579-1650, 2228;
- passes and frame: 1210-1271, 1400-1875;
- picking: 1897-2175;
- device loss: 2175-2227.

`shaders.ts` splits by program (common, surface, line, point, label, oit, grid, pick, output, mip).

**Code repeated in both studio renderers (`renderer.ts`, WebGL2, line ↔ `gpuRenderer.ts`, WebGPU, line):**
- THEMES: 205 ↔ 35;
- direct looks: 353 ↔ 856;
- display-mode factors (x-ray 0.25, isolated 0.15, ghost 0.35, edge 0.9; dash [6,4] at 0.55; accent 0.2/0.42):
  790-871 ↔ 622-1027;
- face and edge state from ViewState: 610 ↔ 586;
- instance shape sharing: 560 ↔ 875;
- instance matrix: 593 ↔ 1042;
- scene bounds: 696 ↔ 780 (memoised only on the GPU side);
- the "has a curved face" test: renderer 729, gpuRenderer 729, silhouette.ts 9, 69;
- section and hatch: 647 ↔ 386.

All of it can move into one studio display-policy module.

**`Viewport.tsx` re-renders:**
- **Every animation frame:** `request()` calls `setTick` (449), which re-renders the whole Viewport.
  - Each pass re-runs the JSON keys (520-521) and the camera basis and pmi key (548-623).
  - It also rebuilds `overlay()` (1137-1357) and about 30 handlers, and gives ViewCube new props (1356).
  - Fix: move the tick into an overlay child component.
- **Print mode:** `{...sourceProps, bodies: [], selection: {...}}` (346) makes new identities on every App render,
  which re-runs `setBodies` and `setState` (483) and the effect at 518.
- **Overlapping effects:** the effects at 518 (13 dependencies) and 573 overlap, so `setState` runs twice per
  display-mode change.
- **Per frame and per hover:** `viewState()` builds a new Map (424).
- **Per pointer move:**
  - `vertexAt` projects every edge end (367).
  - Studio `camera.ts:123` rebuilds the view-projection on every `project`.
  - Fix: a cached projector.
- **From App:** the inline `onPickPole`/`onPickChain`, and `profiles={active?[]:…}` (App.tsx:2174-2178). Viewport
  is not wrapped in `memo`.

**App (from G8, G-R21):**
- **Pick:** 121–151 ms against a 90 ms budget. The whole App re-renders on selection: 63 ms in the outliner's 120
  instance rows (App.tsx:2309) and 20 ms in toolButton.
- **Ghosted orbit after a pick:** the App re-renders on every orbit step, with a second frame each time.

**Per-frame allocations:**
- **gpu viewer:**
  - per-caster offset arrays: 1740, 1747, 1655;
  - `packOutput`/`packFrame` without reuse buffers: 1724, 1479; lights.ts:132, 74;
  - `pipelineKey` built as a string per mesh, in the sort and per draw: 1443, 1422, 1531;
  - `.some` closures and `[a,b]` iteration arrays: 1591-1934;
  - `gridFrame` built twice: 1477, 1867;
  - outline arrays: 1679-1703;
  - `hidden()` inverts the view-projection per candidate: 2133.
- **gpuRenderer:**
  - the camera and lights objects every frame (650-683, 767);
  - `JSON.stringify` of the style per surface (740);
  - the hover `setState` closures, Maps and stringify (569-637);
  - `paintInstances` (1006-1020).
- **renderer.ts:**
  - the per-body `JSON.stringify` key (730) and the CPU silhouette recompute (734);
  - `forEach` closures (806, 844);
  - the bounds corner `.map` (705).

**Cross-package duplicates:**
- matrix math: viewer/math.ts, studio camera.ts:30-48, engine-scene.ts:177, cad-assembly.ts:154;
- bounds: renderer.ts:1148 ↔ bounds.ts:6, gpuRenderer.ts:71 ↔ bounds.ts:30;
- normals: renderer.ts:1156 ↔ geometry.ts:176, which differ on degenerate vertices;
- colour: renderer `hexRgb` ↔ lights `parseColor`;
- rays.

Near-copies inside gpu: directional vs point program-wgsl and webgpu-frame, translation vs scale clip, cylinder vs
cone geometry.
