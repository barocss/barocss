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
