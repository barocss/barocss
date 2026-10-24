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

## G4 — bench scenarios with budgets, a GPU budget beside the CPU's (2026-10-21)

- **What**:
  - `test/bench-browser.mjs` (`pnpm bench:browser`): one budget table (`BUDGET`) for its ten rows; every row now has a GPU
    budget beside its CPU ones — the GPU's time a submit, from the submit until the queue reports that work done (wall
    time, so it holds the queue's own wait: an upper bound of the GPU's work, not a timestamp query; the viewer's device is
    made inside the viewer, without the `timestamp-query` feature). A new row: **cloud** — the 2R arm's workspace map
    shown (RM9b, 20 000 poses; its voxels drawn as an SVG overlay today, G8's point primitive later) and orbited 60 steps.
    The joint, explode and section rows (G1, G2) are the joint-play, explode and section-drag scenarios.
  - `test/bench-assembly.mjs` (`pnpm bench:assembly`, the large assembly: 120 holed brackets): budgeted for 120 copies —
    time until every copy shows, draw calls a frame, CPU a frame, GPU a submit, buffers made; the GPU time measured as in
    bench-browser; exits 1 over a budget.
  - `test/bench-mesh-browser.mjs` (the big meshes: organic 200k and 1000k triangles): budgeted per fixture — read, open,
    save, reopen (ms) and the saved file's MB; exits 1 over a budget or when the file is not a container or not shown.
  - Each prints the machine's load average at its start and end and says `LOADED` above 4: a budget is not set from a
    loaded run (the coordinator's rule).
- **Measured** alone (no flow beside them), at a load average of 8–11: the machine did not come below 4 while the other
  lanes worked, and the owner had them run then ("이제 해도 돼") rather than wait. Budgets are about twice these, as D82's
  were, with the CPU's 2 ms floor and a 4 ms floor for the GPU's; a second run straight after held every one.

  | Scenario | CPU (frame callback / task a frame) | GPU a submit | Other | Budget |
  |---|---|---|---|---|
  | hover, 60 moves | 0.27 / 10.2 ms | 2.0 ms | 11 submits | GPU 4 |
  | select a face | 0.3 / 27 ms | 11.6 ms | 1 submit | GPU 24 |
  | clear (Escape) | 0.1 / 10.3 ms | 1.9 ms | 1 submit | GPU 4 |
  | orbit 60 | 0.22 / 2.9 ms | 2.0 ms | 59 submits | GPU 4 |
  | orbit 60, outlined | 0.24 / 3.6 ms | 2.6 ms | 61 submits | GPU 6 |
  | joint played (pose) | 0.13 / 10.0 ms | 15.7 ms | 3.2 KiB, 0 buffers | task 20, GPU 32 |
  | cloud: 400 voxels, orbit 60 | 0.23 / 3.5 ms | 2.2 ms | 2.3 KiB, 0 buffers | task 8, KiB 6, GPU 6 |
  | explode, 120 brackets | 0.41 / 14.4 ms | 21.4 ms | 62.5 KiB, 0 buffers | task 28, GPU 44 |
  | section drag, GPU | 0.28 / 15.0 ms | 22.1 ms | 2.4 KiB, 0 buffers | task 30, GPU 44 |
  | section drag, CPU clipMesh | 0.33 / 18.5 ms | 26.2 ms | 187 KiB, 2 706 buffers | (for comparison) |
  | large assembly, 120 brackets (bench:assembly) | 0.46 ms CPU a frame | 3.0 ms | shown 289 ms, 242 draws, 739 buffers | shown 600, draws 500, CPU 2, GPU 6, buffers 1 500 |
  | mesh 200k (bench-mesh-browser) | read 59, open 782, save 37, reopen 338 ms | — | 3.4 MB | 120, 1 600, 80, 700 ms; 3.8 MB |
  | mesh 1000k | read 252, open 2 793, save 80, reopen 1 271 ms | — | 17.2 MB | 500, 5 600, 160, 2 600 ms; 19 MB |

  The GPU times a frame that draw the shadow map again (a pose, an explode, a section: a caster moved) are 15–22 ms on
  this machine against about 2 ms for a camera move — the shadow map's 2048² pass; what G14 (display LOD) will measure
  first. The point cloud is small (400 voxels of 10 mm for the 2R arm): G8's point primitive will add a larger cloud.
- **Not done**: budgets re-checked on a quiet machine (load under 4) — a run then may tighten them; a timestamp-query GPU
  time (the viewer would have to ask its device for the feature).
- **Checks**: no product code changed (benches only): the three benches twice each, alone (all within budget the second
  time); gpu unit 74/74 and browser 6/6 (10 s); studio 186/186 (16 s), on the merge `7733e3a3d` of integration's
  `6d4b80e75`. Not run: the flow (no product code), the cad-model suite (not touched).

## G5 — the old review's four open GPU points, re-verified (2026-10-21)

The old review (`REVIEW-2026-10-14-cad-gpu.md` §2 G4/G5 and `review-drafts/gpu-fuzz.md` R1/R2, read only). Each point,
against the code as it is now:

1. **CAD→GPU axes** (review G4, "[추정]": the kernel-face path turns `[x, z, −y]`, the Boolean paths do not) — **confirmed
   fine, by design.** Each path declares its basis: `prepareKernelFacePreview` takes kernel faces (CAD Z-up) to its packet's
   `right-handed-y-up` by (x, z, −y), as the interop GLB export does (`cad-interop/test/cad-integration.test.mjs` holds the two
   equal; 2/2); `prepareAxisBoxBooleanBuffers` declares its input's authored XYZ to agree with the display's Y-up and turns
   nothing (gpu README, "the explicit basis declares authored XYZ agreement with the display's Y-up"); the boolean-shell and
   coplanar buffers say `right-handed-authored-xyz`. None is a studio path: the studio's viewer keeps CAD Z-up with the
   camera's up +Z and no conversion.
2. **sRGB `pow 2.2`** (review G5: the same colour gives different bytes by path) — **fixed where the studio sees it, with a
   test that fails before.** The viewer encodes sRGB exactly (piecewise both ways), but its shader materials
   (`materialShader`, `bindingShader`, `uv01Shader`: the Render workspace's materials) lowered their colour literals by the
   material language's gamma-2.2 decode: a material `#808080` showed as #818181 beside a plain `#808080` material. They now
   lower by the exact sRGB decode of the literal's hex (`lowerMeshMaterialWGSL(…, { srgb: true })`, the same for the UV01
   lowering): every byte back to itself. The language's GLSL and older WGSL renderers keep their own pair (decode 2.2,
   encode 1/2.2: back to the same bytes too), unchanged, with their fixtures.
3. **NaN through `mesh-packet.ts` `array()`** (fuzz R1: `return input as number[]` — the descriptors checked, the caller's
   array returned, so a Proxy could answer NaN on a later read) — **fixed, with a test that fails before**: `array()` returns a
   copy of the values it checked (`mesh-packet.test.mjs`: a Proxy whose descriptors say finite numbers and whose reads say NaN,
   through `validateMeshOptions` and `validatePreviewPacket`).
4. **GLSL vs WGSL coefficient parity** (fuzz R2: `mix(#000,#fff,1e-50)` compiled; GLSL flushed it to 0, WGSL refused it, and
   `materialShader` threw — the studio compiles its render materials as typed) — **fixed, with a test that fails before**: a
   nonzero literal that is zero as an f32 is refused at compile time (`RANGE`, for both backends and the UV01 compiler);
   `materialShader` returns a lowering's refusal as a diagnostic instead of throwing. Representable ones (a subnormal 1e-40,
   1e-38, 0) still compile and lower.
- **Checks** (v2): gpu lint/tsc clean, unit 77/77 (+3: G5's), browser 6/6 (10 s); cad-interop 4/4 and its
  `cad-integration` test 2/2; studio 186/186 (20 s); `FLOW_ONLY` over the render, material and surface-analysis steps (the
  steps that compile shader materials): 4/4 in 12 s, on `acbf60deb` in the verify worktree. Not run: the full flow, the cad-model suite (not touched),
  benches (no frame path changed).

## G6 — scalar colour maps with a legend; the parting line and the mould's halves (2026-10-21, first part)

- **Data shape** (proposed and approved before building, the coordinator relaying to the outer lane): an analysis map is
  `ScalarMap { body, per: 'vertex' | 'triangle', values (NaN none), unit, range, thresholds, legend }` per body, worked out
  when chosen or when the bodies change, never per frame. IM4 thickness, the parting loops and the halves exist in
  cad-model; IM2's per-vertex exact draft (`draftSamples`), CNC's per-triangle access (`accessSamples`) and the isoclines
  as polylines (`isoclinePolylines`) are the outer lane's (O-G6), wired here when they land.
- **Viewer** (`packages/barocss-gpu`):
  - `Geometry.setScalars(values, per)`: one value per vertex (interpolated) or per triangle (flat: the triangles' own
    positions and normals laid out unindexed, made once per field), NaN none (a sentinel on the GPU: WGSL promises nothing
    about NaN). `Mesh.colorMap = { stops: [value, sRGB][]; below?; above?; missing?; bands? } | null`: a 256-texel
    `rgba8unorm-srgb` ramp per mesh, interpolated in linear light (`packColorMap`), drawn by its own pipeline (`vsMap`,
    `fsMap`: the surface's lighting, flat when unlit), the material back with null. The pick, outline-mask, shadow and cap
    passes draw the indexed geometry as before; a mapped mesh under the clip plane caps in its cap colour.
  - `PickHit.scalar`: the field at the hit — its triangle's, or its vertices' by barycentric weights — for the legend.
- **Studio**:
  - The **Analysis map** button (beside Analyse, whose click count the flow relies on): Thickness, then for a moulded part
    Parting and Halves, then off. `viewport/scalarMaps.ts`: IM4's thickness per display triangle (`wallSamples(body).local`,
    a Float64Array, converted), over [0, max(2 × nominal, thick95)] from `wallsOf`; red under the process's thinnest wall
    (the `wall` rule's `minWall`) and under the material's moulding range's low end (`materialData(id).wallMM.injection`,
    the `wall-material` rule) when they exist, green at the nominal, orange to the thick-section limit (nominal over the
    profile's `adjacentWallRatio`, 0.6 unset), purple past it, no wall grey — the outer lane's corrections (O-G6).
  - The legend (`ui/MapLegend.tsx`): one small DOM element — title, unit, the ramp with its thresholds marked, the colour past
    it, the value under the pointer (`scalarAt`, a ray on pointer moves while a map shows); the mould's legend its loops,
    each half's bodies and volume, or why the halves cannot be built, and a Spread toggle.
  - The mould's view (`engine/mouldView.ts`, run in the engine worker — the halves are Booleans): the moulding report's chain —
    IM5's parting line, IM7b's straddling faces split, IM3's undercuts, IM7's plan, IM7a's halves. The loops are one line mesh
    (the accent, 2.4 px, depth-tested), the halves see-through (+ blue, − amber, 0.6) with their edges, spread ± along the
    pull by G1's transforms; while the halves show the part's bodies are not picked and App's picks wait.
- **Evidence**:
  - gpu browser (G6): a box with z as a per-vertex field on a blue → red ramp (each sample the ramp's colour at its value
    within 0.02 in linear light), a per-triangle field in 4 bands (a NaN triangle the missing colour, the top band white),
    below and above colours, picks reading 1, −0.5 and a triangle's own value (ray exact, GPU within 0.05), the cap of a
    mapped mesh under a plane its cap colour, the material back with null, no buffer made over ten turned frames.
  - studio `analysis-maps.test.ts`: the thickness map's values are the wall samples', a shelled box's nominal its 2 mm
    shell, the limit nominal / 0.6; the mould's view on IM7's plate — closed flat loops, the + half 48,000 mm³ and both
    halves the block less the part (1e-6, as IM7's own test); none without a pull; the renderer sets a field once per map
    and clears it, draws the loops and halves, spreads them without making anything, and keeps the part from picks.
  - Flow step G6 (new): a moulded holed plate — Thickness with its legend and a value under the pointer, Parting, Halves
    (+ half 48,000 mm³), Spread, off.
- **Found by the flow**: the engine worker's document is what evaluation reads (`evaluatedPart`: no `mould`), so the
  mould's view had no pull there; the `mould` request now carries the document's mould settings itself (the shared wire is
  left alone).
- **Checks** (v2): gpu lint/tsc clean, unit 77/77, browser 7/7 (55 s, the load at 40); studio tsc clean, eslint 0 errors,
  suite 189/189 (50 s); `FLOW_ONLY` over the analysis menu (surface analysis), IM1–IM8c, CNC1–CNC7b and the new G6 step in
  the verify worktree: 21/22 first (G6 refused the parting map: the wire, above), then G6 and IM4 again on the fix, 3/3.
  Not run: the full flow (the coordinator's), the cad-model suite (not touched), benches (no frame path changed).
- **Not done (waits)**: the IM2 draft and CNC access maps and the isoclines (the outer lane's O-G6 exports, in
  integration's next window: `draftSamples`, `accessSamples`, `isoclinePolylines`, and `castingDraftLimits` for casting's
  draft marks). A legend for several bodies shows the first map's scale.

## G6, second part — the draft and access maps and the isoclines, on O-G6's exports (2026-10-21)

- On integration `3fa729fcb` (merged here as `1029155b1`), which holds the outer lane's O-G6: `draftSamples`, `accessSamples`,
  `isoclinePolylines`, `castingDraftLimits`.
- **Draft** (`draftMap`): per display vertex, the signed draft in degrees from the exact normals (`draftSamples`; a facet face's
  vertex its display normal). The least draft from the report's own sources (`draftLimits`): an injection moulding's surface
  finish (`draftMinDeg`/`draftRecDeg`; none without a finish set — the rule is unknown — so no marks), a die or sand casting's
  alloy family (`castingDraftLimits`). With a least draft m: red where |draft| < m, + light to dark green from m to 2m, −
  light to dark blue, saturating past ±2m, marks at ±m; without one the diverging map alone over ±10°.
- **Access** (`accessMaps`): per display triangle the share no 3-axis direction reaches (`accessSamples`), 0 light blue to 1
  red; it needs no pull.
- **Isoclines**: with the draft map, each body's n·d = 0 polylines on its straddling faces (`isoclinePolylines`), one white line
  mesh (1.6 px, depth-tested).
- The Analysis map button's cycle: Thickness → Draft (with a pull) → Access → Parting → Halves (with a pull) → off.
- **The worker request** (the coordinator's note): `ba0bd85e9` changed the studio's own engine request for the mould
  (`engine/engine.worker.ts`, `engine/client.ts`: the `mould` request carries `doc.mould` beside the wire document); the
  shared wire (`@barocss/cad-model/engine/wireDoc`, `evaluatedPart`) is unchanged.
- **Evidence**: studio `analysis-maps.test.ts` +3: a moulded plate's draft — its walls 0°, its top +90°, its bottom −90° at
  every such vertex, marks at ± the smooth finish's least draft and the range ±2m, none and ±10° without a finish; its access
  map equal to `accessSamples`, every share in [0, 1]; a rod across the pull's isoclines along its sides (z 0 within 1e-3), a
  plate along it none. The flow's G6 step walks the whole cycle.
- **Checks** (v2): gpu unit 77/77, browser 7/7 (16 s); studio tsc clean, eslint 0 errors, suite 192/192 (29 s); FLOW_ONLY
  (G6, IM1–IM8c, surface analysis and a chat/agent step, A5.3, then CNC1–CNC7b) in the verify worktree on `afe6bd0b3`:
  16/16 (34 s, the load at 53) and 8/8 (21 s); the G6 step's screenshots: the plate's walls red (0°, under the smooth finish's
  least draft), its top green; every face reached by a 3-axis mill. Not run: the full flow (the coordinator's), the cad-model
  suite (not touched), benches (no frame path changed).

## G7 — the overlays' lines into the engine (2026-10-21)

- **What moved**: the bounding box's 12 edges, the measure line, each underlay's polylines and the SubD cage's edges (by kind,
  and the mirrored half) were SVG paths rebuilt and projected on every rendered frame (`setTick` re-renders the overlay).
  On WebGPU they are now engine line meshes: `ViewRenderer.setOverlayLines(key, { segments, color, width, opacity, dash,
  over, hidden })`, uploaded when the overlay changes (the Viewport keys them by content — the App hands new objects every
  render — so a frame makes nothing) and skipped in the SVG. WebGL2 keeps the SVG (the fallback has no such lines).
- **Stays SVG**: the box's size chip, the measure line's end points and label, the underlays' texts (G15 is 3D text), the
  cage's faces and vertices, poles, corners and the workspace cloud (G8, the point primitive), the gizmo, the triad and the
  view cube. `setTick` still re-renders the overlay each frame for those (they follow the camera); what it no longer does is
  project and stringify the lines: the underlay bench's 40 000 points were nearly all of that frame's task.
- **Viewer** (`@barocss/gpu`):
  - `Material.lineDash: [on, off]` (CSS px), from each segment's start (as each SVG `<line>` restarted its dash; a polyline
    drawn as segments restarts per segment — the underlays draw solid);
  - `Material.lineOver`: drawn after everything with no depth test, never passed over by `pickLine`;
  - `Material.lineHidden`: a depth-tested line's parts behind surfaces drawn again at that share of its opacity (a second
    draw, depth `less` — reversed Z, so only behind; no overlap with the visible draw);
  - `AddMeshOptions.bounded: false`: left out of `sceneBounds`, so an overlay (a 2 m drawing under a 40 mm plate) does not
    move the shadow's fit or what `fit()` frames.
- **Depth**: the coordinator asked for depth-tested lines. A measure line between a box's top and bottom runs through the body,
  and the box's back edges sit behind it: depth-tested alone they vanished (the first after-run's screenshot). So the box
  (0.6), the measure line (0.75) and the underlays (0.35) draw their hidden parts faint; SVG drew all of them alike over
  everything. The SubD cage stays over the body (`lineOver`): R8.2's design (the cage is the thing edited; its pick is the
  CPU's projection, through the body), so its look is unchanged.
- **Decision (G7-D1, confirmed by the coordinator 2026-10-21)**: overlay lines are depth-tested with their hidden parts drawn
  faint (`OverlayLines.hidden`, the viewer's `lineHidden`), not hidden — the usual CAD convention, and a measure line that
  vanishes inside the body is worse than one shown through it. The shares, to tune later in one place (`Viewport.tsx`'s
  `BBOX_LOOK`, `MEASURE_LOOK`, `UNDERLAY_LOOK`): measure line 0.75 (the thing asked for, read through the body), bounding
  box 0.6 (its back edges must read on light faces: 0.35 was barely visible in the mass step's screenshot), underlays 0.35
  (a drawing under the part, context only). The SubD cage is drawn over the body (`lineOver`), as R8.2 designed it.
- **Evidence**:
  - gpu browser test G7 (new): a depth-tested line hidden under a box and shown beside it; an over line shown and picked over it;
    a hidden-faint line between the body's grey and its colour there (210,107,211 over 147,147,149; 255,0,255 beside); a 6/6 px
    dash measured 6 (±1) px each run, 35 dashes; a 2 000-unit unbounded line not in `sceneBounds`.
  - Flow screenshots before (`afe6bd0b3`) and after on the steps drawing these lines (measure, mass + bounding box, R8.2, R8.3
    cage extrude/crease/mirror, D84 by hand, O68 underlay): the cage, its mirror's dashes and the underlay match; the box and
    measure line as above.
  - Flow selectors: the measure, box and O68 steps read the engine's lines (`__studioOverlayLines`, DEV) on WebGPU and the SVG
    on WebGL2; O68 checks the underlay gone when hidden and back when shown.
- **Bench** (`bench:browser` row `underlay:` new — a 2 000-polyline, 40 000-point underlay with 100 texts orbited 60 steps),
  run alone, the same script on the pre-G7 code in the verify worktree: task 30.38 → 8.22 ms a frame, GPU 27.6 → 6.94 ms a
  submit, wall 2 952 → 2 428 ms, at a load of 11–14 (LOADED). Budget set at about twice (task 16, GPU 14), for G13 to
  re-measure quiet. Seen in passing: the pre-G7 code's `explode:` row twice in two runs drew 2 submits in one frame (budget 1;
  after G7, 1 in both runs): for G13.
- **Checks** (v2, on `697a02ce4` in the verify worktree): gpu tsc and eslint clean, unit 77/77, browser 8/8 (10 s); studio tsc
  and eslint clean, suite 192/192 (19 s); FLOW_ONLY (the seven steps above) 7/7 on WebGPU (32 s, the load at 41) and 7/7 on
  WebGL2 (45 s). Not run: the full flow (the coordinator's), the cad-model suite (not touched), the other benches (no other
  frame path changed; the full `bench:browser` ran twice, its other rows within budget).

## G8 — a point primitive (2026-10-22)

- **Viewer** (`@barocss/gpu`): `GeometryInput.topology: 'points'` — one vertex (or one entry of `indices`) a point, one
  screen-space quad an instance (position, RGBA8 colour: `pointInstances`). `Material.pointSize` (CSS px, default 4),
  `pointShape: 'circle' | 'square'`, `pointBorder: { width, color }` (inside the edge; with a point's own alpha 0 it is a
  ring). Edges by coverage, always blended; `lineOver` and `lineHidden` (G7) apply to points too (pipelines `point`,
  `pointOver`, `pointHidden`). The border colour sits in the object block's cap slot (caps are triangles only).
  `FrameStats.points`. Points are never shadow casters, picked by the pick pass, outlined or capped.
- **`pickPoint(x, y, radius = 6, { throughSurfaces })`** → `{ mesh, index, point, distance }`: `index` is the geometry's
  element (its vertex, or its entry in `indices`). Within `radius` plus the point's half size; a point a visible opaque
  surface hides is passed over for the next nearest (pickLine's rule, G3), unless drawn over the scene; the clip plane's
  cut side is skipped. A brute-force screen search a mesh after its box is checked (`screenBoxMisses`, now shared with
  `pickLine`): 3.5 ms a pick over 100 000 points in the browser test — G9's scene-level structure can take it further.
- **Studio**: `ViewRenderer.setOverlayPoints(key, { positions, colors, color, size, shape, border, opacity, over, hidden })`,
  in the overlay map beside G7's lines (one mesh a key, made when the content changes; `__studioOverlayLines` counts
  points too).
  - RM9b's workspace map (`cloud`): a square of 3 a voxel in its band's colour (the SVG's hsl bands), 0.75 opaque,
    depth-tested with hidden ones at 0.35 (G7-D1's rule: the voxels inside the arm and base show faint, not on top).
  - The SubD cage's vertices by kind (`cagePoints`: plain 5, pole a 9.5 ring of 1.5, bad 8, picked 9 — the SVG's radii and
    stroke), over the body like its edges; with them on the engine the SVG cage keeps only its tinted faces.
  - Not moved: the selected curve's or surface's poles (a handful; the flow's pole step clicks their SVG marks), the corner
    marks and the measure line's ends (hover-driven, one or two).
- **Evidence**: gpu browser test G8 — red points above/beside/under a box: shown, shown, hidden; an over point shown on it;
  a hidden-faint one between the box's grey and its colour; a square of 16 fills its corner at (6, 6), a disc does not;
  a ring empty at its centre, white at its border, nothing past it; `pickPoint` on each: index 0 and 2 shown, the hidden 1
  passed over (found through surfaces), the over one found, an indexed mesh's elements 0 and 1 (vertices 3 and 1) and not
  its unindexed vertex, a ring within its half size, nothing in empty space; 100 000 points drawn (`stats.points`) and found
  by 15 of 20 picks. Flow before (`48b83c1b8`) and after on the RM steps (RM1–RM9c) and the three cage steps: the cage's
  pole rings and edges alike; RM9b's voxels the same, those behind the arm and base faint.
- **Bench** (`bench:browser` row `cloud: 100 000 voxels` new, through a DEV hook `__studioSetCloud` around the arm), run
  alone, the same script and hook on the pre-G8 code in the verify worktree: task 55.54 → 2.91 ms a frame, GPU 55.13 → 6.62
  ms a submit, wall 4 427 → 2 407 ms (load 57–59 before, 53 → 32 after: LOADED). Budget task 8, GPU 14 (about twice), for
  G13. The `explode:` row's 2-in-one-frame miss came up in this after-run too (G7's runs saw it only before): not the
  overlays; for G13.
- **Checks** (v2): gpu tsc and eslint clean, unit 77/77, browser 9/9 (14 s); studio tsc and eslint clean, suite 192/192 (26 s);
  FLOW_ONLY on WebGPU (curves and surfaces, the pole drag, R8.2, R8.3, D84 by hand, RM1–RM9c) 15/15 before and 15/15 after
  (43 s), and on WebGL2 on `d4c7af4e5` (cage and RM steps) 13/13 (66 s, the load at 78). Not run: the full flow (the
  coordinator's), the cad-model suite (not touched), the other benches (no other frame path changed).

## G9 — scene-level trees for picks (2026-10-22)

- **Two trees** (`geometry.ts`: `sceneTree`, `sceneRay`, `sceneNear`, on the same median-split builder as the per-geometry
  BVHs, now `buildBvh`): over the triangle meshes' world boxes, one leaf a mesh or an instance, for rays; over the line and
  point meshes' world boxes for the pointer. Leaf boxes are widened by a millionth of their diagonal past the slab test's
  own tolerance, so nothing a per-mesh test finds is ruled out. Made again lazily at the next pick after a mesh is added,
  removed, cleared or moved (`Mesh.transform`, `setInstances` → `Viewer.sceneMoved`); visibility, pickability, opacity and
  the clip plane are read at the pick, as before.
- **raycast**: the leaves the ray enters, nearest entry first, until one starts past the best hit; ties to the earliest
  leaf (mesh order, then instance) — the walk's rule. **hidden** (G3's depth test for pickLine and pickPoint): the leaves
  entered before the point. **pickLine / pickPoint**: the per-mesh search, unchanged, on the meshes whose box lands within
  the reach of the pointer (`rectDistance`), in their order.
- **Found by the equality test** (G9-D1): under a clip plane, `clippedRay`'s cap is wherever the ray crosses the plane once
  its first kept-side hit is a back face — on a ray grazing a box's edge (its front face missed within tolerance, its back
  hit) that crossing can lie outside the box, so a box-entry bound dropped a hider the walk had (9 of 1 500 picks differed).
  A capped mesh under the plane is now bounded by min(box entry, plane crossing), the crossing computed as `clippedRay`
  computes it. The cap's own behaviour on such rays is today's and is kept; it is noted here, not changed.
- **Points** (G8's brute force): a point mesh of 256 or more points is searched through a hierarchy of its points
  (`bvhOf`, one vertex an element), nodes passed over when their screen rectangle is farther than the best so far. The rule
  is now exact under any visit order: nearest by d² compared directly, ties to the lowest index (G8 compared d² with the
  best's √d² squared, which only differs at a rounding-level tie). The walk (`accelerate` off) uses the same rule.
- **`Viewer.accelerate`** (internal, default true): false keeps the linear walks, the reference the test compares against.
- **Evidence**: gpu browser test G9 — 150 turned boxes and their edges, a 60-instance mesh, a two-sided quad, a see-through
  box (hides nothing), 100 000 + 150 + 60 points (one mesh over the scene); 500 random pointers × raycast, pickLine,
  pickPoint, with the trees and with the walks: the same mesh, instance, triangle, face, cap, segment and point index, the
  same distances, points equal (worst 0), plain, under a capping clip plane and after a quarter of the boxes moved.
- **Bench**: in that test, 500 pointers (load ≈ 20): raycast 46.5 → 3.6 ms, pickLine 77 → 7.9 ms, pickPoint 289 → 9.8 ms
  (linear → trees). `bench:browser` on the studio's 120 brackets (DEV `__studioViewer`), 500 pointers, the same answers:
  raycast 26.6 → 4.1 ms, pickLine 4.1 → 3.4 ms (load 26 → 19). New rows `hover: 60 moves across 120 brackets` (63.8 ms of
  task in all, 70.1 before G9 in the verify worktree) and `pick: a bracket clicked` (47.7 ms, 43.2 before): both are the
  App's own updates on each move and click (its cursor readout, the selection), not the picks — those are 0.053 → 0.008 ms
  a raycast. 100 000 points picked: G8's 3.5 ms a pick → 0.02 ms.
- **Checks** (v2): gpu tsc and eslint clean, unit 77/77, browser 10/10; studio tsc and eslint clean, suite 192/192 (the first
  run's 2 failures were G9's DEV hook reading `import.meta.env` under node: guarded, `7a375e7ff`); FLOW_ONLY on WebGPU over the
  steps that pick, select, hover, mate, place instances, section or measure (67 steps by name, plus step 1): 75 passed and 4
  failed for want of earlier steps FLOW_ONLY left out (the extend-surface step reads the imported source; the instance steps
  the saved part) — steps 46–60 run together: 16/16. Not run: the full flow (the coordinator's), the cad-model suite.

## G10 — copies share one tessellation (2026-10-22)

- **Where it stood**: P6's note ("copies turned about Z are tessellated as placed") is older than `evaluatePlaced`'s
  `samePlacedBody`, which compares names without their renumbering: probed on the bracket, every copy turned 0°, 37°, 90°,
  180° about Z (and with a quarter turn about X) comes back from the engine as the part's own tessellation moved — the same
  indices, positions within 4e-6 mm (float32) of P applied to the part's. What was per copy: `placeBody`'s world copy of
  that mesh, and in the viewer a geometry (surface and edges) uploaded for each. The engine side is unchanged (the kernel's
  placed evaluation still checks each copy's topology; no core files touched).
- **Viewer side** (`gpuRenderer.ts`): `InstanceItem.placement` (App: `placementOf` of the placement the bodies were
  evaluated for, as a 4 × 4). A body joins a **shape** — a reference copy's display mesh, its placement's inverse, one
  surface and one edge geometry, and the meshes drawing them — when its topology key (sizes and a sample of indices) is the
  shape's and `movedCopy` holds: the same indices and faces of vertices, and positions and edge points within 4e-7 of the
  largest coordinate (normals 1e-5) of T applied to the reference's, T = P · P_ref⁻¹. It is drawn through T under its pose
  (`placePreview`). Otherwise it starts a shape of its own; a body without a placement (the CPU section's clipped copies)
  draws its own geometry as before. A shape is released with its last mesh; its reference copy can go first.
- **Private while painted** (`bindShares`, each paint): a copy with picked faces (mates) — face colours are vertex colours —
  or whose look has a texture or a shader material (uvs come from its own positions) takes a private geometry, and draws the
  shape again when that clears; so does one wanting another base colour than the shape's first sharer. The shared geometry
  is painted once, in its sharers' base colour.
- **`shareCopies`** (internal, DEV `__studioShareCopies(on)`): false makes every copy its own again — the flow's oracle.
- **Evidence**: studio `instance-pose.test.ts` G10 — four copies turned 0°, 37°, 90°, 200° and placed: two geometries, every
  mesh on them, each drawn within 1e-4 mm of its own mesh (surface and edges), posed under its pose; an edited copy (its
  second hole moved) and a copy scaled 1.001: their own; picked faces: private, then shared again; the reference gone: the
  rest kept; all gone: every geometry released. Flow step G10 — 24 brackets turned in 15° steps on a ring: 48 meshes on 2
  geometries; sharing off and on: 0 of 1 296 000 pixels differ by more than 96 (the largest difference 1), 400 pointers aimed
  at the copies (255 on one), the same mesh and triangle at every one, points within 5e-6 mm; one copy then edited (its hole
  moved and widened): it alone on two new geometries, the other 23 keeping their meshes.
- **Bench** (`bench:browser` row `pattern: 120 turned brackets opened`, the same script on `98f7dc4be` in the verify
  worktree, each run alone at load 33 → 26 and 25 → 21): uploaded 2 003 → 85 KiB; 240 meshes on 240 → 2 geometries, their
  arrays 2 590 → 22 KiB; JS heap after 122.3 → 107.6 MiB (the main thread still keeps each copy's world `BodyResult`: mates,
  mass and checks read them). The explode, section, pose and pick rows unchanged within noise (the brackets there,
  translated copies, now share too); the explode row's 2-in-one-frame miss came up in the after-run, as it has before (G13).
- **Checks** (v2): studio tsc and eslint clean, suite 193/193 (+1, the G10 renderer test); FLOW_ONLY on WebGPU on `8cfb5fad5`
  (steps 46–60, the RM steps, explode, assembly and pattern steps, G10): 31 + 2 failures — G10 by its own too-few-hits check
  (random pointers, the camera of earlier steps; aimed at the copies now, `test(cad-studio)` commit) and step 81, which counts
  exactly one instance after step 57 had placed one; G10 with step 81 and its fastener steps 78–80 on the fix: 6/6. gpu
  untouched (its suites as at G9). Not run: the full flow (the coordinator's), the cad-model suite.

## G11 — order-independent transparency (2026-10-22)

- **Choice (G11-D1)**: weighted blended OIT (McGuire–Bavoil), not depth peeling. It keeps the outline and cap behaviour —
  the outline mask is its own pass over the meshes (unchanged), and caps are drawn only for opaque meshes — so the
  coordinator's condition for depth peeling did not arise. It is one extra geometry pass for the see-through surfaces
  whatever their depth complexity, works with the 4× multisampling as it is, and is exactly order-independent (sums and
  products), where peeling is exact in colour but costs a pass a layer and needs per-sample depth reads. Its price: two or
  more overlapping layers blend by a depth weight, not exactly "over" — a nearer layer counts more, the farther still
  shows. One layer alone is exact (the test: equal to the sorted path within 1).
- **Frame** (`drawFrame`): with a see-through triangle mesh in view (`oitSurface`: transparent, not a shadow catcher),
  three passes —
  1. the opaque scene: surfaces, caps, the grid, shadow catchers (they darken the ground), opaque lines and points; its
     multisampled colour kept;
  2. the see-through surfaces into `accum` (rgba16float, premultiplied colour × w, added) and `reveal` (r16float, × (1 −
     alpha)), multisampled and resolved, tested against the opaque depth, writing none; w = clamp(1 / (1e-3 + (d/2)³),
     0.01, 3000) with d the view depth over the scene's radius (`frame.viewport.w`);
  3. their composite over the scene (`oitWGSL`: the weighted average where the revealage leaves room, as a premultiplied
     surface), then the see-through and drawn-over lines and points, sorted far to near as before.
  Without one, the single pass as before. Shader materials get the same `O` variant (`fsLitOit`, `fsUnlitOit` in every
  surface module); `Viewer.orderIndependent = false` (internal) keeps the sorted path.
- **Lines (G11-D2)**: opaque lines and points are drawn in the opaque pass, so a see-through surface in front dims them —
  and so does one exactly at their depth or just behind (lines write no depth); see-through lines (a body's 0.6 edges) and
  lines drawn over the scene are drawn after the composite, undimmed. Before, it depended on the meshes' box centres. To
  tune with the ghosting looks if wanted.
- **Evidence**: gpu browser test G11 — two boxes through each other with the same centre (so the sort keeps the order they
  are added in), 0.5 and 0.45 opaque, added in both orders: 0 pixels differ by more than 3 (ΣRGB; the largest 2, f16
  rounding), where the sorted path differs on 8 829 (the largest 98) — the test can tell; one 0.35 layer, outlined, before
  a box cut and capped by the clip plane, a 0.8 line over it: as the sorted path drew it (the largest difference 1).
  Flow before (`f3b850593`) and after (render a part, proposals' ghost, A6.3's ghosted reference, IM7, IM7a, G6, G10):
  8/8 both; every screenshot the same but A6.3's (its hole's cylinder now even through the ghost's walls; 10 pixels past
  96) and G6's halves (0 past 96, the largest 86) — the two with see-through surfaces over each other.
- **Bench** (`bench:browser`, the 120 brackets ghosted: their surfaces 0.35 through the DEV viewer, orbited 60 steps, at load
  13): GPU 2.67 ms a submit sorted, 2.83 ms order-independent; task 4.38 → 4.34 ms a frame. Budget GPU 8 (the 120-bracket
  rows' is 44).
- **Checks** (v2): gpu tsc and eslint clean, unit 77/77, browser 11/11; studio tsc clean, suite 193/193; the flow and bench
  above. Not run: the full flow (the coordinator's), the cad-model suite.

## G13 — hygiene (2026-10-22)

Measured before anything was changed; the coordinator's order.

- **1. Shadow-map redraws (G13-D1: the metric, not the map)**. With the main thread otherwise idle — the 120 brackets moved
  by their meshes' transforms through the DEV viewer, `render()` then the queue's `onSubmittedWorkDone` — the GPU's own
  time a frame is 2.2 ms still, 2.7 ms with every caster moving (the shadow redraw ≈ 0.5 ms; a 1024² map 0.2 ms less; AO
  off 0.1 ms less). The bench's 15–22 ms on the pose, explode and section rows was its GPU column — the wall time from a
  submit until that promise resolved, which waits on the main thread (14–17 ms of task a frame on those rows; 2.7 on the
  orbit, where it read 2.3). So the shadow map is left as it is. `bench:browser` and `bench:assembly` now ask the device
  for timestamp queries and add every render pass's begin–end (`GPU`), keeping the old figure as `queue`; with them the
  pose reads 0.97 ms, the explode 1.24, the section 1.83. One real GPU cost shows: the 100 000-point cloud, 8–10 ms (for
  G14, display LOD).
- **2. The explode row's "2 in one frame"** (1 run in 8 here): both submits were the Viewport's own frame callback
  (`Viewport.tsx`, by their stacks), 2 ms apart under one timestamp — two frame batches headless Chromium stamped alike
  under load; one Viewport, one guard, so no double draw. The bench now counts a frame as a batch of animation-frame
  callbacks (a new one when the timestamp changes or a message posted from the last has arrived — tasks run between
  batches only) and reports `frames stamped as the last` when it happens. In the 4 full runs since, rows saw such
  frames (the pattern row twice, the explode and CPU-section rows once, one frame each), counted apart — and no batch had 2 submits.
- **3. The App's hover and pick** (CPU profiles of the 120-bracket rows): a hover move is ≈ 0.5 ms of JavaScript, most of it
  React's scheduling; the viewer's share is the scene bounds per pick (`unionBox`, 1.2 ms over 60 moves — fixed under 4)
  and the scene tree's one build (1.1 ms). A click on a bracket is 55 ms, 36 of them `jsxDEV`: React's development build
  making the App's panels again on a selection change (the bench runs the dev server). In the viewport: the view cube is
  now drawn only when the camera turns (`memo` on its basis; its callbacks read the viewport's refs) and its parts keyed by
  face and cell, not by their points (React made each polygon again on every turn). The App's panels — memoised against a
  selection change, or measured on a production build — are the UI side's; noted for the coordinator.
- **4. Per frame**: V8's sampling heap profiler over a 60-step orbit and a 60-step explode of the 120 brackets, the viewer's
  functions in its top 22: 10 645 → 4 732 KiB (orbit), 22 927 → 4 069 KiB (explode); all sampled, React included, 20 973 →
  14 098 and 135 965 → 110 120. What changed: the shadow key in a kept typed array (an array of numbers emptied and filled
  was a new store a frame: 4.4 MiB); `sceneBounds` grown in one box (`growBox`); `transformBox` without corner arrays;
  the object block written in place (`normalMatrixInto`, its words, its colour); the visible lists and transparent entries
  kept, numeric sort keys (`pipelineOrder`); the frame block and a draw's dynamic offset reused; the studio renderer's
  bounds kept while their inputs are the same objects. Left: `transformBox`/`multiply` for each moved mesh (its new world
  box, the copy's matrix), render-pass descriptors.
  - **The outline mask** draws only the meshes whose screen box meets the outline's rectangle (outlined ones always),
    scissored to it — the output reads the mask there alone.
  - **Optional uvs**: a geometry without them keeps none (`PreparedGeometry.uvs` null) and binds one zero buffer the viewer
    shares (grown by doubling); `setUVs` gives it its own. For a 120-bracket assembly's geometries, 8 bytes a vertex less
    kept and uploaded.
- **5. Budgets** (`bench:browser`, `bench:assembly`, `bench-mesh-browser`): every row from three runs alone at a load of
  12–17 — the machine had no quieter window with the other lanes working — about twice the worst of the three, the GPU's
  (timestamps) with a 3 ms floor. Notable: pose GPU 32 → 3, explode 44 → 4, section 44 → 6 (they were the queue's wait);
  the 100 000-voxel cloud 14 → 17 (its GPU time is real); bench:assembly's buffers 1 500 → 60 (24 since load with G10's
  sharing). All 17 `bench:browser` rows pass on the new table; bench:assembly 3/3; bench-mesh-browser 3/3 but one run's
  million-triangle save (318 ms; 113 and 128 in the others), its budget from that run.
- **Evidence and checks** (v2): gpu tsc and eslint clean, unit 77/77 (one updated: no uvs given, none kept), browser 11/11;
  studio tsc and eslint clean, suite 193/193; FLOW_ONLY before (`2a770898e`) and after over render looks, measure, mass,
  proposals, double-click, RM1, RM2's posed sections, O68, G6, G10 (11 steps): the same pass/fail both (surface analysis
  fails in both, for want of earlier steps), and every viewport screenshot identical (0 pixels past 8) — the only
  differences a render's progress readout (2.48 / 2.45). Not run: the full flow (the coordinator's), the cad-model suite.

## G14 — display LOD: measured, two fixes, stopped (2026-10-22)

- **Measured** (the bench harness with render-pass timestamps; orbit 60 steps and 30 still frames; load 15–35):

  | case | GPU a frame, orbit / still |
  |---|---|
  | 100 000 points spread over a 120 mm cube | 3.0 / 2.6 ms |
  | the same around the 2R arm (the bench's cloud row: dense on screen) | 8.26 / 7.33 ms |
  | — its hidden-parts pass off | 4.68 ms |
  | — points of 1 px | 4.64 ms |
  | — 25 000 points | 3.53 ms |
  | 200 000-triangle mesh (organic) | 1.5–2.5 / 1.5–2.5 ms |
  | 1 000 000-triangle mesh | 3.0 / 2.7–4.2 ms |

  The dense cloud is fill and blending (≈ 2.5 M fragments a pass piling onto the same pixels), and a second pass for its
  hidden parts (G7's `lineHidden`, 0.35) that shaded every point again.
- **Fix 1 — no discard in the point shader**: a point writes no depth and always blends, so where it does not cover (or the
  clip plane cuts it) it returns transparent black instead of discarding; a pipeline without discard keeps the depth test
  ahead of the fragment shader. The hidden pass 3.6 → 1.4 ms; orbit 8.26 → 6.11 ms.
- **Fix 2 — quads half a pixel smaller**: a point's quad reached a whole pixel past its half size; its coverage ends half a
  pixel past (a point of 3 drew 5 × 5, now 4 × 4). Orbit 6.11 → 4.67 ms, still 4.75 → 4.23 ms, 25 000 points 2.0 ms. The
  edge fringe — pixels under half covered — now keeps only the multisamples inside the quad: RM9b's screenshot within 42 of
  765 (ΣRGB) of before at 994 pixels, the cage's pole rings and vertices as before (the other differences in those flow
  shots are a panel's preview time and a picked face's SVG tint caught at another moment).
- **Stopped (G14-D1)**: no density LOD for points — a cap on the points drawn where they pile up would take most of the
  remaining ≈ 3.5 ms but change which voxels (and colours) show, and 4.7 ms is a quarter of a 60 Hz frame. No levels of
  detail for meshes — a million triangles orbit in ≈ 3 ms of GPU; simplified levels would cost their memory (≈ 1.3× the
  mesh), popping between levels and the question of which level a pick is against, for at most ≈ 2 ms. The million-triangle
  orbit's main-thread time (6.4 ms a frame, 3.5 for 200 000) is React's development build re-rendering the App (`jsxDEV`,
  39 ms over 60 frames), not the viewer: with G13's panel item for the UI side — which the outer lane measured on a
  production build (O141): about 1.5 ms of JavaScript a later click, so no memoisation was needed. Worth revisiting for meshes past ≈ 5 M
  triangles or clouds past ≈ 500 000 points, neither of which the studio makes today.
- **Bench**: `bench:browser`'s cloud row 4.03–4.73 ms of GPU in two runs (load 34–113); its budget 17 → 10.
- **Checks** (v2): gpu unit 77/77, browser 11/11 (G8's shapes, rings, picks unchanged); studio suite 194/194; FLOW_ONLY on
  WebGPU, before (`2c5a345e5`) and after, RM1–RM9c and the three cage steps: 13/13 both. Not run: the full flow (the
  coordinator's), the cad-model suite.

## G15 — text labels, an SDF atlas (2026-10-22)

- **Glyphs** (`viewer/glyphs.ts`): each character drawn once into a 64² cell by the browser's own 2D canvas
  (`OffscreenCanvas`), 44 px to the em, in the label font — one the page already has; no font file is ours or downloaded
  (the studio sets IBM Plex Mono, which its stylesheet already loads, and draws the glyphs again once that web font has
  loaded: `redrawGlyphs`). The coverage, thresholded at a half, becomes a signed distance field by our own transform
  (Felzenszwalb–Huttenlocher's exact squared Euclidean distance, two passes of 1D lower envelopes; the test checks it
  against brute force on random seeds), ±8 px to 0 and 255, 128 on the edge. Cells in one 2048² r8 atlas (1 024 glyphs; a
  full atlas draws no more and says so), uploaded as they are added and again after a lost device.
- **Labels** (`Viewer.addLabels`, topology `labels`): a label's lines laid out at the glyphs' advances, 1.25 em apart,
  placed at its anchor by `align` and `offset`; one 80-byte instance a glyph, two for a chip (its fill, its 1-pixel border).
  A screen label is `size` CSS pixels high whatever the zoom, about its anchor's projection; a plane label lies along its
  plane's right and up, `size` its height in world units. The shader cuts a glyph's edge at the field's middle over
  `fwidth` of it — a device pixel at any magnification — and a chip's rounded box by its distance in device pixels. Depth:
  the points' rules — tested at the anchor (screen) or the quad (plane), `lineOver`, `lineHidden` for the hidden parts.
- **Studio**: `ViewRenderer.setOverlayLabels(key, …)` beside G7's lines and G8's points. The measure readout (at the line's
  middle, hidden parts at the line's 0.75) and the box's size chip (above the box, 0.4 of its diagonal over its top, 0.6),
  the SVG chip's colours a theme (`.dim-chip`, `.dim-text`: dark #121315 / #fff / the accent border, light #fff /
  #1b232c); the underlays' texts on the drawing's plane at their height, anchored at the first line's baseline-left as the
  SVG had them, #8a93a3 at 0.8, hidden parts at 0.35 (their lines'). Not moved: the sketch's dimension chips (hovered and
  clicked to edit, in the sketch's own 2D overlay) and the gizmo's readout (it follows the pointer while dragging).
- **G15-D1 (a label is tested at its anchor)**: a screen label takes its anchor's depth, so a surface in front of the anchor
  hides — faintly, with `lineHidden` — the part of the label it covers; a readout whose anchor is inside a body (a measure
  between two faces) is drawn faint as a whole. The box chip's anchor was lifted clear of the box for that reason.
- **Evidence**: gpu `glyphs.test.mjs` (new, 3): the transform equal to brute force on four grids; a disc's field above 128
  inside, below outside, 4.5 px out at the expected value; the layout's lines, advances, centring and the chip's two
  instances. Browser test G15: a 16 px chip the same size three times as far (86 → 86 px wide, 12 high), its fill
  #121315-dark and its border gold; a plane label twice as wide twice as near (100 → 210 px); magnified about 20 times,
  each edge at most 1 pixel soft; under a box hidden (no pixel past the box's own), faint with `lineHidden`, over it with
  `lineOver`; 16 glyphs for 16 distinct characters; a new font laid out again. Flow before (`eab5e666c`) and after on
  measure, mass and box, O68, the light theme: 5/5 both; the readout and the note where they were (the readout faint, its
  anchor inside the box), the size chip above the box; WebGL2 5/5 (its SVG).
- **Bench**: the underlay row (100 texts) task 8.1–8.7 → 2.5–3.0 ms a frame, GPU 1.5–2.1 ms (load 17–33); its task budget
  16 → 6. The one-frame select and clear rows' GPU floor 3 → 4 ms (one run at load 33 drew 3.07).
- **Checks** (v2): gpu tsc and eslint clean, unit 80/80, browser 12/12; studio tsc and eslint clean, suite 194/194. Not run:
  the full flow (the coordinator's), the cad-model suite.
- **G15-D2 (the coordinator's change to D1, 2026-10-22)**: the measure readout and the box's size chip are drawn over the
  scene (`over`), at full strength, as the SVG drew them — a readout anchored between two faces is almost always inside the
  body, and a faint readout fails at the one thing it is for. The anchor's depth rule (with the hidden share) stays for the
  underlays' texts and other world labels.

## G12 — a proposal's two-colour overlay (2026-10-22)

- **On the outer lane's `proposalDiff`** (O136, integration `d2e4c1860`, merged here as `7351f2348`): added and removed
  material as display meshes with their volumes (the analytic Boolean of each side's united bodies), the changed faces by
  persistent name, the method (`faces` with why where the Boolean refuses).
- **Where it runs**: the engine worker (`proposalDiff` request): both sides evaluated in part slots of their own — the
  base in `read`, the proposal in `agent` (where its preview was just made) — then `proposalDiffFor`, kept by the base's
  revision (`modelHash`) and the proposal with what is left out; the two meshes in a reply slot. The App asks whenever the
  proposal shown changes (previewed, rebased, a feature ticked); none without one.
- **Drawn** (`GpuRenderer.setProposalOverlay`): the added material `#57b26b` and the removed `#e5534b` (the view triad's
  green and red), each a see-through (0.5) two-sided surface through G11's order-independent pass, with its edges (0.9,
  hidden parts 0.35) and a chip of its volume (+500 mm³ / −101 mm³) over the scene as readouts are (G15-D2). The surfaces
  are **decals** (`Material.decal`, new: the surfaces' depth bias reversed, a `D` variant of the surface pipelines and of
  shader materials'), so where the removed material shares the base's faces (the before view) or the added shares the
  proposal's (the after view), the overlay wins without z-fighting. The blue preview tint is off while the overlay shows.
- **Faces instead** (`proposalTint`): where the method is `faces`, or on WebGL2 (no overlay), the shown bodies' faces are
  tinted through `faceColors`: those added or changed green on the after view, removed or changed red on the before view.
- **Evidence**: flow step G12 (new, before the theme step) — a 40 × 20 × 8 plate, a proposal of a Ø4 through hole and a
  10 × 10 × 5 block beside it: method `boolean`, added 500.0 mm³, removed 100.53 (π·2²·8), 9 faces changed; on WebGPU the
  two overlay meshes drawn, the block's pixel green-led (green over red by 20 and over blue by 10 — with the blue preview
  tint still on it was cyan, 119/187/201, which is why the tint is dropped), the hole's red-led (over green by 20); before and after both shown (the screenshots: the red core in the hole after, the red disc on the top and
  the floating green block before); rejected, the overlay gone. WebGL2: the faces tinted (`tinted: true`). Step 98 (the
  proposals' rebase, accept in part, reject) passes on both renderers with the tint change.
- **Checks** (v2): gpu tsc and eslint clean, unit 80/80, browser 12/12; studio tsc and eslint clean, suite 196/196;
  FLOW_ONLY (G12 and step 98) 3/3 on WebGPU and 3/3 on WebGL2. Not run: the full flow (the coordinator's), the cad-model
  suite (not touched), benches (no frame path changed but the decal pipelines' creation).

## G16 — WebGL2 parity: curves and surfaces, a dragged body's turn, edge picks' depth, the proposal overlay (2026-10-22)

All four items are brought to parity on the WebGL2 fallback (`viewport/renderer.ts`); none stays WebGPU-only.

- **A dragged body's turn**: the mesh and line programs take a model matrix (`uModel`) and a normal matrix (`uNormal`,
  the inverse transpose) instead of `uOffset`; a body is drawn by its gizmo drag's matrix (`ViewState.transforms`), else
  moved by its offset (`placeBody`). Face and edge picks move it the same way. Before: the move only, the turn not shown.
- **Edge picks pass over what a surface hides (G3 on WebGL2)**: a pick pass of its own (`pickPass`, a second program on
  the mesh's vertex shader) writes an id and the depth (24 bits, packed into RGBA8) to two colour targets at once — the
  opaque bodies as drawn (their polygon offset too) and the direct surfaces; it is drawn again only when the scene or the
  camera changed, so a pointer's face pick and edge pick share it. `pickEdge` takes each body's segments within the radius
  nearest first, its point nearest the pointer (back through the perspective), and passes over one when the depth at its
  pixel lies in front of the point brought a pixel and a half nearer the eye (in world units at its depth) — the GPU
  viewer's rule — trying up to 16 a body. Ghosted and hidden bodies neither hide nor are picked. Before: a CPU search with
  no depth, an edge at the back of a body picked through its faces.
- **Direct curves and surfaces**: `setDirect` and `pickDirect` on WebGL2 — surfaces lit, two-sided, in the GPU's blue
  (`#8fb3d9`) or the accent when selected; curves as wide lines (2 CSS px, selected 3, `#5ec8e5` / `#ffd35c`); a selected
  one's isocurves (1 px, 0.55) and control net (1.2 px, `#c9a3ff`); they count in the bounds (F frames them). `pickDirect`:
  a curve within 6 px that a surface does not hide, else the surface under the pointer (its id in the pick pass); a direct
  surface in front of a body is no face (as the GPU's raycast). The browser's "Curves and surfaces show in browsers with
  WebGPU" note is gone. **Left out**: the outline round a selected surface (the GPU viewer's outline pass; the accent
  colour marks it here).
- **The proposal overlay (G12)**: `setProposalOverlay` on WebGL2 — the added (green) and removed (red) material
  see-through (0.5), lit, two-sided, pulled in front of the faces it lies on (polygon offset −1 against the bodies' +1:
  the decal), with its edges at 0.9 and at 0.35 of that where hidden (a second draw with the depth test reversed). The
  volume chips are SVG in the viewport's overlay where the renderer draws no labels (`aria-label` "Material added" /
  "removed"). The faces tint (`proposalTint`) is now only for the `faces` method, on either renderer.
- **Also**: `Renderer.capture()` (the frame drawn again and read in the same task, the canvas keeping none). DEV hooks
  for the flow, on either renderer: `__studioPixels(points)`, `__studioFrame(n)`, `__studioEdgeAt(point)`,
  `__studioDirectAt(point)`, `__studioEye()`.
- **Evidence**: flow step G16 (new, before the theme step), the same assertions on both renderers —
  - the study fixture's panel lit blue and picked, the arc's quarter point drawn and picked, the panel clicked in the
    canvas selected (the accent);
  - a 40 × 20 × 8 plate: at the midpoints of the three edges at its corner farthest from the eye no pick finds them; at
    the nearest corner's three each is found;
  - turned 45° about X with the Rotate gizmo: the frame mid-drag (32 × 32 samples) against the frame the turn makes and
    the frame before the drag — WebGL2 0.48 and 8.32 (WebGPU 0.55 and 7.33).
  - On the old behaviour the step fails: with the depth test off (`shown` always true) at the edges; with the transforms
    ignored (offsets only) at the turn (mid-drag 11.9 from the result, 5.3 from before).
  - Step G12 on WebGL2 now draws the overlay: `tinted: false`, the chips `+500 mm³` / `−101 mm³`, the block's pixel
    green-led and the hole's red-led — the same pixel checks as WebGPU (through `__studioPixels`, the GPU-only capture
    replaced).
- **Checks** (v2), in the detached verify worktree on `921b6e4bd` plus these changes: studio tsc clean, eslint 0 errors
  (the flow's console warnings as before), suite 196/196; gpu unit 80/80 and browser 12/12 (not touched; 63 s with the
  studio's, load 42–78). `FLOW_ONLY` on the steps each item touches — the direct steps 49–55, 46–48, 56–57, 63, the edge
  steps 31/33/84, 98, G12 and G16: WebGPU 20/20 in 35 s; WebGL2 19/20 in 49 s (load 31–78), step 31 (fillet from the
  palette) failing on its immediate read of the outliner after the fillet — it failed the same way in the WebGL2 run before
  these changes (load 364) and alone passes one run in two: a flake of its own, not of the renderer. Not run: the full flow
  (the coordinator's), the cad-model suite (not touched), benches (the WebGPU frame path is unchanged; the WebGL2 renderer
  has none).

## G17 — the 3D skeleton sketch tool in the viewport (2026-10-22)

On the outer lane's model and solver (FRf O121 skeleton nodes, FRg O122 `solveSketch3D` with its typed diagnosis, O140
values bound to parameters; integration `cadfe4700`, merged here as `83bf01685`). Nothing in cad-model changed: the
command is the studio's (`SKETCH3D_COMMAND`, "3D sketch", keywords `3d sketch` only — "skeleton" stays the Frame
command's, FR2's rule), offered after the model's in the palette (`Palette`'s `extra`).

- **The viewport's tool hook** (`ViewportTool`, `ToolView` in `Viewport.tsx`): a tool takes the left button before the
  viewport's own picking (orbit, pan, wheel stay the viewport's) and draws its marks in the SVG overlay — alike on both
  renderers, over the scene as the thing edited. `ToolView` gives pixels of world points, the ray under a pixel and the
  shown bodies' corners.
- **Placing** (`skeleton/skeletonTool.ts`): a point goes on the sketch's own point within 10 px (reused: segments meet
  there), else a body's corner within 10 px (in 3D: the end of one of its edges), else with an axis lock (X, Y, Z) on the
  line through the last point along it (the closest point to the pointer's ray), else on the work plane (XY, XZ, YZ;
  keys 1–3, Tab) through the last point — on the grid (the snap step). Each click joins the last point; a click back on
  one of its points closes the chain; Esc ends it.
- **Dragging, solved live**: a point dragged on the work plane through where it was (or along the axis lock), snapped to
  the other points and corners; each move solves through FRg's LM in two passes (`dragSolve`) — first with the point
  held at the pointer (a `fixed` constraint added): where the constraints let it go there it lies under the pointer and
  the rest move as little as they can (LM's small step); where they hold it (the hold left unmet) the constraints alone
  from the pointer as the start, the point as near as they let it. A fixed point does not move. **No solver API was
  needed**: a weighted target would give the same where the point can reach the pointer; where it cannot, the two-pass
  result is the constraints' nearest solution from there rather than a weighted compromise — the dragged point is never
  left off its constraints.
- **Constraints and diagnosis** (`SkeletonPanel`, `SkeletonMarks`): the selection's offers — a segment: length (as it
  is), along X/Y/Z; two segments: parallel, perpendicular, angle; two points: coincident, distance; a point: fix, on the
  work plane, on an axis — each solved on add (the points settle where they can). The constraints listed with their
  values (editable; a bound one shows its parameter), each a mark on the canvas beside its segment or point (a click
  picks it). FRg's diagnosis: the status chip (Fully defined / Under-defined · n free / Over-defined · n redundant /
  Conflict · n unmet), free points blue, redundant marks amber, unmet red; Apply refused on a conflict.
- **Session**: ⌘Z / ⇧⌘Z its own undo, Delete the picked points, segments or constraints (the constraints on them with
  them, the rest renumbered), Enter Apply, Esc (chain, axis lock, selection, then the session). Apply writes one
  skeleton feature — new, or the one edited from the timeline ("Edit in 3D sketch") — stored solved (`solvedSkeleton`)
  and checked against the frames that follow it (`skeletonEditRefusal`). The part changing under an edit ends it with
  nothing written. Applied skeletons are drawn faint (dashed) in the viewport.
- **Evidence**:
  - studio unit `test/skeleton-tool.test.ts` (6): the plane and the axis line under a ray, the grid, snaps (own point,
    else corner, else none); drags — a free end reaches the pointer with the constrained segment kept, a constrained end
    is held (10, 0, 0), a fixed point does not move, a free segment's length kept by its other end moving; the diagnosis
    (well at 0 degrees of freedom, a conflict, an unbound parameter refused); offers by selection; removal renumbering.
  - flow step G17 (new, before the theme step), the same on both renderers: a 40 × 20 loop drawn on XY in the top view
    (4 points, 4 segments, under); point 0 fixed, side 0 along X at 40; corner 2 dragged — under the pointer mid-drag
    and at the end (< 3 px); corner 1 dragged — held (< 1.5 px); the rest constrained to Fully defined; sides 0 and 1
    parallel — Conflict, the marks red, Apply disabled; undone; applied — the node's points back on the 40 × 20 (to
    1e-6), its seven constraints, drawn faint; the 40 × 20 × 8 plate in the iso view, a new sketch's first point clicked
    near its top corner lands on (40, 20, 8) (< 1 px); cancelled, nothing written.
- **Also in this checkpoint**: step 31 (fillet from the palette) waits for the outliner's body count after the fillet,
  as other steps do (the coordinator's fix for its WebGL2 flake); README §0 has the WebGL2 support statement.
- **Checks** (v2), in the detached verify worktree on `83bf01685` plus these changes: studio tsc clean, eslint 0 errors
  (the flow's console warnings as before), suite 203/203 (197 + the 6 new); gpu unit 80/80 and browser 12/12 (not
  touched; 87 s with the studio's, load 46–48). `FLOW_ONLY` on every FR step (FR1–FR4b, FRb–FRf2, both FRg), step 31,
  G16, G17 and the theme step (its palette): WebGPU 21/21 in 79 s, WebGL2 21/21 in 138 s (load 23–47). Not run: the full
  flow (the coordinator's), the cad-model suite (not touched), benches (no frame path changed: the marks are SVG).

## G18.1 — the packed package: CAD external, no source, its consumer tests green (2026-10-22)

The owner's go for G18 ("G18 지금 셋다 합니다"), first of three. `packages/barocss-gpu` only; no version change, no
publish, no new dependency (the lockfile untouched).

- **CAD external (REVIEW G9)**: `build:library` bundles with `--external:@barocss/cad`. `dist/index.js` 1 240 049 →
  725 483 bytes (−41.5 %); CAD's own definitions gone from it (`function validateCoplanarFaceBooleanMesh`,
  `compileCadModel`, `tessellateSurface`, `sampleCurve`: 1, 1, 1, 3 → 0 each), seven `import … from "@barocss/cad"`
  in their place — a consumer installs CAD once, as the dependency (`0.0.0-experimental` in the packed manifest).
- **No source in the package**: `files` is `dist`, README, LICENSE (`src` dropped — the published entries are
  `publishConfig`'s, all `dist`). The tarball: 217 files, 472 350 bytes, `dist` only.
- **`test:consumer`** (3 tests) was failing at its first check (the pack held `src`); past it, two more stale checks:
  - the packed manifest's `private: true` — the package is public since #657 (`3caa10604`, its compiled entries); the
    check is now: not private, `main` `./dist/index.js`, CAD a versioned dependency;
  - a consumer's type annotation `schemaVersion: 1` — the compiler's IR has a version 2 (scenes of version 1, with
    rotations): `1 | 2`.
  The three tests share `tests/packed.mjs`: gpu's tarball and CAD's (its packed manifest's `dist` entries) unpacked
  under a scratch `node_modules`, as npm would install them; each consumer then runs as before (the ESM import, the
  compiler, the mesh packet, and a strict `tsc` of a consumer against the packed declarations, CAD's with them).
- **The workspace's own tests**: with CAD external, a test loading `dist` meets `@barocss/cad`, which the workspace
  resolves to CAD's TypeScript sources. `tests/cad-dist.mjs` (a resolve hook, `module.registerHooks`) points it at
  CAD's built entry — what a consumer gets — for `test` and `test:browser` (`node --import ./tests/cad-dist.mjs`);
  `scene-viewer-browser` maps it on its page (an import map, CAD's `dist` served beside the bundle).
- **Outside the package, noted**: the old example harnesses under `examples/gpu-scene/*.mjs` that import gpu's
  `dist/index.js` from Node need the same hook (`node --import ./packages/barocss-gpu/tests/cad-dist.mjs …`: checked on
  `boolean-buffers-flow.mjs`, which then reaches its own argument check); pages served by `examples/gpu-scene/server.mjs`
  need an import map for `@barocss/cad` — G18.2 (the demo hosts) takes that up.
- **Checks** (v2), in the verify worktree: gpu `build:library`, type-check and lint clean, unit 80/80, `test:consumer`
  3/3 (was 0/3), browser 12/12 (39 s, load 11–36); studio tsc clean and suite 203/203 (not touched: its `@barocss/gpu`
  is the workspace's sources). Not run: flows (no studio code changed), benches, the cad-model suite.

## G18.2 — the repeating UV shader demos in WGSL, on the WebGPU viewer (2026-10-22)

- **The lowering** (`packages/barocss-gpu/src/engine-uv-repeating-material-wgsl.ts`, new; the integration worktree's
  untracked `engine-uv-material-wgsl.ts` — another session's — read for reference only, not adopted, moved or deleted,
  and this file named apart from it so no merge meets it): `lowerEngineUVRepeatingMaterialWGSL` mirrors
  `validateEngineUVRepeatingMaterialIR` — the input reconstructed by it (its source compiled again, as the GLSL lowering
  does), the same tree; `uv_u`/`uv_v` as `engine_uv.x/y`, uniforms in the 64-byte `materialParams` slot (16 at most),
  `mix` the viewer's `material_mix`, the result clamped; every coefficient and uniform bound checked as f32 (finite,
  nonzero not flushed: RANGE, as G5's mesh lowering). Colour literals: the language's gamma-2.2 decode (the GLSL
  lowering's) or, with `srgb`, the exact decode for the viewer.
- **The viewer**: `materialShader` takes repeating UV sources (after the mesh profile, before UV01; a source refused
  by all gets the diagnostics of the profile whose inputs it reads — a `uv_u` source's RANGE, not the mesh profile's
  TYPE); `uvRepeatingShader(material, uniforms)` for a compiled material, its uniforms clamped into the slot.
- **The docs hosts** (`apps/library-docs/scripts/snippets/advanced-shader-host.mjs`, `reusable-shader-host.mjs`): off
  app-owned WebGL2 — the public preparer's binding drawn by `createViewer` as an unlit quad filling the canvas (uv 0..1
  across it, as before), its shader material the public WGSL lowering; the same interface (update, setUniform, report,
  dispose; created async, awaited by `VisualExamples.vue`). Their browser bundles have their own pin,
  `scripts/profiles/gpu-uv-repeating-webgpu-v0.json` (`6d5dcb69d`, the lowering's commit; 488 verified blobs, no dist
  inputs); the CPU consumers and the pages' material-profile pins (`7e96b959`, `363f583c`) are unchanged.
- **`examples/gpu-scene/server.mjs`** (G18.1's note): its `/gpu.js` is the GPU bundle with CAD's built entry folded in
  (esbuild, the root devDependency, once on the first request) — its pages' CSP admits no inline import map.
- **Oracle** (`tests/uv-repeating-browser.test.mjs`, in `test:browser`): the six docs demos (advanced, caustics, weave,
  contour, halftone, reusable), each at its defaults and at its uniforms' maxima, 96 × 96:
  - the WGSL lowering in a raw WebGPU pass against the GLSL lowering on WebGL2 (the old host's program), the same colour
    model: max 0–1/255 on five demos; on contour every pixel off by more than 2 (119 at the defaults, 467 at the maxima)
    lies on a jump — where `fract(elevation·bands)` wraps the f32 GPUs land on either side (the CPU evaluator, binary64,
    changes by more than 24/255 within 2e-5 of its uv) — and off them 0/255;
  - on the viewer (exact sRGB decode and encode) against the GLSL host: max 1–4/255, the colour model alone (its bound,
    the 2.2 power against the sRGB curve, is 8.55/255 at linear 0.0022); contour's jumps as above;
  - f32: a literal flushed to zero (`0.`+45 zeros+`1`) and one past the range (`1`+39 zeros) refused RANGE where the
    source compiles, so by `materialShader` too; an IR not the compiler's refused by the reconstruction.
  - `tests/uv-repeating-wgsl.test.mjs` (2, in `test`): the WGSL text's structure, the alias and the slot, the clamp of
    uniforms, the refusals, without a device.
- **The hosts on WebGPU** (`apps/library-docs/scripts/check-shader-hosts-webgpu.mjs`): each of the six presets drawn
  (a pattern: spread 155–236), a control moved changing 15–94 % of the frame, a refused source (TYPE) leaving the
  accepted frame (100 % of pixels kept), the report's backend "Example WebGPU viewer · public WGSL repeating UV
  material". The CPU consumers (`check-{advanced,weave,contour,halftone,reusable}-shader.mjs`) pass as before.
- **Checks** (v2), in the verify worktree on `11d36ef0b`: cad and gpu `build:library`; gpu type-check and lint clean,
  unit 82/82, `test:consumer` 3/3, browser 13/13; studio tsc clean, suite 203/203; `FLOW_ONLY` on step 48 (the render
  workspace's shader material, `materialShader`'s other user) on WebGPU 2/2 in 9 s (load 33–54). Not run: the full
  flow, the cad-model suite, benches, the docs site build (G18.3 builds it).

## G18.3 — the docs' example screenshots captured again with the current viewer (2026-10-22)

- **How** (`apps/library-docs/scripts/capture-examples.mjs`, new — there was no capture script; the old images were
  taken by hand): the site built locally (every `build-*.mjs` bundle, then `vitepress build`; 119 s + 25 s) and served
  from `docs/.vitepress/dist` by the script itself; each preset opened at `/playground#<anchor>`, its state set, and its
  element shot at the old image's width — the whole example panel (`section.visual-examples`, the 2× shots), the canvas,
  or the display pose's owned slot — the pixel ratio chosen from the element's CSS width (the site's fixed bar hidden,
  so a scrolled element is not under it). The states are the ones the pages describe or the old images show: the
  material functions at amount 0.25, the GPU material at 0 and 1, the two phase variants at π/2 (the old value cannot
  be read from those images; the caustics page suggests π/2), the adaptive sampling's coarser 0.2 mm, the quantity
  functions' default factor 1, the dome's rise 3.6 cm, the display pose's 90° pose, physics after 20 steps.
- **What changed in them**: the viewer's output (the WebGPU viewer and the G18.2 hosts in place of the old WebGL2
  ones: the shader demos as before within the colour model; the scenes framed by the current viewer, e.g. the rounded
  stack seen more obliquely; the dome and the quantity wall larger in frame) and, in the 2× panel shots, the example
  component's current layout (category tabs and the library / example selects in place of the old rows of buttons — so
  those images are 130–230 px taller). Six presets are application Canvas2D hosts, not the viewer (CAD curve, nonunit
  curve, adaptive sampling, discrete material, generated scene, physics): captured again too, for one current set.
- **Replaced** (41 files, `apps/library-docs/docs/public/examples`, 3.4 → 3.2 MB in all; `example-organization.jpg`,
  referenced by no page, left as it is):

  | file | shot | size before → after | bytes | state | host (report's backend) |
  | --- | --- | --- | --- | --- | --- |
  | gpu-scene.png | panel | 1152×1069 → 1152×1275 | 91 → 110 KB | as loaded | WebGPU viewer · showScene |
  | cad-curve.png | panel | 1152×1069 → 1152×1247 | 94 → 107 KB | as loaded | CAD evaluation → host Canvas2D drawing |
  | cad-surface.png | panel | 1152×1069 → 1152×1275 | 105 → 132 KB | as loaded | CAD sampling → WebGPU viewer mesh |
  | cad-extrude.png | panel | 1152×1145 → 1152×1275 | 120 → 111 KB | as loaded | CAD sampling → WebGPU viewer mesh |
  | cad-parameters.png | panel | 1152×1145 → 1152×1275 | 131 → 119 KB | as loaded | CAD sampling → WebGPU viewer mesh |
  | gpu-six-shapes.png | panel | 1152×1117 → 1152×1247 | 124 → 134 KB | as loaded | WebGPU viewer · showScene |
  | viewer-panel.png | panel | 1152×1193 → 1152×1323 | 104 → 107 KB | as loaded | @barocss/viewer on the @barocss/gpu WebGPU viewer |
  | physics-step.png | panel | 1152×1193 → 1152×1323 | 164 → 166 KB | Advance 20 steps | Physics CPU steps → host Canvas2D projection |
  | gpu-material.png | panel | 1152×1109 → 1152×1287 | 84 → 105 KB | amount 0 | CAD sampling → WebGPU viewer mesh |
  | gpu-material-amount1.png | panel | 1152×1109 → 1152×1287 | 84 → 104 KB | amount 1 | CAD sampling → WebGPU viewer mesh |
  | material-rgb.png | panel | 1152×1185 → 1152×1315 | 98 → 109 KB | amount 0.25 | CAD sampling → WebGPU viewer mesh |
  | material-sin.png | panel | 1152×1157 → 1152×1287 | 97 → 109 KB | amount 0.25 | CAD sampling → WebGPU viewer mesh |
  | material-cos.png | panel | 1152×1157 → 1152×1287 | 98 → 109 KB | amount 0.25 | CAD sampling → WebGPU viewer mesh |
  | material-radians.png | panel | 1152×1185 → 1152×1315 | 104 → 115 KB | amount 0.25 | CAD sampling → WebGPU viewer mesh |
  | material-pow.png | panel | 1152×1157 → 1152×1287 | 97 → 108 KB | amount 0.25 | CAD sampling → WebGPU viewer mesh |
  | material-abs.png | panel | 1152×1185 → 1152×1315 | 101 → 111 KB | amount 0.25 | CAD sampling → WebGPU viewer mesh |
  | material-min.png | panel | 1152×1157 → 1152×1287 | 96 → 106 KB | amount 0.25 | CAD sampling → WebGPU viewer mesh |
  | material-max.png | panel | 1152×1157 → 1152×1287 | 96 → 106 KB | amount 0.25 | CAD sampling → WebGPU viewer mesh |
  | material-clamp.png | panel | 1152×1157 → 1152×1287 | 98 → 108 KB | amount 0.25 | CAD sampling → WebGPU viewer mesh |
  | material-smoothstep.png | panel | 1152×1157 → 1152×1287 | 99 → 111 KB | amount 0.25 | CAD sampling → WebGPU viewer mesh |
  | material-mix.png | panel | 1152×1185 → 1152×1315 | 101 → 111 KB | amount 0.25 | CAD sampling → WebGPU viewer mesh |
  | advanced-shader.png | canvas | 640×420 → 640×421 | 403 → 206 KB | as loaded | Example WebGPU viewer · public WGSL repeating UV material |
  | cad-curved-extrude.png | canvas | 640×420 → 640×421 | 16 → 43 KB | as loaded | CAD sampling → WebGPU viewer mesh |
  | cad-nonunit-curve.png | canvas | 640×420 → 640×421 | 22 → 21 KB | as loaded | CAD evaluation → host Canvas2D drawing |
  | cad-weighted-parameters.png | canvas | 640×420 → 640×421 | 24 → 32 KB | as loaded | CAD sampling → WebGPU viewer mesh |
  | gpu-crossed-capsules.png | canvas | 640×420 → 640×421 | 37 → 36 KB | as loaded | WebGPU viewer · showScene |
  | gpu-rounded-stack.png | canvas | 640×420 → 640×421 | 18 → 19 KB | as loaded | WebGPU viewer · showScene |
  | material-transition-window.png | canvas | 640×420 → 640×421 | 19 → 17 KB | as loaded | CAD sampling → WebGPU viewer mesh |
  | advanced-shader-phase.png | canvas | 640×420 → 640×421 | 403 → 206 KB | phase 1.5708 | Example WebGPU viewer · public WGSL repeating UV material |
  | contour-shader.jpg | canvas | 462×303 → 462×303 | 24 → 38 KB | as loaded | Example WebGPU viewer · public WGSL repeating UV material |
  | discrete-material.jpg | canvas | 462×288 → 462×290 | 13 → 18 KB | as loaded | Public CPU material evaluation → app Canvas2D swatches |
  | generated-scene.jpg | canvas | 462×303 → 462×304 | 19 → 24 KB | as loaded | Application Canvas2D diagnostic local boxes |
  | halftone-shader.jpg | canvas | 462×303 → 462×303 | 12 → 16 KB | as loaded | Example WebGPU viewer · public WGSL repeating UV material |
  | reusable-shader.jpg | canvas | 462×303 → 462×303 | 11 → 15 KB | as loaded | Example WebGPU viewer · public WGSL repeating UV material |
  | weave-shader.jpg | canvas | 462×303 → 462×303 | 14 → 20 KB | as loaded | Example WebGPU viewer · public WGSL repeating UV material |
  | cad-adaptive-sampling.jpg | canvas | 462×303 → 462×304 | 13 → 19 KB | Coarser display · 0.2 mm | Public CAD sampling → application browser Canvas2D drawing |
  | cad-quantity-functions.jpg | canvas | 462×303 → 462×303 | 8 → 11 KB | factor: scalar = 2 → factor: scalar = 1 | Public CAD Source3 → sampled wall → WebGPU viewer mesh |
  | cad-rational-dome.jpg | canvas | 462×303 → 462×303 | 8 → 13 KB | value: 2.4 cm → value: 3.6 cm | CAD sampling → WebGPU viewer mesh |
  | caustics-shader.jpg | canvas | 570×374 → 570×375 | 22 → 34 KB | as loaded | Example WebGPU viewer · public WGSL repeating UV material |
  | caustics-shader-phase.jpg | canvas | 570×374 → 570×375 | 22 → 34 KB | phase 1.5708 | Example WebGPU viewer · public WGSL repeating UV material |
  | viewer-display-pose.jpg | owned | 462×522 → 462×341 | 14 → 10 KB | Apply 90° display pose | Public Viewer on the @barocss/gpu WebGPU viewer |
- **Before and after** (side by side, the old first; in the session notes folder `g18-screenshots/`): the weave and
  contour shaders (the same patterns), the plasma shader and the rounded stack, the adaptive sampling and the display
  pose, the dome and the quantity wall, the mix and physics panels.
- **Local only**: nothing published or deployed; no font file added anywhere (the owner's "아이콘 글꼴 프로젝트에
  넣지마"). The site's build output (`docs/.vitepress/dist`, `generated/`, `cache/`) is ignored, as before.
- **Not fixed, noted**: `apps/library-docs` `check:docs` stops at "Manifest drift: @barocss/gpu" (the recorded
  current-manifest commit predates later gpu manifest edits) — it does so at `858710053` too, before G18; recording a
  new manifest commit is the docs inventory's explicit step (`inventory.mjs --write --commit`), left to its owner.

## G19 — section-view upgrades (S0 approved 2026-10-22)

The owner's pick ("좋아 그렇게 진행해줘"): hatching on the caps, several planes (a box section; two or three free
planes; a plane from a face), caps on ghosted bodies, the section in the Render workspace, the section bar for all of
it. Order frozen: G19.1 the viewer's planes (gpu) → G19.2 the studio's model, UI, WebGL2 and exact section → G19.3
hatch → G19.4 ghost caps → G19.5 Render. The coordinator's answers: the kept region is the planes' intersection only;
hatch in world space only; hatch on by default. **First open item after G19**: the quarter cut-out (the "3/4 section":
a union of two half-space removals, a corner taken out) — to be scheduled, not a vague later option.

## G19.1 — several clip planes in the viewer, the caps on the kept region's entry (2026-10-22)

- **Planes**: `Viewer.clipPlanes` (up to `MAX_CLIP_PLANES`, 6): drawn, shadowed, picked and ray-cast is the intersection
  of their kept sides; `clipPlane` is the one-plane case (read: the first's `normal`/`offset`, `planes` all). The frame
  block's clip words: the caps' colour with the number of planes in its w, then six planes (`FRAME_BYTES` 1024 → 1104);
  `clippedAway` tests them all. CPU: planes packed 4 numbers each (one plane is the old form) — `rayTriangles`,
  `nearestSegment` (the segment cut to each plane's kept interval, their intersection), `nearestPoint`, `localPlane`
  (all planes through a transform), `clipBox` (each axis-aligned plane), `regionEntry` (where a ray comes into the region
  and leaves it).
- **The cap rule, changed from G2's (the S0's own rule did not hold)**: G2 drew a cap from a kept back face whose ray
  came in through the plane. With several planes a ray can come into the kept region through one plane and leave it
  through another inside a solid with no surface between — no kept back face, no cap: a box section wholly inside a
  part showed none (the CPU oracle's counterexample, a box under three planes; the GPU's first run, 0 cap pixels for
  16 829). Now: at a pixel, C is where its ray comes into the kept region (from the planes); C is a cap of mesh M when
  the first surface after C among the capped meshes' faces — clipped or not — is M's back face (the entry is inside M).
  - GPU: the probe (in place of G2's front-depth prepass, `capFront`, rg32float): the capped meshes' faces, both sides,
    unclipped, those before C dropped; the nearest kept by the depth test, its depth and whether a back face — a back
    face drawn 4e-7 nearer so it wins a tie (two parts touching: the cap). The cap passes (scene, pick, outline) draw a
    capped mesh's back faces where the fragment is that first surface (`capFirst`), at C's depth, in its cap colour, lit
    with the normal of the plane C is on (`capPoint` gives it). The camera's depth range holds every capped mesh's whole
    box (`depthBounds`): the probe and caps read its cut-away faces (with the bounds cut to the region the far faces were
    past the far plane — the second run's 0 pixels).
  - CPU, the same rule: `clippedRayFull` gives a mesh's kept hit and its first unclipped surface after C; the viewer's
    `capHit` takes the first of those over every capped mesh and instance (a back face winning a tie) — `raycast`, the
    GPU pick's cap flag and `hidden` (line and point picks) use it; `meshRay` is the kept hit only. `PickHit.capPlane`:
    the cap's plane. With one plane the rule gives G2's caps (G2's browser test unchanged and passing).
  - Limit: a solid wholly inside another — the inner one's front face is the first surface after C, so the outer one's
    cap is missing over it.
- **Evidence**:
  - `tests/viewer-core.test.mjs` (node), G19: 400 rays at a box under one to three random planes against the closed
    form (the box and the region convex: the first point kept is max(box entry, region entry), a cap when the region's is
    later) — every hit, its parameter to 1e-9 and its cap and plane; 40 rays through a 3 200-triangle sheet's hierarchy
    with three planes against every triangle; planes through a transform; a segment between two planes; a box section's
    planes on a box. The frame block's words for one and two planes.
  - `tests/viewer-pose-clip-browser.test.mjs` (real WebGPU), G19: a 10 × 10 × 10 solid under a box section of side 3,
    seen obliquely: the caps 16 907 px against the cube's silhouette 16 829 (a²(|vx| + |vy| + |vz|), ± 592 along its
    outline); a box with y ≥ 0 and x ≥ 0: 8 712 against 8 649 (± 395); a 64-sided cylinder under the same two: 6 780
    against 6 782 (± 338); the solid's edges cut away — no line found; 300 GPU picks at pixel centres over the three scenes
    (the box section, the two planes, the cylinder under three oblique planes) against the CPU's rays: 0 differ in mesh,
    cap and plane, 156 on caps, points within 0.05.
  - Bench (`bench:browser`, `BENCH_ONLY=section`, new: only the matching rows measured), the section rows alone, load
    16–19: GPU section 2.89 → 2.38 ms GPU a submit, task 18.1 → 17.2 ms a frame, upload 2.4 → 2.6 KiB a frame (the frame
    block's 80 bytes); the CPU clipMesh row unchanged (20.7 ms).
  - The studio's section through the new caps (`FLOW_ONLY`, WebGPU, the three steps whose GPU section is checked against
    the CPU's clipMesh through the same viewer): section 140 strong pixels, with instances 89, RM2 posed 27 of 1 296 000
    (G2's were 211, 51, 467; the flow holds ≤ 0.1 %) — 4/4 in 18 s.
- **Checks** (T1, gpu), in the verify worktree on `7b9ea4823` plus these changes: gpu type-check and lint clean, unit
  83/83, `test:consumer` 3/3, browser 14/14; studio tsc clean, suite 203/203 (170 s with the builds, load 13–26); the
  three section steps above. Not run: the full flow, the cad-model suite, WebGL2 (its CPU path is unchanged), the other
  bench rows.

## G19.2 — the studio's section: a plane, a box, several planes, a plane from a face (2026-10-22)

- **The model** (`viewport/sectionView.ts`): `Section = { mode: 'plane' | 'box' | 'planes'; planes }`, each plane
  `{ normal, offset, axis?, face? }` (kept where dot(normal, p) ≥ offset; the kept region their intersection).
  `axisSection` / `asSection` keep G2's `{ axis, at, keep }` form working (the hooks, the bench and the flow take it);
  `boxSection` (six axis planes a tenth in from the part's box, the inside kept); `planeFromFace` (a flat face's plane,
  the material behind it kept, moved in to the middle of the part along it — on the face itself it would cut nothing).
- **WebGPU**: the planes to the viewer (`SectionClip.planes`, `GpuRenderer.setClip` → `Viewer.clipPlanes`, the bounds
  cut by each axis plane); bodies wholly cut away by any plane left out (`cutAway`).
- **WebGL2** (`clipMeshPlane`): an axis plane through clipMesh itself (G2's path unchanged — its test passes as it was);
  another plane in its own frame — the mesh turned so the normal is +z, clipped there, turned back, the cap face's normal
  and centre with it; several planes in turn (`clipMeshPlanes`: the later ones cut the earlier caps).
- **The exact section** (`sectionSplits`): one axis plane exactly as before (by the bodies' boxes); otherwise each body
  split by each plane that crosses what is left of it — the kept piece of one split the next one's parent (the kernel's
  oblique split, normal·p = offset, its positive piece kept) — whether a plane crosses read from the display mesh clipped
  plane by plane (only the points its triangles use: clipMesh keeps the dropped triangles' points, which first made a
  split of a piece the plane missed).
- **The section bar** (`ui/SectionBar.tsx`): Plane · Box · Planes; Plane: X/Y/Z, From a face, Flip, Sketch; Box: reset,
  a drag handle on each face (`sectionHandles`: an arrow on each plane toward the side cut away, through the middle of
  what is kept; an axis plane's value its coordinate as G2's handle, another's its offset); Planes: two or three, each
  X/Y/Z or from a face, flip, remove, add. "From a face": the next click on a flat face (App's `onPick`, before the
  section's own hold on picks) sets that plane. Sketch the section: one plane only (disabled with its reason otherwise).
- **Evidence**:
  - `test/section-planes.test.ts` (4): clipMeshPlane on axis planes equal to clipMesh; an oblique plane through a box at
    the closed form (12√2 × 8, the cap facing away, its centre on the plane, every used point kept); a box section on the
    CPU leaving the inner box's surface (634.88 mm², all caps); the exact section — one axis plane the same document and
    keys as the code before (four planes), an oblique plane 960 mm³, a box section six chained splits 983.04 mm³ (16 ×
    9.6 × 6.4), a second plane past what the first left no split, wholly cut nothing kept — the kernel's volumes; a plane
    from a face. `section-view.test.ts` (G2's) passes on the new model through `axisSection`.
  - Flow step G19.2 (new, before the theme step), both renderers: a 40 × 20 × 10 plate — Box: six planes and handles, the
    exact volume 4 096 (32 × 16 × 8); its +X face's handle dragged in, the volume (x − 4) × 16 × 8; Planes: y ≥ 10 and x ≥
    20, 2 000, Sketch disabled; plane 2 from the top face (clicked where kept): z ≤ 5, 2 000, its label "Z ≤ 5"; Plane
    again: 4 000, Sketch enabled. GPU against CPU (WebGPU): the box 963 strong pixels, the two planes 938 of 1 296 000
    (≤ 0.1 %) — the ground's shadow under the box (in a box section no original surface is left and the caps cast none:
    G2's limit) and the edges where caps meet. Step 73 (G2's section) and the instance and RM2 section steps pass on both
    renderers (75, 129 strong; 313 on step 73 this run, 140 earlier: load).
- **Checks** (T1/T2: App.tsx and viewport), in the verify worktree on `b843f5399` plus these changes: studio tsc clean,
  eslint 0 errors, suite 207/207 (42 s); `FLOW_ONLY` G19.2 and step 73 on WebGPU 3/3 (17 s) and WebGL2 3/3 (15 s); the
  instance and RM2 steps 3/3 on each (13 s, 17 s), load 14–49. Not run: the full flow, the cad-model suite (not
  touched), gpu (not touched), benches (the GPU path's per-frame work unchanged).
- **Limits**: the caps cast no shadow (G2) — a box section's kept part casts none; the exact section of several planes
  decides by the display mesh whether a plane crosses a piece (a plane within tessellation of a curved face's tangent
  may disagree with the kernel, which then refuses: the clipped view stays).

## G19.3 — the hatch on the cut (2026-10-22)

- **The rule, one for both renderers**: world-space lines on each plane, through the world's origin, in the plane's own
  axes — `capHatchAxes(normal)` (gpu, exported; `hatchAcross` in WGSL): the normal turned so its largest component is
  positive (a plane and its flip hatch alike), u the next world axis after that component's (x → y → z → x) projected
  into the plane, v = n × u; a hatch at θ runs along cos θ·u + sin θ·v, `spacing` apart. A line is 1 CSS pixel wide and
  the face under it × 0.45 (the coordinator's "cap colour × 0.45"; on lit caps, of the lit colour).
- **Viewer** (gpu): `Mesh.capHatch` / `AddMeshOptions.capHatch` `{ angle (degrees), spacing (world) } | null`, default
  none; the object block +16 bytes (`OBJECT_BYTES` 192 → 208, stride 256 unchanged). `fsCap`: the hatch coordinate
  from the cap point C and C's plane, its change per pixel `length(dpdx, dpdy)` (not fwidth: a 45° line would be √2
  wide), taken before any discard; coverage clamp(½·dpr + ½ − d) — a line one pixel wide at any angle.
- **Studio**:
  - Angles by body in turn — the bodies', then the placed parts' surfaces — 45°, 135°, 30°, 120°, 60°, 150°
    (`hatchAngle`); spacing a sixtieth of the part's and placed parts' box diagonal, down to the step below of 0.5, 1, 2,
    5, 10 mm (`hatchSpacing`). On by default; the section bar's "Hatch the cut" toggles it (its own state, not part of
    `Section`, so the exact section is not computed again).
  - WebGPU while the planes move: the caps' shader (`SectionClip.hatch` → each capped surface's `capHatch`).
  - As lines (`hatchSegments`, `sectionHatch`; `ViewRenderer.setSectionHatch`): WebGL2's clipped caps, and the exact
    section's cut faces on either renderer (they are ordinary faces there). The lines are cut against every triangle lying
    on a section plane (within 1e-3 mm) and facing the side cut away — a clipped cap or an exact piece's cut face alike —
    each line k crossing two edges (half open). Drawn black at 0.55 opacity, so the face under them is × 0.45 however it
    is lit. The first try used the body's colour × 0.45, opaque: 1.58 × the shader's ink.
- **Evidence**:
  - `tests/viewer-pose-clip-browser.test.mjs` (real WebGPU), G19.3: two boxes under y = 0 at 45° / 0.4 and 120° / 0.6,
    every pixel's darkening read back (α). The mean α over a cap equals a pixel over the spacing in pixels (0.1439 against
    0.1434, 0.0956 against 0.0956). Of the angles every 5°, the lines of the mesh's own angle and spacing through the
    origin lie where α is (0.85 mean α within 0.3 pixel of them). The same after the camera pans and zooms, and on an
    oblique plane through both (seen along it, its axes from `capHatchAxes`). Off: α 0.
  - G19's limit pinned (the coordinator's request): a 2 mm box wholly inside a 10 mm one and wholly kept. Over it the
    GPU pixel, the GPU pick and the CPU ray all give the inner box's front face, no cap. Beside it, the outer cap. A fix
    shows as a changed expectation.
  - `test/section-hatch.test.ts` (3): the axes (axis planes, flips, orthonormal on three oblique planes), equal to the
    WGSL rule by the browser test above. Segments on a clipped cap at 0° (x = 2 … 20, total 80 = 10 lines × 8, all on
    y = 5 within the cap) and at 45° (length within a line of the area over the spacing; direction (x + z)/√2; whole
    spacings through the origin). None on the body's own faces. An oblique cap within a line of 12√2·8/0.5. The exact
    section's cut face the same as the clipped cap (80). Two bodies at 45° and 135°. The spacing steps.
  - Flow step G19.3 (new, before the theme step), on both renderers, on a 40 × 20 × 10 plate, spacing 0.5:
    - On by default, with lines on the exact section's cut face.
    - Ink (the luminance the hatch takes away), WebGPU: the exact face's lines 673 389; held back, the caps' shader
      670 253 against the CPU's lines 677 747 (1.1 %; the step allows 20 %).
    - Ink, WebGL2: exact 1 327 609, the clipped caps 1 339 838.
    - Off: no hatch, no lines, no shader hatch; then on again.
    - `sectionAgainstCpu` (G2's and G19's GPU-against-CPU) compares with the hatch off, then turns it back on. Its
      figures are as before: section 164, with instances 105, posed 153, box 963, two planes 938 strong pixels of
      1 296 000.
  - Bench (`BENCH_ONLY=section`, run alone, load 14–16): GPU section 2.38 → 2.04 ms GPU a submit, task 17.2 → 17.7 ms
    a frame, upload 2.6 KiB unchanged. CPU path 20.7 → 21.5 ms a frame (the segments each step).
- **Checks** (T1, gpu and studio), in the verify worktree on `3a90a9e2c` plus these changes:
  - gpu: tsc and lint clean; unit 83/83, consumer 3/3, browser 16/16.
  - studio: tsc and eslint clean; suite 210/210.
  - `FLOW_ONLY` (G19.2, G19.3, step 73, the instance and RM2 steps): WebGPU 6/6 and WebGL2 6/6, load 36–50.
  - Not run: the full flow, the cad-model suite (not touched), the other bench rows.
- **Limits**:
  - The exact section's hatch lines are made when the section changes. A body moved after that (an explode, a
    drag) keeps its lines where it was, until the next change.
  - A body face lying exactly on a section plane and facing the cut-away side is hatched although nothing was cut there.

## G19.4 — ghost caps, caps casting shadows, the exact section's hatch moving with its body (2026-10-22)

- **Integration**: 56e11f3ae merged as 8888de5ec (G19.2, the kernel's FRk1/FRk2, the outer lane's latest); studio suite
  211/211 on it.
- **The exact section's hatch moves with its body** (the coordinator's follow-up to G19.3's limit):
  - WebGPU: a line mesh a body, kept by its index; `setState` gives it the body's own transform (posed, dragged,
    exploded), its visibility and the ghost's faint opacity. The segments are in the part's frame, as the body's mesh.
  - WebGL2 already drew them through the body's placement.
  - Not driven in the flow: the transform path is the body's own.
- **Caps cast shadows** (the coordinator's follow-up 2: a box section was a block with no shadow):
  - While the planes cap a shadow caster, the shadow map is drawn after a probe from the light: the capped casters'
    faces, unclipped, the nearest beyond each texel's entry into the kept region along the light.
    - The probe uses the shadow map's own depth texture, nearer smaller (the `nearer` override, −1). Its target is an
      rg32float the shadow map's size: 32 MiB at 2048², made only while caps cast.
  - Each capped caster's caps then go into the shadow map by the scene's rule (`fsCapShadow`).
  - The shadow frame looks from the light (orthographic eye and forward). Its depth range holds the capped meshes'
    whole boxes; its breadth is the scene's, as before.
  - The shadow key holds each caster's cap flag.
- **Ghost caps** (WBOIT):
  - A capped see-through mesh (with order-independent transparency on) goes into the caps' probe with the opaque ones:
    which solid the ray's entry is inside decides either's cap.
  - Its caps are weighted into the order-independent pass at its opacity (`fsCapOit`), depth tested against the
    opaque scene, none written. `capShade` is shared with `fsCap`, hatch included.
  - They are drawn, not picked: `capHit` passes them by, as the GPU pick draws none.
  - In the sorted (non-OIT) path there are still no ghost caps.
  - In the studio a ghost in a section is a reference part (sketch ghosts have no section). WebGL2 already had them,
    by clipMesh.
- **The overlap limit, measured**: where two solids overlap and the plane's entry is inside both, the probe keeps one
  surface a pixel. Only the solid whose back face comes first is capped there; equally deep back faces tie, and both
  are capped. Pinned in the browser test.
- **Evidence** (`tests/viewer-pose-clip-browser.test.mjs`, real WebGPU; browser 18/18):
  - Shadows: a box section inside a 10 mm solid shadows the ground in 882 pixels. The kept 3 mm cube as a plain,
    unclipped mesh: 882. A solid kept whole under planes that cut nothing: 882, as without them.
  - Ghost caps: a ghost box's cap and its CPU-clipped half's real face, the same see-through material, through the
    same viewer: 0 pixels differ.
  - Two overlapping ghosts: one cap over the overlap (3 827 pixels differ from the CPU's two layers there; 0
    elsewhere). 120 GPU picks equal to the CPU's rays.
- **Flow** (`FLOW_ONLY`, both renderers):
  - G19.4, new: a welded frame from the kernel (three members, a gusset, an end cap, the T's bead and the gusset's four
    runs: 10 bodies) through STEP, cut across Y at its middle.
    - The exact section's kept volume equals the CPU-clipped meshes': 891 818 of 1 783 636 mm³, on either renderer.
    - The plane crosses six bodies; the gusset's runs lie off it, two cut away and two wholly kept. Hatched: 5 exact,
      6 clipped. Every cut of a spacing square or more is hatched (10 mm here); the bead's 9 mm² cut got a line on
      the CPU's clipped mesh and none on the exact piece.
    - GPU against CPU: 1 465 strong pixels of 1 296 000. The step allows 0.2 %, not 0.1 %: the cut walls are long
      strips 3–4 mm wide, and a GPU cap's edge is decided once a pixel where the CPU's face is antialiased.
  - Before the end cap was added (9 bodies), every section step on both renderers: G2's 73, the instance and RM2 steps,
    G19.2 and G19.3. The box section's ground shadow now shows on the GPU as on the CPU; the strong pixels left (1 011)
    are the caps' aliased edges.
  - The first step ("starter plate loads") failed once on WebGPU under load (load 37), then passed on the rerun.
- **Bench** (`BENCH_ONLY=section`, run alone, load 19–24): GPU section 2.04 → 2.33 ms GPU a submit (the light's probe
  and the caps in the shadow map, redrawn each drag step), task 17.7 → 18.6 ms a frame; the CPU row 21.5 → 21.2 ms.
- **Checks** (T1), in the verify worktree on de66d459c plus the flow step:
  - gpu: tsc and lint clean; unit 83/83, consumer 3/3, browser 18/18.
  - studio: tsc and eslint clean; suite 211/211.
  - The flow steps above. Not run: the full flow, the cad-model suite.
- **Limits**:
  - The caps' edges are aliased: inside-or-not is decided once a pixel, at its centre. A fix would need the probe and
    the cap test per sample.
  - A cut smaller than a spacing square may get no hatch line.
  - Ghost caps only with order-independent transparency on.

## G19.5 — the section in the Render workspace (2026-10-22)

- **What the probe found**:
  - The section applies there as in Model: the planes cut and cap the rendered bodies (the render looks, the
    environment, the ground), the hatch is on, and the exported image is cut.
  - One fault: the Render workspace's animated offsets (its timeline's tracks, by body key) were put on the bodies
    shown by index into the part's bodies. In a section the shown bodies are others — those wholly cut away left out,
    and in the exact section the pieces split from them. An animated body then did not move, or another did.
  - Example (the welded frame across Y): the end cap, body 9 of 10, was index 9. The exact section shows 8 bodies, so
    the offset fell on none.
- **Fix**:
  - `sectionSplits` returns `from`, each kept piece's body by key; the exact section's state keeps it.
  - The offsets are computed by key (`animatedAt`) and put on the shown bodies (`animatedOffsets`), each by its own
    body's key — an exact piece by the body it was cut from.
  - The GPU's moving section and the CPU's clipped bodies keep their keys. The hatch lines follow (G19.4).
- **Evidence**:
  - Flow step G19.5 (new), both renderers: the welded frame (10 bodies) in the Render workspace, the end cap animated
    30 mm along X.
    - Before the section, its offset is on itself.
    - With the section across Y: the clip set on the GPU, one offset `[30, 0, 0]`, on `b6_positive`, whose source is
      the end cap (`b0_part9`); the frame changed in 2 000+ pixels.
    - On WebGPU, the exported PNG differs from the one before the section.
  - `section-planes.test.ts`: the one-plane exact section's `from` against the code before.
  - Every section step again on both renderers: 73, the instance and RM2 steps, G19.2–G19.5 — 8/8 each.
- **Checks** (T1), in the verify worktree on 6bfb02f22 plus these changes: studio tsc and eslint clean, suite
  211/211; the flow steps above. Not run: the full flow, gpu (not touched), cad-model.

## G20 — the quarter cut-out (S0 approved 2026-10-22)

A "Cut-out" section of two planes (a quarter) or three (an octant, the "7/8 section"): kept on any plane's kept side,
the corner where their cut-away sides meet removed. The coordinator's answers:
- (a) both;
- (b) the exact section keeps separate kernel pieces, but everything that reports per body reports per source body —
  the "N solids" status, mass and properties, the outliner, the picks' body name;
- (c) the default corner is the one nearest the camera, through the box centre; flip and drag as in Planes mode.

Stages: G20.1 the viewer; G20.2 the studio.

## G20.1 — cut-outs in the viewer (2026-10-22)

- **Model**: `Viewer.clipCutout` (default false), with `clipPlanes`. What is kept is on any plane's kept side. The
  removed region R, the intersection of the cut-away sides, is convex: one stretch of any ray. C — what the probe, the
  caps, the hatch, the shadow caps and the ghost caps all read — is where the eye's (or the light's) ray leaves R, on the
  plane it leaves through. After C the ray stays kept, so a cap is drawn where the first surface after C is a back face:
  G19.1's rule, unchanged.
- **GPU**:
  - The frame's plane count is negative for a cut-out (`clipCount`, `clipCutout`), so the frame block does not grow.
  - `clippedAway`: inside every removed half-space.
  - `regionAlong` returns R's exit as C (none when the ray misses R or never leaves it through a plane).
- **CPU**:
  - Packed planes carry the flag last (length 4n + 1, `packedCutout`); `keptBy` is any-of; `localPlane` appends it.
  - `regionEntry` returns R's exit.
  - A segment's kept part may be two pieces, each tried (`testPiece`).
  - `clipBox` leaves a box as it is (a corner off keeps its extent), or none when R holds all its corners.
  - The shadow key holds the mode.
  - A fault the oracle found: a kept surface before R is nearer than the cap. In G19 nothing was kept before C; the
    CPU took the cap anyway. Now `clippedRayFull` returns the nearer (the GPU's depth test always did).
- **Evidence**:
  - `viewer-core` G20 (node): 800 rays at a box under two or three random planes as a cut-out, against the closed form
    (the box's stretch less R's: its entry, else R's exit when inside the box) — 300+ hits and 40+ caps, each to 1e-9
    with its plane. Also: the packed flag; a segment across a removed slab found on either piece and not between, its
    nearest end from inside the slab; clipBox; the frame's −n.
  - Browser (real WebGPU), G20, a 4 mm cube seen obliquely:
    - The quarter's caps: 10 915 px against 8(|vx| + |vy|) on screen = 10 839 ± 789.
    - The octant's: 7 407 against 4(|vx| + |vy| + |vz|) = 7 370 ± 789.
    - 300 GPU picks against the CPU's rays: 0 differ, 74 on caps.
    - The edge through the removed corner: not found there; found on its kept half.
    - The octant cut-out's shadow on the ground: 1 853 px, the seven 2 mm cubes it is made of 1 853.
- **Bench** (`BENCH_ONLY=section`, three runs alone, load 14–16): GPU section 2.77, 3.24 and 2.41 ms GPU a submit (2.33
  in G19.4's one run). The intersection path's only change is one uniform branch a fragment; the spread between runs is
  wider than the difference. Task 18.5 ms a frame; the CPU row 21.7 ms.
- **Checks** (T1, gpu): tsc and lint clean; unit 84/84, consumer 3/3, browser 19/19. Studio not touched (G20.2).

## GPU lane: hand-over (account change, 2026-10-22)

**Where it stands**
- Branch `claude/gpu-viewer-pose-clip-2026-10-21`, worktree `.claude/worktrees/great-einstein-3ea69b`.
- Last integration merge: ecb9562ee (integration 9fec9950c). The coordinator merges this branch into integration in
  its windows; merge each integration tip it sends before your next checkpoint, and never amend or rebase.
- Last stage done and accepted: **G20.1** (02ebc9a7a gpu, 94eb2d048 record).
- **G20.2 in progress, committed as WIP** (the tip of the branch: 3d85e6793, 398683cb6).
  - The fix in 3d85e6793: the caps' probe gave a back face a fixed depth lead of 4e-7 to win ties. Far from the eye in
    reversed depth, that lead put a back face just behind a front face (near an edge) ahead of it, so a cap leaked over
    the part's far edges: 660 leaking pixels in the new browser test's scene, 2 051 strong pixels in the studio's
    cut-out flow against the CPU.
  - Now the lead is depth × 1e-5 in the scene's probe; the shadow map's probe (linear depth) keeps 4e-7. The leak
    scene leaves 3 pixels, all on edges.
  - In the studio: the Cut-out mode, `clipMeshCutout`, the chained exact pieces, and `exactBodies` / `mergeBodies`
    (one body per source body).
  - Verified: gpu unit 84/84 and lint; the leak scene run alone; studio suite 213/213; WebGL2 `FLOW_ONLY` G20.2 and
    every section step 9/9.
  - **Unverified**: the gpu browser suite with the probe fix (stopped while running, load 54); G20.2 on WebGPU after
    the fix; the bench section row.
- **To finish G20.2**:
  1. Run gpu `npm run build:library && npm test && npm run test:browser` (CHROME and PW_DIR as in the standing rules),
     20/20 expected with the new leak test.
  2. In the scratch verify worktree, on the branch tip: `FLOW_RENDERER=webgpu FLOW_ONLY='G20|G19|section view: a box
     with a hole|place another part as an instance|RM2: the 2R arm posed' node test/browser-flow.mjs <out>`, then the
     same with webgl2.
  3. `BENCH_ONLY=section node test/bench-browser.mjs`, run alone.
  4. Write the G20.2 record here, and the G20 row in README §0.
  5. Send the checkpoint.
  6. If the GPU against CPU figure still exceeds 0.1 %, look at the diff map (the caps' aliased edges are a known limit,
     not a leak).

**Queue** (owner, "좋아 로드맵을 채워줘"; README §0 item 6). Each stage: a short S0 to the coordinator first, one
checkpoint a stage, FLOW_ONLY on both renderers.
- G20.2, then:
- G21 CAD display: silhouette edges of curved faces (screen space); shaded with edges, hidden lines removed, hidden
  lines dashed, wireframe and x-ray modes; isolate and hide with the rest faded.
- G22 assembly checks on screen: interference and clearance colours, and collision highlights in joint play or a motion
  study. The outer lane's `clearanceMap(doc, evaluate, { nearMM })` → `clearance-map-v1`, as agreed:
  - a band mesh a side, in the body's local frame, edges ≤ near/3, the exact field per band vertex (not per display
    vertex), drawn as a decal;
  - overlap meshes in body a's local frame with a pose key; closest points local or pose-tagged;
  - updates pair by pair as the Booleans finish, each checked by its pose key;
  - pending pairs red from the clearance; refused pairs hatched red, with the reason.
- G23 manufacturing previews (no mould fill or other CAE, #2177).
  - `printLayers`: bed coordinates plus a model → bed 4×4; `layer(k)` on demand and cached; a `summary` (count,
    heights, totals, `supportColumns`: footprints and z ranges); per layer, merged support polygons with the contours'
    winding.
    - The "printed up to k" view: the model in the bed frame cut by one clip plane (G19's caps), the supports extruded
      once from `supportColumns`.
  - `camPackage`:
    - the full tool shape;
    - the ordered tool-tip path (rapid, feed, plunge, ramp and retract segments, linking moves included);
    - one setup frame and a tool axis per setup;
    - CNC7b's stock as a solid.
    - A height field in the setup frame (2.5D); the part's mesh as the target; NOT FOR PRODUCTION shown.
- G24 3D annotations (MBD/PMI): the outer lane's `modelAnnotations` → `model-annotations-v1`, as agreed:
  - planar text by default (billboard an option), mirrored back when seen from behind, fading edge-on;
  - their `lines` drawn, `targets` for picks and highlight;
  - arrows as heads {tip, dir, length, width, style}; lines with a role; text height in model mm;
  - GD&T frames and weld symbols from the outer lane's glyph builders (pure functions in plane coordinates), not your
    own symbol geometry; a stable `id` equal to the sheet item's; `<inst>/` targets.
- G25 GPU analyses: wall thickness and tool access by GPU rays (display only, the exact values the kernel's), and a
  scan-versus-CAD deviation map.

**Open items**
- After G25 (unless G20 or a later stage needs the same machinery first): antialiased cap edges. The caps' probe and
  cap test would run per MSAA sample; inside-or-not is decided once a pixel now.
- The WebGL2 support statement (README §0, after G16): keep it current as stages add WebGPU-only views; say what
  WebGL2 draws and what it does not.
- Later, only on measured need: occlusion culling for huge assemblies, progressive photoreal rendering, turntable and
  exploded-animation video export.

**Standing rules**
- Local only: no push, PR, publish, release or deploy.
- Don't touch the kernel core files (edge-finish, part-model, analytic-boolean, rolling-ball, fillet-section, brep-*,
  solid-mass, tessellation). Own TS/WGSL, no new dependencies, no WASM. Hoist functions out of hot paths. No icon font
  or font files in the project.
- Git identity `easylogic <cyberuls@gmail.com>`. Commits end with the Co-Authored-By line. New commits only.
- Name another lane's file and the change to the coordinator before building it.
- Flow chat port `CAD_STUDIO_CHAT_PORT=52691`.
- Check `sysctl -n vm.loadavg` before a long run; above about 40, wait.
- `FLOW_ONLY` narrow: only the steps the change runs and their prerequisites. New steps go before the theme step.
  Don't edit sources during a flow run (Vite reloads).
- Long checks in the scratch verify worktree. Kill only your own PIDs. Benches only for changed rows, run alone, with
  the load recorded.
- Every display path is checked against the CPU's: GPU picks against CPU rays, GPU section against CPU clipMesh through
  the same viewer (≤ 0.1 % strong pixels), WebGL2 at parity, or the tolerance stated with its reason. Oracles closed
  form where one exists.
- Tests: gpu (Node 22) `npm run build:library` before tests; browser with
  `CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" PW_DIR=$HOME/.cache/barocss-playwright/node_modules/playwright`.
  Studio: `npm test`, tsc, eslint on the changed files. cad-model's suite only if cad-model is touched.
- Commit pnpm-lock.yaml only with a deliberately added dependency.
- Leave alone the untracked `REVIEW-2026-10-14-cad-gpu.md`, `review-drafts/`,
  `packages/barocss-gpu/src/engine-uv-material-wgsl.ts` (read-only) and `.claude/`.

**How to resume**
1. Read README §0 (item 6 and this block) and this file's G19 and G20 sections.
2. In the worktree, check `git status` (clean) and the tip (this commit).
3. Merge the integration tip the coordinator names.
4. Finish G20.2 as listed above.
5. Then G21: send its S0 to the coordinator first.


### Coordinator handback pointer — GPU G, 2026-10-23

Owner finish is in force; no implementation or author checks restart. The latest
GPU G STOP record was reviewed at `0eff11097ebe3e795f4c5173211eb861214c76a2`. Its immutable
[snapshot](evidence/2443211888b5bc5d219fa3075dfea444bd6d5d4a/final-window/lanes/gpu-G.md) and accompanying stop receipt are archived
with the final window. That documentation review does not adopt the branch's
unverified product source. See [handback](notes/codex-handback-2026-10-23.md) and
state for exact WIP, process cleanup, blockers and first resume steps.

## G-R1 — resumed by Claude after Codex: the studio lint error (2026-10-23)

- **What**: `apps/cad-studio/test/bench-assembly.mjs:34`, `no-this-alias` (the one studio lint error in the
  coordinator's window at 99da385a1). The bench's timestamp-query wrapper of `GPUDevice.createCommandEncoder` aliased
  `this` as `dev`. The wrapper's body moved to `instrument(dev, enc)`, and the patched method passes `this` and the
  encoder to it; what it measures is unchanged.
- **Checks** (T1): studio eslint on the file, 0 errors (4 `no-console` warnings, as before); `node --check`. Not run:
  `bench:assembly` itself (a browser bench; it needs a heavy-run slot and low load).

## G-R2 — A9-7: a placed part's bearing edited in place, against a linked housing (ported from Codex, 2026-10-23)

- **What**: Codex's A9-7 UI connection, from `codex/a9-7-ui-connection`: `git diff c45c92f85 8789e468d --
  apps/cad-studio/src` (the original `d46ddbd8` plus its correction `8789e468`), applied unchanged to integration
  6bfd0ad97. Source only; Codex's evidence files are not ported.
  - The Outliner lists a selected placed part's bearings. One opens a NodeEditor on that occurrence (`app/bearingEdit.ts`).
    - The edit session keeps the explicit immediate occurrence as owner: two instances may share one authored child
      document.
    - Inherited bearing and fit rows reach the edit and its validation, never the saved child.
    - Apply validates the edited occurrence in the worker, then commits through the root's undo path only if the root,
      the selection and the occurrence are still the ones captured.
  - `useAssembly` reads linked face tables per owner through a host callback with the current root (`bearingFaceInput`),
    never from a bare child or a flattened document. The bare `faceKey(child)` read was what blanked the screen at d46.
    A group is published only whole and only for the current source; otherwise no mate, lock, ground or solve runs.
  - The BOM panel (`bomHasLinkedHousing`) never shows or exports a previous result once the document has a linked
    housing. An evaluation failure shows its reason. Unlinked documents keep their partial data while loading, as before.
  - App: the Bearing command builds against the current authored targets. Its preview and Apply are refused once the
    assembly changed under it.
- **Tests**: Codex's three tests (in packages/barocss-gpu/tests) moved to the studio, as agreed with the coordinator.
  - `test/bearing-edit.test.ts`, 7 tests.
  - `test/bom-linked-ui.test.ts`, 5 tests.
  - `test/assembly-linked-faces.test.ts`, 5 tests.
  - The two hook tests bundle BomPanel and useAssembly with recording stand-ins for React and the model calls. They
    load esbuild from the studio's node_modules at run time.
  - The fixture row is written into the test document. It is not agent-loaded rows; rule (b) governs those.
- **Ownership**: BomPanel.tsx is the outer lane's file. The coordinator assigned this change to the GPU lane and told the
  outer lane to hold off that file.
- **Checks** (T1):
  - the three test files, run one at a time: 17/17;
  - studio `type-check`: 0 errors;
  - eslint on the 4 source and 3 test files: 0 problems;
  - `build:library` (cad, gpu): rebuilt for the run.
- **Not run**:
  - the full studio suite and a browser flow: they need a slot;
  - linked-bearing success in the real UI: it needs an admissible person-supplied row/fit file from the owner, and none
    is faked. Codex's no-row flow at 8789e468 passed in its own run; it is not repeated here.
- **Branch**: `claude/gpu-lane-2026-10-23`, in this session's own worktree, which is isolated and cannot write
  great-einstein-3ea69b. It was cut from 6bfd0ad97.

## G-R3 — G23 CNC: material removal shown along the Model's program, on both renderers (from Codex's source 5c9f861f, 2026-10-23)

- **What**: Codex's six CNC source files from `codex/g23-cam-preview` (source only; its brief and evidence are not
  ported), reviewed, corrected and connected. Before this, they had never been compiled, run or wired.
  - `camHeightfield.ts` — the stock as a height field in one setup's machine frame:
    - inputs: the Model's `cam-package-v1` (camPackage) — its stock solid or refusal, its tool, its setups' ordered moves;
    - from pristine stock on every request;
    - only feeds, plunges and ramps cut;
    - a cell is lowered only to where the tool reaches its furthest corner;
    - refused, typed: a skew or mirrored frame, a bar across the machine Z, a grid the tool cannot cover, a buried
      flute, and more than 250 000 samples or 25 M cell visits.
  - Corrections in review:
    - **The stated lateral uncertainty was wrong**: `h + s/2`, where h is the half diagonal and s the sample spacing.
      A cell stays when its centre is more than r − h from every sample, so material can stand r − 2h from them. It is
      now `2h + s/2`, the full diagonal. The pocket oracle below found the gap: 1391.07 mm² against a 1392.70 bound
      built from the old value.
    - **The hot loops had closures and allocations per element** (owner rule): `forEach` over cells, a `triangle` and an
      `at` closure, `move.a.map` per sample. They are now plain loops with module-level helpers.
    - **The mesh drew four walls on every cell**. Walls now go only where a cell stands above its neighbour or the
      footprint's edge.
    - **The worker received the whole document and bodies on every progress tick**. It now gets them only when the
      source changes (`source` in the request); a scrub posts a few numbers.
  - `camToolGeometry.ts`: the declared flat, ball or bull tool, revolved with 64 sectors and 12 nose rings.
    - The shank is shown one diameter long, an estimate said; the Model's shankMM is a diameter. No holder is shown.
    - `disk` is hoisted.
  - `camOverlayGeometry.ts`: world-space drawings.
    - The stock wire is where the Model put it.
    - Paths by move kind, whole and done, the active move, the remaining stock (lit amber) and the tool (lit) are turned
      back through the setup's inverse on the CPU. That is exact: the frame is a signed axis permutation.
    - Identities stay while their inputs do: paths per setup, remaining stock per removal, tool per pose.
  - Both renderers share one overlay path with print layers:
    - `overlayDrawing.ts`: the shared type. It allows non-indexed triangles and lit surfaces.
    - `overlayGL.ts`: the WebGL2 pass, factored out of PrintOverlayGL, plus a lit program. PrintOverlayGL keeps its API.
    - `GpuRenderer.syncOverlay`: shared by `setPrintDisplay` and the new `setCamDisplay`.
  - `Viewport`:
    - `camDisplay` and `camActive`, with renderer errors shown as an alert;
    - the stock and the part framed once per package and setup, and the camera restored on close.
  - `CamPanel`, in the right corner next to Print layers:
    - NOT FOR PRODUCTION first; setup, progress (to the move and a fraction), the asked grid and an optional tool;
    - shown: removed volume (a grid estimate), grid and pitch, sample spacing, ± across, the tool and its basis, the safe
      Z estimate, and the skipped features with why.
  - App:
    - session only: no document field, so Save/Open reproduce the same input from the machining stock and geometry;
    - mutually exclusive with Print layers and assembly clearance, each saying so;
    - refused with a reason in Render/Drawing, with placed parts, references, an edit, Section view or analyses;
    - dev hook `__studioCam`.
- **Tests**: `test/cnc-preview.test.ts`, 6 tests.
  - tool profiles exact (ball and bull noses), with their refusals;
  - every Model setup frame's inverse exact; skew, mirror and scale refused;
  - stock and grid refusals;
  - cutting moves only;
  - a prefix rebuilt from pristine stock is the same, scrubbing back included;
  - buried and work-cap refusals;
  - the slot oracle: (20·6 + π·9)·4, less at most the stated band;
  - the overlay identities and the tool tip's world position.
  - **The CNC8 pocket oracle**, the Model's own 50 × 30 × 8 pocket from cad-model's test: the field's cut area is at
    most 1500 mm² and at least 1500 − 4(1 − π/4)·9 − 160·(stated uncertainty).
- **Checks** (T1):
  - cnc-preview 6/6;
  - Codex's studio-code tests in packages/barocss-gpu/tests, one file each: print overlay 6, hook 5, worker 3,
    projection 6, settings 4; clearance overlay-gl 5, gpu 5, clip 5; display contract 9, gpu display contract 13;
    instance bridge 7; silhouette 5.
  - The print overlay check reads `pass.draws`; PrintOverlayGL exposes it from the shared pass.
  - studio type-check 0 errors; eslint on App, viewport/ and the test 0 problems;
  - studio `build`: the CNC worker bundles (1.78 MB, like the print worker).
- **Not run / not built**:
  - the two-renderer flow: a stock-bearing pocket document shown, 0/middle/end compared, setup switched including −Z,
    an unsupported stock refused, picks and camera kept, Save/New/Open. It needs a slot.
  - overcut colouring (where the swept tool enters the part, README §G23). It needs the part's mesh against the field
    and comes next.
  - the hook's and worker's lifecycle in a browser.

## G-R4 — G23 CNC: overcut shown red, and a Model program defect it found (2026-10-23)

- **What**: where the swept tool enters the part (README §G23: uncut and overcut coloured). Uncut is the amber stock
  left.
  - **The part's top.** The height field rasters the part's display meshes (world → machine frame) into its grid: each
    triangle is written at the cell centres its plan covers, and the highest surface per column is kept. A wall seen
    edge-on covers no centre.
  - **What counts as overcut.** A cell cut more than 0.01 mm under that top (`CAM_OVERCUT_TOLERANCE_MM`; the part mesh's
    own error is not known here). It is counted (`overcutCells`, `overcutMM3`) and its top drawn red, apart from the
    amber stock.
  - **Conservative both ways.** The field removes no more than the tool sweeps, so a correct program shows no false
    overcut at walls.
  - **Where it shows.** The panel says the overcut, or that there is none, to the field's resolution. The worker passes
    the current bodies' meshes.
- **The defect it found** (the outer lane's file, reported to the coordinator, not changed here):
  - On CNC8's pocket, camPackage's feeds run at x 73–117, y 53–77 instead of the pocket's 38–82, 28–52.
  - `pocketMoves`' `at()` adds the plane origin to loop points that `cam.ts` already gives as projections
    (`[p·X, p·Y]`). The tool then mills the plate's top: 3142 cells and 10 618 mm³ into the part.
  - The fix is `q0·X + q1·Y + ((o·n) + floor − depth)·n`.
  - cad-model's test compares the swept area to the feeds' own bounds, so it cannot see an offset.
  - The CNC8 "no overcut" check joins `cnc-preview.test.ts` once the fix lands.
- **Tests**: one more in `cnc-preview.test.ts` (7):
  - a slot through a part filling the stock is overcut by exactly what it removes;
  - a part whose top is the slot's floor is not overcut (within the tolerance);
  - a part beside the slot's end is overcut in part.
- **Checks** (T1): cnc-preview 7/7; studio type-check 0; eslint (viewport/ and the test) 0.
- **Not run**: the two-renderer flow (slot).

## G-R5 — G23 CNC: the CNC8 pocket cut through its own part, end to end (roadmap G2, 2026-10-23)

- **What**: the check G-R4 held back, now that the outer lane's O157 (fcdc7e3bf, integration 402f4f6fd) puts the
  pocket's feeds where the pocket is.
- **The test** (`cnc-preview.test.ts`, 8 tests): the Model's own CNC8 pocket.
  - `camPackage` builds the program from the plate's document and its machining stock.
  - The height field is cut at 0.5 mm, end to end, with the part's own display meshes.
  - It removes material and has no overcut cell (and no red drawing).
  - The lowest top left is the pocket's floor, z 12, to 1e-6.
  - Before O157, the same check counted 3142 cells and 10 618 mm³ into the part.
- **Checks** (T1): cnc-preview 8/8; studio type-check 0; eslint on the test 0.
- **Not run**: the two-renderer flow (slot).

## G-R6 — the previews take the made bodies only (O160 F1 in print layers and CNC; roadmap G4, 2026-10-23)

- **What**: the outer lane's O160 (`madeBodies`, e46106870) in the GPU lane's two manufacturing previews.
  - The Print workspace passed every shown body's mesh to `printLayers`, so a bought O-ring was sliced with its cover.
    Now `printSourceMeshes(doc, bodies)` (viewport/printSettings.ts) feeds it: the made bodies, less those hidden.
    The A9 cover should show 40 layers, no supports and 8 mm high. That number is the outer lane's (a9-acceptance); this
    lane's flow step will read it, not hard-code it.
  - The CNC preview's overcut judged every body as the part. Now `camPartMeshes(doc, bodies)` passes only the made
    bodies, so a bought bearing's or O-ring's volume is not counted as gouged. `camPackage` already plans from the made
    bodies since O160.
- **Tests**: `test/made-bodies-previews.test.ts` (2).
  - An O-ring and a bearing are left out of both previews.
  - With the person's `bought: false` override, the O-ring is in both.
  - A body with no node reference is the part's own.
  - A hidden made body is not printed.
- **Checks** (T1):
  - made-bodies-previews 2 and cnc-preview 8 (10/10);
  - Codex's print settings 4, hook 5 and worker 3 (packages/barocss-gpu/tests);
  - studio type-check 0; eslint on the changed files 0.
- **Not run**: the print flow step on both renderers (slot).

## G-R7 — G21 rest, a static pass: WebGPU silhouettes without a per-frame closure (roadmap G3, 2026-10-23)

- **What**: a read of both renderers' display-mode, silhouette and isolate/hide paths for what G21 still lacks without a
  browser. Most of it is in place:
  - both renderers draw every mode;
  - curved-face silhouettes for bodies and instances, hidden bodies skipped, isolated instances faded to 0.15;
  - instance surfaces keep their depth in line-only modes.
- **The one defect**: WebGPU's `updateSilhouettes` defined an `update` closure on every frame, the owner's no-nested-
  functions rule for per-frame paths. It is now a method, `updateSilhouette`, with the same arguments and behaviour:
  - bodies are shown unless hidden; instances always;
  - a recompute when the mesh, the eye or the placement moved;
  - a restyle when the mode, opacity, theme or clip did.
- **Looked at and left**: WebGL2's silhouette cache is per GpuBody. Each placed instance uploads its own GpuBody (only
  the geometry is shared), so instances sharing a tessellation do not thrash it. No change.
- **Checks** (T1): Codex's studio-code checks, one file each:
  - silhouette 5 and display contracts 9 + 13;
  - instance bridge 7, print overlay 6, clearance gpu 4;
  - studio type-check 0; eslint 0.
- **Left for the browser slot**: G3's acceptance. Each mode, isolate and hide on both renderers, with picks unchanged.

## G-R8 — the drawing's sheet pipeline as a hook, no behaviour change (G24 step 1; roadmap G5, 2026-10-23)

- **What**: the coordinator's decision. The GPU lane extracts the pipeline, since the outer lane is on A9's acceptance
  path. DrawingWorkspace.tsx is the outer lane's file, borrowed for this commit; the coordinator asked them to leave it
  until this lands.
  - **What moved.** DrawingWorkspace's sheet pipeline went to `src/ui/useDrawingSheet.ts`, next to it:
    - the scope and its document, and the bodies read;
    - the views projected with their sections, and the layout;
    - elements, callouts, fits, the followed-stale notes and threads;
    - the BOM read, the sourced tables, the weld joints, and the sheet.
  - **Its signature.** `useDrawingSheet(active, { engine, doc, bodies, settings, fileName, annotations? })` returns
    those values, plus `annotations` (model-annotations-v1) when asked.
    - With `active` false, no engine call is made and nothing is built.
    - DrawingWorkspace calls it with `active` true. `today()` moved with it.
  - **Proof of no change.** The moved code was diffed against HEAD's DrawingWorkspace. The only differences are the
    three `active` guards (bodies read, projection, BOM read) and `active` in their dependencies, and DrawingWorkspace
    passes true. React's hook order is the same on every render. Unused imports were removed.
- **Checks** (T1):
  - studio type-check 0; eslint on both files 0;
  - chat.test (the studio test that reads drawing outputs) 18/18;
  - studio build ok.
- **Not run**: the drawing flow steps. Their exports' bytes on the existing fixtures are the check the coordinator
  asked for, and need the browser slot. The code that builds the sheet and the exports is the same code, moved.

## G-R9 — G24: the drawing's annotations on the model, picked to their targets (roadmap G5, 2026-10-23)

- **What**: G24 on `useDrawingSheet` (G-R8) and the outer lane's model-annotations-v1, as the coordinator approved:
  planar text, the edge-on fallback, and picking by persistent names.
  - **The toggle.** "3D annotations" in the right corner, session only. Nothing new is stored: the annotations come from
    the document's own drawing settings, so Save/Open gives them back.
    - App builds the drawing's sheet only while it is on, with the Drawing workspace's own inputs (`useDrawingSheet` with
      `active`).
    - It is refused with a reason in Render/Drawing, during an edit, and with the print or CNC preview.
    - When the hook is inactive, it no longer canonicalises the document each render. The Drawing workspace always
      passes `active`, so it is unchanged.
  - **The drawings.** `viewport/pmiGeometry.ts` holds `pmiDrawings`.
    - The data's lines and arcs (chords of π/24) become one line drawing. Its heads become triangles (filled, a 12-sided
      dot) or strokes (open, tick). The selected annotation is apart, in the accent colour.
    - Both renderers draw them through the shared overlay path: `setAnnotationDrawings`, over OverlayGL and syncOverlay.
  - **The texts.** `pmiLabels`, on WebGPU's labels: in each text's plane, at its height in mm, along its direction and
    up.
    - Seen within 10° of edge-on, a text faces the eye at 12 px. It is rebuilt only when that set changes
      (`pmiFacingKey`).
    - WebGL2 (no engine labels) draws the texts facing the eye in the SVG overlay.
  - **The pick.** `pmiPick` finds the annotation nearest the pointer, within 8 px of its texts' spans or its lines on
    screen. It takes the click before the model under it.
    - App's `pickAnnotation` selects its targets' edges and faces by their persistent names on the evaluated bodies
      (`pmiSelection`).
    - The panel shows the count, how many are only on the sheet, and the picked one's text.
    - Dev hook `__studioPmi`.
- **Tests**: `test/pmi.test.ts` (3), on the outer lane's fixture (r14 tol-plate-geometric, auto-dimensioned, tolerances
  accepted, a fit on the hole):
  - every segment and head of the data is drawn once, the first line exactly; the selected one apart in the accent
    colour;
  - labels are planar at their height and direction, face the eye edge-on, and the facing key changes only then;
  - a click on a text picks its annotation and a miss none; the targets are selected by their names on the evaluated
    bodies.
- **Checks** (T1):
  - pmi 3/3; cnc-preview, made-bodies-previews and chat 28/28;
  - Codex's print/display/silhouette/clearance/instance checks 44/44;
  - studio type-check 0; eslint 0; build ok.
- **Not run**: the flow on both renderers (shown, picked, the same after Save/New/Open), and instance-prefixed targets'
  selection on placed parts. Both wait for the browser slot.

## G-R10 — G25 step 1: the triangle hierarchy packed for WGSL, with a CPU mirror (roadmap G6, 2026-10-23)

- **Approved S0** (coordinator):
  - (a) `compute/` in @barocss/gpu, exported as **experimental**: `computeExperimental` from the package. It may change
    without a version bump, and has no docs page yet.
  - (b) **G25c, the scan-to-CAD deviation, is deferred** until a scan input is decided. The robot workspace cloud is not
    a scan.
  - (c) G25a thickness, then G25b access, each its own checkpoint. The CPU values stay authoritative in the panels; the
    GPU map is labelled "GPU estimate".
- **What** (`packages/barocss-gpu/src/compute/bvhPack.ts`): `packBvh` packs the kernel's `triangleBvh` (K2) into two
  storage buffers.
  - **Nodes**, 8 words each:
    - the box low and high as f32, rounded outward from f64 (`f32Down`, `f32Up`);
    - a link: an inner node's first child, or −1 − start for a leaf;
    - a leaf's count.
  - **Triangles**, 12 words each: in leaf order, f32 vertices, and the source triangle's index for `skip`.
  - **Depth refusal**: a hierarchy deeper than the WGSL traversal's fixed 64-entry stack is refused (`[GPU_BVH_DEPTH]`).
    A DFS that pushes both children holds at most depth + 1 entries; the median split keeps the depth near
    log2(triangles / 4).
  - **The CPU mirror**: `packedRayHit` and `packedNearestDistance2` run the kernel's algorithms (slab test, Möller–Trumbore,
    Ericson's regions, nearer child first) on the packed words, as the shaders will. No allocation per query, and no
    per-element closure.
- **Tests** (`tests/compute-bvh-pack.test.mjs`, 5, in gpu `test`). Meshes: a box off the origin, a sphere of 2400
  triangles, and a sphere of 10 000 triangles at r 0.9.
  - The outward rounding is exact.
  - Every triangle appears once in leaf order with its source index, each f32 vertex inside its leaf's f32 box.
  - The mirror's ray hit equals the kernel's within 1e-5 of the mesh's size: 400 rays a mesh, hits and misses, plus an
    inward ray skipping its own triangle.
  - The nearest distance does too, bounded queries included.
  - A 69-deep chain is refused.
- **Checks** (T1): gpu `test` 184/184; gpu type-check 0; eslint (compute, index) 0; `build:library` ok.
- **Next**: G25a, the WGSL kernels (thickness) and their browser spec against the CPU map. The spec waits for the slot.

## G-R11 — G25a: wall thickness as a WGSL compute pass, with its CPU mirror (roadmap G6, 2026-10-23)

- **What** (`packages/barocss-gpu/src/compute/thickness.ts`, experimental): the studio's IM4 rule, one to one.
  - `wallRays` gives each display triangle's centre and its normal reversed. A degenerate triangle gets a zero direction,
    meaning no ray: WGSL may optimise a NaN test away, so none is used.
  - `WALL_THICKNESS_WGSL` runs one invocation per triangle:
    - the depth is the nearest hit inward, skipping the triangle itself;
    - the local thickness is twice the nearest-surface distance from the ray's midpoint, bounded by half the depth;
    - both traversals use a fixed 64-entry stack, the same slab test, Möller–Trumbore and Ericson's regions as the kernel.
  - `gpuWallThickness(device, packed, rays)`:
    - one pass and two read-backs;
    - its buffers are released after;
    - the pipeline is compiled once per device;
    - the WebGPU types are structural, as the viewer's are.
  - `cpuWallThickness` is its mirror on the same packed words.
- **Tests**:
  - `tests/compute-thickness.test.mjs` (3, in gpu `test`):
    - a 40 × 30 × 8 box's top and bottom triangles read 8 deep and 8 thick;
    - a Ø60/Ø50 tube 40 high with 96 sides reads 5 across its wall;
    - every triangle equals the kernel's rayHit + nearestDistance2 composed the same way (1e-5 of the size);
    - a degenerate triangle reads Infinity.
  - `tests/compute-thickness-browser.test.mjs` (in gpu `test:browser`): the GPU pass against the CPU mirror per
    triangle, within 1e-4 of the size, with hits and misses the same. Cases: the box and a 20 000-triangle sphere shell
    (R 30, r 25). GPU and CPU times are printed with the load.
- **Checks** (T1): gpu `test` 187/187; type-check 0; eslint 0; `build:library` ok; the browser spec passes `node --check`.
- **Not run**: the browser spec, which needs the slot; so the WGSL has not yet been compiled by a device. Also next:
  the studio's thickness map on WebGPU ("GPU estimate", with the CPU's numbers in the panel), checked against
  `thicknessMap` on the CNC8 plate (its 8 mm floor), the r14 plate and a curved part.

## G-R12 — G25b: tool access as a WGSL compute pass; both analyses checked against the studio's CPU maps (roadmap G6, 2026-10-23)

- **What** (`packages/barocss-gpu/src/compute/`, experimental):
  - **`access.ts`**, CNC4's rule one to one:
    - `accessSampleSet` lays out the samples on the CPU, as accessOf does: n² parts a triangle (n from its longest edge
      over the step, at most 48), each part's centre 0.01 mm off the face, and the 6-bit set of directions on the face's
      side;
    - `ACCESS_WGSL` runs one invocation a sample: its six axis rays (minT 1e-6, no skip) give a mask of the directions
      that leave the part;
    - `accessByTriangle` folds the masks back per triangle into the unreached share and the OR mask;
    - `cpuAccessMasks` is the pass's mirror.
  - **Shared pieces.** `bvhWgsl.ts` holds the hierarchy's structs, bindings 0–1, `rayHit` and `nearest2`, now shared by
    both passes. `dispatch.ts`'s `runCompute` handles inputs, outputs, a 16-byte uniform, workgroups of 64 and read-back,
    with every buffer released and one pipeline a device and shader.
  - The thickness pass now uses both, with unchanged WGSL.
- **Tests**:
  - `tests/compute-access.test.mjs` (2, in gpu `test`):
    - a box: every face reached by its own direction, and the samples' areas sum to each triangle's;
    - a box with a sealed cavity: the cavity's faces at share 1, the outside at 0, and every mask equal to the kernel's
      rayHit along the same directions.
  - **`apps/cad-studio/test/gpu-analyses.test.ts` (2), the acceptance's CPU half**, on the CNC8 pocket plate and the r14
    geometric plate:
    - cad-model's own `accessSamples` (share and mask per triangle) equals the experimental samples folded back:
      shares within 1e-5, masks all equal;
    - cad-model's `wallSamples` (depth and local) equals the thickness mirror within 1e-4 of the size, hits and misses
      the same.
    - So the GPU passes, once they match their mirrors in the browser, compute what the panels compute.
  - `tests/compute-access-browser.test.mjs` (in gpu `test:browser`): GPU masks against the mirror, on a sealed-cavity box
    and a 20 000-triangle shell. At most 1 sample in 10 000 may differ, a ray grazing within f32; shares within 1e-3.
    Times are printed with the load.
- **Checks** (T1): gpu `test` 189/189; gpu type-check 0; eslint (src) 0; gpu-analyses 2/2; studio type-check 0.
- **Not run**:
  - both browser specs (slot);
  - the studio map wiring on WebGPU ("GPU estimate"), which follows the specs;
  - the acceptance cases still to add in the browser: a box (its wall), the CNC8 plate (its 8 mm floor), the r14
    plate and a curved part, with timings at the stated load.

## G-R13 — the bottom-right controls no longer cover the history bar or the panels (a regression fix; flow on WebGPU, 2026-10-23)

- **The regression** (the coordinator's full flow at a177c4929: 16 steps timed out on clicks): the Views row (the
  corner-right row) had grown well past the ≈600 px the history bar's position assumes.
  - G-R3 and G-R9's CNC and 3D-annotation toggles, beside Print layers and Assembly clearance.
  - Codex's G21 display-mode select and "Isolate selection" in the Views card.
  - So it lay over the history bar's steps. Codex's display-mode notice (`cad-display-status`, absolute above the row)
    lay over the property panel's lower buttons, such as Sew into a body.
- **The fix**:
  - The Views row has one **Display** button (`aria-label="Display and previews"`, `aria-expanded`). It is lit while any
    preview is on, isolate is in use or the mode is not the default.
  - It opens a popover above the row holding:
    - a Display card: the CAD display mode select and Isolate selection, unchanged, with the same labels;
    - the display-mode notice, inside that card;
    - the four preview toggles.
    - The previews' state stays in App, so closing the popover does not stop a preview.
  - The maps' legends, the popover and the section bar now stack in one column above the row (`.corner-stack`). Before,
    each sat at its own absolute offset and they could overlap.
  - The history bar and timeline CSS is untouched.
- **Flow test changes**:
  - The G23 CNC step opens the popover first and closes it after.
  - K2's refusal is read from the toast's textContent: the kernel's reason sits in its closed Details, which innerText
    skips.
  - K2's blank-canvas check compares the shown tee with the empty viewport by the share of pixels that change (more than
    0.5 %). A colour count could not tell them apart: 60 against 60.
- **Flow** (WebGPU, DPR 1, 1440 × 900), the failing steps with their prerequisites, three runs (load 1m 13–35):
  - all of 2–6, 20–25, 35–40, 48–60, 61–77, 98–104 and 193–197 pass;
  - all of 246 and 247 (narrow widths), 261–267 (G19.3–G20.2, K2, G23 CNC) and 267 (palette) pass.
  - In one run, step 65 (Hole then Fillet) was refused by the kernel when run without 61–64. The camera they leave
    moves the dragged hole; with them it passes, as in the full flow.
- **Steps not mine** (the coordinator's list): 147, 245 and 248 (the outer lane's rows rule (b) in the scripted chat),
  and 144 (a timing flake).

## G-R14 — K2's viewport side on both renderers, and the L-gap black canvas not reproduced (roadmap K2 / G4, 2026-10-23)

- **K2 notches** (`K2 FRk5 notches`, the kernel lane's D182 cases) **and G23 CNC** (`G23 CNC`) **pass on WebGL2**
  too (load 1m 14–19). With G-R13's WebGPU runs, both now pass on both renderers.
- **The L-gap reproduction** (new check `K2 FRk5 L gap`).
  - D175 recorded that the L gap frame's first WebGPU canvas was black with real worker geometry, and WebGL2 fine.
  - The check opens a mitred L of 40 × 40 × 3 tubes with a 2 mm joint gap, as the studio's frame node, after a New part.
    It requires:
    - two bodies;
    - the first frame after they arrive not black (under 0.5 % near-black pixels) and changed from the empty view;
    - the same after Iso;
    - the same volumes (1e-9) after Save, New and Open.
  - Results:

    | Renderer | First frame changed | Black | Result |
    |---|---|---|---|
    | WebGPU | 8.61 % | 0.00 % | passes |
    | WebGL2 | 11.03 % | 0.00 % | passes |

  - **Not reproduced at integration.** Codex's black canvas came from its own environment at 1f041 (before the
    G19–G21 viewer work in integration); its raw files are gone.
  - The check stays in the flow as a guard. If it comes back, the step's message gives the shares.

## G-R15 — G3's acceptance: every display mode on both renderers, picks unchanged, isolate and restore (roadmap G3, 2026-10-23)

- **The check** (new flow step `G3 display modes`): a 64 × 32 × 8 plate and two placed Ø8 × 20 pins (curved faces,
  silhouettes).
  - Each of the five CAD display modes is chosen from the Display popover: shaded with edges, hidden lines removed,
    hidden lines dashed, wireframe, x-ray. For each, the step requires:
    - the mode effective (the select's `data-display-mode-effective`);
    - the canvas drawn (over 0.5 % of pixels changed from the empty view);
    - a click on the plate's top, away from the feature's handle, selecting the same face in every mode.
  - Isolate: with a pin selected, Isolate selection fades the rest (over 0.5 % changed); Restore view brings back the
    selected view (under 0.2 % changed).
- **Results** (load 1m 16–31, DPR 1, 1440 × 900):

  | Renderer | Modes drawn | Pick | Isolate fades, restore returns |
  |---|---|---|---|
  | WebGPU | 5/5 | `{body 0, face 5}` in all five | yes |
  | WebGL2 | 5/5 | `{body 0, face 5}` in all five | yes |

  The snapshots were inspected: dashed hidden edges, silhouettes on the pins, isolate fading the plate and the other pin.
- **Not covered**: hiding a body in every mode (the outliner's eye), and section plus mode combinations. G19's steps cover
  sections in the default mode.
- **Getting the step right**: a click at the canvas centre hit the extrude's handle and opened its edit, which disables
  the display modes. The step now frames with the Frame-all button (a key could start a command) and clicks away from
  the handle.

## G-R16 — G24's acceptance on both renderers: shown, picked to its targets, the same after Save, New and Open (roadmap G5, 2026-10-23)

- **The check** (new flow step `G24 3D annotations`): the outer lane's r14 tol-plate-geometric case, its document with
  its own drawing (6 dimensions, A3), opened in the studio and seen from Front.
  - "3D annotations" is turned on from the Display popover.
  - The annotations must arrive and be drawn: the canvas changes, and the texts are drawn (WebGPU's `pmi:text` labels;
    WebGL2's SVG texts).
  - A click at the first annotation's text anchor, projected by `__studioScreenOf`, must pick it and select its
    targets.
  - After Save, New and Open, the same ids and texts.
- **Results** (load 1m 17–20, DPR 1, 1440 × 900):

  | Renderer | Annotations | Canvas changed | Pick | After Save/New/Open |
  |---|---|---|---|---|
  | WebGPU | 6 dimensions, 0 sheet-only | 0.88 % | selects its edge (the 64 mm line along X) | same |
  | WebGL2 | 6 dimensions, 0 sheet-only | 1.14 % | selects its edge | same |

  The snapshots were inspected: the 64 and 32 dimensions, extension lines and heads in their planes, and Ø8 THRU.
- **Not covered**: datums and frames in 3D on screen. They are in pmi.test (unit); this case's drawing has no frame
  placed. Instance-prefixed targets are not covered either.

## G-R17 — G25's compute passes run on a device: both match their CPU mirrors (roadmap G6, 2026-10-23)

- **First runs on WebGPU** (Chrome, Node 22, load 1m 19–25), one spec file at a time:
  - `compute-access-browser`:

    | Case | Samples | Masks that differ | Worst share | CPU | GPU |
    |---|---|---|---|---|---|
    | a sealed-cavity box | 27 924 | 0 | 0 | 19 ms | 1.3 ms |
    | a 20 000-triangle sphere shell | 331 900 | 0 | 0 | 590 ms | 7.7 ms |

  - `compute-thickness-browser`:

    | Case | Worst \|Δ\| | Hits and misses | Outliers | CPU | GPU |
    |---|---|---|---|---|---|
    | the box | 3.8e-6 mm | the same | 0 | 0.4 ms | 0.9 ms |
    | the 20 000-triangle shell | 8.6e-6 mm | the same | 2 | 87 ms | 7.2 ms |

    - The 2 outliers are polar rays aimed at the inner sphere's pole vertex. The f64 mirror (as the kernel's own f64
      rayHit would) slips between triangles there and reads the far side, 54.97. The f32 GPU hits the inner shell,
      4.9975: the true wall.
    - The spec counts such through-a-vertex cases and allows at most 1 in 1000; the rest are compared within 1e-4 of
      the size.
- **Fixes the device runs found**:
  - The WGSL "no hit" literal 3.4028235e38 is above f32's largest, so the shader did not compile. It is now 1e38,
    read back as Infinity at ≥ 9e37: f32 stores 1e38 as 9.99999968e37.
  - The specs' server now answers /favicon.ico (204). A 404 was a console error.
- **A Codex contract updated** (`cad-instance-display-diagnostics`, "one … toggle"): it read App.tsx between
  `aria-label="Views"` and the notice. Isolate now lives in G-R13's Display card, so the check reads that card and also
  requires no Isolate toggle left in the Views row. Its intent is unchanged: one toggle, enabled to restore, session
  only.
- **Checks**: gpu `test` 189/189; type-check 0; eslint 0; studio gpu-analyses, pmi and cnc-preview 13/13.
- **`test:browser` as a whole**: it hung in `uv-repeating-browser` (G18.2, the docs' shaders) for over an hour, and only
  this lane's processes were stopped. That spec is to be run alone with a timeout to find why. The other browser specs
  (viewer, scene viewer, pose-clip) were not reached in that run.

## G-R18 — the viewer no longer hangs at start without antialiasing; the access map on the GPU (roadmap G6/G7, 2026-10-23)

- **The hang** (gpu `test:browser` stuck for over an hour; viewer-pose-clip's G2 and G19 timing out):
  - It came with Codex's 22e129e36 (per-sample caps). Without antialiasing, the caps reuse the surface and pick shader
    modules, and `createPipelines` called `getCompilationInfo()` on every entry, so twice on each of those two modules.
    In Chrome a second call on one module never settles.
  - So `createViewer({ antialias: false })` never returned. A cold probe confirmed it: antialias true started in 835
    ms; antialias false had not started after 170 s, with no pipeline pending, waiting on the sixth compilation check.
  - **Fix**: each module is checked once. A cold antialias-false viewer now starts in about 2 s.
  - Every spec that makes an unantialiased viewer was affected. A test timeout left its browser open, so the process
    never exited.
- **gpu `test:browser`, one file each** (load 1m 10–14):

  | Spec | Result |
  |---|---|
  | viewer | 1/1 |
  | scene-viewer | 1/1 |
  | uv-repeating | 1/1 (2.6 s; it had hung) |
  | compute-thickness | 1/1 |
  | compute-access | 1/1 |
  | viewer-pose-clip | 17/18 |

  - The one left is #6, "G20.2 no cap leaks over a front face's far edges". It finds 77 cap pixels where the CPU's ray
    meets no cap; 10 are allowed for pixel-edge rounding. It is a real cap defect (G7's area), and is investigated
    next. It could not run before this fix.
- **G25b's access map on the GPU** (approved):
  - Viewer `computeDevice` (a getter) passes through `GpuRenderer.computeDevice` and the Viewport handle to
    `useGpuAccessMaps`.
  - On WebGPU the access map is the compute pass's, the legend titled "Not reached by a 3-axis mill · GPU estimate".
    With no device (WebGL2, or not ready) it is the CPU's, as before.
  - `accessOf` stays the panels' number.
  - `accessMapOf` and `accessStep` in scalarMaps share the map and the step with the CPU path.
  - gpu-analyses checks the GPU map's step and length against cad-model's accessSamples.
- **Thickness stays on the CPU** (the coordinator's decision): thicknessMap's legend range comes from `wallsOf`, which
  runs the CPU rays itself. Seeding the samples from the GPU would make the panels' numbers the GPU's. The GPU
  thickness pass stays built and tested for when the range can come from elsewhere.
- **Checks**: gpu `test` 189/189; type-check 0 (gpu, studio); eslint 0; studio gpu-analyses and analysis-maps 8/8.

## G-R19 — G20.2's cap-leak check made right for antialiased caps; viewer-pose-clip 18/18 (roadmap G7, 2026-10-23)

- **The failure** (viewer-pose-clip #6, which could first run after G-R18): 77 cap pixels where the CPU's centre ray
  meets no cap, against 10 allowed.
- **What it was**: a probe on the test's own scene (a cut-out 40 × 20 × 10 plate with a shadow catcher), each cap pixel
  classed by its colour and its neighbours:
  - with antialiasing (Codex's per-sample caps), the 64 such pixels were all beside a CPU cap pixel, and none was the
    pure cap colour. They are partly covered edge pixels: the cap on some of their samples. That is G7's antialiased
    cap edge, not a leak.
  - without antialiasing, 3, within the allowance.
  - The leak G20.2 guarded against (660 pixels before its fix) covers whole pixels.
- **The check now**:
  - A leak is a pixel of the pure cap colour (every sample cap) where the CPU's ray meets no cap: 10 allowed, as before.
  - Partly covered cap pixels must exist, so the cap edge is antialiased.
  - Result: 11 050 cap pixels, 0 leaks, 77 partly covered (load 1m 11).
- **viewer-pose-clip 18/18.** With G-R18, every gpu browser spec passes, one file each: viewer, scene-viewer,
  pose-clip, uv-repeating, compute-thickness, compute-access.
- **G7 so far**: antialiased cap edges are shown (the fringe), with no leaks and the caps' picks unchanged (pose-clip's
  G2, G19 and G20 pick checks pass). Still open from its S0:
  - AA on against off on a box at 0°, 30° and 45° and a cylinder (the interior unchanged, coverage at the edge);
  - capFrontSamples' memory and the frame time.

## G-R20 — G7 closed: antialiased caps against unantialiased, their cost; pose-clip #6 tightened (roadmap G7, 2026-10-23)

- **pose-clip #6 tightened** (the coordinator's rule, so the G-R19 rule can't hide a real leak):
  - A partly covered cap-coloured pixel counts as an edge pixel only when it is 8-adjacent to a CPU cap pixel.
  - Any other cap-coloured pixel where the CPU's ray meets no cap is a leak, pure or not: 10 allowed, as before.
  - Result: 11 050 cap pixels, 0 leaks, 77 edge pixels, all beside a CPU cap pixel (load 1m 14). viewer-pose-clip 18/18.
- **viewer-cap-aa-browser** (new, in `test:browser`), WebGPU only. The scene:
  - one viewer each with antialiasing on and off; 480 × 360 at pixel ratio 1; orthographic, seen along +Y; cut by y = 0;
  - an unlit #404040 body with a #ff00ff cap on black;
  - a box 8 × 8 × 8 turned 0°, 30° and 45° about Y (the cap a turned square), and a 64-sided Ø8 cylinder standing
    along Y (the cap a disc).
- **The interior unchanged**: pixels whose whole 3 × 3 neighbourhood is cap by the CPU's ray, AA on against off.
  Worst |Δ| 0/255 in every case (10 000, 9 748, 9 660 and 7 676 pixels).
- **The edge covered**: edge pixels are those with cap and not cap in their 3 × 3 neighbourhood. A partly covered pixel
  is neither the pure cap colour nor grey, but a mix of magenta and what is beside it.
  - Box 0°: 404 of 816 (50 %), where the square's edges fall mid-pixel.
  - Box 30°: 648 of 1 104 (59 %).
  - Box 45°: 564 of 1 136 (50 %).
  - Cylinder: 436 of 816 (53 %).
  - The spec requires ≥ 30 % on the turned boxes and the cylinder.
- **An uncut frame unchanged**: the same scene uncut with the cap path on (`cap: true`) against off. 0 bytes differ in
  every case.
- **Cost**:
  - capFrontSamples is rgba16float at 4 samples, 8 bytes a sample. That is W·H·32 bytes: 5.27 MiB at 480 × 360,
    63.3 MiB at 1920 × 1080.
  - It is allocated only when a capped frame is drawn with antialiasing (`ensureCapSamples`).
  - Frame time, with capture and read-back (20 captures each, load 1m 10): 1.9–2.2 ms cut with AA, 1.8–2.1 ms cut
    without, 1.4–1.6 ms uncut.
- **Not covered**: WebGL2. Its caps aren't drawn per sample, so there is no AA path there to compare.
- **G7 done.** With it, the roadmap list given to the GPU lane (G1–G7, K2) is done.

## G-R21 — G8 performance regression check: three causes fixed, two App findings (roadmap G8, 2026-10-23)

- **What ran**: `bench:browser`, `bench:assembly` and `bench-mesh-browser`, alone, against the budgets G13 set (two
  times G4's, re-measured).
  - First run at load 1m 10–12, on integration 3e573ec71:
    - over budget: pose (138 buffers, budget 4); explode (6 758 buffers); section on the GPU (70.7 KiB uploaded a frame,
      budget 5; 12 ms of GPU, budget 6); pick (126 ms of task, budget 90); hover over 120 brackets (0 frames); both
      ghosted orbits (125 submits, budget 64);
    - bench:assembly: 258 buffers, budget 60;
    - the meshes: within every budget.
- **Tracing**: `BENCH_TRACE=1` (new, opt-in) prints under each row:
  - the buffers made and the bytes written, by label and caller;
  - the meshes dirty at each frame's object write, and who touched them;
  - a CPU profile's self time and stacks.
- **Cause 1, curved-face silhouettes on the CPU** (Codex's G3 display modes, 99da385a1). `updateSilhouette` recomputed
  each surface's contour whenever the eye or its transform moved, into a new line geometry and buffer. That was every
  frame for every moved body in pose and explode, and for every curved body in an orbit.
  - **Fix: the contour on the GPU.** `GeometryInput.contour` (gpu): line geometry made from triangles with normals.
    - Each triangle is one instance (72 bytes).
    - The line shader's `vsContour` finds the segment silhouetteLines finds: the facing at the vertices, linear across
      the triangle, at zero. Zero vertices and degenerate triangles are handled the same way.
    - It is drawn by the line pipelines' contour variants (plain, see-through, over, hidden), and never picked.
  - The studio makes one contour geometry per mesh (`contourTriangles`: the curved, unfaceted faces' non-degenerate
    triangles). Its copies share it, and it moves with its surface's transform.
  - silhouetteLines stays for WebGL2.
  - **viewer-contour-browser** (new, in `test:browser`): a torus drawn with the CPU's segments and with the contour.
    - Perspective, orthographic, and turned and moved: 819, 776 and 983 pixels each way.
    - 0 pixels of either more than a pixel from the other.
    - Moved 10 times: 0 buffers made.
- **Cause 2, object blocks written from the lowest dirty slot to the highest.** Two dirty meshes far apart (the ground,
  a late silhouette) sent every block between them again: 70 KiB a frame.
  - Fix: each run of dirty slots written on its own; a gap of up to 4 clean blocks is kept in its run.
- **Cause 3, silhouette lines flipping `clipped`.** applyClip set them false (they were not in its cut set) and
  updateSilhouette set them back each frame, dirtying about 116 lines a frame in the section drag.
  - Fix: applyClip gives each silhouette line its surface's `clipped`.
- **Bench rules (measurement only)**:
  - A reversed timestamp pair leaves its submit unstamped: out of the GPU average, and allowed for 5 % of the submits
    (at least 1). Seen on Chrome/Metal: one section frame's first pass with its begin stamp unwritten (6.1e18).
  - The hover over 120 brackets is `drawless`: the brackets are not highlighted under the pointer, so 0 frames is
    right, and its task is what is judged.
- **After**, the full run (load 22–35, LOADED; the outer lane's run beside it):
  - pose: 0 buffers, 4.3 KiB a frame.
  - explode: 0 buffers; frame callback 2.5 → 0.33 ms; task 28.6 → 24.4 ms; 116 → 90 KiB a frame.
  - section on the GPU: 2.6 KiB a frame; GPU 5.0–5.6 ms in three runs (7.5 once at load 25; budget 6).
  - bench:assembly: 27 buffers.
  - Every other row within budget, except the two App findings below.
- **Findings for the App** (not fixed here; App.tsx is shared, and the owner has asked for its refactor):
  - **pick: a bracket clicked**: 121–151 ms of task (budget 90; 47.7 at G9). A CPU profile puts it in React's DEV
    element creation as the whole App renders again on the selection:
    - 63 ms in the outliner's 120 instance rows (App.tsx 2309);
    - 20 ms in the toolbar's `toolButton` (App.tsx 1790).
  - **ghosted orbits after a pick**: once the pattern is open and a bracket has been clicked, the App renders again on
    every orbit step (2 s of `jsxDEV` over 60 steps), and each step draws a second frame (124 submits). Alone, or
    without the pick, 59.
    - What sets the App's state on a camera move is not yet found: a refactor's first question.
- **Checks**:
  - gpu: tsc 0, eslint 0, unit 189/189 (cad-gpu-display-contract #24's fixture has no field initialisers: the contour
    map is made on first use).
  - studio: tsc 0; eslint 0 errors (the bench's existing no-console warnings only).
  - gpu browser specs, one file each (load 18–22): viewer, scene-viewer, pose-clip 18/18, uv-repeating, compute-thickness,
    compute-access, cap-aa, contour.
  - studio suite: 249/249.
  - FLOW_ONLY on WebGPU, the steps that draw silhouettes or sections (load 13–16), all pass: section view (73), cylinder
    on a side face (85), G19.2 (262), G19.4 (264), K2 notches (267) and G3 display modes (269).
- **Next**: G9 (capFrontSamples memory), then G10 (WebGL2 full flow); then R1, the App.tsx split, which takes both App
  findings.

## G-R22 — G9: the caps' samples at 2 bytes a sample, 63.3 MiB at 4K (roadmap G9, 2026-10-23)

- **Before**: capFrontSamples held each sample's probe winner as its depth's 32 bits in an rgba16float (11/11/10 bits and a
  back flag): 8 bytes a sample, 32 a pixel. That is 28.1 → 112.5 MiB at 1440p and 253.1 MiB at 4K, allocated whenever a
  capped frame is drawn with antialiasing.
- **Now: r16uint, a triangle's key** (`probeKey`: the mesh's slot, its first vertex and its instance, hashed to 16 bits,
  never 0; 0 is no cap or a front face).
  - The probe writes its winner's key where the winner is a back face. The probe still chooses by the sample's own depth
    (`capSampleDepth`), with the back face's lead as before.
  - A cap draws where the key at its sample is its own triangle's: the triangle the probe found there. The probe and the
    caps draw the same triangle at a sample (one index buffer, one rasterisation), so the key matches without a depth
    tolerance.
  - The slot key is object.pick.z's high half: `(slot % 65535) + 1`. The flags' bits 0–1 are unchanged.
  - Why a triangle and not a mesh: with one key a mesh, every back face of the winning mesh on the ray would draw the cap.
    In the order-independent pass, which writes no depth, a ghost's cap was then added again. The spec below shows 8/255
    that way, against 0/255.
  - Limit: two triangles on one ray share a key about 1 time in 65 535. The unit test measures under 4 in 65 535 over
    260 000 pairs, neighbouring first vertices included. Then a sample of a cap could be drawn by the wrong triangle.
  - r32uint is not multisampled in WebGPU; r16uint, r8uint, rg16uint and r32float are (Chrome, checked).
- **Memory, 4 samples × 2 bytes = 8 bytes a pixel**: 1.32 MiB at 480 × 360; 15.8 MiB at 1080p; 28.1 MiB at 1440p;
  63.3 MiB at 4K (budget 64). Still allocated only for a capped frame with antialiasing.
- **viewer-cap-aa-browser**:
  - G7's four cases unchanged: interior worst |Δ| 0/255; edge partly covered 404 / 648 / 564 / 436 pixels, as G-R20;
    uncut frames byte-identical.
  - New: at 2560 × 1440 and 3840 × 2160, 251 507 and 566 484 cap pixels. A frame with read-back takes 17.9 and 38.6 ms
    cut, 19.3 and 36.4 ms uncut (load 13); the read-back of a 4K frame is most of that.
  - New: one ghosted mesh of two boxes in line, the first cut: its cap's interior with antialiasing (the samples' keys)
    against without (the pixel's probe), worst 0/255 over 3 364 pixels. With the key a mesh (tried, then put back),
    8/255.
- **viewer-cap-samples** (Codex's source contracts) now pin the new contract: r16uint, a uint binding, the key
  interpolated flat in probe and caps, `capFirstSample` by key. The 11/11/10 depth-lane test is replaced by the key's
  test.
- **Checks**:
  - gpu: tsc 0, eslint 0, unit 189/189.
  - Browser specs, one file each (load 12–37): cap-aa 3/3, pose-clip 18/18 (G20.2: 11 050 caps, 0 leaks, 77 edge;
    G19.4 ghost caps), viewer, scene-viewer, uv-repeating, contour.
  - FLOW_ONLY on WebGPU, every step that sections, plus G3 display modes: 20 passed, 0 failed. The load started at 37
    and reached 60 at the end, with other lanes' runs beside it.

## G-R23 — G10: the full browser flow on WebGL2, the parity statement (roadmap G10, 2026-10-23)

- **Full flow, WebGL2**: from a detached scratch worktree at 6db68a8ef, chat port 52691, load 1m 15–19 at start and end.
  - 255 passed and 17 failed.
  - 9 of the 17 were my setup: the kernel's `dist` was not built in the scratch worktree ("Cannot find module …
    barocss-cad/dist/index.js"). Built, they pass (42, 44, 45, 46, 83, 120, 121, 142, 264, 265).
- **Reruns** (FLOW_ONLY, each failing step with its prerequisites), at b836b7efd with both dists fully built:
  - load 8–10: 1, FRd1 (165), 255, 258, 269, 271 and 272 pass;
  - 144 and 166 fail on WebGL2 and on WebGPU alike (see below).
- **Real WebGL2 gaps, and what was done**:
  - **G6 analysis maps and the mould's view (255)**: renderer.ts has no `setScalarMaps`, `scalarAt` or `setMould`. On
    WebGL2 the Thickness button turned on and nothing was drawn. That was silent, and it cascaded: the maps were left on,
    so display modes were refused in 269, and 271 and 272 waited.
    - **Stated limit** (accepted by the coordinator): on WebGL2 the "Analysis map" button is disabled, with its reason:
      "… are drawn with WebGPU; this browser draws with WebGL2".
    - App.tsx learns the renderer through Viewport's new `onBackend`; the legend follows the same state.
    - Step 255 on WebGL2 checks the disabled button, its reason and that no legend is shown.
    - **Roadmap limits line**: analysis maps (thickness, draft, 3-axis access) and the mould's parting line and halves are
      WebGPU only; WebGL2 says so.
  - **G10 shared copies (258)**: WebGL2 shares a copy's tessellation too (renderer.ts' `instanceShapes`). The step read
    the WebGPU viewer's DEV hook. Now:
    - renderer.ts has a `shareCopies` toggle (every instance made again) and `instanceGeometries()`, with the DEV hooks
      `__studioShareCopies` and `__studioInstanceGeometries`.
    - Step 258's WebGL2 branch uses the renderer-neutral probes. Result (`G10 oracle (webgl2)`):
      - 24 copies on 1 geometry, 24 when each has its own;
      - the 96 × 96 frame the same: 0 of 9 216 samples differ by more than 96, max 2;
      - 400 picks on the copies' tops: 366 hits, 0 differ;
      - the edited copy on its own geometry (2 in all), the other 23 kept.
- **Not WebGL2 (the same on WebGPU at b836b7efd, load 8)**, findings for their lanes:
  - **144 FR3b** (D126): the round-cornered table's preview now arrives after 1 293–1 435 ms, and the step requires more
    than 2 000 ms to be "the case being measured". The kernel's trims got faster; the step's premise is stale. What it
    measures holds: the slowest answer was 1 ms, and the longest main-thread gap 73 ms.
  - **166 FRd2** (O119): all 16 welds are now placed on A3, and none is said unshown. The step expects 11 placed and W8
    and W13–W16 unshown. A drawing-model change since O119 (O174–O178) places the five.
- **Bench**: `BENCH_TRACE` also prints the callers of React's `dispatchSetState`, for R1's ghosted-orbit question.
- **Checks**: studio tsc 0, eslint 0, unit 250/250; the flow's syntax checked. The full flow runs at the end of Phase R,
  as the survey's rules say.

## G-R24 — R1a: the viewport's per-frame render moved into its overlay; Escape clears a part's selection (roadmap R1, 2026-10-23)

- **How it is measured**: `countRender(name)` (DEV only, `src/devRenders.ts`) in App, Viewport and the new
  ViewportOverlay. `bench:browser` under `BENCH_TRACE=1` prints each row's renders, the same rows before and after.
  Numbers below are renders per row: App / Viewport (/ overlay).
- **Before**, at de06d57b7 (load 9):
  - every frame rendered the whole Viewport: orbit 60 frames → 60 Viewport renders; cloud orbits 60; underlay 61;
  - ghosted orbits: 66 App and 128–129 Viewport renders, 124 submits, task 19.6 ms a frame.
- **The ghosted orbit's cause** (G8's open question): the bench's `dispatchSetState` callers show `place` (App.tsx) ←
  `onTurn` ← `gizmoDrag` (Viewport).
  - After a bracket was picked, the bench pressed Escape. Escape cleared only the faces' selection.
  - The bracket stayed selected, with its gizmo, and the orbit drag that followed turned it.
  - **Fix (a behaviour fix, its own commit 53e0cb4cf)**: Escape clears the placed parts' and the direct objects'
    selections too.
- **R1a, the per-frame render**: `request()` set a state each frame (`setTick`), so the whole Viewport rendered again:
  its handlers, its JSON keys, the camera basis and the PMI key, ViewCube's props.
  - Now a frame bumps a ticker. Only `FrameOverlay`, which draws the SVG overlay, ViewCube and WebGL2's PMI texts,
    subscribes to it (`useSyncExternalStore`).
  - Which PMI texts face the eye was computed in each render; it is now checked in the frame, before it is drawn. The
    texts are set again only when that changes, as before.
- **After**, at the same rows (load 23 → 12):
  - orbit: 1 Viewport render, 60 overlay renders (60 Viewport before);
  - the cloud and underlay orbits likewise, 1 Viewport render each;
  - hover over the plate: 0 Viewport (11 before), 11 overlay;
  - ghosted orbits: 1 App, 1 Viewport, 60 overlay renders; 59 submits; task 3.3 ms a frame (19.6). Both rows are now
    within budget.
  - Rows the App renders every frame are unchanged, and are R1's next targets:
    - pose: 100 App renders over 51 frames (the joint's value is App state);
    - explode: 60;
    - section drag: 154.
  - pick is unchanged at 129 ms: the App's selection render, R1's App split.
- **Checks**:
  - studio tsc 0, eslint 0.
  - FLOW_ONLY on both renderers, the steps that draw the overlay (load 7–13), all pass: constraints and typed dimensions,
    a box's dimension arrows, measure, a dimension handle and the Rotate gizmo, the view cube, the section plane's drag,
    K2 L gap, G3, G24 and G23.
  - The instance steps 50, 57, 58 and 60 need their prerequisites. With 49, 56, 57 and 59, all pass on WebGPU (load 9).

## G-R25 — R1b: the viewport's stable inputs (print views, offsets, the projector) (roadmap R1, 2026-10-23)

- **Print views' props**:
  - With Print layers or the CNC preview on, the viewport's props were made again in every App render: `bodies: []`,
    the selection, `handles: []`, `profiles: []`, and the print projection's selection and face colours.
  - The effects keyed on them (setBodies, setState) ran again each time.
  - Now the empty lists are module constants, and the projected selection and face colours are memoised on their inputs
    (`printSelection`, `printFaceColors`). The same values as before.
- **The bodies' offsets**: `viewState()` runs in each frame and hover, and it made a new Map of the transforms' offsets
  each time. Now that Map is made once for the transforms (or offsets) it comes from.
- **The projector**: studio `camera.ts` `project` multiplied the view-projection again on every call. It runs for every
  edge end on a hover (vertexAt) and every overlay point in a frame.
  - Now the matrix is kept until a camera value changes: target, distance, yaw, pitch, fovY, ortho or aspect.
  - It is the same `viewProjection`, so the projected points are bit-identical.
- **Renders**: the bench rows read as G-R24 (load 18 → 11). These inputs did not drive the bench rows' renders; what
  they save is work in each render and frame.
- **Not done here**: `memo(Viewport)`. The App hands it about 15 props made in every render (inline callbacks,
  `boundsBox`, `measureLine`, `profiles={active ? [] : …}`, `cageEd.shown(…)`), so memo would compare and still render.
  They are made stable with the App split (R1c).
- **Checks**:
  - studio tsc 0, eslint 0, unit 250/250.
  - FLOW_ONLY on both renderers (load 9–11), passing: the overlay steps, the instance steps (56–58), AM6, AM7a, G24 and
    G23 (Print layers inside).
  - 49 and 50 fail when run straight after 47 (measure), at R1a's f63c349f2 too, so the cause is the FLOW_ONLY order,
    not R1b. In the full flow, 48 comes between them, and they passed (G-R23).

## G-R26 — R1c (1): the outliner's placed parts and the toolbar's buttons memoised; the camera cache's test (roadmap R1, 2026-10-23)

- **What**:
  - `ui/OutlinerInstances.tsx`: the list of placed parts, and each row, as memoised components. Each row gets its
    selected flag, its bearings when it alone is selected, the bearing being edited, and whether editing is locked. The
    pick and edit handlers are stable (setters only).
  - `ui/ToolButton.tsx`: a command's button, memoised. Its availability (ok, reason) and its on flag are worked out by
    the App as before. `start` goes through a ref to the latest, and the drag handlers are stable.
  - The DOM is unchanged: the same classes, attributes, labels and order.
- **The camera cache's test** (the coordinator's request), `test/camera-projector.test.ts`: each value project depends
  on is changed in place after a projection, each of target's three, then target replaced, distance, yaw, pitch, fovY,
  ortho and aspect, and orbit, pan, zoom, fit and setView. Each time the projection is bit-identical to a fresh camera's
  with the same values, and again from the kept matrix. Also: the same matrix as viewProjection. 16/16.
- **Bench** (BENCH_TRACE, load 38 → 24, LOADED):
  - **pick: a bracket clicked**: task 129 → 57.6 ms (budget 90). Now within budget. The profile's jsxDEV self time is
    118 → 36 ms.
  - the pattern opened: 64.8 → 26.4 ms of task.
  - the other rows within budget, except pose (28.6 ms of task, budget 22). Its App renders every frame for the joint's
    value: R1c (2).
- **Checks**:
  - studio tsc 0, eslint 0, unit 266/266.
  - FLOW_ONLY on both renderers (load 12–24), passing: tool keys, the instance chain, chat commits an assembly, Bearing
    R12c.4, the narrow top bar, the shapes strip, the palette.
  - 50, 57, 60 and G3 failed when the sketch step 24 ran before them. Run as G-R24's set (49, 56–60) and G3 alone
    (load 20–22), all pass, so the cause is the FLOW_ONLY order.

## G-R27 — R1c (2a): the rail's and the shapes strip's button lists memoised by their availability (roadmap R1, 2026-10-23)

- **Why**: memoised buttons alone (G-R26) still left the App making each button's element again in every render, about
  70 of them. That is 376 ms of jsxDEV in the pose row: the App renders in every frame of a joint played, an explode or
  a section drag.
- **What** (`ui/ToolButton.tsx`):
  - `commandStates(list, ctx)` is each command's availability in this render, with a signature.
  - `CommandButtons` (each rail group) and `CommandStrip` (the shapes strip's buttons inside ShapesStrip) are memoised.
    They are made again only when the commands, that signature, the active command or a handler changes.
  - The rail's groups and the place commands are module constants. The DOM is unchanged.
- **Bench** (load 39 → 37, LOADED; before is G-R26's run at load 13):
  - pose 31.2 → 23.4 ms of task a frame (budget 22);
  - explode 27.8 → 19.7;
  - section drag 30.8 → 23.3;
  - pick 57.6 → 48.0;
  - pattern 26.4 → 21.6.
  - The toolbar's stack is gone from the profile. What is left of the App's per-frame render is its own JSX: 894 ms over
    138 renders in the pose row. That is the next split.
- **Checks**:
  - studio tsc 0 (after the merge), eslint 0, unit 266/266.
  - FLOW_ONLY on both renderers (load 23–37), all pass: constraints, tool keys, a hole by dimensions, a box's arrows, an
    instance placed, Bearing R12c.4, the narrow top bar, the shapes strip, the palette.

## G-R28 — step 258's WebGPU count after G8's contours (G10, 2026-10-23)

- **The failure** (the coordinator's full window at 218c5604a, WebGPU): "each its own: 46 more geometries". The scene's
  geometries went 4 → 73 when each copy got its own mesh. Pixels and picks were the same (strong 0, max 1; 255 hits,
  0 differ).
- **Why**: G8 (G-R21) draws a curved face's silhouette as a contour geometry, one for each mesh source, shared by
  copies of it. A copy with its own mesh has its own contour too: 23 more, beside the 46 surfaces and edges. The code
  is right; the step's count predates G8. My G10 reruns were on WebGL2 only, so they did not see it.
- **The step now** counts the contours apart: 1 shared, then 24, one a copy. The other geometries are still 46 more.
- **FLOW_ONLY 258** (load 26–28), passing on both renderers:
  - WebGPU: contours 1 → 24, geometries 4 → 73;
  - WebGL2: as G-R23.

## G-R29 — R2a: per-frame allocations in the viewer and both studio renderers (roadmap R2, 2026-10-23)

- **gpu viewer** (`viewer.ts`, `lights.ts`):
  - The shadow pass's two per-caster dynamic-offset arrays and the grid's `[0]` now go through the module's
    `dynamicOffset`, as every other draw does.
  - The four `for (const list of [opaque, transparent])` loops no longer make an array a call. One test inside them
    (`list === transparent`) is now `l === 1`.
  - `opaque.some(m => …)` / `casters.some(m => …)`, closures a frame, are now `anyCapped` / `anyGhostCapped` loops.
  - `packOutput` writes into a kept block (`into`, zeroed first) instead of a new ArrayBuffer a frame. Its outline
    colours are written without the `slice`/`forEach`/spread arrays.
  - The shadow frame's `packFrame` call writes into a kept block. Its light list and viewport are constants (`[1, 1, 1]`,
    as before).
  - The same values are written in the same order.
- **studio WebGL2 renderer** (`renderer.ts`): the instances' and the bodies' draw loops are index loops, in place of
  `forEach` closures and `entries()` pairs, with `return` → `continue`. The edge colour is passed without a spread. The
  bounds' corners are taken without a `.map` array a corner.
- **studio WebGPU renderer**: the silhouettes' seen set is kept and cleared, made on first use for the contract test's
  field-less fixture.
- **Left as they are, with the reason**:
  - `pipelineKey`: a per-mesh cache would have to follow `geometry.data.scalars`, which changes without touching the
    mesh, `colorMap` and the shader pipelines' lazy compiles. That is a wrong-pipeline risk for a few short strings.
  - `gridFrame`, made twice a frame: one small object. A cache would have to follow the grid's fields and the distance.
  - The WebGPU renderer's camera, lights and environment objects a frame: the viewer's change checks lean on them
    (`target` is copied so the studio's array is never aliased). Reusing them risks those checks for little.
- **Bench** (load 21 → 17, LOADED): explode 14.3 ms of task a frame (19.7 at G-R27); pick 39.0 (48.0); ghosted orbits
  2.5; section drag 21.8. The pose row, App state each frame, waits for R1c (3).
- **Checks**:
  - gpu: tsc 0, eslint 0, unit 189/189. Browser specs, one file each, all pass: viewer, scene-viewer, pose-clip 18/18,
    cap-aa 3/3, contour, uv-repeating.
  - studio: tsc 0, eslint 0, unit 266/266.
  - FLOW_ONLY on both renderers, all pass: instance place and drag, the section steps (73, G19.2, G19.4, G20.2), K2 L
    gap, G3 and G24. On WebGPU 258 failed until G-R28, then passed.

## G-R30 — R1c (3a): the joints and the placed parts' poses as domain hooks, a pure move (roadmap R1, 2026-10-23)

- **What moved**, line for line (each moved line was checked to be in its hook unchanged):
  - `state/useJoints.ts`: the joint-slider pose, the joint played (its frame loop), the path checked, the waypoints and
    the workspace map, with their effects (a moved joint clears the path; a new tree drops the waypoints, the map and
    gone joints' values), and `jointFk` and `gearLines`.
  - `state/useScenePoses.ts`: `instancesPlaced`, `instancePoseMap` (posed and exploded), `cpuInstanceSection`,
    `instanceSectionPoses` (a live drag under a CPU section), `instancesShown` (sectioned), `instanceTransforms`, and the
    DEV `__studioInstanceBounds` hook.
  - The App keeps the state set from many places, the explode factor and the instance drag, and calls the two hooks
    where the code was.
  - The effects run in the same order: no other effect stood between the moved ones.
- **Not changed**: the values, when they are made, and what renders. This is the structure step; (3b) takes the
  per-frame values out of React state.
- **Checks**:
  - studio tsc 0 (after the merge), eslint 0, unit 266/266.
  - FLOW_ONLY on both renderers (load 23–27): RM1–RM6 and RM9a–RM9c (the arm posed, played, Home, Check path,
    waypoints, the workspace map, the exports), R12b.7 the gears, an instance placed, 73 and G19.2 sections, 258 and
    G3. All pass on WebGPU. On WebGL2 all pass except 58, once.
  - 58 on WebGL2 is load-sensitive, a 5 s wait. Run twice here it passed once (load 19) and failed once (load 26 → 41).
    At R2a's cb8d10856, before this move, it also failed once and passed once (load 32–40). So it is not this move.

## G-R31 — R1c (3b): what a frame changes is kept outside React state; SceneViewport and the Joints card subscribe (roadmap R1, 2026-10-23)

- **Why** (the owner's concern, and the coordinator's call): a joint played set App state in each frame, so the whole
  App rendered every frame. An explode dragged did the same.
- **What**:
  - `state/valueStore.ts`: a value outside React state, with `get`, `set` (a value or an updater, telling the
    subscribers only when it changes) and `subscribe`. `useStoreValue(store, subscribed)` reads it through
    useSyncExternalStore. With `subscribed` false it is the value as it is when the component renders for another
    reason.
  - The pose (`useJoints`' `poseStore`) and the explode factor (`explodeStore`) live there. The play loop, the sliders,
    Home, the pruning of gone joints and `__studioSetExplode` set them as their state setters did.
  - **Subscribers**:
    - `viewport/SceneViewport.tsx` wraps Viewport. It makes the placed parts' matrices from the pose and the factor, as
      useScenePoses does (`poseKinematics`, then `instancePoses`), and it holds the flow's `__studioInstanceBounds`.
    - `ui/JointsPanelLive.tsx` is the Joints card's readout: the values after forward kinematics, the gear pairs
      (`gearLinesAt`) and the gravity torques.
    - `ui/ExplodeButton.tsx` is the explode button, its label and its steps.
  - **The App** subscribes to them only while it uses them itself: the clearance check is on, or the placed parts are
    sectioned on the CPU. Its copies of the pose then follow each frame, as before. Otherwise it reads them when it
    renders anyway. It always follows whether the parts are exploded (the instance gizmo is not offered then). The Add
    waypoint and Check path buttons read the pose from the store when clicked.
  - A path checked is cleared when the pose changes, through the store's subscription, as the effect on the pose did.
- **History and files, unchanged and tested**: the pose is a preview, as RM2 says ("shown moved and not saved"). RM2
  now checks, on both renderers:
  - a slider pose, and a joint played then stopped, leave the Undo button as it was (its tip and its disabled state),
    and leave the placements unchanged;
  - the arm saved while posed, then New and Open: the placements as saved, the arm at home (the pose is not in the file,
    as before).
- **Bench** (BENCH_TRACE, load 39 → 36, LOADED), renders a row:
  - **pose**: App 109 → 3; SceneViewport and JointsPanelLive 95 each; task 23.4 → **4.1 ms** a frame (budget 22). Now
    within budget. 94 frames drawn in the row, 69 before: the frames got cheaper.
  - **explode**: App 60 → 1; SceneViewport 60; task 14.3 → 9.1 ms.
  - The section drag still renders the App each frame. The section plane is App state with its exact section and
    hatch, and was not in this step's scope.
- **Checks**:
  - studio tsc 0 (after the merge), eslint 0, unit 266/266.
  - FLOW_ONLY on both renderers (load 20–45), all pass: RM1–RM6 and RM9a–RM9c (RM2 with the new checks), R12b.7 the
    gears, the instance chain 57 and 58 (explode inside 57), 73 and G19.2 sections, 258 and G3.

## G-R32 — step 58's waits made conditions, not a pause (the coordinator's request, 2026-10-23)

- **The defect**: after the X drag the step paused a fixed 400 ms and then read the turn handle where the gizmo was
  drawn. Under load, the overlay had not yet followed the moved copy, so the turn drag started off the handle. The next
  wait, 5 s for the 15° step, then failed: about 1 run in 2 at load 30–40 on WebGL2 (G-R30). The step's three waits had
  5 s ceilings.
- **Now**:
  - Before each drag, `settled()` waits for the gizmo as drawn: its origin present and the same over two animation
    frames.
  - The three condition waits (moved along X, turned 15°, undone) have 30 s ceilings.
  - The assertions are unchanged.
- **Runs**: WebGL2 three times in a row (load 24 → 87, other lanes' work beside it), 3/3 pass; WebGPU once (load
  87 → 81), pass.

## G-R33 — R1c (3c), part 1: a dragged section plane outside React state, committed on release (roadmap R1, 2026-10-23; not finished)

- **What**:
  - The section is split into the committed state and `sectionLive`, a value store holding a dragged plane. App code
    reads `section = live ?? committed`, so its 64 readers are unchanged.
  - Handles drag through `dragSection(f, done)`; `sectionHandles` passes `done`. Each step goes into the store, the App
    is told once as the drag starts, and the release commits.
  - On WebGPU, SceneViewport draws the dragged plane's clip and handles (`liveSection`). On WebGL2 the App subscribes:
    its CPU copies are cut again in each frame, as before.
  - DEV `__studioDragSection(s, done)` follows the same path; the bench's section rows use it.
  - The section is a view setting, as before. Step 73 now checks that a drag adds no undo entry and leaves the document
    unchanged, that the handle follows the drag, and that the handle stays where it was let go.
- **Checks**:
  - studio tsc 0, eslint 0, unit 266/266.
  - FLOW_ONLY on both renderers (load 16–54), all pass: 73, G19.2–G19.5, G20.2, RM1, RM2, K2 notches, G3 and the
    instance place step.
- **Not yet done**: the GPU section row still renders the App at each step (60 App renders, 32 submits; task 25.7 ms
  under load 33, LOADED). Something still sets App state per step and has to be found with the bench's setter trace.
  Until then the perf goal of (3c) is open.

## G-R34 — R1c (3c), part 2: the section drag no longer renders the App (roadmap R1, 2026-10-23; R1 done)

- **What still rendered the App** (after G-R33: 59–61 App renders over the 60 steps): a minimal DevTools hook in the
  bench (BENCH_TRACE: "app hooks changed", the App fiber's hook states compared at each commit) showed two causes.
  - **Hook 106, 33 times**: `useStoreValue`'s useSyncExternalStore, even when not subscribed. After each commit React
    checks the snapshot again, and it renders again when the store has moved meanwhile.
  - **Hook 114, 23 times**: the exact section's results. Each App render took the live plane, started an engine job for
    it, and its result rendered the App again.
- **Fixes**:
  - `useStoreValue(store, false)` reads `store.get()` outside useSyncExternalStore: no snapshot to check, so no forced
    render.
  - On WebGPU the App takes the plane as the drag started (`sectionDragFrom`), not the live one. The exact section waits
    for the release: no engine job while dragging, and none shown, since its cut would be the old plane's. The live
    plane's clip and handles are SceneViewport's (G-R33). The release commits, and the exact section then follows.
  - On WebGL2 (or with the CPU path forced) the App follows the live plane as before: its CPU copies are cut in each
    frame.
  - **The one behaviour change**: during a drag paused without letting go, the exact section no longer comes in. It
    comes after the release.
- **Bench** (BENCH_TRACE, load 30 → 15, LOADED):
  - **section drag, GPU**: App 59 → 5; task 25.7 → **5.9 ms** a frame (budget 33). The GPU time a submit was 7.55 ms
    (budget 6; 5.0–6.6 in earlier loaded runs), so the row still reads SLOW on GPU time alone. The same frames' GPU
    work was not changed here.
  - section drag, CPU (WebGL2's path): App renders each step, as designed.
  - pose (App 3, 4.0 ms), explode (App 1, 8.7 ms) and pick (47 ms) as before.
- **Checks**:
  - studio tsc 0 (after the merge), eslint 0, unit 267/267.
  - FLOW_ONLY on both renderers (load 11–16), all pass: 73 (its G-R33 checks: no undo entry, the document unchanged,
    the handle following and committed), G19.2–G19.5, G20.2, RM2, K2 notches and G3.
- **R1 done.** Its rows against where they started (all LOADED, so compare only):
  - pick 129 → 47 ms;
  - ghosted orbits 19.6 → 2.7 ms;
  - pose 23.4 → 4.0 ms;
  - explode 27.8 → 8.7 ms;
  - section drag 30.8 → 5.9 ms;
  - one Viewport render per orbit, not one a frame.

## G-R35 — R2b: one display-policy module for both studio renderers (roadmap R2, 2026-10-23)

- **A user-visible change named (from G-R34)**: on WebGPU, while a section plane is dragged, the GPU's clip follows
  the plane live, and the exact section comes in after the release (before G-R34 it could also come in during a pause
  in the drag). The coordinator accepted it.
- **What** (`viewport/displayPolicy.ts`), what both renderers had as their own copies, with the same values:
  - the display modes' factors: x-ray 0.25, faded 0.15, ghost 0.35, edges 0.9, hidden lines dashed at 0.55 with a
    [6, 4] dash, the hatch at 0.55, threads at 0.55;
  - the accent and a selection's share of it (0.42);
  - the themes' shared colours (`PALETTE`: background, grid, base, edge). Each renderer keeps what is tuned for it:
    its ambient, grid opacity, shadow and AO.
  - `faceStateOf` / `edgeStateOf`: a body's hovered (1) and selected (2) faces and edges from the view state. These
    were line-for-line the same in both.
- **Left as they are**: numbers that only look the same.
  - The proposal overlay's 0.35 is its hidden share, not a ghost.
  - WebGL2's shader mixes 0.22 for a hovered body and 0.55 for its uBodySel hover; WebGPU's hover face is 0.2.
  - The ground's 0.55 under a render setting.
  - The lights' directions.
- **Checks**:
  - gpu unit 189/189 (cad-gpu-display-contract bundles gpuRenderer); studio tsc 0 (after the merge), eslint 0, unit
    268/268.
  - FLOW_ONLY on both renderers (load 19–40), passing: G3 display modes, the G19.3 hatch, section 73, proposals (ghost
    and before/after), hole types, the selection filter, an instance placed, 258 and K2 L gap.
  - Not passing: **81** (a countersunk screw inserted as its own part) fails on both renderers, and the same way at
    f18177709 before this change, so it is not this change. Handed to the coordinator. It may follow the built-in
    tables becoming person-loaded sample rows.

## G-R36 — R2c: viewer.ts and shaders.ts split behind their facades (roadmap R2, 2026-10-23)

- **shaders.ts** (918 lines) is now `viewer/shaders/` by program: common (the uniform blocks' sizes and the WGSL every
  program starts with), surface, line, point, label, oit, grid, pick, output and mip. `shaders.ts` is the facade with
  its exports as they were; `common` itself stays internal, as it was.
  - **Checked**: the old and the new module, each bundled, export the same 19 names. All 29 values are identical,
    strings byte for byte, the program functions called with each kind of argument: custom surface shaders, the
    capSamples and multisampled variants.
- **viewer.ts** (2 311 lines → 1 921) gives `viewer/scene.ts` (410) its scene objects as they were: ViewerError, the
  material, texture, mesh, clip-plane, colour-map and instances options, ImageTexture, packColorMap, the instances'
  packing, Geometry, Mesh, the cap hatch and the material normaliser.
  - Mesh's scratch moved with it: the object block's normal matrix and its words.
  - `viewer.ts` imports them and exports the same public names as before. The viewer's own internal helpers
    (`packInstances`, `INSTANCE_STRIDE`, `hatchOf`, `materialOf`) are exported from scene.ts as @internal only, not
    from the facade.
  - The two classes reached each other only through public members, so nothing about access changed.
- **Tests' file servers**: four browser specs served `dist/viewer/*.js` from the top folder only, and
  `dist/viewer/shaders/*` was refused. They now walk subfolders. The examples read the kernel's dist or walk already.
- **Checks**:
  - gpu: tsc 0, eslint 0, build, unit 189/189. Browser specs, one file each, all pass: viewer, scene-viewer,
    pose-clip 18/18, cap-aa 3/3, contour, uv-repeating, compute-thickness, compute-access.
  - studio: tsc 0, unit 268/268.
  - FLOW_ONLY on WebGPU, all pass: 73, G19.4, G3, G24, 258, RM2, K2 L gap, the palette.

## G-R37 — R2d: the gpu package's top-level files into folders (roadmap R2, 2026-10-23; R2 done)

- **What**: 96 files moved with `git mv`, their basenames unchanged and unique; `index.ts`, `viewer/` and `compute/` as
  they were.
  - scene 15, boolean 4, geometry 21, mesh 17, native/lights 8, native/uv01 7, engine 13, material 9 (the
    engine-uv-* and mesh-material files among them), core 2 (gpu-error, rotation).
  - Every relative import in src was rewritten from the file's new place to its target's.
- **What else followed, in the same commit**:
  - The gpu tests' deep dist imports (gpu-compiler, material-colour-f32, mesh-packet) and the esbuild entries in
    native-point-light-program-wgsl.
  - 52 examples/gpu-scene flows: their deep imports, the `src/<file>.ts` receipts and the bundle-graph assertions
    (`endsWith('/src/<file>.ts')`). Lines reading a pinned commit (`gitFile(…)`, `commit:`) were left on their old
    paths.
- **Not edited** (the coordinator's rule): any profile, evidence or ledger JSON, and the physics examples' evidence
  bundle (`native-freeze/source-bundle.js`).
  - The library-docs builders read gpu sources through git at each profile's pinned sourceCommit, so they keep
    resolving. **The docs profiles pick up the new paths only when the docs owner next re-pins them.**
- **Nothing live left on the old paths**: outside packages/barocss-gpu, apart from index and viewer/index, JSON and
  evidence, the only `barocss-gpu/(src|dist)/` paths left are:
  - prose in the handover notes;
  - the studio tests' imports of `src/viewer/*` (not moved);
  - `.github/scripts/affected-ci.test.mjs`' template `src/${name}.ts` (a synthetic path);
  - pinned reads (`engine-uv-texture-material-flow`'s `gitFile`);
  - the negative assertions that the graph does not include dist.
- **Checks**:
  - gpu: build, tsc 0, eslint 0, unit 189/189. Browser specs, one file each (load 19–27), all pass: viewer,
    scene-viewer, pose-clip 18/18, cap-aa 3/3, contour, uv-repeating, compute-thickness, compute-access.
  - The library-docs scripts without a pin: cad-impact-map.test.mjs 7/7; check-viewer-authored-directional-lights
    passes.
  - studio: tsc 0, unit 268/268. FLOW_ONLY on WebGPU: 73 and G3 pass.
  - The examples/gpu-scene flows tried (material-scalar-abs, engine-scene, native-surface-uv01-frame,
    triangle-geometry, scene-generated, material-smoothstep, engine-uv-texture-material-wgsl) fail, and fail the same
    way at d50c2fe82, before the move. Some cannot find the kernel's `src/types.js`; others assert a git-diff file list
    against an old base. Not this move: noted for the kernel lane and the examples' owner.
- **R2 done**: per-frame allocations (R2a), the display-policy module (R2b), the viewer/shaders split (R2c) and these
  folders.

## G-R38 — G4: the clearance map and print layers as flow steps on both renderers (roadmap G4, 2026-10-23)

- **No WebGL2 limit here.** Both studio renderers already draw the clearance overlays (`setClearanceDisplay`) and the
  print layers (`setPrintDisplay`), so neither needs a disabled button with a reason, unlike G6.
- **Fixture** `test/fixtures/clearance-states.bcad` (generated once from the model's own commands, not agent rows):
  - At the root: the default shaft and a key in its keyseat, a designed pair ("key n1 in its keyseat").
  - Placed 20 × 20 × 10 boxes:
    - side by side: touching;
    - 10 mm into each other: an overlap of 2000 mm³;
    - 0.5 mm apart: near;
    - 0.8 mm off in both x and y: clear, at a gap of 1.13 mm against near = 1 mm.
- **DEV hook** `__studioClearanceLog`: records each display the worker sends, with its stage and the raw and shown pair
  states. It lives in useClearanceAnalysis's onmessage, not in a render, because a render can batch two messages. The
  flow reads the `map` stage from it to see the contact state, before the overlaps are worked out. The log is capped at
  200 entries and is DEV only.
- **Flow step 273, G22 clearance** checks:
  - The pairs at `ready`: designed, touching, overlap, near, clear.
  - The `map` stage before them: designed, contact, contact, near, clear.
  - The panel's `li[data-clearance-state]`.
  - Overlays for designed, near, overlap and touching, and none for clear.
  - The canvas changes, then returns once closed (< 0.2 %).
  - With Print layers checked, the assembly is refused there and the clearance panel says "Close Print layers"; after
    it closes, the same pairs.
  - Save → New → Open gives the same pairs and overlays.
- **Flow step 274, G23 print layers**, on CNC8's plate:
  - 100 layers at the estimated 0.2 mm.
  - Height set to 0.5 mm: 40 layers.
  - Layer moved to 21, at bed Z 10.25 mm: the view changes.
  - "Printed up to layer" turned off.
  - The saved file holds `printPreview` { layer 20, layerMM 0.5, printed false }. Reopened: the same layer, the same Z,
    the same top.
- **Runs** (FLOW_ONLY `^G22 clearance|^G23 print layers`): both steps pass on both renderers, first run.
  - WebGPU: 2.03 % of the canvas changed for the map; print 11.73 % shown, 5.60 % moved.
  - WebGL2: 2.12 %; print 12.39 % shown, 5.65 % moved.
  - studio tsc 0, eslint 0 on the changed source.

## G-R39 — O10's GPU part: each body's frame cost by display mode, read-only (O10, 2026-10-23)

- **Shape**: as approved by the coordinator. Off by default; while off, one branch per draw. Read-only: the tally only
  counts what a frame already draws.
- **Viewer (packages/barocss-gpu)**:
  - `viewer.costs` turns the counting on and off.
  - `viewer.meshCosts(): ReadonlyMap<Mesh, MeshCost>` gives `{ draws, triangles, lines, points, passes }`.
  - `FramePass` is one of shadow, surface, transparent, oit, hiddenLines, caps, outlineMask; `FRAME_PASSES` is
    exported.
- **Viewer records**:
  - Kept between frames on the mesh (`Mesh.cost`, internal) and in the map.
  - Made when a mesh is first drawn counting; dropped by `remove`/`clear`.
  - Zeroed as each counted frame begins.
  - No per-frame Map, object or closure in the draw loop: the tally is in drawTriangles, drawMesh, drawHiddenLines and
    drawMapped behind `if (this.counting)`.
  - The pass is a field set where each pass begins. Caps count with their probes; the mask's caps count as
    outlineMask; the light probe counts as shadow.
- **Studio (`viewport/frameCost.ts`)**, the same shape on both renderers:
  - `trackFrameCost(on)`.
  - `frameCosts(): Partial<Record<DisplayMode, FrameCost>>`: the last frame tracked in each mode, for the bodies shown
    now.
  - `FrameCost` is `{ renderer, mode, frame, cpuMs, bodies: BodyCost[], scene }`; `BodyCost` adds `key` and `share`.
- **How each renderer fills it**:
  - gpuRenderer maps the viewer's per-mesh counts after each frame. A root body counts its surface, edges, highlight
    and silhouette. A copy counts its own surface, silhouette, edges and threads under `${instanceId}/${bodyKey}`,
    through shared geometry or not (G10). The scene is everything else.
  - renderer.ts (WebGL2) counts its own draws through a `T` that is null when off. Its scene counts the draws its render
    makes itself (background, grid, ground shadow, direct geometry, proposals, the AO composite). Overlay helpers are not
    counted, as the doc comment says.
- **Handle**: ViewportHandle forwards `trackFrameCost`/`frameCosts`; tracking asked for before a renderer is made applies
  once it is. The DEV hook is `__studioFrameCost(on?)`.
- **Stated limit**: work counts plus the frame's CPU time only. There is no per-body GPU time. A whole-frame gpuMs is
  left for later.
- **What the counts showed** on the clearance fixture (10 bodies, 8 placed copies):
  - Wireframe draws the surfaces' triangles on both renderers, for the depth the edges are classified against. My
    proposal's "wireframe: 0 surface triangles" was wrong; the step checks lines > 0 there instead.
  - WebGPU counts 11378 lines against WebGL2's 1220. The GPU contour (G8) draws one instance per curved-face triangle,
    and WebGL2's CPU silhouette draws its segments.
  - On WebGPU in shaded mode, the edges and silhouettes are see-through lines, so the transparent pass has draws there
    too. The x-ray check compares x-ray's see-through draws with shaded's.
  - A copy's key is the studio's instance evaluation key (`i1/b2` here). The clearance worker names the same body
    `i1/b1`, because it evaluates the source document its own way. The outer lane's panel and the agent query should
    know which key they join on.
- **Checks**:
  - gpu: tsc 0, eslint 0, unit 189/189.
  - Browser specs: viewer-costs 1/1 (new), viewer 1/1, pose-clip 18/18.
  - The three adapter tests that build a GpuRenderer from a field list gained `tally: { tracking: false }`;
    cad-gpu-display-contract, cad-clearance-gpu and cad-print-overlay pass 23/23.
  - studio: tsc 0, eslint 0, unit 268/268.
- **Flow** (FLOW_ONLY):
  - O10 (step 275) passes on WebGPU and WebGL2. It covers the five modes, each copy's own draws, x-ray see-through,
    dashed hidden lines, shares, and that nothing is counted once off.
  - G3 display modes (270) passes on both.
  - On WebGL2, step 1 failed once (`/Hole Ø8/`) and passed on the rerun.

## G-R40 — R6: the examples/gpu-scene flows triaged, 65 kept and green, 13 retired (roadmap R6, 2026-10-23)

- **Starting point**: all 78 flows failed as checked in.
  - The cause common to all: in the workspace `@barocss/cad` resolves to CAD's TypeScript sources, which Node does
    not load.
  - The rest pinned the repository's state on each milestone day: exact public-namespace sizes, the parent commit's
    barrel, bytes, declarations and manifest, git deltas, and dependencies then pending.
  - Two causes were mine, from R2d. It missed the `'/src/' + name` source-graph checks, and it rewrote paths read from
    pinned parent commits (`parentFile('src/material/…')`), where the parent has the old path.
- **Coordinator verdicts, as approved**:
  - (a): fix the 65 that still check shipped behaviour.
  - (b): delete the 13 that need research inputs not in the repository, with one record line each naming the missing
    input.
- **Runner** `examples/gpu-scene/run-flows.mjs`: builds cad and gpu, then runs each flow with a fresh `--output` and the
  gpu tests' hook `tests/cad-dist.mjs` through `NODE_OPTIONS` (child processes included). The README says so.
- **(a), in three commits**:
  - 1/3: the runner, plus 15 flows whose namespace-size checks became "includes the names this flow adds". The 18
    flows that needed only the hook are unchanged.
  - 2/3, 17 flows: R2d's source-graph paths; the removed primitive-scene-renderer.ts dropped from preflight's graph;
    the parent-commit checks dropped.
  - 3/3, 15 flows:
    - R2d's parentFile paths undone.
    - The parent-commit checks dropped.
    - Two real behaviour changes since the milestones, followed:
      - An f32 underflow literal is refused at compile time (RANGE) since acbf60deb (G5), not later at lowering. Five
        flows now check that, and uv01-frame's frame case became a compile check.
      - `validateMeshMaterialBinding` has been public since 59c1eff09.
    - material-locals and material-shorthand bundle the sources with esbuild instead of importing src/index.ts with
      plain Node.
  - Every check of actual output stays: WGSL, programs, buffers and values.
- **Rule correction, before anything was committed**: my first generic "exact length" rule also matched output checks
  (panel, body, draw and diagnostic counts). It was reverted and narrowed to namespace sizes only. The scratch run that
  had shown "50 green" with those checks removed was redone with them kept.
- **(b), one commit**:
  - The 13 flows.
  - Five helpers used only by them: knot-*-internal.mjs ×3, source-surface-elevation-frame-internal.mjs,
    split-body-engine-scene.ts.
  - The gpu README's three command blocks for retired flows now say so.
  - The physics examples' base-tracked-ledger.json entries stay as historical text, untouched.
- **Record**: every changed assertion, before → after with its reason, and each retired flow's missing input are in
  `handover/notes/r6-gpu-scene-flows.md`. Pinned evidence is untouched, as are the outer lane's two clearance files.
- **Final run**: `node examples/gpu-scene/run-flows.mjs` passes 65/65 on the kept set, with a full cad+gpu build first, at
  integration 8ddf53eea merged.
- **Next**: D229 folders the kernel's dist. After the merge past it, the runner's full `build:library` clears the stale
  flat files; rerun it then.

## G-R41 — the history bar no longer runs under the view bar (2026-10-23)

- **The defect** (the docs tour shot at 1280 × 800, and G-R38's 1440 × 900 shots with longer history):
  - `.history` was centred on the assumption that the view bar (`.corner-right`: Display, the views, Pick all, Snap,
    units) is 600 px wide.
  - It has grown to about 700 px with Analyse and Maps, so the bar's second chip ran under it.
- **The fix**:
  - `ui/useBottomRow.ts` measures the view bar (a ResizeObserver plus the window's resize) and sets `--corner-w` and
    `--corner-h` on `.studio`.
  - `.history` fills the room between the browser panel's edge (270 px) and the view bar, centred there, scrolling its
    chips when they don't fit.
  - With less than 280 px of room, `.studio.history-stacked` lifts it above the view bar (left 270 px to right 12 px).
    The view bar's own stack (previews, legends, section bar) rises above it there.
  - Measured: beside at 1440; stacked at 1280, 1024 and 800.
- **Check**: the new flow step "bottom row", at 1440 × 900, 1280 × 800, 1024 × 800 and 800 × 800, with five history
  chips. In each size it checks that:
  - the history bar's and the view bar's rects don't intersect;
  - the history bar stays in the window;
  - the open Display popover's stack doesn't meet the history bar.
  - It also checks beside at the widest and stacked at the narrowest.
- **Runs**: passes on WebGPU (the layout is the renderer's frame, not the renderer's). "Narrow window top bar" (O127)
  still passes; studio tsc and eslint clean.

## G-R42 — G11: the heaviest scenes measured; no budget missed, so G11 closes (2026-10-23)

- **Read-only**: no product change. The tables are in `handover/notes/g11-scene-profile.md`.
- **What was measured**: 11 scenes on both renderers, a 60-step orbit in three display modes (shaded with edges, hidden
  lines dashed, x-ray), at loads of 10–17.
  - The A9 assembly (38 bodies), the 120-bracket pattern, five box frames (60 members), the 6R arm and the welded table.
  - The heaviest generated parts: a spring (114 k triangles), a worm pair (17 k) and a spur gear.
  - The heaviest studio fixtures: clearance-states and lid, plus the starter template.
- **Result**: every scene holds 60 Hz on both renderers, with frame-interval p95 16.7–16.8 ms. On the worst rows:
  - Main-thread task 2.2–3.9 ms a frame.
  - WebGPU 0.5–5.0 ms of GPU a submit. The highest are the lid fixture at 5.0 (its outline mask) and the frames in
    x-ray at 4.7.
  - The frames' single 50 ms frame and A9's 33 ms frame are one-offs at the drag's start, on both renderers.
  - The 16.7 ms frame budget is met with at least 3× headroom everywhere. Occlusion culling, LOD or more instancing
    would buy nothing measurable on these scenes.
- **Outside the GPU's budget, for the kernel lane**: opening is the slow part (evaluation). The frames take 25–28 s,
  A9 16 s, the spring 10 s and the worm pair 6–7 s.
- **Refused, not measured**: "Fill with a lattice" (after Hollow) on an 80 × 60 × 40 box, at the kernel's
  2 000 000-triangle cap.
- **Unit difference (O10's note 2)**: WebGPU's line counts are 5–20× WebGL2's on curved parts. The GPU contour draws
  one instance per curved-face triangle.

## G-R43 — G12a: the three-column shell, the chat column, the proposal cards in it (roadmap G12, 2026-10-24)

- **Commit**: it landed as one commit, 85625038e ("wip … to be split"). The split into an App.tsx commit and the rest was
  refused here as history rewriting (hard reset, then revert). The later G12 steps keep App.tsx in their own commits.
- **Shell**: `.studio` is a flex row of the chat column and `.stage`.
  - `.stage` (the centre) holds the top bar, the viewport and everything placed over it, positioned as before but
    within the centre.
  - `100vw`-based widths became `100%`.
  - The column comes after the stage in the document, shown at the left by `order: -1`. The top bar's Chat button
    stays the first `[aria-label="Chat"]`, because the chat panel has that label too.
- **Chat column** (`layout/ChatColumn.tsx`, `layout/useLayout.ts`):
  - Full height. 360 px by default, dragged at its right edge within 320–520 px and kept per viewer.
  - The width shown leaves the centre at least 560 px.
  - Collapsed, it is a 44 px strip laid over the stage's left edge, so the canvas keeps the window's width. Pixel-based
    sketch and drawing steps (18, 204) depend on that; `--strip-w` moves the stage's left-anchored parts past the strip.
  - Collapsed by itself when the window narrows past chat + dock + 560 px. That happens at 1024; an open made after it
    holds.
- **Proposals** moved from the Browser into the column, over the chat.
  - While one is open, the column shows it with the chat open or not.
  - The decided ones are reached from the strip's "Show decided proposals".
  - The cards drop the left-border-and-radius style (the owner's rule) for an even 1 px border and a tinted risk chip.
- **Also**:
  - The view bar wraps onto a second row in a narrow centre instead of running under the column.
  - The bottom row measures the stage less the strip.
  - The file-name chip gives way first in a tight top bar.
- **Checks**:
  - New flow step "three columns (G12a)": open 360, drag to 480 and 520, collapse to 44, collapsed by itself at 1024,
    nothing in the centre over the column at 1440/1024/800, and no box with a left border alone and a radius. It passes
    on WebGPU and WebGL2.
  - The chat, proposal, bottom-row, narrow-top-bar, concentric-arcs and R14.1 steps pass on WebGPU; the layout ones also
    on WebGL2.
  - Studio unit 274/274, tsc and eslint clean, check:docs clean.
  - A full WebGPU flow run before the strip became an overlay showed 18 and 204 shifting; both pass now.
  - "shapes strip" and "R14.4" fail before G12a as well, at 09ef149d4 in the scratch worktree: pre-existing, not from
    this step.

## G-R44 — G12b: shadcn/ui and Tailwind v4 set up, the right dock with the Browser, the HUD and the inspector (roadmap G12, 2026-10-24)

- **Setup** (762499b9c, package.json and the lockfile only): tailwindcss and @tailwindcss/vite 4.1.13, clsx,
  tailwind-merge, class-variance-authority, the Radix primitives (collapsible, scroll-area, toggle-group, tooltip, slot)
  and react-resizable-panels, all exact. The owner confirmed the download in this session.
- **Tailwind without its preflight**: only `tailwindcss/theme.css` and `utilities.css`, in layers.
  - The studio's own CSS stays unlayered and keeps the browser defaults it was written against.
  - shadcn's tokens are mapped onto the studio's in `src/tailwind.css`. shadcn's `--accent` (a hover fill) is
    `--ui-hover` there, so the studio's yellow `--accent` keeps its meaning.
  - `components.json` and `@/` mean src/. `cn()` is in `src/lib/utils.ts`.
  - Collapsible, ScrollArea and Badge are copied into `src/components/ui`.
- **Dock** (`layout/Dock.tsx`): 300 px, or 280 below 1280.
  - It holds the Browser (moved from the left, its mount behind `browserPlacement`), the running command's HUD and
    the inspector (today's right column). They sit flat in one plain scroll column. Radix's ScrollArea let the panels'
    content grow past it.
  - Where chat + dock + 560 px don't fit, the dock is a 44 px strip at the stage's right with a sheet over the viewport.
    An opened BOM, Library or Parameters panel opens the sheet.
- **Top bar**: spans the centre and the dock (the window less the chat column), with the dock under it.
- **Fixes the narrower centre called for**:
  - Strips take the pointer only on their buttons. Steps 72 and 273 had clicked the canvas's left edge, where the
    chat strip lies.
  - The top bar's z-index is set once (a later `z-index: 6` in the same rule had won).
  - The inline dimension editor sits over the bar again (z 9, O137).
  - Toasts sit at the stage's top left under the hint bar. The section bar is about 700 px wide in a narrow centre and
    met them at the bottom.
  - The view bar's room is the stage less both strips.
- **Flow changes**:
  - Each step starts with the columns as a fresh viewer has them (DEV `__studioLayoutReset`).
  - G3's two clicks are world points on screen.
  - R14.1's hand placement is 18 mm off the front view; at 30 mm it fell on the top view's label.
  - The shapes strip picks the last shape that can start. Fastener, needing a row, is off.
  - The bottom-row step follows the stage's room.
  - The three-columns step checks that a click beside the strip's buttons reaches the viewport.
- **Runs**:
  - Full flow on WebGPU and on WebGL2 (scratch worktree, b3d6a2369): 279/280 each. The one failure is R14.4 (207),
    fixed on the outer lane's branch (d2d62a94e).
  - Studio unit 274/274, tsc and eslint clean, check:docs clean (533 labels).
- **For the outer lane**: a click on a drawing view's label does not place a dimension. R14.1's placement fell on one in
  the narrower centre.

## G-R45 — G12c/G12d: Preview & analysis one mode at a time, compact panel text, the layout check, the CSS in a layer (roadmap G12, 2026-10-24)

- **G12c, the dock's Preview & analysis section** (94ce0e006, c397ed363 App.tsx):
  - `previewMode` (none, CNC, print, clearance, analysis) replaces the three toggles. Each panel's own checkbox sets or
    clears its mode, so one preview shows at a time. Choosing Analysis starts zebra; the analysis maps are that mode.
    The mutual-exclusion notices are gone.
  - The section is a folding `DockSection` (its open state kept per viewer) with a one-at-a-time ToggleGroup.
  - The panels are compact: colour chips, NOT FOR PRODUCTION as a chip (Print, and since a12e158b6 CNC, the package's
    whole banner behind Details and as the chip's tip), the rest behind Details. CNC's overcut line stays shown.
  - The Display popover holds the display mode and isolate only. 3D annotations are an overlay toggle beside the modes.
- **G12d, the layout step** (25899f359): 1440, 1280, 1024 and 800, the chat open and collapsed, each preview mode, the
  dock's sheet opened where the dock is a strip.
  - No two of the chat column, dock, dock strip, top bar, tools rail, history bar, view bar, view cube, HUD, view-bar
    popovers and toasts meet; each stays inside the window; no box with a left border alone and a radius.
  - **What it found, fixed**:
    - The view bar's room ran under the tools rail.
    - The history bar met the dock's strip and sheet.
    - The preview switch's items had the browser's button border (preflight is off).
    - The history bar still reserved 270 px at the left for the browser panel, which is in the dock now. It starts past
      the tools rail (72 px) when `BROWSER_PLACEMENT` is the dock.
    - A stage too cramped even for the stacked bar (800 px, the chat open, the sheet open: 72 px left) hides the
      history bar and the view cube until the sheet closes (`stage-cramped`).
    - The recovery card ran under the sheet at 1024 with the chat open. Toasts now keep to the stage's room, 220 px at
      least. On a cramped stage a toast runs under the sheet: raising it would put it over the top bar's menus.
- **The studio's CSS in `@layer legacy`** (950dab2e3, approved by the coordinator):
  - styles.css, ui/chat.css, ui/constraints.css and drawing/drawing.css are wrapped, with no rule changed. The layer is
    ordered first (`legacy, theme, base, components, utilities`), so within it the rules settle as before.
  - Tailwind's utilities, the shadcn components', now win over its element rules (`button { font: inherit }`, the
    panels' inputs). O16's components can drop their `!`.
  - No third-party stylesheet that the old rules beat is pulled in:
    - Google Fonts' sheet declares only the icon font and `.material-symbols-outlined`; the studio uses its own `.ms`.
    - Radix ScrollArea injects a scrollbar rule and react-resizable-panels a drag cursor, but neither is mounted.
- **The R1 bench rerun found a regression from G-R41** (db502eb7a):
  - The explode button's label (`Explode ×0.03…`) resizes the view bar every frame of a drag. useBottomRow kept its
    size in React state, so the App rendered each frame: explode App 43 renders, task 19.2 ms.
  - The size now goes onto the studio element as CSS variables, outside React. The App renders only when the stacking
    changes: explode App 2, task 10.1 ms.
  - The other rows are as at G-R34. The run was LOADED, so compare only: orbit App 1, 3.1 ms; pose App 3, 3.9 ms;
    section (GPU) App 5, 6.8 ms; pick 55 ms.
- **Flow**:
  - Step 89 (hole types) waits for the countersunk hole's label in the Browser. The history bar hides again at once
    while the command runs on (Shift+Enter), so a wait for it caught it only when the restart was late. The earlier
    bisect toward 94ce0e006 was this flake.
  - G22 and G23 check one preview at a time. G22's canvas threshold is for the overlays alone.
- **Runs** (scratch worktree):
  - Full flow at e770d5c8e. WebGL2: 282/283. WebGPU: 260/283 in the full run. Its first failure was the dev server's
    dependency re-bundling after the O16 merge (a cold cache: "the page reloaded during this step") at step 61, and the
    run was loaded beside the kernel's T2. The 22 steps rerun alone all pass. On both renderers the one failure left is
    FR3b (147), the known "not the case being measured" flake.
  - After a12e158b6: the layout, bottom-row, three-columns and G23 steps pass on both renderers.
  - Studio tsc and eslint 0 errors. check:docs clean (558 labels).
  - Studio unit 281/282: `bom-linked-ui.test` fails, from O16, not G12. It bundles BomPanel against a React stub
    without `forwardRef`, and the shadcn Button's Radix Slot calls it.
- **New labels**: Preview & analysis; Preview mode; Preview: None / CNC / Print / Clearance / Analysis; Collapse /
  Expand Preview & analysis. Renamed: none. The Display button's tip is now "The display mode and isolate (the
  previews are in the dock)".

## G-R46 — G12e: the switch is the previews' enable; history chips whole (roadmap G12, 2026-10-24)

- **One mode, its settings alone** (23724e10f, 828764fa7 App.tsx):
  - Print, CNC and Clearance lose their own on/off boxes. The dock's switch enables them, and under it only the chosen
    preview's settings show, flat. None shows a one-line hint.
  - Analysis gets a panel (`viewport/AnalysisPanel.tsx`): the surface analysis (Zebra, Curvature, Overhang for a
    printing process) and the map (Thickness, Draft and the mould's Parting and Halves with a pull, Access). These are
    the choices the view bar's Analyse and Maps buttons step through, and those buttons stay. On WebGL2 the maps are
    disabled with their reason.
  - 3D annotations, the one overlay (the owner's choice), is a toggle at the section's header (`DockSection` actions).
    Its status line shows under the panel.
- **History chips never cut mid-text** (23780cd69):
  - The bar stacks above the view bar when its steps don't fit beside it. The bottom row uses the bar's natural width;
    a fixed 280 px used to decide.
  - Where even the stacked row is short (a narrow centre), the chips past its room hide behind a "+n" chip. It opens
    the bar on more rows with every step whole; Less closes it.
  - `useFitChips` hides them by style, outside React, measured again when the bar, the stage, the view bar or the
    stacking changes. The App renders when the count changes.
- **Toasts** sit below the view cube (top 144 px). The recovery card met the cube at 1024 with the chat open.
- **Flow** (b548fe1f2):
  - Previews are chosen with the switch through a `preview(mode)` helper. It clicks only when the mode is not on,
    since clicking the item again turns it off.
  - The layout step checks:
    - every history chip whole inside the bar and clear of the view bar;
    - "+n" opening every step whole, and Less closing it;
    - no "+n" at 1440 with the chat collapsed.
- **Runs**:
  - Full flow at b548fe1f2 (scratch): WebGPU 282/283, WebGL2 282/283. The one failure is FR3b (147), the known
    "not the case being measured" flake.
  - R1 bench rows (loaded, compare only):
    - orbit App 1, 3.1 ms; pose App 3, 4.5 ms; explode App 2, 9.8 ms; pick 55 ms;
    - section on GPU App 5, 6.7 ms. Its GPU time of 8.1 ms a submit is over the budget of 6, as before.
  - Studio tsc and eslint 0 errors. check:docs clean (558 labels). Unit 281/282, the O16 `bom-linked-ui` stub as in
    G-R45.
- **Labels**:
  - Removed (old → nothing), the checkboxes:
    - `Print layers`, `CNC preview`, `Assembly clearance`. The panels keep these names as their aria-labels.
    - Their enable is now `Preview: Print`, `Preview: CNC`, `Preview: Clearance`.
  - New:
    - `Analysis` (the panel);
    - `Surface analysis kind`, `Surface: Zebra / Curvature / Overhang`;
    - `Analysis map kind`, `Map: Thickness / Draft / Access / Parting / Halves`;
    - `n more history steps` / `Fewer history steps` (the "+n" / Less chip).
  - For the docs lane: display.md, assemblies.md and manufacturing.md say these previews are in **Display**, and that
    Print layers and the CNC preview "take turns". They are now chosen in the dock's Preview & analysis switch.

## G-R47 — G12f, part 1: the shell onto shadcn (Tooltip, the rail, the HUD, the section bar, the timeline, the view bar, the menus, the palette, the help) (roadmap G12, 2026-10-24)

- **Packages** (a2d8db19f, apps/cad-studio/package.json and pnpm-lock.yaml only):
  - Added from Radix's 2026-10-05 release, the coordinator approving the pins and the owner the download:
    react-dropdown-menu 2.1.25, react-context-menu 2.3.8, react-dialog 1.2.0. Also cmdk 1.1.1 (2025-03-14).
  - Deliberate downgrades onto the same release: G12b's came from the 2026-10-12 release, under the lanes' two-week
    rule. react-tooltip 1.4.1 → 1.3.0, scroll-area 1.4.0 → 1.3.0, collapsible 1.2.1 → 1.1.21, toggle-group 1.2.1 →
    1.1.20, slot 1.5.0 → 1.4.0.
  - cmdk's `react-primitive ^2.0.2` resolved to 2.2.0 (10-12). The root override `"cmdk>@radix-ui/react-primitive":
    "2.1.11"` (13074758a, the coordinator's) holds it. A direct pin did not, and `pnpm dedupe` touched unrelated
    packages.
  - Every package added or changed was published on or before 2026-10-05.
  - react-context-menu turned out not to be needed: the menus open from code at a point, so a DropdownMenu anchored
    there fits. It can go in a later package commit.
- **Areas** (labels, roles and the classes the flows and other lanes use are kept):
  - 88a30d9da, the **tooltip**: still one layer reading `data-tip`. It now renders shadcn's Tooltip (Radix's
    placement) anchored on the hovered element's box.
  - dba7c5781, the **rail**: ToolButton is on `components/ui/tool-button.tsx`, a ghost icon button with the primary
    fill when on. Its box stays `.tool`'s, so the rail's short-window sizes hold.
  - 837fa7830, the **HUD**: shadcn's Input, NativeSelect and Button.
  - e853e6e36:
    - the **section bar**: the mode is a ToggleGroup, and a click on the mode shown keeps it; the buttons are Button;
    - the **timeline** and the explode chip.
  - ee60ff852, App.tsx: the **view bar**'s buttons and chips are Button.
  - 35ce1cdc2, the **menus, palette and help**:
    - A right-click's menu is a DropdownMenu anchored at the click. It is kept inside the window, opening upward when
      that has more room, with arrow keys and Escape.
    - More tools and More shapes are DropdownMenus rendered in place (`portal={false}`), so the flows find their
      buttons inside the bar.
    - The palette is shadcn's Command (cmdk) in its Dialog, ranked by paletteList (`shouldFilter={false}`). Enter is
      kept from the window's handler.
    - The keyboard and mouse help is a Dialog.
  - 262949d1c, App.tsx: `__studioLayoutReset` (DEV) also dismisses every toast. The recovery card is only hidden; a
    question's toast is cancelled. This is the outer lane's find: a toast from an earlier step met the view cube in the
    layout step.
- **Left for part 2**: the top bar's own buttons. The ~30 `className="tool"` spots in App.tsx waited for O11, which is
  now merged.
- **Measured** (DEV `__studioRenders`). Neither was changed by G12f; both are R1d, after G12f and before G13:
  - HUD typing: 4 keystrokes render App 10 times, the same with the old HUD.
  - Placing: 30 pointer moves render App 114 times.
- **Runs**:
  - Full flow at 262949d1c (scratch): WebGPU 281/285, WebGL2 281/285. The failures on both:
    - FR3b (147), the known flake;
    - AM7a and AM7b (NaN mass), and O10 Rebuild panel (284). All three pass alone at 262949d1c and at the merge
      before G12f's menus (83161bb55). They are the outer lane's O18 work in progress: deferred mass, and the
      copies' frame costs with sameMeshes.
  - The pair "render a part" (48), then section view (74), parameters, surface analysis and RM2, fails at b548fe1f2
    too, before G12f. It is an order dependency of step 48 that the full flow, with steps between, does not meet.
  - R1 bench rows (loaded): orbit App 1, 3.2 ms; pose App 3, 4.6 ms; explode App 2, 9.9 ms; pick 57 ms; section on
    GPU App 5, 6.8 ms.
  - Studio tsc 0, eslint 0 errors, unit 286/286, vite build. check:docs: no label drift. Its two other reports at the
    time (`_refusals.md`, cad-model `api/`) were the API lane's, fixed on integration by the docs lane.
- **Queued for G14 (measure, then decide)**:
  - Section on GPU: 8.1 ms a submit against 6.
  - From O18: with a new bodies array of identical meshes, gpuRenderer's rebuild on WebGPU left the placed copies out
    of the drawn frames. The outer lane worked round it in App (sameMeshes, 2aae36ec3). Two questions: why the copies
    drop, and whether the renderer should key on mesh identity.

## G-R48 — G12f, part 2: the top bar onto shadcn; the context menu inside the stage (roadmap G12, 2026-10-24)

- **The top bar** (44a4a243c, App.tsx):
  - Its tools and the panels' close buttons (about 30 `className="tool"` spots) are on ToolIconButton.
  - The mode switch (Model, Sketch, Render, Drawing), Finish sketch and the Templates rows are on shadcn's Button; the
    template's name is on Input.
  - The labels and the `tool`, `on` and `sketching` classes are kept.
- **The right-click menu inside the stage** (d28a8e1a1, from the coordinator's review of the 1440 screenshot: a face's
  ~24-item menu had risen over the Model/Sketch tabs):
  - Radix's collision boundary is the stage. It is padded below the top bar and clear of the dock's strip or sheet,
    both measured as the menu opens.
  - The menu's height is that room, with its own scroll. It opens at the click and flips up only where the stage has
    more room above.
  - The layout step checks it (a55096abe): at 1440 and 1024 a right-click on the plate opens the menu inside the stage,
    clear of the top bar and the dock.
- **Packages** (b5102a63b): `@radix-ui/react-context-menu` is removed, unused (the coordinator agreed). Only its entries
  leave the lockfile.
- **gpu** (the coordinator's ask from the API lane): `tests/api-scene.test.mjs` is in the package's test script.
  - The facade's tests pass 4/4; gpu's whole test script passes 193/193.
  - The script needs CAD's `build:library` first, as before.
- **Runs**:
  - Full flow at 5bac895fa (integration with O18 merged, scratch): **WebGPU 286/286, WebGL2 286/286**. AM7a/b and O10
    pass in sequence with O18, and FR3b passed this time.
  - R1 bench rows (loaded): orbit App 1, 3.4 ms; pose App 3, 4.3 ms; explode App 2, 10.2 ms; pick 56 ms; section on GPU
    App 5, 6.8 ms. Section's GPU time is over its budget, as before; it is on the G14 list.
- **G12 is done** with this, as the coordinator counts it, once the docs lane retakes its shots.
- **Queued**:
  - R1d next: the HUD values and the placing pointer in a store.
  - G13 the frame triads, after R1d.
  - G14: section's GPU time; O18's copies dropped on a rebuild with identical meshes; the step-48 order dependency
    (render a part, then section view, parameters, surface analysis or RM2).
  - R7.3: rename the packets' `right-handed-y-up` tag to what it means. Viewer is already Z-up and nothing converts
    coordinates.

## G-R49 — R1d: the HUD's values and the placing pointer outside the App's renders (roadmap R1d, 2026-10-24)

- **What rendered the App**:
  - Typing in the HUD: 4 keystrokes rendered App 10 times.
  - Placing: 30 pointer moves rendered App 76 times, before the click. That is the bench's loaded measure; 114 in the
    dev server's first count.
  - Each value went through App state (`active`), then the preview's result again (`previewBodies`, `preview: 'ok'`).
    Two effects then set state to the value it already had, which renders App once more to bail out:
    - the requirements' `setSpec(null)` with no requirements;
    - the access map's `setResult(null)` while off, its deps the shown bodies.
- **The change** (83ce1a2cb, 7a62bda29 App.tsx):
  - The running command is in a store (`activeStore`, a ValueStore; `setActive` is its `set`, with the same updaters).
  - App subscribes to a key (`activeKey`): the command, its context and placing, and its values, unless the HUD typed
    them (the values its last keystroke made) or the pointer is placing the shape.
  - Handle and gizmo drags render App as before, so their handles follow the pointer.
  - The HUD subscribes to the whole command: values, preview state, error.
  - The preview evaluation follows the store's values, not App's renders.
  - Apply-when-ready is checked after each render (a result renders App with its bodies) and as the preview settles
    without one (an error).
  - `apply` and a command's pick read the store.
  - Both bailout setters now set state only when there is something to clear.
- **Bench** (two new rows, `app` = App's renders; budgets one per keystroke or move; loaded, compare only):
  - HUD typing: App 10 → **1** (1 result).
  - Placing: App 76 → **16** (16 results, one each).
  - Side effect of the access-map fix: the section drag's App renders 121 → 61 (CPU) and 5 → 3 (GPU).
  - The full bench, all 19 rows: ok. Section on GPU is within its budget in this run.
- **Also** (7b919a762, the coordinator's asks from the API lane):
  - The facades' browser check `api-show-browser` (the API lane's, reviewed) is in gpu's `test:browser`. It passes 1/1
    on hardware WebGPU and on SwiftShader.
  - gpu's tsconfig.json is `noEmit`. build:library emits through `tsconfig.build.json`, so a bare `tsc` only checks and
    no longer overwrites the bundle in dist/index.js with unbundled output.
- **Runs**:
  - Full flow at 7a62bda29 (scratch): **WebGPU 286/286, WebGL2 286/286**.
  - Studio unit 286/286, tsc and eslint 0 errors, check:docs clean (595 labels). gpu unit 193/193.

## G-R50 — G13: the robot's frames drawn as triads; a proposal's volume chips stacked (roadmap G13, 2026-10-24)

- **Frames** (6cf398188), the prop shape the coordinator settled with the outer lane:
  `frames?: readonly { name, kind?: 'tool' | 'sensor', o: Vec3, R: Mat3 }[]`.
  - `o` is in mm, in assembly coordinates. `R` is row-major with its columns the frame's axes.
  - Each frame is drawn as a triad, X red, Y green, Z blue, over the scene, with its name on a chip: a tool's is the
    accent, a sensor's cyan.
  - WebGPU draws engine lines and labels, keyed by content. WebGL2 draws them in the overlay.
  - The axes are drawn after the names, so an axis that turns under its name stays visible. The first run found the
    TCP's chip covering its Z axis after the turn.
  - SceneViewport builds the list from the pose store: FK's link motions while a slider moves, the solved pose's own
    frames otherwise. So a joint played renders it, not the App.
  - The axes' length is a fifth of the parts' own extent, so the triads keep their size as the arm moves.
- **Flow** (4b4acd4cb), the 6R arm with O12's TCP on l6 and camera on l3:
  - The TCP's triad is at MuJoCo's (45, 97, 330) at the zero pose, and at (63, 105, 330) after a quarter turn of l6,
    its Z then along +Y.
  - The camera's triad does not move.
  - The triads are drawn where they say. On WebGPU the Z axis is blue on the canvas along it; on WebGL2 the overlay's Z
    line runs between the origin's and the end's screen points.
- **A proposal's volume chips** (b0d5619b4), from the docs lane's shot, where they overlapped by the hole:
  - Both chips stand stacked over the top of the two boxes (`proposalChips`), on WebGPU's labels and WebGL2's overlay
    alike, so they never meet however the view turns.
  - G12's step checks that the WebGL2 chips' boxes are apart.
- **Runs**:
  - Full flow at 4b4acd4cb (scratch): **WebGPU 287/287, WebGL2 287/287**.
  - The full bench: every row ok but section on GPU's GPU time (8.8 ms a submit against 6; the G14 item). Pose is App 3,
    4.6 ms, as before: the frames don't render the App.

## G-R51 — R7.3a in progress: gpu's errors onto BarocssError, batch 1 of 2 (roadmap R7.3a, 2026-10-24)

R7.3a in progress: batch 1 is committed as WIP (c185821e8), unit-checked, not browser-checked; batch 2 is not started.
The work stopped here for the owner's move to another place.

- **Done (batch 1, no message or code changed)**:
  - `src/core/barocss-error.ts`: gpu's `BarocssError`, in api-conventions.md §6's shape `{ code, message, where?,
    details? }`, with `cause`, and `Problem` `{ code, message, where? }`. gpu imports neither cad nor cad-model, so this
    is its own class of that name and shape.
  - Each of gpu's 35 error classes extends it. Each keeps its class name (the tests' `instanceof` and `assert.throws`,
    about 200 references), its `code` and its message unchanged.
    - The three without a code get one each, one to one: GPUError `gpu`, SceneError `scene`, SceneViewError
      `scene-view`.
    - `instanceof BarocssError` now catches any refusal of the package.
  - `src/core/error-codes.ts`: `GpuErrorCode`, the union of every class's `code` type plus the facade's
    `MESH_INVALID` and `LIGHT_INVALID`, so the docs' refusal table can be read from types.
  - `src/api/refusal.ts` (the API lane's facade) uses the core class. `refuse()` still writes the `[CODE] …` message.
  - Exported from the main entry: `BarocssError`, `Problem`, `GpuErrorCode`. `UpdateResult`'s error is a BarocssError.
  - `tests/barocss-error.test.mjs` is in the test script: each exported error class is a BarocssError, keeping its
    name, code and message.
- **Not done (batch 2, next)**, as the coordinator split it:
  - The codes in upper-snake (`webgpu-unavailable` → `WEBGPU_UNAVAILABLE` …, the three above too).
  - Messages prefixed `[CODE] `.
  - gpu's tests and examples/gpu-scene updated in the same commits. The studio matched no gpu code or class at batch 1
    (checked: none in apps/cad-studio/src or test); recheck at the time and list each studio site changed.
- **Left open, for the coordinator**: the `{ ok: false, diagnostics }` compile results are kept as data results.
  - They are mesh-material, scene-viewer and gpu-compiler. Their diagnostics already carry `code` and `message`, with
    source positions.
  - Whether they become `check…` functions returning `Problem[]`, or throws, is not decided. Either changes their
    callers.
- **Checks at the commit**: gpu tsc 0 and eslint 0; gpu unit 195/195, its earlier 193 plus the new error test's two; the
  build; studio tsc 0. gpu's test:browser was stopped before it finished, on the owner's stop:
  **the batch is NOT VERIFIED in the browser**. The next session runs `pnpm test:browser` in packages/barocss-gpu, after
  CAD's and gpu's build:library, on hardware and with VIEWER_ADAPTER=swiftshader.
- **Then**, from the coordinator's queue:
  - R7.3c: gpu's Vec3, Mat3 and Mat4 at the package boundary (§10.2).
  - R7.3d: the `right-handed-y-up` tag renamed, with the kernel lane (§10.1).
  - G14, measure then decide: section's GPU time 8.8 ms against 6; the copies dropped on a rebuild with identical
    meshes (O18); the step-48 order dependency.

## G-R52 — R7.3a batch 1 browser-verified (a harness 404 found); batch 2: upper-snake codes, `[CODE] …` messages (roadmap R7.3a, 2026-10-24)

- **Batch 1 in the browser** (ee5d032ad, merged as 1c20848d9):
  - **Found**: batch 1 broke gpu's `test:browser`. viewer/ and api/ import `../core/barocss-error.js`, and the
    harnesses serve exact routes (the viewer's built modules under `/viewer/…`, the facade's `/gpu/api/…`), so the
    import 404'd and the module failed to load: 5 of 28 on hardware (api-show, viewer-browser, the three cap-aa tests).
    The studio was not affected (its Vite resolves the package; the window's flow 287/287 stands); no studio harness
    serves dist/viewer.
  - Fix, tests only: each viewer harness (and the costs bench) also serves `/core/barocss-error.js`; api-show's route
    takes `core/`. Then 28/28 on hardware and 28/28 with VIEWER_ADAPTER=swiftshader.
- **Batch 2** (this commit):
  - **Codes upper-snake.** Ten codes in four classes were not: ViewerError's `webgpu-unavailable`, `no-adapter`,
    `no-context`, `shader`, `pipeline`, `disposed`, `device-lost` → `WEBGPU_UNAVAILABLE` …; GPUError `gpu` → `GPU`,
    SceneError `scene` → `SCENE`, SceneViewError `scene-view` → `SCENE_VIEW`. The other 31 classes' codes were already
    upper-snake (`INPUT`, `BUDGET` …).
    - GPUError, SceneError and SceneViewError declare their code's literal type (`declare readonly code: 'GPU'`), so
      `GpuErrorCode` is a union of literals, not `string`.
    - `core/error-codes.ts` checks it with tsc: `NonUpperSnakeGpuErrorCode` must be `never`. Checked by adding
      `'oops-x'` to the union: tsc fails, as it should.
    - Codes stay per class, not package-unique: `INPUT` is the code of about 30 classes. Whether the docs table needs
      them unique (`ENGINE_RAYCAST_INPUT` …) is the coordinator's call; nothing reads them that way today.
  - **Messages `[CODE] …`.** gpu's BarocssError writes the prefix, as cad's facade class does, once (a message already
    carrying its code keeps it once; the facade's `refuse()` is unchanged).
    - The 27 classes that cap a refusal at 1024 characters pass `maxLength: 1024`, and the base class caps the whole
      message, its prefix included. So the flows' `message.length <= 1024` checks stand unchanged.
    - `refusalText(error)` (exported) gives the words without the refusal's own code. It is used where a refusal's text
      moves into a diagnostic that carries the code as its own field, or into another refusal under that one's code:
      mesh-material's six compile catches, material-viewer, gpu-compiler's diagnostic (its `code(message)` guess reads
      the words), scene-front's three primitive checks, material-evaluation ×2 and scene-parameter-source. So a
      diagnostic's message is the same text as before, and a wrapped refusal reads `[OUTER] words`, never
      `[OUTER] [INNER] words`.
  - **A batch-1 regression, fixed**: seven classes record a cause given as `undefined` as an own `cause` (the native
    lights' four `arguments.length > 2`, the two WebGPU frames' and the UV-texture bindings' variadic cause). Batch 1's
    base class dropped an undefined cause, and the uv-texture-material-bindings flow's "a thrown undefined is the cause"
    check failed. The base class now keeps a cause whenever the key is given; the other classes leave the key out when
    they have none, as before. A unit test checks both.
  - **The studio's call sites**, all checked, none changed:
    - RenderPanel's scene and material errors show compile diagnostics (`compileGpu`, `materialShader`): data, whose
      messages keep their words (above).
    - gpuRenderer's `showScene` catch drops the refusal (the panel shows the diagnostics); `createViewer`'s rejection in
      Viewport falls back to WebGL2 without showing it.
    - useGpuMaps shows a compute error's message, but compute throws plain `Error`s, not gpu's classes.
    - Nothing in apps/cad-studio/src or test matches a gpu code or class name.
  - **Tests**: barocss-error.test (5): `[CODE] …` per constructor shape, the 1024 cap with the prefix, the prefix once,
    `refusalText`, a diagnostic plain, the undefined cause. Four gpu-scene flows checked the old text and now check the
    code too: engine-transform-clip, engine-uv-texture-material-bindings and triangle-normal-generation
    (`startsWith('[${code}] Header: ')`), native-surface-uv01-geometry (the exact `[NORMALIZATION] …`). viewer-browser's
    disposed check reads `DISPOSED`.
- **Runs** (this worktree, at the batch's tree):
  - gpu tsc 0, eslint 0, unit 198/198, examples/gpu-scene flows 65/65, `test:browser` 28/28 on hardware and 28/28 with
    VIEWER_ADAPTER=swiftshader (its viewer-browser case rerun after the `DISPOSED` fix). Only three of the nine browser
    files read VIEWER_ADAPTER (viewer-browser, scene-viewer-browser, api-show); the other six run on hardware both times.
  - Studio tsc 0 (no studio file changed).
  - Studio flow, FLOW_ONLY `^(render a part|surface analysis|G12:|G13:|G16:|G17:|G19\.|G20\.2|K2 FRk5|G3 display
    modes|G22 clearance|G23 )` (the steps on either renderer, plus Render's and the analysis' gpu compiles), port 52691:
    WebGPU 17/18 and WebGL2 17/18. The one failure on both, 280 (G3 display modes), is a FLOW_ONLY prerequisite: its
    Mount needs the mount rows that step 91 (O14 / O16, the Library's shop rows) loads, so the Mount stayed open and
    the display-mode select was disabled. Rerun with `^(O14 / O16: the Library|G3 display modes)`: 91 and 280 pass on
    both renderers.
  - Not run: the full flow on either renderer (the coordinator's window at the end of R7.3); studio unit.
- **Left open, for the coordinator**:
  - The `{ ok: false, diagnostics }` compile results (mesh-material, scene-viewer, gpu-compiler) stay data results, as in
    G-R51.
  - 101 plain `throw new Error/RangeError/TypeError` remain in gpu's src (geometry.ts 15, gpu-data.ts 15, viewer/scene.ts
    10 …). Several are causes the classes wrap, and flows check them as `RangeError`. Whether they become BarocssErrors is
    a batch 3 decision.
- **For R7.3d (the packet tag)**: `right-handed-y-up` is not meaningless everywhere. gpu's primitive geometries and the
  engine scene are authored in scene units with a real Y axis (cylinder-geometry: "a generic Y-axis mesh"; capsule,
  cone, plane, torus alike), so there the tag is true. The misleading one is the mm mesh packet from CAD (cad's
  core/packet.ts and its seven preview builders, gpu's mesh-packet.ts, gpu-compiler and kernel-face-preview), which is
  Z-up data. The same tag also sits in packages/barocss-cad-interop (its packet, three and babylon hosts, which are Y-up
  engines), packages/barocss-viewer, the physics examples and pinned evidence JSON. The scope is the coordinator's call.

## G-R53 — R7.3c: gpu's Vec3, Mat3 and Mat4 in one declaration, readonly at the boundary (roadmap R7.3c, 2026-10-24)

- **One declaration**: `src/core/geometry-types.ts`, in api-conventions.md §10.2's shapes:
  - `Vec3 = readonly [number, number, number]`;
  - `Mat3`: 9 numbers, row-major, its columns the frame's axes;
  - `Mat4 = Float64Array`, column-major.
- **Before**: two exported Vec3s, viewer/math.ts's readonly one (exported as `ViewerVec3`) and scene-types.ts's mutable
  one (the main entry's `Vec3`), plus scene-viewer's local `V3` and inline `[number, number, number]` in the public
  mesh packet, the mesh camera, capHatchAxes and the SDF render IR. No Mat3.
- **After**:
  - viewer/math.ts and scene-types.ts re-export the core types. scene-viewer's `V3` is the core `Vec3`.
  - The main entry exports `Vec3` (now readonly), `Mat3` and `Mat4`. The viewer entry exports the same three under the
    same names. `ViewerVec3` is gone, with no alias; nothing in the repository used it.
  - Readonly `Vec3` in the public types: MeshPacket's `bounds`; MeshOptions' and the coplanar boolean options'
    `translate`; MeshCamera's `eye`, `target` and `up`; capHatchAxes' `u` and `v`; the SDF IR's `translate`, `size`,
    `rotateDegrees`, `start` and `end`. Colours stay `RGB`, a mutable triple: they are not geometry.
  - Inside gpu, values being built stay mutable: 58 `number[] as Vec3` casts read `as [number, number, number]`, and
    the growing min/max accumulators are typed mutable (engine-scene, triangle-geometry, mesh-scene-transform,
    primitive-frame-preflight, source-scene-bounds' `GrowingBox`). A readonly Vec3 accepts them.
- **No runtime change**: the built `dist/index.js` and every emitted `.js` are byte-identical to batch 2's (`cmp`). The
  only new file is the type-only `dist/core/geometry-types.js`. So the browser tests and flows were not rerun.
- **Runs**: gpu tsc 0, eslint 0, unit 198/198. Studio tsc 0 and cad-model tsc 0 against the new declarations; neither
  changed.
- **Not done, for the other lanes** (§10.2 says "where they cross a package"): cad's `Vector3` (section-properties) and
  its api/ Vec3s (the API lane's), and cad-model's eight `Vec3`/`V3`/`Mat3` declarations, are the kernel's, the API
  lane's and the outer lane's.

## G-R54 — G14 in progress, measured: section's GPU time by pass; the step-48 order dependency (roadmap G14, 2026-10-24)

- **Section's GPU time, by pass** (measure first):
  - The viewer's render passes now carry labels (`viewer surface`, `viewer output`, `viewer shadow`, `viewer cap front`
    and `… samples`, `viewer light probe`, `viewer oit` and `… composite`, `viewer outline mask`, `viewer mip`,
    `viewer pick`). A label is the only change: no pass, draw or binding moved.
  - bench-browser records each stamped pass's time by its label and prints it under the row with `BENCH_PASSES=1`.
  - Run: `BENCH_ONLY='^(section|orbit)' BENCH_PASSES=1 node test/bench-browser.mjs`, load 14 → 12, so LOADED (compare
    only). Milliseconds per submit:

| Row | GPU | surface | output | cap front samples | light probe | cap front | shadow | outline mask |
|---|---|---|---|---|---|---|---|---|
| orbit, 60 steps | 1.2 | 0.41 | 0.79 | — | — | — | — | — |
| orbit, a body outlined | 2.06 | 0.40 | 1.27 | — | — | — | — | 0.39 |
| section, 120 brackets on the GPU | **5.68** (≤ 6) | 2.17 | 2.06 | 0.71 | 0.30 | 0.27 | 0.17 | — |
| section, CPU clipMesh (WebGL2's) | 1.95 | 0.86 | 0.81 | — | — | — | 0.28 | — |

  - Within its budget in this run; 8.1–8.8 ms at G-R46–G-R50, also loaded. So the overrun is not steady.
  - Where the time goes: the surface pass costs 2.5 times the CPU path's (the clip plane's discard and the caps' probe
    in the same shader), and so does the output pass (2.06 against 0.81). The cap passes add 1.3 ms. The output pass's
    share is the open question: it resolves and composites the same pixels either way.
  - **Decision proposed**: no change to the section path from this. Next, one quiet-machine run of the section rows to
    settle whether 6 ms holds, then, only if it doesn't, the output pass first.
- **The step-48 order dependency** (reproduced: FLOW_ONLY `^(render a part|section view|parameters:|surface
  analysis|RM2:)` on WebGPU; 48 passes, 74, 96, 193 and 217 fail):
  - Cause 1: **New part keeps the camera.** Step 48 leaves its saved view (the camera further out). Step 74 starts from
    New part with that camera, where it otherwise starts from the default one. Its six 12 px drag steps then move the
    plane to 29 mm, not 24.
  - Cause 2: at that zoom the section handle moves 2.9 px on release (held → after: −2.7, −1.0 px), over step 74's
    2 px limit. The drag and the commit both snap to 0.5 mm, and the handle's point comes from the same
    `sectionHandles(section, sectionBox)` both times, so the move is in how the handle is drawn, not in the plane. Still
    to find: during the drag SceneViewport draws the handle from the live store; after release the App draws it, and
    they differ.
  - Steps 96, 193 and 217 fail only because 74 stopped with the section left on (96's screenshot: the section bar still
    up, Chamfer refused).
  - Step 74 passes alone.
  - **Decisions proposed**: (a) New part puts the camera back to the default view; this is user-visible, so it is the
    coordinator's call. **The coordinator's answer: not now.** It stays a possible later UX item, so it doesn't hide (b). (b) Find the 2.9 px release move and fix it: a handle should not move when it's let go. (c) The
    flow's steps 96, 193 and 217 don't need to change.
- **O18's placed copies dropped on a rebuild with identical meshes** (measure first):
  - The outer lane's work-round (App's `sameMeshes`, 2aae36ec3) was taken out in this worktree only, for the runs, then
    put back (nothing committed).
  - FLOW_ONLY `^O10 (frame costs|Rebuild)` and `^(AM7|O10 (frame costs|Rebuild))` on WebGPU: all pass (285, 286, and
    AM7a and AM7b before them). The frame costs list the 10 bodies with the 8 copies by their keys in every display
    mode. **Not reproduced at 540df6a71.**
  - Why it can't come from gpuRenderer.setBodies today: it keys bodies by their mesh signature (content), keeps every
    body whose signature is unchanged, and returns at once when all are. A new array of the same meshes rebuilds
    nothing. The instances are keyed the same way (setInstances). So "should the renderer key on mesh identity" is
    answered: it already keys on content, which covers identity.
  - **Decision proposed**: close the item. Keep the work-round: it also saves the App's re-render on a mass patch. If a
    full window shows the copies missing again, its O10 steps will catch it.

## G-R55 — R7.3d, gpu and interop side: the CAD packet's tag is `right-handed-z-up`; GpuErrorCode takes the facade's codes (roadmap R7.3d, 2026-10-24)

- **Scope, as the coordinator settled it**: the mm mesh packet from CAD only. Its tag was `right-handed-y-up`, which
  is wrong for CAD's data (Z up, §10.1); it becomes `right-handed-z-up`, with no alias. gpu's primitive geometries,
  the engine scene, the SDF render IR, the cloth and particle layers and the pinned evidence JSON keep
  `right-handed-y-up`: they are scene units with a real Y up (cylinder-geometry is "a generic Y-axis mesh").
- **gpu** (489a29d36, the README in dc39326fd and 540df6a71):
  - mesh-packet.ts (the PreviewPacket type, its validator and its copy) and kernel-face-preview.ts (the packet it builds).
  - gpu-compiler.ts: the render IR's frame is per variant now. The SDF IRs are `right-handed-y-up`, the indexed-mesh IR
    (a CAD packet) is `right-handed-z-up`.
  - The README's packet example and IR line.
  - Tests and fixtures that build packets: tests/mesh-fixtures, mesh-packet, mesh-consumer, gpu-compiler-consumer,
    fixtures/original-compiler.json's packet. examples/gpu-scene: mesh-fixtures.mjs, mesh-flat-packet.json and
    native-surface-uv01-geometry-flow's packet check. examples/cad-nurbs/preview-flat-packet.json.
- **barocss-cad-interop** (assigned to this lane for the rename only): its packet reader (packet.ts), native-face.ts's
  packet and babylon.ts's surface-mesh metadata, which copies the packet's frame. Its curve lineage (three, babylon,
  pixi3d curves) is not a packet and keeps its label. Tests: interop.test's packet, babylon-loader's metadata check.
- **barocss-viewer**: unchanged. It passes cad's packets through gpu's validator and writes no packet tag itself; its
  `frame: 'right-handed-y-up'` is another field.
- **The physics examples** (3541c0e48, assigned by the coordinator): physics-character-viewer's capsule-mesh, terrain and
  geometry-checks, and the rigid-hinge viewer's meshes.mjs, built packets with the old tag, which gpu now refuses. Only
  the literals changed; `node --check` on each.
- **The kernel's side**: cad's core/packet.ts, core/preview.ts, z-axis-revolve-preview.ts, the seven planar-solids
  preview builders, the README's three lines, and the fixtures/tests that build packets (tessellation.test,
  modeling-box-cut-fixture, modeling-union-fixture, stored-circle-prism-solid-fixture, modeling-circle-native). It is a
  patch for the kernel lane, `r73d-kernel-packet-tag.patch` in the lanes' shared notes folder (16 files, 22 lines;
  `git apply --check` clean). The two sides land together: gpu now refuses a y-up packet, and native-surface-uv01's
  frame pack compares cad's packet type with gpu's, which tsc rejects until both are renamed.
- **GpuErrorCode** (the API lane's R7.5b finding 8): `| SceneCode` from src/api/refusal.ts, a type-only import, in
  place of the hand-written `'MESH_INVALID' | 'LIGHT_INVALID'`. The facade's MATERIAL_UNKNOWN, MATERIAL_INVALID and
  CAMERA_INVALID reach the union, and the union and the refusal table can't drift.
- **Runs**, with the kernel patch applied locally (then reverted, not committed by this lane): cad tsc 0 and its three
  packet suites (construction, stored-circle-prism-solid, tessellation) 28/28. gpu tsc 0, eslint 0, unit 201/201,
  test:consumer 3/3, gpu-scene flows 65/65 (after native-surface-uv01-geometry's check), test:browser 29/29 on
  hardware. Interop `pnpm test` passes. `test:babylon` passes with gpu's cad-dist hook
  (`node --import ../barocss-gpu/tests/cad-dist.mjs test/babylon-loader.test.mjs`); its own script fails before running
  anything, because `@barocss/cad` resolves to TypeScript sources (G-R40's cause, which this change didn't introduce).
  Studio tsc 0: the studio, cad-model and the docs don't use the packet path.

## G-R56 — G14 (b): a handle drag measured from where it began; the release no longer moves the section handle (roadmap G14, 2026-10-24)

- **Cause** (G-R54's cause 2): Viewport's handle drag measured each step with `dragAlong(from, pointer, hd.at, …)` and
  `dragIn(…)`, linearised at the handle's *current* point.
  - On WebGPU, SceneViewport hands Viewport the section's live handles, drawn where the plane now is, in every frame of
    the drag. So each step measured from the point one frame back, and the release measured from yet another point.
  - In perspective, the same pointer then gives a slightly different value. At step 74's zoom after step 48, that flipped
    a 0.5 mm snap: the plane was committed half a millimetre back from where it was shown, and the handle moved 2.9 px
    on release.
- **Fix** (`viewport/Viewport.tsx`): the drag keeps the handle's point as the drag began (`handleAt`) and measures every
  step and the release from it. The move gizmo already did this (`origin`, "measured from the gizmo where the drag
  began"). Arcs, which add up their turn step by step about a fixed centre, are unchanged.
- **Runs**:
  - FLOW_ONLY `^(render a part|section view|a selected box shows its dimension|drag a surface pole|drag a part
    instance|drag a dimension handle|Hole: drag its centre|a box under a fillet keeps up|O9:|G19\.|G20\.2|G16:|G17:)`:
    every handle-drag step passes on WebGPU and on WebGL2 (32, 64, 66, 69, 74, 271–277), and **74 passes after 48**:
    the order dependency is gone at its cause.
  - 50, 58 and 270 failed in that selection on both renderers. Rerun with their prerequisites,
    `^(import a \.barocad source|drag a surface pole|place another part as an instance|drag a part instance|G16:)`, all
    six pass on both. 50 needs 49's imported surface and 58 needs 57's instance.
  - 270 (G16) is another camera carry-over: it passes after 49/57 and failed after the G19 steps. That is the New-part
    camera item (G-R54 (a)), left for later.
  - Studio tsc 0 and eslint 0 (with R7.3d's kernel patch applied in the lane's tree; this branch is cut before R7.3d).
- **Branch**: `claude/gpu-g14-handle-2026-10-24`, cut at 3801e2d9f (before R7.3d), so it can merge ahead of the R7.3d
  pair. The lane branch merges it too.

## G-R57 — R7.3a batch 3: gpu's public-input refusals coded (roadmap R7.3a, 2026-10-24; in progress, by area)

The coordinator's plan from the classification (`gpu-throws-classified.md` in the lanes' shared notes):
- Of the 101 plain throws in gpu's src, 61 refuse a caller's input on a public path, 28 are invariants or unreachable,
  and 12 are wrapped as causes or turned into diagnostics.
- The 61 become coded BarocssErrors, area by area, one commit each.
- Shared helpers stay plain. Where they are public through an entry, the entry wraps them, keeping the RangeError as
  the cause, so the seven flows that check `cause instanceof RangeError` stay true.
- (b) and (c) are unchanged. Refusals that fire when a frame or a pick runs stay where they fire.
- **Later, "verify, then remove"**: 17 (b) sites the classifier called dead: face-highlight 6, edge-overlay 1,
  boolean-shell-scene-input 8, requireSceneExecution 2. Not verified: face-highlight is still imported by
  object-highlight.

**1. The viewer** (32 sites):
- ViewerError moves into its own module, `viewer/viewer-error.ts` (re-exported where it was, from viewer/scene.ts and
  the viewer entry), so geometry, lights and math refuse with it without an import cycle. Its code union is
  `ViewerErrorCode`, exported from the viewer entry; GpuErrorCode takes it through ViewerError as before.
- New codes, each `[CODE] ` followed by the old words:

| Code | Sites |
|---|---|
| GEOMETRY_INVALID | geometry.ts' input checks (15: positions, indices, topology counts, normals, faces, edges, uvs, labels, colours, a colour range, scalar fields); Geometry's setColors/colour range/uvs (scene.ts, 4) |
| INSTANCES_INVALID | instance transforms or colours of the wrong length; instancing a non-triangle mesh (3) |
| TRANSFORM_INVALID | a transform that isn't 16 numbers (1) |
| COLOR_MAP_INVALID | fewer than two stops, or stops not rising (1) |
| COLOR_INVALID | not a hex colour (lights.ts, at frame time, 1) |
| MATERIAL_INVALID | a shader material with more than 16 params (at frame time, 1) |
| CLIP_INVALID | more clip planes than allowed; a plane without a normal or a finite offset (2) |
| TEXTURE_INVALID | a texture without a size; data not width × height RGBA (2) |
| SIZE_INVALID | a backing size under 1 × 1 (1) |
| MATRIX_SINGULAR | `invert` of a matrix with no inverse (1) |

- The class was RangeError; it's ViewerError now. Nothing in gpu's tests, the gpu-scene flows, the studio or cad-model
  checks these as RangeError (the classifier's search, rechecked). The tests' message regexes are unanchored.
- **Found, for the coordinator**: the published package has two copies of the viewer's classes. `@barocss/gpu` is a
  bundle (dist/index.js) and `@barocss/gpu/viewer` is tsc's unbundled output (dist/viewer/), so `instanceof` across
  the two entries fails (a ViewerError from one is not the other's BarocssError). This predates batch 3; the studio
  uses src and is unaffected. barocss-error.test compares within the viewer entry and says why.
- **Runs** (with R7.3d's kernel patch applied in the lane's tree, uncommitted; without it gpu's build stops at tsc):
  gpu tsc 0, eslint 0, unit 202/202 (barocss-error.test 6, a new MATRIX_SINGULAR case); test:browser 29/29 on hardware
  and 29/29 on SwiftShader; studio tsc 0, studio unit 286/286.

**2. The mesh and scene entries** (24 sites, wrapped at their entries):
- `core/input-error.ts`: `GpuInputError`, its codes, `recoded(code, error)` and `refusing(code, fn)`. `refusing` is
  applied once per entry, at load, in src/index.ts. A plain Error from the entry becomes a GpuInputError of the code,
  with the same words and the plain one as its cause. A BarocssError, and anything that isn't an Error, passes through.
- Inside the package the plain functions are still used. So the engine and native paths wrap the shared validators as
  before, and the seven flows that check `cause instanceof RangeError` are unchanged.

| Code | Entry | The sites it covers |
|---|---|---|
| SCENE_INVALID | parseScene, compileScene | scene/scene.ts:8 (the source version); gpu-data.ts' 12 record and object checks, through compileScene's admission |
| MESH_PACKET_INVALID | validatePreviewPacket | mesh-packet.ts:33 |
| MESH_OPTIONS_INVALID | validateMeshOptions | the options' camera (camera.ts:17), lighting (mesh-lighting.ts, 6) and transform |
| MESH_INVALID | prepareMesh | the packet's and the options' checks |
| CAMERA_INVALID | validateMeshCamera, prepareCamera | camera.ts:17 |
| FACE_PREVIEW_INVALID | prepareKernelFacePreview, resolveKernelFaceReference | kernel-face-preview.ts:20 and its record reads |
| PRIMITIVE_FRAME_INVALID | preparePrimitiveSceneFrame | mesh-scene-transform.ts:19, gpu-compiler.ts:60 (requireMeshExecution) and the packet, camera and lighting checks under it |

- **preparePrimitiveSceneFrame recodes in its own catch, not through `refusing`.** Its flow checks that an error the
  caller's own input throws (a Proxy trap's sentinel, while the frame record is read) passes through as the very same
  object. So once the input is read, a plain refusal is recoded. What the read itself throws passes through, as before.
- Changed check: primitive-frame-preflight-flow's six `RangeError` expectations now expect a GpuInputError of
  PRIMITIVE_FRAME_INVALID, with the RangeError as its cause and its message as the cause's after the code.
- **Runs** (R7.3d's kernel patch applied in the lane's tree, uncommitted): gpu tsc 0, eslint 0, unit 203/203
  (barocss-error.test 7: an entry's coded refusal with its cause; a coded refusal passing through); test:consumer 3/3;
  gpu-scene flows 65/65; test:browser 29/29 on hardware; studio tsc 0.
- **Found while checking**: R7.3c's readonly Vec3 breaks packages/barocss-viewer's type-check (34 errors, all of them
  gpu's readonly Vec3 meeting barocss-viewer's own mutable `Vec3` aliases; 0 with gpu's Vec3 mutable). It went to the
  coordinator with a proposed fix in barocss-viewer only.

**3. Boolean buffers and the BVH** (5 sites):
- BOOLEAN_BUFFERS_INVALID: prepareCoplanarBooleanBuffers and prepareBooleanShellBuffers are wrapped in index.ts. That
  covers native-mesh-buffers.ts:6 and 46, coplanar-boolean-buffers.ts:29 and boolean-shell-buffers.ts:22. axis-box,
  which wraps the same helpers in its own `child()`, is unchanged.
- GPU_BVH_DEPTH: packBvh (computeExperimental) throws a GpuInputError in place. Its message is byte-identical to
  before (`[GPU_BVH_DEPTH] the hierarchy is … deep; …`), so the studio's access map shows the same words.
- **Runs** (R7.3d now merged on integration; the kernel's half was applied locally): gpu tsc 0, eslint 0, unit
  204/204, consumer 3/3, gpu-scene flows 65/65, test:browser 29/29 on hardware and on SwiftShader; studio tsc 0,
  cad-interop tsc 0.

**Batch 3's codes, for the docs lane's refusal table**:
- ViewerError: GEOMETRY_INVALID, INSTANCES_INVALID, TRANSFORM_INVALID, COLOR_MAP_INVALID, COLOR_INVALID,
  MATERIAL_INVALID, CLIP_INVALID, TEXTURE_INVALID, SIZE_INVALID, MATRIX_SINGULAR.
- GpuInputError: SCENE_INVALID, MESH_PACKET_INVALID, MESH_OPTIONS_INVALID, MESH_INVALID, CAMERA_INVALID,
  FACE_PREVIEW_INVALID, PRIMITIVE_FRAME_INVALID, BOOLEAN_BUFFERS_INVALID, GPU_BVH_DEPTH.
- All are in GpuErrorCode (`ViewerErrorCode`, `GpuInputErrorCode`). Each message is `[CODE] ` followed by the old
  words.
- After batch 3, gpu's src keeps 40 plain throws: 28 invariants or unreachable and 12 wrapped as causes. That's by
  design.

## G-R58 — Open reads `.barocad` as the only curve and surface source; another file is named with what Open reads (owner, 2026-10-24)

- **The owner**: ".barocad 하나만 우리는 가지고 있어도 될 것 같아." `.cad` is a generic extension other CAD programs
  use. The studio took such a file for our source, parsed it, and failed.
- **The change** (App.tsx):
  - The Model file input's accept list drops `.cad`.
  - open() takes only `/\.barocad$/i` as a source, and strips only that from the name.
  - A file whose extension Open doesn't read is now refused before the model reader is tried. Before, it reached
    readStudioFile and failed with the reader's words. The toast says "Can't open <name>", with `OPEN_READS`: "Open reads
    models (.bcad, .json), STEP (.step, .stp), STL, OBJ, IGES (.igs, .iges) and .barocad curve and surface sources. Your
    part is unchanged."
  - A file without an extension is still tried as a model, as before.
- **Nothing else reads or writes `.cad`**: not in the studio's src or test, cad-model's src, or the fixtures (lid,
  study and warp are `.barocad`). The one mention is apps/library-docs/docs/studio/files.md:21, which lists `.cad`
  beside `.barocad`. That's for the docs lane.
- **Flow**: a new step, the last (288, so no other step's number moves). It checks the accept list, opens
  `bracket.cad`, and expects the toast's name and words and the part unchanged.
  - FLOW_ONLY `^(Open: a \.cad|import a \.barocad source|open a STEP file)` on WebGPU: 46, 49 and 288 pass.
  - 49 is the `.barocad` import; 46 is STEP and its refusal of a bad .step.
- **Runs**: studio tsc 0, eslint 0 on App.tsx. Not run: studio unit (the change is in App's open path, which only the
  flow reaches); WebGL2 (renderer-independent).

## G-R59 — R7.3d follow-up: cad-interop's curve metadata and its examples are `right-handed-z-up`; the axis-box basis question returned (roadmap R7.3d, 2026-10-24)

- **The interop curve metadata** (the coordinator's go): CAD curve samples in mm, put into Three, Babylon and pixi3d
  geometry with no axis change. That's CAD's Z-up data under a Y-up label, the packet's mislabel again.
  - `'right-handed-y-up'` → `'right-handed-z-up'` in: three.ts, babylon.ts (the curve lines), three-uniform-curve,
    babylon-uniform-curve, babylon-selected-uniform-curve, pixi3d-selected-uniform-curve; and the test
    selected-uniform-curve-pixi3d.
  - In the examples that check these labels: curve-parameterization-three (verify and html), host-replacement-flow,
    host-replacement-babylon-flow, weighted-curve-babylon (verify and html), the xy-angle-arc and
    source-curve-control-polygon checkpoints. Also multi-section-loft-babylon (verify and html),
    native-surface-curvature-babylon-verify and sdk-entry-checkpoint-verify: these check the *surface* mesh's metadata,
    which R7.3d renamed (babylon.ts:113) but whose example checks it missed.
  - The `-scene-units` labels (cloth, particles) are untouched.
- **Runs**: interop tsc 0, build, `pnpm test` passes, test:babylon (with gpu's cad-dist hook) passes,
  selected-uniform-curve-pixi3d.test passes.
  - **Not run, and can't be as they stand**: the example verifies and checkpoints. They need a demo's output directory
    (`<CAD-947-demo-output-directory>`, `--output EVIDENCE_DIR`) or a TypeScript loader for interop's src
    (ERR_MODULE_NOT_FOUND on src/*.js, ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX). This predates the change: it's the state
    G-R40 triaged for the gpu-scene flows. Their edits are the same literal as src's.
- **axis-box-boolean-buffers: returned to the coordinator, not changed.** Its `basis: 'authored-xyz-matches-rhyup'` is
  not its own.
  - It's the host assertion used in about 150 places across cad-interop (the Three, Babylon and pixi3d hosts) and
    barocss-viewer: "map authored XYZ unchanged into the host's right-handed Y-up frame".
  - Its output is scaled into scene units by mmToSceneUnit, like the engine scene. So its `coordinateSystem` names the
    host scene's frame, not the CAD data's.
  - Renaming only axis-box's basis would split one assertion into two spellings. A rename of the assertion itself is
    one change across all three packages, and it's the coordinator's call.
