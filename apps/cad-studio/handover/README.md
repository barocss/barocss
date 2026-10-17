# cad-studio hand-over — 2026-10-16

Hand-over from the Claude account that ran the 2026-10-16 cad-studio work (organization NAVER_TEAM_17,
then the next one) to whoever continues it. Session transcripts do not move between accounts; this folder,
the git history and the QA report are the record. Everything is **local only**: nothing was pushed, no PR,
no npm publish.

## 1. Where the work is

| What | Value |
|---|---|
| Integration branch | `claude/cad-studio-2026-10-16` |
| Its tip at hand-over | the commit that adds this folder (`git log -1 -- apps/cad-studio/handover`); code tip `d476654c`. Every merge is `merge(cad-studio): …` |
| Worktree it is checked out in | `.claude/worktrees/barocss-naver-team-17-cfd156` |
| Cut from | `review/cad-gpu-engine-2026-10-14` @ `c73bf909` (the earlier single-engine/cad-studio line) |
| Relation to `develop` | ~1,380 commits ahead, 2 behind (`57ad0fd0`, `1edc9026` — Integration's docs/viewer commits) |
| Also on | `review/cad-gpu-engine-2026-10-14` was fast-forwarded to the hand-over tip on 2026-10-16 (owner's choice), so it and `claude/cad-studio-2026-10-16` point at the same commit. It is checked out in `.claude/worktrees/barocss-cad-gpu-review-efbb2c` (untracked drafts there kept). Merging into local `develop` (owned by Execute Integration per AGENTS.md) was not done. |

Feature branches (all merged into the integration branch; each has its own worktree under `.claude/worktrees/`):

| Lane | Branch | Worktree | Owns |
|---|---|---|---|
| Sketch constraints & dimensions | `claude/studio-constraints-371737` | `studio-constraints-371737` | `src/sketch/*`, `ui/ConstraintTools.tsx`, `ui/SketchMarks.tsx`, `ui/constraints.css` |
| Assembly mates | `claude/studio-mates` | `studio-mates-cbde0e` (checked out on `claude/studio-mates`) | `src/assembly/*`, `ui/MatePanel.tsx` |
| 2D drawings | `claude/studio-drawings-cd772f` | `studio-drawings-cd772f` | `src/drawing/*`, `ui/DrawingWorkspace.tsx`, kernel `brep-hidden-line.ts` |
| Chat-driven modeling | `claude/studio-chat` | `great-einstein-3ea69b` | `src/chat/*`, `server/*`, `ui/ChatPanel.tsx`, `ui/chat.css` |
| QA tester (report only) | `claude/studio-tester-412a82` | `studio-tester-412a82` | `test/qa/*` |
| Integration + core fixes | `claude/cad-studio-2026-10-16` | `barocss-naver-team-17-cfd156` | merges, `engine/errors.ts`, `app/measure.ts`, kernel `edge-finish.ts` / `part-model.ts` fixes |

`.claude/worktrees/amazing-euler-c18b94` is a stopped duplicate chat session (no commits); it can be removed.
Per-lane notes written by each session are copied in [`notes/`](notes/).

## 2. Run and verify

```bash
export PATH=$HOME/.nvm/versions/node/v22.19.0/bin:$PATH        # Node 22; Node 18 breaks the gpu tests
pnpm install --no-frozen-lockfile --prefer-offline              # the lockfile lags apps/cad-studio; never commit pnpm-lock.yaml
(cd packages/barocss-cad && pnpm build:library)                 # never bare tsc there (it overwrites dist)
(cd packages/barocss-gpu && pnpm build:library)
cd apps/cad-studio
pnpm dev                                                         # http://127.0.0.1:52020
pnpm test && pnpm type-check                                     # unit tests (node --test via esbuild)
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
PW_DIR=/Users/user/.npm/_npx/e41f203b7505f1fb/node_modules/playwright \
node test/browser-flow.mjs /tmp/cad-studio-flow                  # real Chromium, WebGPU, ~5 min, a screenshot per step
pnpm chat                                                        # optional: chat server on 127.0.0.1:52021 (uses the local `claude` CLI login)
```

Kernel suite: `cd packages/barocss-cad && pnpm build:library && pnpm test`. One test,
`actual native Split source produces validated scoped Face reference resolutions`, always fails here: the
example demo it runs pins Node 22.23.3 and this machine has 22.19.0. It is environmental, not a regression.

Last verified state at hand-over:
- `pnpm test` 123/123 and `pnpm type-check` clean on the hand-over tip (the QA probes in `test/qa/` are excluded
  from the type-check; they run through esbuild).
- Browser flow 44/44 on WebGPU: run by the integrator on `8e2c4b17`, and by the drawings session on `a2243e58`,
  whose tree is identical to the drawings merge `85f5e6ed` (later merges add only `test/qa/` and this folder).
- Kernel suite 826 pass / 1 environmental fail on `d5fa5fa6`; hidden-line tests 10/10 on `a2243e58`.

QA probes (from the tester lane, now in `test/qa/`, report in `test/qa/REPORT.md`):
`node test/qa/run-engine-probe.mjs [probe.ts]` (engine level, seconds) and
`PW_DIR=… CHROME=… node test/qa/ui-probe.mjs /tmp/cad-studio-qa [case-regex]` (real app, ~10 min).

## 3. What cad-studio does now (added 2026-10-16)

- **Sketch**: sketch on faces (flat, side, sloped), XY/XZ/YZ planes with offset and angle. Explicit
  constraints (H, V, parallel, perpendicular, coincident/fix, equal) and driving dimensions (length, radius,
  ΔX/ΔY, angle, point distances, circles placed from outline corners/edges and from each other), all
  refused with a reason when redundant or conflicting. They are kept in the sketch node (`outline`), drive the
  feature editor, and a finished sketch reopens for editing. Sketch-level undo/redo while sketching.
- **Assembly**: part instances with mates: coincident, distance, angle, concentric, tangent
  (round–flat, round–round), wedge between two round faces, origin planes, lock; grounded parts;
  sub-assemblies (an inserted file's own instances); remaining freedom shown; mates re-solve when parts change.
- **Drawing workspace**: third/first-angle standard views and isometric from an exact hidden-line projection
  (kernel `projectBrepHiddenLines`); centre marks and centrelines; tangent edges (optional); section A–A;
  linear, diameter/radius and angular dimensions that follow the model, with tolerances (±, deviations, fit
  codes); notes with leaders; title block (fields fit their cells);
  instances on the sheet; SVG and PDF export.
- **Chat modeling**: chat panel, with each turn run by the local `claude` CLI against the studio's own tools
  only (an MCP server over the real command builders; no file/shell tools). It covers parts, assemblies
  (instances, placement, mates), image attachments, and bitmap → relief or inflated 3D figure. The server binds
  127.0.0.1 and refuses cross-site requests.
- **Core fixes from QA**: pipe angle; unreadable STEP keeps the open part; draft/revolve refusal reasons; exact arc
  length; removed-features count; overlapping sketch shapes refused (no silent cut); fillet/chamfer wider than
  its wall refused; unions touching only at an edge/point refused; honest message for curved-face union failures.

### Usability pass (2026-10-17, `review/cad-gpu-engine-2026-10-14`, local commits only)

The owner's bar: cad-studio should feel like a commercial CAD tool (mouse-driven handles everywhere, no
beginner-ish tools, one consistent icon set). What landed, one commit each (`git log 134071aa..`):
- **Handles everywhere**: every shape (box … prism) has a puck to slide it and arrows for its sizes, when made
  and when edited (a shape's solid remembers its command and values, `made`, and edits as itself — Edit Box,
  Edit Sphere); hole centre puck, blind depth, counterbore size/depth; shell wall; split plane; linear pattern
  spacing and count; circular pattern axis puck and spread arc; revolve angle arc; fillet/chamfer limits.
  Picking a face or edge edits the feature it came from (each of several holes).
- **Shapes**: sphere, cone/frustum, torus, tube, wedge, polygon prism beside box and cylinder, in a top
  shapes bar; a shape follows the pointer onto the ground or an upward face until a click, or is dragged from
  the bar and dropped.
- **Faces as inputs**: Extrude on a picked flat face (push/pull, its outline fitted back to lines and arcs,
  holes too); Fillet/Chamfer on a picked face take all its edges; Align puts a face on another body's face
  (turning by quarter turns when needed) or a body on the floor; Mirror across any face's plane.
- **Bodies**: Browser panel at the left (eye, colour dot, rename, sketches, parts, curves); per-body name,
  colour and visibility (`StudioDoc.bodies`, keyed by the body's first feature, so they survive added
  features and renumbering); right-click Hide / Show only this / Show all / Delete; Delete key; Duplicate (⌘D)
  as a separate body; patterns can make separate bodies.
- **Inspect and view**: view cube; section view (kernel split, display only, cut faces lit); interference
  check; centre of mass and surface area; `?` lists keys and mouse.
- **Sketch**: object snaps (ends, middles, centres, quadrants, model corners/edge middles/hole centres in the
  plane, origin).
- **Speed and fixes**: dragging a handle on a feature under fillets previews the part up to that feature
  while moving and the whole part on pause; command previews have their own kernel cache and no mass
  properties; selections follow re-evaluation by name; the key listener always sees the newest selection;
  New part clears instance/direct/measure picks; F stays Fit view, Fillet is Shift F.
- **Icons**: one generated system in `src/ui/cadIcons.tsx` (shared isometric projection, opaque three-tone
  faces mixed into `--icon-bg`, accent `--icon-ac`); check them with `test/qa/icon-sheet.tsx` (renders a sheet).

Later the same night (`ab879125..`): previews tint the bodies a command adds; the command HUD sits at the
right (the Selection panel's place) so it no longer covers the model; arrow keys nudge the picked body
(Shift 10 mm, PgUp/PgDn for Z, one history step per run); ⌘C/⌘V copy and paste bodies; sketch construction
shapes (X: dashed references kept with the sketch, never sent to the kernel); sketch tool and history icons in
the CAD set; right-click a history step to edit, edit its sketch, roll back or delete it; the sketch hint bar at
the top; the rail hidden in Drawing.

Then: double-click picks a whole body and F frames what is picked; **standard fasteners stage 1** (#2094): a
catalogue (`src/app/fasteners.ts`, ISO 4017/4762/4032/7089 nominal sizes M3–M12 with sources), simple shapes,
a cosmetic thread kept with the part and shown in the Body panel (no helical geometry), placement that takes a
round hole's axis and rim, editing size/length in place (a multi-step shape remembers `made.nodes`), one history
entry per part. Stages 2–4 of #2094 (verified size/length tables with versions, explicit assembly placement,
real threads) are not started; nothing was posted to the issue.

Next round (2026-10-17, `968ac90d..`): double-click an edge picks its tangent chain; gizmo moves (bodies and
placed parts) line up with other bodies' sides and middles; Undo/Redo name the step; shapes placed on side or
lower faces stand out of them (`up`, a rotate step; arrows and puck turn with it); bolts go into side holes;
per-body materials (mass follows; fasteners steel); a shape edited into one with a different step count is
rebuilt in place (`replaceRange` renumbers what follows); a settable grid snap (1/0.5/0.1/5/10 mm/off); a body's
features listed under it in the browser; Measure from here; the rail fits short windows; Shift-Enter applies and
starts the command again, and picks survive a body becoming another; sketch Offset (lines, arcs at tangent
joints), Round corner, and Use the face's outline (or as references).

Verified at `0d4d0e6f`: unit 175/175, type-check and lint clean, browser flow 73/73 (WebGPU).

Third round (2026-10-17, `ced02dd3..d722585e`): the kernel's numerical sketch profile v1 (64 points / 64
segments / 128 constraints, `solveXYNumericalSketchPoints`; v0 is untouched) and cad-studio sketches up to 64
points; analytic Booleans refine a surface-intersection seed only when no traced chain or known edge is within
half a step, and curve segments keep their samples (box fillets of 8 edges 1028 → 613 ms, 4 top edges 167 →
132 ms, volumes unchanged; subtracting the convex tools one by one was tried and reverted — it broke two
finish tests); sketch Offset of arcs meeting at corners (moved pieces cut back or run on to meet); a sketch
**Trim** tool (T: a piece back to its crossings, open pieces meeting end to end join — a rectangle and a circle
over its edge become a keyhole in two clicks; the piece to go is lit red); the section view follows its dragged
plane at once (`engine/clip.ts`: display meshes clipped and capped on the CPU, the exact kernel Split replaces
it); fasteners fit their hole (#2094 stages 2–3, `app/fasteners.ts`): ISO 4017 / 4762 lengths apart, ISO 273
clearance and tap drills, catalogue version and sources (ISO 4017 lengths other than M6 marked not yet
cross-checked), a hole's Ø/depth/through from the viewport picks the size, the joint (washer + nut under the
far face, or tapped) and the shortest length that does; the steps report the fit; the pointer looks through
the shape being placed. Nothing was posted to #2094.

Verified at `d722585e`: unit 183/183, type-check and lint clean, browser flow 76/76 (WebGPU); kernel 834/835
(the one failure is the Split demo pinning Node 22.23.3).

Still open after it: real helical threads (#2094 stage 4: a kernel helix sweep first); fillet evaluation is
still ~130 ms for mitred box tops (the tools' unions; tools trimmed apart at the mitre would avoid them);
sketch Extend; fasteners as assembly instances rather than features.

Verified at the end of the first pass: unit 167/167, type-check and lint clean, browser flow 64/64 (WebGPU),
QA probe 70/73 before its helper fix (the three remaining were the helper; U4x/U5x pass after it).
The flow takes `FLOW_ONLY=<regex>` to run the first step and the matching ones. The QA probe
(`test/qa/ui-probe.mjs`) was brought to the new flows (shape labels, Finish then E, Mirror's default plane);
note that it hot-reloads if sources change while it runs, and its cases depend on the ones before them.

Still open from this pass: kernel fillet ~140 ms per evaluation (dragging a fillet's own radius waits on it;
two thirds of it is `edge-finish.ts` `joinTouching` unioning the corner-mitred tools one by one);
the sketch solver's 16-point admission limit is part of the kernel's frozen `bounded-length-angle-v0`
contract (a test checks it), so it was left for the kernel owner;
a GPU clipping plane would make the section view instant; sketch trim/offset/construction lines; the
QA `test/qa/ui-probe.mjs` predates the new sketch flow (Finish no longer opens Extrude).

### Gallery backlog and perf pass (2026-10-17, same branch, local commits only)

The gallery backlog (`handover/gallery-backlog.md`) is done, A → B → C and the carried-over items; each line
there names its commit. Last additions: sew surfaces into a solid (kernel `sew`, `7c3bebdb8`), trim a direct
surface by a closed curve (`91819d596`; a display trim, thicken and sew take untrimmed surfaces), a
countersunk hole as one `hole` with `countersink` (`dda679abb`), ISO 4017 lengths M3–M12 cross-checked
(`b5b9ad450`), mitred fillets 110 → 56 ms (`25a98599e`).

Perf work handed over by the CAD/GPU common-functions session (B1–B4, D1/D4; D3 and D5 skipped: frozen
zero-native contract modules), measured before and after, names and volumes unchanged unless noted:
patterns in a balanced union tree, 1269 → 445 ms for a stepped body × 12 (`1ecb6fabb`); a hole's miss check
from its faces, 16 holes 2.9 → 1.0 s (`dafa648bc`, `77c06d2b9`); `curveEvaluator` without allocation
(`db8079c1f`); `regionInteriorPoint` pruning (`a043e2ebf`); curved-face tessellation without per-point and
per-edge allocation, 49 → 31 ms (`b31d45aab`); mass quadrature in scalars (`ffe7df8c5`); evaluators exported
(`cae8a9920`); a pole-drag step of a direct surface 17.4 → 4.4 ms (`8d36bd7d0`). Rule from the owner since
then: no functions made inside functions on hot paths (module helpers with a context instead).

Tangent cylinders: a cross hole whose side touches a vertical hole's wall from inside is built in either
order (`5d24f6374`, replacing the refusal of `8cc93fc6d`): the crossing quadratic's two roots are cut at
the touch so every cut piece ends there; volumes match exact integration within 5e-6. Touching from
outside stays refused (not a manifold solid).

Second perf pass (P1–P8, one commit each): benchmarks with budgets — `pnpm bench`, `bench:browser`,
`bench:memory`, `bench:assembly`, all opt-in (`df011d3a6`, `da1e4a454`, `fdbc9efaa`); the worker gets each
node once and only what it evaluates (`3d11e41ae`: a mesh-import preview step 16 ms → 0.01 ms of cloning);
reference/field comparisons on hot paths (`8c145cad0`); viewer frames without per-frame views and strings
(`04ec89405`); long-session memory checked flat (main 28 → 32 MB over 200 edits, worker 17 → 18 MB, GPU
buffers constant); many-hole faces triangulate without cubic searches (`d88ffa6dd`: a 120-hole plate's
mesh 4.3 → 0.7 s, its drawing 17.8 → 4.6 s); copies of a part share its tessellation and mass
(`fdbc9efaa`: 120 copies shown 2.2 → 0.34 s); the first load leaves the chat, drawing, render and direct
tools for later (`d55d81e9f`: 1377 → 837 kB, 406 → 263 kB gzip); no AO while the camera moves (`1ade490f0`:
orbit GPU 5.7 → 4.5 ms, the still frame identical). Still open from P6: a modelled M8 bolt's STEP is
23.6 MB, over the 4 MB import limit (`CadPartLimits.fileBytes`); its drawing takes 1.7 s; copies turned
about Z are tessellated as placed (the kernel renumbers an upright body's repeated faces when it turns it).

Verified: browser flow 102/103 at `1ade490f0` (WebGPU; the one failure a test race, fixed in `bf3138604`); unit 235/235;
kernel 853 + the one environmental failure (the Split demo pins Node 22.23.3). Note: `@barocss/cad`'s
exports point at `src`, so editing kernel sources while a browser flow runs reloads the page mid-step.

## 4. Open items (not done)

QA stopped after its fifth pass on `d5fa5fa6` (see `test/qa/REPORT.md`): every routed finding is fixed there and
nothing regressed; `8e2c4b17` and later (lock mates, chat assembly tools, circles from edges, drawing
tolerances/notes) were not QA-tested.

Closed on `review/cad-gpu-engine-2026-10-14` after the hand-over (2026-10-16, one commit each, unit +
type-check + browser flow 45/45, kernel suite where `packages/barocss-cad` changed):
- **S4** a dimension that pushes an attached circle across the outline's edge or off it is refused; Finish
  also catches crossings whose sample lands exactly on the edge (`aa5e88aa`).
- **A3** a flat mate with an origin plane lines the planes up by default; Flip opposes them (`157d3d48`).
  Mates saved before with Flip on an origin plane now read as opposed.
- **U4** New part and Open close an open sketch and tool first (`f5eecae6`).
- **U5** the dev/preview server answers `/api/chat/status` with `{ enabled: false }` when no chat server
  listens, so no 502 is logged (`61c546e8`).
- **U1** Delete feature in the feature editor (and the Delete key); mates, drawing dimensions and render keys
  are renumbered, dimensions of a removed feature dropped with a toast; Undo restores (`a3c0d7ab`).
- **D2** a STEP with several solids opens as that many bodies (kernel `import` `each`, node `solids`, sides
  `part<k>`); files opened before stay one body (`3f2e02b4`).
- **D1, D4** curved B-rep mass by quadrature over the exact surfaces (`8bc8f295`): STEP re-open of torus,
  pipe and loft, and fillets at any radius, exact to ~1e-11; Booleans with real intersection trims ~1e-5.

Open, with IDs as in the report:
- **W5 (kernel)** narrowed: overlapping tori with different tube or ring radii join (5/4, 5/4.9, R31 vs R30);
  only *congruent* tori turned about a line through the ring centre fail ("edge … has 4 uses"). Their
  intersection passes where both tori's patch boundaries (the inner equators) cross, and a piece there is
  found by two neighbouring patch pairs. Joining marched branches at tangential crossings did not fix it
  (tried, reverted). Next step: dedupe cut pieces that lie on a patch boundary shared by two face pairs in
  `analytic-boolean.ts` `cutPair`/`march`.
- **E15 (kernel)** the kernel still accepts a `holes` loop that crosses the outer loop (the app refuses it).
- **W1 (rest)** overlapping shapes in one sketch are refused; an actual union of them is not implemented.
- **X1** interference between bodies of the part: done (Inspect › Interference); between placed instances still not.
- Sketch solver: about 16 points per outline; each placed circle costs helper points, so two fully placed
  holes nearly reach it ("Too many points…").
- Drawings: one section only (parallel to the front view), no dimensions on the section or iso view.

Chat backlog (from the chat session): threads/springs/involute gears/helical surfaces need kernel features;
Booleans with lofted bodies are slow (~7 s) and bump-onto-loft unions can fail; smooth loft ≤ 5 sections and
≤ 64 segments per loop; image → 3D only inflates the front silhouette; every tool call re-evaluates the part
(24-step turn cap); buildings beyond massing are out of scope; image tracing checked on one cartoon only.

Deferred earlier (owner said docs later, cad-studio first): library-docs shader demo hosts still on app-owned
WebGL2 (an uncommitted WGSL draft `packages/barocss-gpu/src/engine-uv-material-wgsl.ts` sits in the
`barocss-cad-gpu-review-efbb2c` worktree); docs screenshots from removed renderers; gpu `test:consumer`
fails because the package `files` include `src`.

### Mesh bodies and SubD roadmap (owner decision, 2026-10-18)

Owner: "알고리즘을 개선하고 wasm 은 되도록 쓰지말고 자체구현으로 가자. parasolid 에서 필요한 부분만 우리가
하고, subD 도 적용해보자". This replaces the open M2 choice (keep B-rep / own mesh solid / manifold-3d WASM).
- No WASM or external numeric libraries (no manifold-3d, meshoptimizer or Rust core): our own TypeScript with
  better algorithms (culling, BVH, caches, filtered predicates, no allocation in hot loops). `@barocss/cad`
  stays dependency-free. If a hot loop still dominates after that, bring the numbers to the owner; don't
  propose WASM unprompted.
- One body kind, B-rep, whose faces carry analytic, NURBS or **facet** geometry (a Parasolid "convergent"
  subset). An imported mesh becomes facet faces grouped into regions, never a B-rep face per triangle (what
  `brepFromTriangles` does today). SubD is a way of making a body: a cage feature that becomes exact bicubic
  NURBS faces.
- Parasolid subset in scope: F0 facet faces; F1 facet × plane with an exact planar cap; F2 facet × plane,
  cylinder, sphere, cone. F3 (facet × facet) later.

Order (checkpoint with SHAs and numbers after each step; the owner wants to see progress between steps):
1. **R1 — M0 finished**: fixtures, pipeline measurement, `pnpm bench:mesh`; an F0 audit (each brep-core and
   evaluateSurface user: how a facet face is handled); an F0 spike (region grouping of the 200k/1M fixtures by
   normal angle: faces, memory, tessellate/pick/mass of a typed-array facet patch).
2. **R2 — B0, the B-spline performance base** (unblocks the helical thread default, SubD, F2): mass on
   B-spline faces by patch-domain tensor Gauss with analytic D1, no tessellation for untrimmed patches;
   analytic-boolean/split scaling (ray bbox cull in `rayHits`, per-face BVH over the grid, indexed stitch, no
   refit of untouched boundaries, the 625-point setup only when needed); `sewSolid` spatial hash;
   interval-filtered predicates in `polyhedral-boolean.ts` (BigInt only when ambiguous) and a bbox cull of face
   pairs. Then re-measure the helical bolt and propose switching the thread default.
3. **R3 — F0 facet faces**: a typed Surface union; patch data as typed arrays with a BVH, polyline edges,
   region naming (stable region ids, no triangle indices); exact mass by the divergence theorem, BVH ray
   classification, AP242 tessellated STEP; a typed-array path that skips freezing and deep copies. With it
   **M1** binary mesh blob in .bcad (content-hashed, own format, migration) and **M3** import gate and repair
   (weld, orient, own Liepa hole fill with fairing, degenerate and floater removal) with a diagnostics badge.
   **F0 fallback (owner, 2026-10-18: "F0 동안 작은 STL은 기존 평면 경로로 boolean이 되게 fallback을 유지하고,
   F1/F2가 들어오면 걷어내자")**: imported meshes become facet faces by default; a Boolean, split or other
   refused operation on a facet body under a size threshold (chosen from the R2 polyhedral numbers so it stays
   interactive; state it and why) explodes it to the planar per-triangle B-rep and runs the polyhedral path.
   Above it, refuse with a clear code naming the missing capability ("Booleans on large meshes arrive with
   F1/F2"). One named code path with a test; **remove it in the step that lands F2**. Version the mesh node so
   old .bcad files keep resolving `<id>.facetK` names. Region grouping needs smoothed normals or a size cap
   (the noisy scan); M1 binary storage comes before lifting the 100k cap.
4. **R4 — F1**: facet × plane split and section with an exact planar cap (each vertex's sign once, one tie rule).
5. **R5 — SD1 SubD**: a `subd` node storing the cage (OpenSubdiv rules: smooth, sharp crease, boundary edge
   and corner), no 64-surface or inline-surface limits; regular regions as exact bicubic patches packed into
   faces of ≤ 16×16 poles; buildBrep straight from the cage topology.
6. **R6 — F2**: facet × plane/cylinder/sphere/cone; implicit sign per vertex; the analytic face stays exact,
   its rim a polyline on it.
7. **R7 — SD2**: extraordinary vertices: one local Catmull–Clark step, then a PCCM-style bicubic G1 cap with
   interior double knots, boundaries bit-identical to the neighbours; report deviation from the limit surface;
   a G1 check between faces. Promise C2 away from EVs, G1 at EVs, G0 at creases; never G2.
8. **R8 — SD3 studio cage editor**: Box/Smooth toggle; vertex/edge/face selection, loop/ring by double-click;
   gizmo; extrude on a modifier drag; insert edge loop, delete, bridge, fill hole, weld; sharp crease; one
   mirror plane; a validation overlay (non-manifold, poles, n-gons); each drag one undo step, the session one
   timeline feature; the pole gizmo from `direct.ts` driven by cage data, not source-text edits.
9. **R9 — M4**: our own QEM decimation, attribute-aware, with a reported error.

Then the **AI mechanical parts track** (owner, 2026-10-18: serial, one implementation session, "그냥 순서대로
하는게 좋아"). For an AI to model anything the kernel must express it; mechanical parts and sheet metal are
most real demand, and fillet is the most used feature after extrude (today only plane/plane and
plane/cylinder edges, `edge-finish.ts`). Kernel breadth, robustness and automatic verification before UI.
An S0-style feasibility checkpoint before each large step (R10, R11, R12).
    **R10a — stable sketch-entity side names** (from A1.4, deferred in D31; before R10, whose fillets name sides):
    - segment ids in polygon and loop profiles, kept through vertex insertion, with the sketcher's
      constraints and dimensions keyed by them;
    - an optional `sideTags` on the kernel profile, used by every side-naming generator (prismatic, drafted,
      loft, revolve, part-model loops) for `side[tag]`;
    - a studio sketch node version 2 that sends the tags, with old nodes keeping `sideK` (D16);
    - conformance: a vertex inserted keeps every other side's name.
10. **R10 — general fillet and chamfer** (on R2/B0): any edge incl. B-spline and cylinder/cylinder; constant
    radius, then variable; vertex blends and setbacks where three or more fillets meet; rolling-ball blends as
    exact NURBS approximations with a reported deviation; clear refusal codes (radius too large, degenerate).
11. **R11 — general shell and offset** for B-spline and facet faces: offset surfaces, then self-intersection
    trimming; failures diagnosed per face.
12. **R12 — sheet metal**: base flange from a sketch, edge flange, bend (radius, K-factor), reliefs, flat
    pattern, DXF export of it, bend table data in the part.
13. **R13 — automatic verification and DFM checks** for AI loops: minimum wall thickness, tool access and
    moulding draft, hole/thread standards, intended versus actual dimensions; machine-readable reports in
    the existing diagnostic codes.
14. **R14 — automatic drawings**: view selection and layout, dimensions from feature intent, GD&T and
    tolerance suggestions.

R1 results (2026-10-18, `f5d237c9f`; `pnpm bench:mesh`, `pnpm bench:mesh --facets`; audit in
[`f0-audit.md`](f0-audit.md)):
- Per-triangle B-rep faces (today's `brepFromTriangles`): 200k triangles → 10.5 s to convert, 3.8–85 s to
  display, 2.2–2.6 GB RSS; 1M → 84 s + 32 s, 6.4 GB, a 267 MB display message, 55 MB of .bcad JSON. The
  studio refuses more than 100k (`CadPartLimits.meshTriangles`). Polyhedral union with a box: 16 s (2k),
  49 s (5k), 409 s (20k); one-side split 12 / 32 / 192 s. Broken meshes (hole, flipped patch, non-manifold
  edge, extra shells, crossing shells) are refused at conversion; degenerate triangles are dropped.
- F0 spike (typed arrays, regions by normal angle) at 1M: 9–1551 regions, 179 MB, BVH 0.3 s, 1000 picks
  4 ms, 1000 point classifications 2.5 ms, exact mass 9 ms, display buffers 41 ms. The noisy scan breaks
  into 4k–129k regions with either rule: region grouping needs smoothed normals there.
- Reference only (dropped by the owner's decision, not to be adopted): manifold-3d WASM did 1M union
  0.45–0.6 s, split 0.57–0.66 s; meshoptimizer simplify 1M → 100k 0.4 s.

R2 / B0 results (2026-10-18, `014e2f821`…`38e06b110`; decisions D9–D16; conformance `conformance/r2`):
- Polyhedral Boolean, union with a box: 2k 16.3 → 0.44 s, 5k 49 → 0.94 s, 20k 409 → 3.2 s. The 20k volume
  agrees with manifold-3d's to 0.02 mm³.
- Helical M8×30 bolt: mass 5.9 → 0.47 s; half-space cut 5.7 → 1.4 s; studio split 18 → 3.7 s; display 51k
  → 9.3k triangles.
- Sewing 1536 patches: 2.4 → 1.1 s.
- D16 (approved, done after R2): the helical thread is the default for new nodes; nodes without `form` stay
  faceted.
- Known (fixed in RB2, D19): the helical builder's direct output tessellated with 342 open edges by exact position. Faceted bolt split still fails (touching facets).

RB1 results (2026-10-18): `pnpm rb` in `packages/barocss-cad` ([robustness/README.md](../../../packages/barocss-cad/robustness/README.md)).
- First run over 9 conformance cases and 27 seed cases: all stages pass, except the re-imported countersunk
  plate STEP (duplicate face names, 18 open edges), which is a TODO.
- The broken meshes are refused with GEOMETRY, as their rb1 conformance cases require.

RB2 results (2026-10-18; D18, D19; conformance `rb2`):
- Tessellation corners are shared to the bit: the helical bolt goes from 342 open mesh edges to 0, with STL
  watertight (studio and kernel tests). On the pre-fix build, `pnpm rb` catches it as NEW.
- `checkBrep({ strict: true })` is the L0 validator. It runs in RB and conformance, and parts expose it as
  `output.validate()`.
- It found the all-edges fillet's corner patches 0.18–0.36 mm off their edges: TODO for R10.
- The countersunk STEP round trip (duplicate names, 18 open edges) stays TODO for RB3.

RB3 results (2026-10-18; D20, D21; conformance `rb3`):
- Surface area is exact: closed forms to 1e-12 (`brepSurfaceArea`, `output.surfaceArea()`).
- STEP files carry CAx-IF validation properties, which are read back and compared on import.
- RB checks the STEP round trip of every output: all within 1e-6, typically 1e-11.
- A STEP file's repeated names are numbered on import. The countersunk TODO is fixed: its plate had branched
  into two bodies in the seed.

RB4 results (2026-10-18; D23, D24): `pnpm rb:props` runs 8 properties × 200 cases (seed 20261018).
- Passing: inclusion–exclusion, commutativity, scale, knot insertion and degree elevation, fillet monotone and
  Lipschitz, quadrature against tessellation.
- Known (TODO): difference and rigid motion. Found along the way and fixed (D23): mass depended on where a body
  sits, and trims were left out of the quadrature.
- ~~Open: an upright cylinder minus a turned box encloses 6.8e-5 too little (the Boolean); its intersection
  integrates 8.7e-4 high; that body's centroid moves 9e-6 mm through STEP.~~ Fixed by D25.
  - The cause was not the Boolean: the trimmed faces' quadrature keyed its strips by vertex index.
  - Now 2e-10, 2e-11 and 5e-11 mm.
  - Both property TODOs pass.

Cylinder − turned-box fix (2026-10-18; D25, owner: before A1):
- Exact-oracle families are in the corpus (93 cases; `scripts/rb/oracle-*.mjs`): boxes turned about X, Y and Z,
  grazing placements and crossed cylinders. The "exact oracles" property covers them nightly.
- Found along the way and fixed:
  - sliver faces falling back to the coarse mesh;
  - 100 nm slivers refused as cavities;
  - sliver planes tilted in STEP;
  - a tessellation frame flipping at 45° (one face of crossed cylinders inside out).
- Left for RB5 (`robustness/todo.json`):
  - **First item:** the 1 nm graze returns an invalid body (534 mm³ against 253 mm³). A cut-face strict guard
    was tried and is not adopted: it refuses valid touching walls (D25).
  - Grazes within 3–30 tolerances refuse.
  - Two random 10 µm and 1 µm X-turned grazes refuse.
  - A 10 µm lens's mesh folds.

**Overnight summary (2026-10-18, under the owner's delegation; commits local, nothing pushed):**

| Step | Commits | Result |
|---|---|---|
| D25 — cylinder − turned-box defect | `2f1591d92` `7fcf3a06f` `948cd76e1` `b7a924fa7` `3f43c5aba` `b23800e71` | Not the Boolean but the trimmed-face quadrature. Now 2e-10; the STEP drift 9e-6 → 5e-11 mm; 93 oracle cases. |
| 1 nm graze guard | `604f78b0c` | Tried and not adopted: it refuses valid touching walls. RB5's first item. |
| A1.1, A1.1b — stable feature ids and body keys | `13e720230` `5625d829b` `cab16ec04` `9523d9a9b` | Schemas 2 and 3. |
| A1.2 — selectors | `e50baa9ad` `31c8af68c` | |
| A1.3 — re-match on edit | `2455c0a02` `7fd748b60` | |
| A1.3b — signatures | `bdc247ca1` `9a4611c11` | |
| A1.3c — references card, holds | `f10cc6a67` `8b919e96c` | |
| A1.4 — sketch-entity side names | `8ff632c6a` | Deferred: D31, R10a. |
| A2.1 — facts and inspect | `0c18974c7` `b56b8ba98` | |
| A2.2 — analysis tools, assumed mass | `4eda0269e` `5d61428b7` | |
| A2.3 — render_views PNG | `fa1b3313b` `84dc64919` | |
| A2.4 — response format | `4d651f316` `ca3ace65a` | |
| A3.1 — declarative requirements | `a798dce2b` `50091aada` | |
| A3.2 — mutants and policy | `e9b66afa0` `99801dd8b` | |
| A3.3 — panel | this step | |

Checks at the end:

| Suite | Result |
|---|---|
| kernel | all pass but the known environmental Node-version test |
| studio | 272/272 |
| browser flow | 105/105 |
| RB and props | 0 NEW |
| bench | within budget |

Pending decisions: none needing the owner. Deferred with plans: R10a (D31) and RB5's first item (D25).

Next: A4 (transactions and proposals).

**Current order (owner, 2026-10-18, all serial):** R1 ✓ → R2/B0 ✓ → RB1 ✓ → RB2 ✓ → RB3 ✓ → all-edge fillet corner ✓ (D22: a validator false positive at poles; geometry and names unchanged) → RB4 ✓ → cylinder − turned-box fix ✓ (D25) → **A1** (A1.1 stable feature ids ✓, A1.1b body keys by id ✓ D26; A1.2 selectors ✓ D27; A1.3 re-match on edit ✓ D28, A1.3b persisted signatures ✓ D29, A1.3c references shown and settled ✓ D30; A1.4 sketch-entity side names deferred, D31) → **A2** (A2.1 facts and inspect ✓ D32; A2.2 analysis tools ✓ D33, A2.3 render_views ✓ D34, A2.4 response format ✓ D35) → **A3** (A3.1 requirements and check_spec ✓ D36; A3.2 mutation check and iteration policy ✓ D37, A3.3 requirements panel ✓ D38) → **A4** → R3 … R14 → **A5–A8** → **RB5–RB9**.

**Robustness benchmark track (RB).** Every case is classified as OK, REFUSED (a typed reason, acceptable),
INVALID (fails L0), WRONG (valid but fails a metamorphic or oracle check), CRASH (uncaught exception or NaN),
TIMEOUT or TOL_BLOWUP. Reports give the pass rate per operation × category × input class with p50/p95 time,
one JSONL row per commit. Known failures carry OCCT-style TODO markers, so a fix shows as IMPROVEMENT.
- **RB1 harness**: `bench:mesh`'s per-fixture child process, SIGKILL timeout, crash capture and JSONL,
  generalised into a dataset runner (a directory of files → a worker pool). Adds the taxonomy, a trend file
  keyed by commit and file hash, and TODO/IMPROVEMENT markers.
- **RB2 L0 validator**: `checkBrep` gains edge-on-surface within tolerance (today only caught at
  `brep-tessellate.ts:684`), self-intersecting wires, sliver faces and a tolerance-growth cap. It runs on every
  result in tests. `importStep` validates as part of its result.
- **RB3 L1 round trip and GVP**: STEP export → import keeps volume, area, centroid and topology counts to about
  1e-6 relative. CAx-IF Geometric Validation Properties (volume, area, centroid, box) are written into exported
  STEP and read and compared on import. CAx-IF thresholds are the outer bound: volume/area < 1%, centroid
  < 0.1% of the box diagonal. A surface-area API (area exists only through the mesh today).
- **RB4 L3 metamorphic and property tests**: our own small harness with seeds and shrinking, no library.
  Properties: |A∪B| = |A| + |B| − |A∩B|; |A−B| + |A∩B| = |A|; ∪ and ∩ commute; invariance under exact
  rigid transforms (90° turns, power-of-two moves); volume × s³ under uniform scale; knot insertion and degree
  elevation keep mass; fillet volume monotone and Lipschitz in radius; exact and fine-tessellation mass
  converge. CI runs a fixed seed (~200 runs per property); nightly runs random seeds.
- After R14:
  - **RB5 L4 fuzz**: random CSG trees and chained operations, capped per operation. Degeneracy generators:
    coincident faces, ε offsets 0 and 1e-12–1e-6, tangent cylinders and spheres, vertex-on-face, near-seam.
    A fillet radius × edge length grid.
  - **RB6 CI corpus (~100 files) with goldens**: NIST MBE PMI, MFCAD++ (CC BY), FreeCAD-library STEP (CC-BY,
    attribution kept). Goldens are generated once with the existing OCP tooling
    (`packages/barocss-cad/scripts/exchange.mjs`) and committed as JSON; there is no live OCCT dependency.
    Compare volume, area, centroid, Betti/genus and validity, never face counts. A disagreement is a triage
    signal, not a verdict.
  - **RB7 STEP import hardening (L)**:
    - LENGTH_UNIT and conversion-based units: inch files come in 25.4× too big today;
    - UNCERTAINTY_MEASURE and per-entity tolerance, with light healing;
    - PCURVEs;
    - assemblies (NAUO, MAPPED_ITEM, CDSR transforms);
    - complex B-spline forms without `_WITH_KNOTS`: a TypeError at `step-import.ts:255/289` today; refuse
      first, then support;
    - OFFSET_SURFACE, SHELL_BASED_SURFACE_MODEL/OPEN_SHELL, POLYLINE/COMPOSITE/OFFSET_CURVE, VERTEX_LOOP;
    - closed or periodic B-spline faces with seams, and edges that need splitting (`:93`, `:479`).
  - **RB8 nightly ABC sweep**: 1–5k models fetched at run time and never committed, deduplicated with
    UV-Net-style filters, stratified by face count (10–30, 30–100, 100–500). Pass rates per stage (parse,
    validate, tessellate, Boolean, fillet, shell), compared with OCP goldens where available. No
    non-commercial datasets (Fusion 360 Gallery, Text2CAD, CAD-Recode) and no GrabCAD.
  - **RB9 AI scenario ladder**: 13 scenarios with acceptance predicates computed by our kernel:
    1. block with hole
    2. washer
    3. printed phone stand
    4. machined plate
    5. sheet-metal L-bracket
    6. load bracket (beam stress)
    7. bolted joint
    8. snap-fit box
    9. PCB enclosure
    10. sheet-metal PCB enclosure
    11. print-in-place toy
    12. 5-part assembly
    13. product from a brief

    Parameters are sampled per run; 5 trials per scenario on fresh documents; pass@k and pass^k;
    a Requirement Score; checks validated against mutants; no VLM in the score; the checker is hidden
    from the agent.

**AI collaboration track (A).** Owner, 2026-10-18: "AI 트랙 A1–A4는 RB1–RB4 바로 뒤에 넣고, A5–A8은 R14 뒤에 순서대로".
The goal is AI that designs and makes products, with several agents. Research behind it (peer session):
- Success depends on the execute → inspect → repair loop.
- Kernel checks decide pass or fail: executable checks agreed with human labels at 0.938, a VLM judge at 0.474.
  Renders are only a secondary check for gross shape.
- Repair gains fade after 2–3 attempts; restarting fresh does better.
- Multi-agent gains come from separating generation from an independent oracle. Splitting coupled sequential
  geometry loses 39–70%, and LLM reviewers affirm 85–92% of outputs, wrong ones included.

Chat baseline at `984872627`:
- Claude CLI with an MCP server of about 17 tools, at most 24 turns;
- text-only observation;
- index names such as `n1.top`, renumbered on delete;
- no dry run, one undo per turn, no viewport selection sent;
- image input only, single agent, chat not persisted;
- mass, interference and drawings are not exposed as tools.

- **A1 stable references**:
  - provenance IDs: `ext1.cap.end`, `ext1.side[sk1.l3]`, `fillet2.face[ext1.edge(…)]`, `hole1.wall`;
  - semantic selectors (`{feature, role}`, `{on, normal, pick}`), each resolved and returning its ID;
  - on rebuild, re-match by geometric signature; when ambiguous, fail with the candidates; never expose kernel
    indices;
  - migrate `n<i>.*` names with a version bump and a resolver for old documents (this also unblocks concurrent
    agents).
- **A2 observation tools**:
  - after every op, compact JSON facts: validity, solids, volume, mass, centroid, bbox, f/e/v counts and their
    change; detail on request (face type, area, normal or axis, radius, adjacency, the feature that made it);
  - tools for measure, mass properties, interference and clearance, section, wall thickness and draft;
  - `render_views`: 3–4 orthographic views plus isometric at 768–1000 px, with face-ID labels or colours
    (Set-of-Mark), a section view and a view of failures highlighted; rendered only at milestones or on
    failure, cached by model hash;
  - `response_format` concise or detailed, with pagination.
- **A3 requirements → executable checks**:
  - a brief record in the document, SysML-v2-like: id, quoted source text, type, subject, assume, require,
    value ± tolerance, hard or soft, assumed or ambiguous;
  - `check_spec` predicates written before modeling, as kernel queries over named features;
  - predicate suites validated against a trivial stub and mutated shapes, so always-passing tests are caught;
  - a verification report `{model_hash, summary, failures[{req_id, check, measured, expected, delta, entities,
    feature, hint}]}`, with passes as counts only;
  - iteration policy: up to 3 retries on execution errors; 3–4 repair rounds, stopping when the failing set
    stops shrinking; after 2 rounds without progress, restart fresh from the brief, the tests and the best
    snapshot; never accept a regression;
  - a requirement checklist panel per proposal; clicking a requirement highlights its geometry.
- **A4 transactions and proposals**:
  - `apply_ops` batches: all-or-nothing, `dryRun` returning the tree diff, mass delta and broken references,
    client opIds for idempotent retries, plus checkpoint, restore and diff;
  - proposals on a branch; a feature-tree diff (added, modified before → after, deleted, rebuild-broken);
  - a ghost preview with a before/after toggle and a volume-delta overlay;
  - per-feature, dependency-aware accept/reject plus "Revise…"; an approval becomes a named, revertible commit
    carrying agent, prompt, plan and requirement IDs;
  - autonomy L1 suggest, L2 propose (default), L3 auto-apply small edits within requirement bounds,
    L4 autopilot on a branch; assemblies, mates and drawings always need approval;
  - the viewport selection goes to chat as context chips; chat and design history persist in the document.
- After R14:
  - **A5 DSL and MCP**:
    - `run_script`: a compact TS-style DSL compiled to feature-JSON ops, never raw B-rep;
    - about 10–15 consolidated feature tools, with progressive schema disclosure (`describe_feature`);
    - one tool layer for the in-app chat and an external MCP server, with annotations and outputSchema;
    - an A/B test of JSON-only against the hybrid.
  - **A6 inputs**:
    - a brief template, with process and material required;
    - clarifying policy: ask only about blocking unknowns, in 1–2 batches of at most 5 questions; everything
      else becomes an editable assumption;
    - STEP or mesh as a locked reference body with datums and keep-outs;
    - images and drawings only produce drafts, and their dimensions are confirmed by the user;
    - standards data authored with provenance. No ISO/ANSI text in prompts or RAG, no GPL tables; legal
      review before release.
  - **A7 multi-agent v1**:
    - roles: Requirements; one Designer; a Verifier on a different or stronger model that sees only
      artifacts and requirements; a deterministic Integrator;
    - op patches submitted against a base revision hash, applied serially through gates: validity →
      interference/clearance → interfaces → DFM → analysis;
    - a full trace per patch;
    - compared with a single agent on the same token budget, logging cost per accepted design.
  - **A8 v2, then v3**:
    - v2: parallel read-only DFM and Analysis reviewers; a Drafting agent on a frozen revision;
    - v3: an Architect owning an `interfaces` section (datums, hole patterns, envelopes and keep-outs,
      budgets); Part agents in parallel against frozen contracts with leases; ECRs with impact analysis and
      human approval for contract changes; an Assembly integrator and a BOM agent;
    - per-role metrics such as Verifier precision and recall on seeded defects.

  RB9 measures this track end to end.

**Standing rule for every R and RB step (owner, 2026-10-18).** Each finished step leaves:
1. a short decision record in [`decisions.md`](decisions.md) (ADR-style);
2. conformance fixtures in `packages/barocss-cad/conformance/` (not published: outside the package's
   `files`). These are representative inputs (JSON part documents or STEP) with expected outputs (volume,
   area, centroid, topology/Betti, face and edge names, error codes, tolerances) in an
   implementation-independent format.

Purpose: a spec plus conformance suite, so a fresh implementation can be tried after the roadmap. The
fixtures double as RB goldens.

Ground rules as before: local only, small commits, no functions inside hot-path functions, tests + lint +
bench + a short studio flow, a changeset for published package changes, name/contract shifts reported, and
anything whose risk outweighs its value skipped with the reason.

## 5. Ways of working that held up

- One integrator merges every lane serially (`git merge --no-ff`, message `merge(cad-studio): …`), then runs
  unit + type-check + the browser flow (and the kernel suite when `packages/barocss-cad` changed) before the
  next merge. Lanes merge the integration tip into their branch before new work.
- Lanes keep logic in their own new files; shared files (`App.tsx`, `Viewport.tsx`, `engine/doc.ts`,
  `browser-flow.mjs`) get thin wiring only, and each lane adds flow steps at its own anchor.
- The QA tester never edits product code; findings are tagged `[sketch-constraints]`, `[assembly-mates]`,
  `[drawing]` or `[core]` and routed to the owning lane.
- Git identity `easylogic <cyberuls@gmail.com>`; commit trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  Read `AGENTS.md` (owner decisions) before merging anything into `develop` or touching root/workspace files.
- The owner prefers replies in Korean; code, commits and notes in English. cad-studio is the single app on
  the one `@barocss/gpu` viewer engine (old cad-editor/render-editor were folded in and deleted).

## 6. Starting prompt for the next account

> Continue cad-studio from `apps/cad-studio/handover/README.md` on branch `claude/cad-studio-2026-10-16`
> (worktree `.claude/worktrees/barocss-naver-team-17-cfd156`). Verify the tip with section 2 first, then ask
> me which open item in section 4 to take next.
