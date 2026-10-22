# BaroCSS CAD: three-layer boundary proposal (kernel, model, app) — 2026-10-21

**Status:** design input for roadmap item PKG (owner, 2026-10-21: "경계제안서 정리가 되면 그대로 정리하는 것도 로드맵에 추가 해서 진행해줘"; moves run only when both lanes sit at a track boundary). Read-only research by the coordinator's helper; no file in any checkout was changed. Evidence base: integration `review/cad-gpu-engine-2026-10-14` at `73aaf95a6`; outer lane at `07df217da` (plus `721b1569c`, IM3, which adds `src/mould/undercut.ts`). Method: `wc -l`; a pass over every import/export/`import()`/`new URL()` specifier in `apps/cad-studio/{src,server}` (236 files, 1,084 relative edges, type-only flagged); greps for React/DOM/storage/env use; strongly connected components of the import graph; root ESLint and `tsc --noEmit` run read-only.

## 0. Headline findings

1. **The split is clean.** Of 178 would-be model files only **12 import edges point from model into app code, all `import type`**: 11 from `sketch/*` (`SketchShape` etc. in `viewport/Viewport.tsx`) and 1 from `assembly/drag.ts` (`Axis3` in `viewport/gizmo.ts`). One server edge crosses into the UI: `server/cadCli.ts` imports `meshToStl` from `ui/files.ts`. No model file imports `react`, `react-dom` or `@barocss/gpu`.
2. **The kernel imports no studio code** (0 code imports); data/path couplings exist (§3.4).
3. **The model is one type cycle**: with type edges, 95 model files in 12 folders form one SCC, caused by `engine/doc.ts` importing record types from 12 domain modules. Value-only, the largest cycle is 9 files. Either move the 95 files in one step, or hoist `doc.ts`'s type imports first (step d).
4. **Geometry is duplicated across layers**: the kernel has a triangle BVH (`facet-bvh.ts`) and a BVH mesh distance (`mesh-distance.ts`); the studio has three more ray accelerators (`print/orient.ts` BVH, a uniform grid in `chat/analysis.ts`, a brute-force ray in `library/libraries.ts`), five point–triangle distance copies and three point-on-surface Gauss–Newton projections. Studio and kernel each export a `meshDistance` with **different meanings**.
5. **The model files are already lint-clean** under the root config (188 files, 0 errors/0 warnings); `apps/cad-studio` has no `lint` script, so they were never linted in CI.

## 1. Per-folder table (integration `73aaf95a6`; "model" = `packages/barocss-cad-model`)

| Folder | Files | Lines | React / DOM / env use | Target | Reason |
|---|---|---|---|---|---|
| `src/app/` | 22 | 3,315 | `localStorage` in `recovery.ts`, `templates.ts` | **model** (20 files, 3,234); `recovery.ts`, `templates.ts` stay in app | Commands as document transforms (`commands.ts` 725, `editFields`, `primitives`, `fasteners`, `measure` …). Rename to `commands/` on the move. |
| `src/assembly/` | 9 | 1,059 | `useAssembly.ts` React + `import.meta.env.DEV`; `faceClient.ts` `new Worker`; `faces.worker.ts` | **model** (6 files, 820); 3 stay in app | `mates.ts` (517), `flatten`, `faces`, `definitions`, `explode`, `drag` pure; `drag.ts` type-imports `Axis3` (B2). |
| `src/chat/` | 26 | 6,116 | `client.ts` fetch stream; `images.ts` canvas; guarded `process.env` in `toolset`, `groups`, `tools` | **model** (24 files, 6,009); `client.ts`, `images.ts` stay | Agent tool layer (`tools.ts` 1,365, `contract`, `groups`) plus records `doc.ts` uses (`brief`, `questions`, `references`, `drafts`, `spec`, `proposals`). `tools-v1/v2.json` go with `contract.ts`. |
| `src/drawing/` | 20 | 2,942 | `performance.now` only | **model** | Sheets, auto-dimension, issues, layout, PDF/SVG/DXF writers; `drawing.css` stays in app. |
| `src/engine/` | 27 | 4,343 | `client.ts` Worker URL; `engine.worker.ts`; `blobs.ts` `crypto.subtle`, `atob`/`btoa` | **model** (25 files, 4,099); `client.ts`, `engine.worker.ts` stay | `doc.ts` (680, StudioDoc), `evaluate`, `part`, `ids`, `references`, `rematch`, `migrate`, `container`, `mesh`. |
| `src/io/` | 1 | 60 | `Blob` + `CompressionStream` (Node ≥18 globals) | **model** | Zip writer. |
| `src/library/` | 4 | 550 | `globalThis.localStorage?` in `libraries.ts` (B4); `builtin/*.json` | **model** | Registry, materials, sharing, alignment. |
| `src/mould/` | 1 (2 on outer) | 180 (284) | none | **model** | `draft.ts` (IM2), `undercut.ts` (IM3, outer). |
| `src/print/` | 8 | 1,347 | `performance.now` | **model** | Rules, hollow, lattice, orient, overhang, split bed, 3MF. |
| `src/rb9/` | 14 | 1,192 | `performance.now` | **model** | RB9 ladder; `main.ts` is the Node entry for `scripts/rb9.mjs`. |
| `src/robot/` | 23 | 3,099 | none | **model** | Joints, FK/IK, dynamics, sweep, URDF/MJCF/SDF/USD. |
| `src/sketch/` | 19 | 2,581 | runtime none; 11 files type-import `SketchShape` from `viewport/Viewport.tsx` (B1) | **model** after B1 | Solver, loops, DXF read/write/underlay, trim, offset, osnap. |
| `src/standards/` | 1 | 104 | none | **model** | Provenance. |
| `src/subd/` | 2 | 399 | `useCageEditor.ts` React/events | `cageEdit.ts` (260) → model; `useCageEditor.ts` stays | |
| `src/team/` | 11 | 1,346 | `TextEncoder` | **model** | Team, bundle, baseline, ECR, freshness, sha256. |
| `src/ui/` | 29 | 3,178 | React (23 files); `files.ts` DOM | **app** | Panels; `files.ts#meshToStl` used by `server/cadCli.ts` (B3). |
| `src/viewport/` | 10 | 2,577 | React, `@barocss/gpu`, WebGL | **app** | `Viewport.tsx` (997) also owns the sketch state types (B1). |
| `src/` root | 2 | 2,456 | React, `document` | **app** | `App.tsx` 2,451, `main.tsx`. |
| `server/` | 7 | 1,057 | Node fs/http/child_process | stays at `apps/cad-studio/server`, depends on model only after B3 | `cadCli`, `cadMcp`, `cadDoc`, `chatServer`, `ab/`. |

Totals: model 178 files / 27,823 lines; app 51 / 9,021; server 7 / 1,057. Kernel: 357 files / 89,844 lines, 175 test files, 346 conformance JSON files.

## 2. Generic geometry to move down into the kernel (track K)

None needs StudioDoc. Where a function takes `DisplayMesh` it uses only positions/indices/bounds, so the kernel API takes `(positions, indices)` and must not learn `DisplayMesh`.

| # | Studio file / functions | Importers | Kernel equivalent | Recommendation |
|---|---|---|---|---|
| G1 | `robot/hull.ts` (92) `convexHull` (quickhull) | `App.tsx`, `chat/robot`, `rb9/captive`, `robot/urdf`; tests robot-* | none | Move as-is (no imports). |
| G2 | `robot/gjk.ts` (74) `convexDistance` | `robot/sweep`, `robot/workspace` | none | Move as-is with G1. |
| G3 | `robot/sweep.ts:178` `meshDistance` — exact least triangle–triangle distance, box-pruned O(n·m); private `pointTriangle`, `segSeg` | `chat/references`, `rb9/rungs-enclosure`, `team/assembly`, `robot/sweep` | kernel `meshDistance` is a **one-way largest** sample distance; `meshDistanceRange` samples A's vertices/centroids only | Add kernel `meshClearance(pa,ia,pb,ib)` (exact least, dual-tree on `mesh-distance.ts`'s tree); delete the studio copy. |
| G4 | `print/orient.ts:11–65` `TriangleBvh`, `buildBvh`, `rayHit`; `fibonacciDirections` | `chat/assembly`, `mould/undercut` | `facet-bvh.ts` `FacetBvh` has the same layout but a private builder per facet B-rep; `mesh-distance.ts` has another private tree | One kernel builder `triangleBvh(positions, indices)` used by `facetBvh(brep)`, plus `rayHit`/`nearest`. Reopens the coordinator's 2026-10-21 withdrawal (decided: reopened, as K2). |
| G5 | `chat/analysis.ts` private grid ray, `pointTriangle2`, `clearance`; exported `wallThickness`, `interference` | `chat/spec`, `chat/tools`, `print/rules` | no ray-thickness API | Keep `wallThickness` (BodyResult wrapper) in model; replace its grid with the G4 ray query. |
| G6 | `library/libraries.ts:313` `thicknessAt` brute-force ray | itself | none | Use the G4 ray query. |
| G7 | `print/hollow.ts` (310) voxel inside flags, depth bins, cavity SDF, marching tetrahedra, components; `planHollow` doc-level | `print/lattice`, `app/commands`; tests hollow, lattice, chord | none (`mesh-offset.ts` is a different method) | Move the grid/SDF/MT core to a kernel module on (positions, indices); keep `planHollow` in model. Largest item, last. |
| G8 | `print/lattice.ts` `meshVolume` (gyroid stays) | `app/commands` | tet volume exists on B-reps only | `meshVolume` goes down with G7. |
| G9 | `mould/draft.ts` private Gauss–Newton point-on-NURBS `foot()`, `normalAt` | `chat/analysis`, `print/rules`, `mould/undercut` | private Newton projections in `brep-tessellate.ts:720`, `offset-cavity.ts:856`, `rolling-ball.ts:47` | Export one kernel `closestPointOnSurface(surface, p, seed?)`; use it here, in `engine/trim.ts:18 nearest`, and in `engine/mesh.ts:266/286` (three studio copies). |
| G10 | `rb9/beam.ts` private Green's-theorem section integrals | `rb9/rungs-beam` | `frame-section.ts` closed forms per kind, no second moments | Kernel `polygonSectionProperties(loops)` (line segments); can cross-check `frameSection`. |
| G11 | `robot/inertia.ts` `symmetricEigen`, `rotateInertia` | 14 importers of the file | private `jacobi3` in `mesh-offset.ts:100` | Low priority: one exported 3×3 symmetric eigen solver. |
| G12 | point–triangle distance, 5 private copies (`app/measure:39`, `chat/analysis:54`, `robot/sweep:196`, `print/hollow:57`, `engine/mesh:248`) | — | private in `mesh-distance.ts` | One kernel primitive, folded into G3/G4. |
| G13 | `engine/fit.ts` interpolation, LSQ, knot removal | `engine/direct` | certified interpolation exists; no LSQ/knot removal | Equivalence check first. |
| G14 | `engine/trim.ts` `projectLoop`, `trimmedMesh` | `engine/direct` | unclear | Investigate later; `nearest` folds into G9. |

`engine/geom2.ts` (20) and `engine/vec3.ts` (12) stay in model.

## 3. Dependency map (relative imports, `73aaf95a6`)

| From → To | Edges |
|---|---|
| model → model | 722 |
| app → model | 216 (42 app files) |
| app → app | 84 |
| server → model | 34 (19 model files) |
| **model → app** | **12, all `import type`** |
| **server → app** | **1** (`cadCli.ts` → `ui/files.ts`) |

External: `@barocss/cad` 51 files (40 model, 10 app, 1 server); `react` 29 (all app); `@barocss/gpu` 3 (`ui/RenderPanel.tsx`, `viewport/gpuRenderer.ts`, `viewport/analysis.ts`).

Worst app→model importers: `App.tsx` 82, `ui/DrawingWorkspace.tsx` 19, `viewport/Viewport.tsx` 15, `ui/ChatPanel.tsx` 7. The app uses **107 distinct model files** (top: `engine/doc` 21, `evaluate` 12, `mesh` 10, `chat/tools` 7) → use subpath exports (`"./*": "./src/*.ts"`), not one barrel. Model hubs by fan-in: `engine/doc` 80, `evaluate` 47, `mesh` 23, `ids` 20, `assembly/mates` 19, `library/materials` 17.

Kernel → studio: 0 code imports. Path couplings: `packages/barocss-cad/test/fr-1.test.mjs:111` reads `apps/cad-studio/src/library/builtin/tslot-20.json`; `scripts/{urdf,mjcf,loop}-oracle.py` name `apps/cad-studio/scripts/cad-cli.mjs` in usage text; 32 conformance JSON `about` strings name studio test paths.

Cycles: one 95-file type SCC (chat 17, drawing 16, app 14, robot 12, engine 9, team 7, sketch 7, print 6, assembly 3, library 2, standards 1, mould 1) bridged by `engine/doc.ts:4–12, 263–273`. Value-only: one 9-file cycle (`app/bodies`, `app/commands`, `assembly/faces`, `chat/references`, `engine/evaluate`, `print/{hollow,lattice,splitBed}`, `robot/inertia`) and three 2-file cycles. Partition: 41 files (5,013 lines) don't reach the SCC; 95 are in it (19,233); 42 depend on it (3,577).

## 4. Blockers and the smallest cut

| ID | Where | Cut |
|---|---|---|
| B1 | `viewport/Viewport.tsx:30–75` sketch state types | Move to new `sketch/types.ts`; `Viewport.tsx` re-exports. |
| B2 | `viewport/gizmo.ts:9` `Axis3` | Declare in `assembly/drag.ts` or `engine/vec3.ts`; gizmo imports it. |
| B3 | `ui/files.ts` `meshToStl` used by `server/cadCli.ts` | Move to `engine/mesh.ts` or new `io/stl.ts`; `downloadBytes` stays. |
| B4 | `library/libraries.ts:61–74` `localStorage` save/load, built-ins registered at load | A `LibraryStore {get,set}` set by the app (`setLibraryStore(localStorage)`); default none. |
| B5 | guarded `process.env` in `chat/toolset.ts:12`, `groups.ts:129`, `tools.ts:412,968,999,1010` | Keep; model tsconfig `types: ["node"]`. Later a `ChatConfig` passed by `server/*`. |
| B6 | `useAssembly.ts` `import.meta.env.DEV`, Worker URLs | Already app-only; leave. |
| B7 | `chat/images.ts` canvas, `chat/client.ts` fetch | App-only; `chat/trace.ts#traceImage` (pure) moves. |
| B8 | `app/templates.ts`, `app/recovery.ts` localStorage | App-only; leave. |
| B9 | `subd/useCageEditor.ts` | App-only; `cageEdit.ts` moves alone. |
| B10 | module-global state: `engine/blobs.ts:17`, `assembly/faces.ts:64`, `library/libraries.ts:30`, `engine/evalMemo.ts:15–25` | Import the model only by package specifier; no re-export shims (second module ID). |
| B11 | tests importing pure functions from `.tsx` (`ui/CutListDialog#cutText`, `ui/ParametersPanel#parameterUses/renameParameter`) | Optional: move into model and re-export. |

`performance.now`, `TextEncoder`, `crypto.subtle`, `btoa`, `Blob`, `CompressionStream` are Node ≥18 globals — not blockers.

## 5. Move order (each step keeps every suite green; one at a joint track boundary)

Suites: studio `pnpm test`; contract (`test/tool-contract.test.ts`, `test/toolset.test.ts`, v2 replay); kernel `pnpm test` + `test/conformance.test.mjs`; flow `test/browser-flow.mjs` (run alone); types `tsc --noEmit` in app and package.

| Step | What | Moved / touched | Covered by |
|---|---|---|---|
| **PKG-a** | Empty `packages/barocss-cad-model` (`@barocss/cad-model`, private, `type: module`, `exports: {"./*": "./src/*.ts"}`, dep `@barocss/cad: workspace:*`, devDeps typescript, @types/node), tsconfig, lint/type-check scripts; app dep entry. Workspace already globs `packages/*`. | 0 moved; 2–3 new; app package.json; pnpm-lock.yaml | types, studio, flow smoke |
| **PKG-b** | Cut B1–B4 in place, no moves (B11 optional). | ~2 new (`sketch/types.ts`, `io/stl.ts`); ~16 edited | studio (sketch tests, mates, instance-drag, library*, cad-external/ab/team-bundle/robot-harness/robot-sizer), flow |
| **PKG-c** | Move the 41 SCC-independent files (e.g. `engine/{vec3,geom2,fit,trim,mesh,clip,direct,directModule,errors,render,stepUnits,meshImport,curveSource}`, `sketch/{plane,profile,spline,terms,osnap,offset,corner,history}`, `robot/{gjk,hull,profile,urdfCheck,mjcfCheck}`, `chat/{api,contract,groups,script,trace}`, `io/zip`, `subd/cageEdit`, `team/sha256`, `library/{materials,sharing}`, `print/threemf`, `drawing/text`, `app/{edgeChain,materials,measure}`); rewrite ~94 importers. If `chat/contract.ts` moves, the frozen `tools-v1/v2.json` move with it byte-identical and the two FROZEN test paths change in the same commit (or leave the JSON in place until PKG-h). Kernel `fr-1.test.mjs:111` path updated (kernel-file edit) or tslot-20.json moved to conformance. | 41 moved (5,013 lines), 3 JSON | studio, contract (without UPDATE_TOOL_CONTRACT), types, flow |
| **PKG-d** (optional) | Hoist `doc.ts`'s record types to `engine/docTypes.ts`, breaking the 95-file SCC into per-folder moves. Only if PKG-e is too big for one boundary. | 1 new, ~13 edited | studio, types |
| **PKG-e** | Move the 95-file SCC in one commit. | 95 moved (19,233 lines) | studio, contract, flow, types |
| **PKG-f** | Move the 42 dependents (`rb9/*`, `robot/{ccd,sdf,usd,workspace,preview,modelCheck}`, `sketch/{dxf,select,settle,trim}`, `team/{bundle,metrics,scripted}`, `engine/{container,meshWire,migrate}` …); update `scripts/rb9.mjs`; re-point `server/*` and `ab/` to `@barocss/cad-model/...`. | 42 moved; 7 server files; 1 script | studio (rb9, ab, cad-external, team-*), flow |
| **PKG-g** | Guard the boundary: model `no-restricted-imports` forbids `react*`, `@barocss/gpu*`, `apps/**`; kernel forbids `@barocss/cad-model`. Drop DOM from model `lib` once it type-checks without it. | config | lint, types |
| **PKG-h** (later) | Move model-only tests into the package (55 tests use `process.cwd()`-relative paths). | up to ~124 tests | studio + model suites |

**Kernel track K** (independent; each is a kernel-lane step with a D-record, kernel test, conformance where it fits, RB rows): **K1** G1+G2 (hull, GJK); **K2** G4+G6+G5's grid (one triangle BVH + ray; the 2026-10-21 withdrawal is reopened); **K3** G3+G12 (`meshClearance`, one point–triangle); **K4** G9 (`closestPointOnSurface`) + G14's `nearest`; **K5** G10, G11, G8's `meshVolume`; **K6** G7 (SDF, marching tetrahedra); **K7** G13 after an equivalence check. Studio coverage: robot-*, printing, im-s0, hollow, lattice, mould-draft, mould-undercut, fit, chord, rb9.

**Git mechanics:** keep the subtree shape (`src/engine/doc.ts` → `packages/barocss-cad-model/src/engine/doc.ts`) so moved files stay byte-identical and merge-ort rename detection carries later lane edits; no re-export shims at old paths; dry-run each step against each lane tip with `git merge-tree --write-tree <step> <lane>` (read-only) before landing.

## 6. Risks

1. **Merge conflicts with the lanes.** Since 2026-10-18, 157 non-merge commits touched `apps/cad-studio/src`; hottest: `chat/tools.ts` 66, `App.tsx` 58, `engine/doc.ts` 54, `part.ts` 33, `evaluate.ts` 33, `tools-v1.json` 30, `tools-v2.json` 18. Steps e and f move most of these; `App.tsx` gets import rewrites every step. Merge each lane's pending work (e.g. IM3 `721b1569c`) before any move. Directory-rename detection for files a lane later adds under a split folder is **unverified** — confirm with a merge-tree dry run.
2. **Frozen tool contracts.** `test/tool-contract.test.ts:18` and `test/toolset.test.ts:20` resolve `process.cwd()/src/chat/tools-v1.json`/`tools-v2.json`. Moving them needs both constants changed in one commit, a run without the update flag, byte-identical files. Simplest: leave the JSON in place until PKG-h.
3. **Path-based fixtures.** 55 studio tests resolve paths from `process.cwd()` (`../../packages/barocss-cad/conformance/...`, `test/fixtures/*`, `scripts/cad-cli.mjs`); they keep working while tests stay in `apps/cad-studio/test`. Kernel `fr-1.test.mjs:111` must be updated at PKG-c. The 3 oracle scripts and 32 conformance prose strings go stale (docs only).
4. **tsconfig.** The app config needs no change for a–c. The package needs `moduleResolution: "Bundler"`, `types: ["node"]`, strict, noEmit. The kernel is `NodeNext`, `types: []`: anything moved down (K track) needs `.js` relative suffixes and no Node/DOM globals. Unclear: whether `@types/node` types `CompressionStream` without DOM — check before PKG-g drops DOM.
5. **package.json and lock.** New private `@barocss/cad-model`; app dep; `pnpm-lock.yaml` changes. Copy the kernel's `"main": "./src/index.ts"` source-consumption pattern; nothing is published.
6. **Vite.** `server.fs.allow` already covers `packages/`; workers stay in app. Do **not** extend the build's `moduleSideEffects` regex (kernel only) to the model: `library/libraries.ts:73–74` registers built-ins at load. Check the lazy `engine/directModule.ts → import('./direct')` chunk after PKG-c.
7. **esbuild scripts** (`scripts/{test,cad-cli,cad-mcp,chat-server,ab,rb9}.mjs`) resolve workspace packages via node_modules; only `rb9.mjs` names a moving path (`src/rb9/main.ts`).
8. **ESLint.** The app has no lint script, so `pnpm -r lint` skips it; the model files are clean today. A `lint` script on the new package brings them into CI lint with no new failures.
9. **Ownership.** Kernel core files stay with the kernel lane; K steps touching `facet-bvh.ts` / `mesh-distance.ts` go through the coordinator.

## 7. Open questions

- PKG-d (type hoisting) vs one 95-file move at a single boundary.
- Whether `server/` should become its own package later (nothing requires it).
- Kernel API naming for G3, so `meshDistance` (one-way largest) and the new least distance aren't confused (`meshClearance` proposed).
- The studio test count was not re-run for this note.
