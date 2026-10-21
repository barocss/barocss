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

