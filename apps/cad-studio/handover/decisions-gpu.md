# Decision records — GPU viewer lane (G-numbers)

The viewer lane's records (2026-10-21, a session started by the coordinator "barocss 로드맵"): improvements to the studio's
one 3D viewer, `packages/barocss-gpu` (WebGPU; the studio's WebGL2 `Renderer` is the fallback), and its glue in
`apps/cad-studio/src/viewport/`. The kernel lane keeps `decisions.md` (D-numbers), the outer lane `decisions-outer.md`
(O-numbers). Same format: what was decided, why, what it binds. Newest last.

The survey that ordered this lane's work (read-only, 2026-10-21): 1 transforms instead of vertex rewrites, 2 a GPU clip
plane, 3 overlays into the engine (lines and points), 4 depth-aware `pickLine`, 5 scalar colour maps for the IM/CNC
analyses, 6 scene-level pick acceleration, 7 benches for these. This session takes 1 (G1) and 2 (G2).

## G1 — posed and exploded instances by transform, not by moved copies (2026-10-21)

- **Before**: a played joint ran a `requestAnimationFrame` loop that set the joint value every frame; each frame
  `posedInstances` (cad-model `robot/preview.ts`) and `movedBody` (`assembly/explode.ts`) copied every moved instance's
  positions, normals and edge lines and rewrote them, and `GpuRenderer.setInstances` removed, disposed and re-added every
  instance's surface and edge meshes: the whole assembly made and uploaded again each frame, and each instance's thread
  rings worked out again on the moved copies.
- **What**:
  - `apps/cad-studio/src/viewport/instancePose.ts`: `instancePoses(part, instances, fk, explode)` — one column-major 4 × 4
    per moved instance: its link's motion relative to the base part's (cad-model's new `instanceMotions`, which
    `posedInstances` now uses too), then its explode offset. The offsets are worked out from the boxes *as posed*
    (`boundsUnder`, every vertex through the matrix, nothing copied), so they are the ones the moved copies gave.
  - `GpuRenderer.setInstances` is keyed: an instance whose bodies have the same signatures (the bodies' own signature
    function: sizes, bounds, a sample of positions) and the same thread rings keeps its meshes; only new or changed
    instances are made, gone ones released. `setInstanceTransforms(map)` (new on `ViewRenderer`) puts each matrix on the
    instance's surface, edge and ring meshes; the gizmo's drag goes after the pose (`drag × pose`). A transform equal to
    the mesh's is not set again (its object block is not re-sent). An instance surface's vertex colours are written only
    when its base colour or picked faces change (a new selection repaints none).
  - App: the instances are passed as placed (`instancesPlaced`), with `instanceTransforms`; each instance's thread rings
    are worked out once on the placed meshes and drawn as that instance's own line mesh, moved with it (the part's own
    rings stay one mesh). `__studioInstanceBounds` (the flow's view) reads the exact posed boxes from the matrices.
    `__studioSetExplode(k)` (DEV) sets any explode factor, for the bench.
  - The section view (until G2) still shows moved, clipped copies of the instances: a CPU clip needs the posed mesh.
- **Instancing**: the engine's per-mesh `instances` (one geometry, many transforms in one draw) was not used: the studio's
  instance bodies are evaluated and placed per instance (their positions are world positions), so two copies of a part
  do not share a geometry. Sharing one would need the instance bodies unplaced with their placement as a matrix — the
  next step if many copies of one part become common (bench-assembly's 120 brackets draw 240 meshes).
- **Picking and outline**: unchanged code — `raycast` and the GPU pick already go through each mesh's transform, `pickLine`
  through `viewProjection × transform`, the outline mask through the object block. A test now holds them on a moving
  mesh.
- **Evidence**:
  - `apps/cad-studio/test/instance-pose.test.ts`: on the conformance 2R arm (`rm/chain-2r`), 24 random poses × explode
    0, 0.5, 1, 2: every vertex and edge point through the matrix within 1e-4 mm of the moved copies (Float32 positions of
    about 100 mm), the posed boxes within 1e-4 mm; nothing moved at home. The renderer on a stand-in viewer: a new
    selection and the same bodies again make and repaint nothing; 60 played frames only move meshes; a drag goes after the
    pose; an unchanged transform is not set again; one changed instance alone is rebuilt; the same rings kept; gone ones
    released.
  - `packages/barocss-gpu/tests/viewer-pose-clip-browser.test.mjs` (real WebGPU, in `test:browser`): a box and its edges
    swung through 30 transforms — no GPU buffer made; at five of them the CPU ray hits the top side (face 4) within 1e-4,
    the GPU pick within 0.1, the line pick lands on the moved box's edges, and the outline's pixels (with minus without)
    are centred on the moved box (≤ 12 px, > 100 outline-coloured pixels).
  - Bench (`pnpm bench:browser`, two new rows; Apple M-series, WebGPU, Chrome; the task time is the DevTools protocol's
    `TaskDuration` per drawn frame, so React's render and effects are in it):

    | Row | Before G1 | After G1 | Budget |
    |---|---|---|---|
    | pose: a joint of the 2R arm played (1.5 s) | 94 submits, 10.28 ms task, 35.8 KiB, 1 116 buffers made | 94 submits, 9.76 ms task, 3.1 KiB, 0 buffers | ≤ 120 submits, 20 ms, 8 KiB, 4 buffers |
    | explode: 120 brackets, 60-step drag | 49 of 60 steps drawn, 22.32 ms task, 1 996 KiB, 35 280 buffers | 59 drawn, 13.34 ms task, 62.4 KiB, 0 buffers | ≤ 120 submits, 28 ms, 128 KiB, 4 buffers |

    The explode's 62 KiB a frame is the 240 moved meshes' object blocks (256 bytes each). The joint's remaining ~10 ms a
    frame is the app's React render of the new joint value, not the viewer (its frame callback is 0.11 ms).
  - Checks (T1): studio suite 787/787; studio `tsc` clean, eslint 0 errors (120 warnings, none in the changed files);
    cad-model lint/tsc clean; gpu lint/tsc clean; flow `FLOW_ONLY` over the instance, mate, section, explode, RM/RD steps
    (30 steps and the first) 31/31.
  - Checks at the checkpoint (T2, App.tsx touched; on the merge `1a52dc75e` of integration's `b7e1d447a`): gpu unit 73/73
    (2 s), gpu browser 3/3 (11 s), the full browser flow on its own 217/217 (685 s, port 52691).
  - Same pixels as the CPU path (the coordinator's rule): the flow's instance, explode, section-with-instances, RM2 posed
    and RM9b steps run on integration's tip (moved copies) and on this branch, screenshots diffed (1440 × 900): at most 75
    pixels a frame (0.006 %) differ, each by at most 16 in |ΔR| + |ΔG| + |ΔB| (about 5/255 a channel), none by more than
    32; the RM2 posed and RM9b frames identical. The run-to-run noise of one build is the corner's timing label only.
- **Binds**: a new view-only motion of an instance (a mate preview, an animation track) goes through
  `instanceTransforms`, not through moved copies of its meshes. `posedInstances`/`movedBody` stay for the exports and
  checks that need moved meshes (and the CPU section until G2).
