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

## G2 — a GPU clip plane with a cap for the section view while its plane moves (2026-10-21)

- **Before**: with the section view open, every change of its plane (a drag, X/Y/Z, Flip) ran `clipMesh` on every body
  and every placed instance (the instances first moved on copies, G1's section exception), and the renderer made and
  uploaded the clipped meshes; the kernel's exact section (a Split, in the engine worker) replaced the bodies when it came.
  The hand-over (§3, ~line 1002) asked for "a GPU clipping plane would make the section view instant".
- **What** (`packages/barocss-gpu`):
  - `Viewer.clipPlane = { normal, offset, cap }` (or null): drawn is where dot(normal, p) ≥ offset. The frame block grows
    32 bytes (`FRAME_BYTES` 992 → 1024): `clip` (normal, offset) and `clipColor` (the cap's linear colour, w 1 when set).
    `AddMeshOptions.clipped` (default true; `Mesh.clipped`) and `cap` (default false: a closed solid; `Mesh.cap`); the flag
    rides in the object block's `pick.z` (bit 0 receive shadow, bit 1 clipped).
  - Discarded beyond the plane in every pass that draws a clipped mesh: surfaces (lit, unlit, the shadow catcher), lines
    (the fragment's world point, carried from the segment's ends), the GPU pick, the outline mask, and the shadow map (its
    pipeline gains a depth-only fragment `fsDepth`).
  - The cap: drawn from the mesh's back faces (`cullMode: 'front'`) on the kept side whose eye ray crossed the plane before
    them (it came in through the cut), at the crossing's depth (`frag_depth`), in the cap colour, lit as a face on the
    plane facing the cut-away side with the mesh's metal and roughness (flat when unlit). The same test and depth in the
    pick (`fsCapPick`: the cap picks its mesh, its point on the plane) and the outline mask (`fsCapMask`: the cap hides what
    is behind it and carries its mesh's outline).
  - A prepass (`capFront`, only while a plane caps something): every opaque surface's nearest kept front depth per
    pixel (r32float, bound as frame binding 5), and a back face behind one is not capped — its ray crossed the plane outside
    the solid and came in through that face. The first version without it painted the cap over the kept faces seen in
    front of the cut (an iso view of the cut box showed only the cap colour); the browser test now holds a kept face in
    front of the cut showing the body, and fails without the prepass.
  - Bounds: `Viewer.sceneBounds` (the camera's clip planes, the shadow frame, the occlusion) cuts a clipped mesh's box by an
    axis-aligned plane (`clipBox`, exported), as a clipped copy's box is; another plane leaves the box.
  - The CPU paths honour the plane (the coordinator's point 1): `rayTriangles(g, o, d, plane, backs)` counts only hits on
    the kept side (the plane carried into the mesh's space, `localPlane`: (Aᵀn)·x ≥ offset − n·t), and reports whether the
    hit is a back face; `clippedRay` (exported, used by `raycast` and the GPU pick's triangle) turns a back-face hit of a
    capped mesh into its cap hit (`PickHit.cap`, the point on the plane, triangle and face null) when the ray crossed the
    plane before it; a single-sided uncapped mesh cut open is ray-cast without its back faces, as it is drawn.
    `nearestSegment(…, plane)` (`pickLine`) clips each segment to its kept part before the eye clip, the parameter carried
    through both; with no plane the arithmetic is the same as before.
- **Studio** (`apps/cad-studio`):
  - `src/viewport/sectionView.ts`: `sectionPlane`, `cutAway` (clipMesh's null by the box, its tolerance), `sectionedBodies`
    and `sectionedInstances`: on WebGPU the bodies themselves less those wholly cut away and the instances' list itself;
    on WebGL2 the clipMesh copies exactly as before.
  - App (call sites only): the section's bodies from `sectionedBodies`, the instances from `sectionedInstances`, G1's matrices
    on the instances always on WebGPU (the plane in world space cuts each where it is shown), and `clip` to the Viewport:
    the plane, and whether the part's bodies are cut (until their exact section is shown). DEV hooks `__studioSection()`,
    `__studioSectionDebug({ hold, cpu })` (the exact section held back, the CPU path forced) and `__studioSetSection`.
  - `GpuRenderer.setClip`: the viewer's plane, the cap in the CPU cap's colour (a selected face's: the theme's base mixed
    with the accent, 0.42); the bodies' surfaces, edges and highlights cut while not exact, the instances' surfaces, edges
    and rings always, the surfaces capped; everything else (ground, direct objects, regions, the part's rings, props)
    not cut, as the CPU section left them. `bounds()` (the studio's occlusion radius and fit) cuts the boxes the same way,
    and the ground (the shadow catcher) is now one unit square placed by its transform from those bounds, again when the
    plane moves — it followed the CPU's clipped meshes before by being made again; now nothing is made.
  - The exact kernel section is kept and still replaces the bodies when it arrives (the cut faces lit as selected, "Sketch
    the section" reading them); only the moving plane is the GPU's.
- **Consumers of clipMesh's output** (the coordinator's point 5): only App's display path — the Viewport's bodies and
  instances, the cut faces' highlight (`shownSelection`, by the cap's name), the per-index body colours, hidden bodies and
  face colours, and the status line's solid count. On WebGPU: the bodies unclipped (the same membership: wholly cut
  bodies left out), so the counts and the per-index lists are the same; the cap is drawn, not a face, so it is not
  highlighted as a face (it has the highlight's colour). On WebGL2: unchanged. No export reads it: STEP, 3MF, the drawings
  (kernel views and sections), the mass properties and the screenshots of drawings read `bodies` / the kernel; the
  viewport capture (PNG) draws what is shown, so it has the GPU's section. Picks, measure and osnap stay off in a section
  (App ignores picks while sectioned; osnap runs only in a sketch, which closes the section); hover still ray-casts, now
  with the plane.
- **Evidence**:
  - `packages/barocss-gpu/tests/viewer-core.test.mjs` (node): the frame block's clip words; a box's ray with the plane (the
    far bottom from inside, back), on a 7 200-triangle sheet through its hierarchy against every triangle with the plane
    (60 random rays and planes), a segment found only on its kept part with its parameter, a null plane the same as none.
  - `tests/viewer-pose-clip-browser.test.mjs` (real WebGPU), G2: shapes cut across y = 0 in an orthographic view, each
    cap's pixels against its section's closed form, within one pixel along its outline: box 1 332 px for 1 366 (± 148),
    64-sided cylinder 606 for 602 (± 87), a square tube with a 32-sided hole 1 066 for 1 099 (± 206), a turned copy 1 366
    for 1 366; the hole open, an uncapped box hollow and see-through, an unclipped one whole; the CPU ray and the GPU pick on
    the cap (point on the plane), nothing through the hole, the line pick not finding the cut-away edge (found without
    the plane); the outline round the cut box (304 px, centred within 6); the cap in perspective; a kept face in front of the
    cut showing the body; no cap from the kept side.
  - `apps/cad-studio/test/section-view.test.ts`: the WebGL2 path equal to the code before G2 (bodies and posed instances,
    12 random planes); the WebGPU path the same bodies less exactly clipMesh's nulls (60 planes); clipMesh's caps at the
    closed forms (box exact, a 32-sided cylinder and the holed plate's hole within 1 % — the chords); the CPU ray with the
    plane against a ray on clipMesh's meshes, a holed plate and a box moved by a matrix: 4 000 rays, 2 378 hits, 548 on
    caps, the parameter within 1.4e-5 mm, the cap where clipMesh's cap is in every case.
  - The flow (the coordinator's rule 8): in the section, section-with-instances and RM2-posed-section steps, the GPU's
    section against the CPU's clipped meshes through the same viewer, the exact section held back (`sectionAgainstCpu`,
    both shots kept). Pixels differing by more than 96 (ΣRGB: a cap, a silhouette, an edge line — geometry) are at most
    0.07 % of the 1 296 000 over every run (the full flow: 51, 211 and 467) (the flow holds ≤ 0.1 %): an edge-on cap strip where the plane runs along a
    face, and edge lines at the cut, up to 475. Faint differences (more than 8) are 0.01–0.04 % in the section and
    instance steps and 0.5–4 % in the posed view, all below 30: the ground's contact shadow and the CPU shot's shadow
    speckle on the ground, whose frame follows the scene's box (the CPU's path builds its ground from its clipped meshes,
    a frame late). The first GPU version had a cap painted over kept faces in front of the cut: 7 243 and 34 201 pixels
    differed then; the prepass took them to these. Under `FLOW_RENDERER=webgl2` the same helper asserts the CPU path and
    no plane (the section step passes).
  - Bench (`bench:browser`, new rows; 120 brackets, the plane dragged 60 steps, the exact section held back):

    | Row | Task / frame | Upload / frame | Buffers made |
    |---|---|---|---|
    | section, GPU clip plane | 15.6 ms | 2.3 KiB | 0 |
    | section, CPU clipMesh (WebGL2's path, same build) | 19.3 ms | 190 KiB | 2 706 (45 a frame) |

    The brackets are small (about 100 triangles each), so the CPU's clipping is a small part of the frame; on large bodies
    its share grows with their triangles, the GPU's does not.
  - Checks (T2: gpu shaders and App.tsx), on the merge `7455af373` of integration's `b435c0b87`: cad-model package 626/626
    (106 s), lint/tsc clean; gpu lint/tsc clean, unit 74/74, browser 4/4 (94 s with the builds); studio tsc clean, eslint 0
    errors (106 warnings: the flow's three new G2 lines among them), suite 185/185 (32 s); the full browser flow on its own
    219/220 (777 s, port 52691) — step 109, the throated worm wheel's known `waitForSelector` flake, passed on its own
    (22 s); before the merge the full flow was 217/217 (704 s). `FLOW_RENDERER=webgl2` section step: passes on the CPU path.
- **Not done / limits**: one cap colour for every mesh (the CPU cap took a body's own colour mixed with the accent); a
  ghosted (see-through) body is cut but not capped; the cap casts no shadow; an open mesh marked `cap` shows a cap where
  its inside shows (the studio caps every body and instance, as clipMesh did). The section's outline is not drawn as lines
  (clipMesh drew none either).
- **Binds**: a view that cuts the model for display goes through `Viewer.clipPlane` and `Mesh.clipped`/`cap`, not through
  cut copies; any CPU query of the viewer honours it. WebGL2 keeps clipMesh.

## G2b — each mesh's cap in its own colour (2026-10-21)

- **Why** (the coordinator's review of G2): G2 drew every cap in one colour; the CPU's section painted each body's cut face
  in the body's own colour mixed with the accent, so in an assembly section the parts stayed apart. One colour for all was
  a visible regression.
- **What**: `Mesh.capColor` (`AddMeshOptions.capColor`; sRGB, or null for the plane's colour) in the object block, which
  grows 176 → 192 bytes (`OBJECT_BYTES`; the stride stays 256): `cap` (linear, w 1 when set). `fsCap` takes it times the
  mesh's material colour, as a face of the mesh in that vertex colour is lit; without one, the plane's colour as before.
  Studio: a body's cap is what the CPU's section painted its cut face — selected: the body's own colour (or the theme's
  base, or white under render settings) mixed with the accent, 0.42; an instance's cap its base colour (the CPU never
  selected an instance's cut face).
- **Evidence**: the gpu browser test G2b (an own colour, a colour times the material's, the plane's for none, a change and
  back, exact pixels on unlit meshes); the studio's renderer test (each instance surface's cap colour the base). The flow's
  GPU-against-CPU section shots do not move with it (strong pixels 51, 211, 472, as at G2): in the section step the body's
  cap colour was already the plane's (the base mixed with the accent), and in the instance and posed views the instances'
  caps face away from the camera.
- **Limits kept (stated)**: a ghosted (see-through) body is cut but not capped; the cap casts no shadow (G2).

## G3 — line picks pass over what a surface hides (2026-10-21)

- **Before**: `pickLine` (viewer.ts ~1212) was a screen-space search over every line mesh with no depth test: an edge at
  the back of a body, or behind another body, was picked through the faces in front of it — for hover and for picks. The
  studio's WebGL2 `pickEdge` does the same (no depth either; G16 is WebGL2 parity).
- **What**: for each line mesh, the nearest segment is tested at its nearest point: the eye's ray to it against every
  visible opaque triangle mesh and its instances (`meshRay`: the clip plane's kept side, its caps); a hit more than about a
  pixel and a half in front of the point (in world units at its depth: lines lie on their faces, and the depth test's bias
  lets them show a little behind) hides it, and the next nearest is tried with the hidden ones left out (`nearestSegment`'s
  new `skip`; up to 16 a mesh). `pickLine(x, y, radius, { throughSurfaces: true })` keeps the old search. The studio's
  `pickEdge` and `pickDirect` take the default: hidden edges are no longer hovered or picked.
- **Oracle**: the GPU's own depth — a line shows where it passes the depth test, so the surface the GPU pick finds at a
  point's pixel says whether the point is shown.
- **Evidence** (`tests/viewer-pose-clip-browser.test.mjs`, G3): a lit box with its 12 edges and another box in front of part
  of it, 300 random pointer positions over it, with and without a clip plane: no depth-aware hit lies behind a surface (by
  the GPU's depth at its pixel, two pixels' slack), and every through-surfaces hit the GPU shows is found by the depth-aware
  pick, or a nearer one — 0 and 0 in both runs, 48 found, 30 of the through-surfaces hits hidden (5 with the plane). The
  back vertical edge: not found, found through surfaces; cut open by a plane (no cap) it shows and is found; capped, the cap
  hides it. On the old behaviour the test fails (its hidden through-surfaces hits would be found).
- **Checks for G2b and G3** (the coordinator's v2 rules: no full flow at a checkpoint), on the merge `0c3735079` of
  integration's `f567478ab`, in a detached verify worktree: gpu unit 74/74 and browser 6/6 (11 s); studio 185/185 (27 s);
  `FLOW_ONLY` over the section, instance and RM steps and the twelve steps that had timed out in a full run made before the
  rules changed (one run of 55 min on a machine at load 30–90: FR2, FR3a, R10.3a, R11b, R14.1, R14.3, R14.3b, A5.2, A5.3,
  A6.4, IM6, CNC1) — 16/16 in 76 s; that full run's other 208 steps passed, every canvas-picking step among them, with G3
  in. The section shots against the CPU's: strong pixels 75, 178 and 244 (≤ 0.02 %). Not run: the full flow (the
  coordinator's, per merge window), the cad-model suite (not touched), the benches (nothing they measure changed).
