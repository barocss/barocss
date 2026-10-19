# cad-studio hand-over — 2026-10-16

Hand-over from the Claude account that ran the 2026-10-16 cad-studio work (organization NAVER_TEAM_17,
then the next one) to whoever continues it. Session transcripts do not move between accounts; this folder,
the git history and the QA report are the record. Everything is **local only**: nothing was pushed, no PR,
no npm publish.

## 0. Start here — hand-over of 2026-10-18 (read this section first)

The owner's usage ran out on 2026-10-18; work continues from another account. This section is current.
The sections after it are the older hand-over (2026-10-16/17), kept as history: where they disagree, this one wins.

### Where the work is
| What | Value |
|---|---|
| Branch | `review/cad-gpu-engine-2026-10-14` — **local only, never pushed; no PR, no publish** |
| Worktree | `.claude/worktrees/barocss-cad-gpu-review-efbb2c` |
| HEAD at hand-over | the commit that adds this section (`git log -1 -- apps/cad-studio/handover/README.md`); last code commit `2831d318a` (PERF3 A6) |
| Uncommitted, not ours | `REVIEW-2026-10-14-cad-gpu.md`, `review-drafts/`, `packages/barocss-gpu/src/engine-uv-material-wgsl.ts`, `.claude/`: the earlier review session's drafts — keep, do not commit or delete |
| Decision log | `handover/decisions.md`, D1–D95 (D82 = PERF3, with sections A1–A6; D84 = R8.3 and the owner's pipe clamp; D85 = R9 QEM decimation; D86 = R10a side ids; D87 = R10 S0; D88 = R10.1; D89 = R10.2a; D90 = R10.2b; D91 = mass on trimmed patches; D92 = R10.3a; D93 = R10.3b; D94 = R10.3c; D95 = R10.4a) |
| Conformance fixtures | `packages/barocss-cad/conformance/` (`r5/`, `r6/`, `r7/`, …; superseded cases carry `supersededBy`) and the RB corpus `packages/barocss-cad/corpus/` |
| Coordination hand-over | `handover/notes/coordination-2026-10-18.md`: the owner's coordinating session's direction and research decisions, the "why" (copied from `.claude/worktrees/amazing-euler-c18b94/HANDOVER-coordination-2026-10-18.md`) |

### Roadmap (serial, one implementation session), status
Done:
- R1–R7, RB1–RB4, A1–A4 (AI collaboration), R3–R6, R6a gears, LIB1–4, R6b, AM1–AM5.
- R8.1 cage operations (D80); R8.2a cage editor (D81); R8.2b the agent's cage tools and their browser-flow step (D83).
- **R8.3** (D84): the cage editor by hand end to end in the browser flow (extrude by Shift-drag, loop, crease, mirror, session undo, Done, document undo); the owner's acceptance part, a **SubD pipe clamp** (`handover/notes/acceptance/subd-pipe-clamp.png`), built by the agent's cage tools (43 calls, unit test and through the real chat) and its shape by hand in the editor; one body of genus 2, its SubD metrics, mass, STEP round trip and tessellation in the kernel's conformance case `r8/subd-pipe-clamp`. New: `subd-tube` primitive, `subd_insert_loop`'s `t`, the boundary query's box, a hole's rim by double-click, the editor ending its session when the part changes under it, a drag of nothing no step.
- **R10.2a** (D89): the rolling-ball fillet of any closed chain between two faces (a pipe tee, crossing rods, a rod through a cone): stations solved where the ball touches both faces, the tool lofted through their sections (C² cubic, patches breaking where the contacts cross seams), applied by the analytic Boolean told which tool faces touch the body only along their contacts (`contactFaces`). Forced on closed-form cases it matches them to 1.7e-7–2.8e-6 of the fillet; contacts within 2.5e-7 mm of their faces, G1 to 1e-4°; a report per fillet (`fillet` on the output). Refusals `CONTACT_LEAVES_FACE`, `APPROX_TOLERANCE_NOT_MET`; open general chains wait for R10.2b. Conformance `r10/general-*`; a flow step (pipe tee). The pipe clamp's B-rep lug: each edge by R10.1, the loop needs R10.3 (D89).
- **R10.2b** (D90): open chains of general edges — the tool runs past a convex end where the body ends (the junction marched past the edge, the Boolean trimming it) or is clipped by an oblique end face's plane; square ends, ends at curved or several faces and ends meeting another finished edge are refused (R10.3). R10.1's closed-form tools now end at an oblique end face as well (they stopped square: 0.6–1.5 % over). Contact cuts made once, as exact pieces of the tool's curves: the pipe tee 3109 → 82 edges, 1.8 s. Names across a radius edit settled (D89): face references stand, open-end edge references re-match. Conformance `r10/general-oblique-groove`, `translational-rod-across-oblique`, `plane-rib-oblique-ends`, `refuse-overflow-end`; a flow step (oblique groove).
- **R10.3a** (D92): the ball rolls round an edge at an inside corner — a box boss's whole foot, the pipe clamp's lug loop on its tube (the coordinator's case), an L-plate's inner corner under a rounded top — one tool for the chain, its corner a canal surface about the edge (a horn torus quarter on a plane), closed forms to 1e-8; rolling-ball chains mitred with another finished edge at convex corners of planes. A corner of three finished edges is refused `[VERTEX_BLEND_UNSUPPORTED]` (R10.3b). Conformance `r10/corner-*`, `refuse-vertex-blend`; a flow step (box boss).
- **Mass on trimmed patches** (D91): quadrature no longer declines where a fillet's mesh reaches its patch's edge (a derivative's stencil stepped off the domain) or where a revolved face is cut along a parameter line (zero-area slivers in its triangulation): 200 random cone-rim fillets all by quadrature (7 fell back before), the oblique groove too (its tessellated value was 9e-6 of the part high).
- **R10.3b** (D93): corners of three finished edges — all concave between planes (a pocket's corner) the ball's eighth, as convex ones had; the two ways round (a boss's uprights and foot, an L-plate's inner upright and top) in two passes in one feature, the odd one out first. Closed forms to 1e-10 (the pocket's to its corner patch's quadrature, 2e-4 of the fillet). More than three edges at a mixed corner refused. Conformance `r10/corner-pocket`, `corner-boss-uprights-and-foot`, `corner-l-plate-top-and-inner-upright`; a flow step (boss, 8 edges).
- **R10.3c** (D94): R10.1's closed-form fillets ending at a cylinder across the edge (a rod's feet at a round plate's rim) run past and are cut by it near that end — they stopped square, 1.7–6.5 % over; across a seam of the rim, or where the Boolean fails, square as before. A general fillet ending square on a plane, at a cylinder or at several faces stays refused: the analytic Boolean fails there (coplanar sections, coincident cylinders). Conformance `r10/translational-rod-across-disc`, `refuse-general-end-at-cylinder`; a flow step (rod on a disc).
- **R10.4a** (D95): overflow over smooth edges — the ball's contact running off a face onto a round already made rolls on over it; R10.1's closed forms no longer reach past a smooth edge onto another surface (a rounded boss's large foot fillet was 7.8 % over, silently) and hand such a chain to the rolling ball. Pappus to 9e-8. Conformance `r10/overflow-boss-rounded-top`; a flow step.
- **R10.1** (D88): fillets in closed form for straight edges between planes along them and cylinders whose axis runs along them (a rod on a plate, a groove's rim, a D shaft, parallel rods: the section solved with lines and circles, `fillet-section.ts`, extruded) and circular edges between surfaces of revolution about one axis (cylinder, cone, sphere, torus, planes square to it: the meridian solved and revolved; one half of a revolve's rim rounds the whole circle). Exact (volumes 1e-9–1e-10, surfaces 1e-12 from the ball's centre). Typed refusals `TANGENT_FACES`, `RADIUS_EXCEEDS_FACE`, `RADIUS_EXCEEDS_CURVATURE`, `NOT_ANALYTIC_PAIR`; the true face reach replaces `faceReach`. Conformance `r10/`; RB4 properties for both classes; a flow step. Chamfers of the new pairs: not yet.
- **R10 S0** (D87): R10.1's two closed-form classes hold on today's tool + analytic Boolean method — tools tangent to a cylinder (along a ruling, concave and convex) and to a cone (along a circle) go through exactly (1e-13, 1e-9); today's refusals and the `faceReach` defect (8.5 mm admitted on a 7.93 mm face) recorded in `test/r10-s0.test.mjs`. Verdict: R10.1 as the research note gives it.
- **R10a** (D86): stable sketch-entity side names — the kernel's `sideTags` honoured by every side-naming generator (`side[e3]`), the sketcher's ids kept through split, corner, trim and join with the constraints carried by them, sketches from before renamed once exactly on their first edit; command sketches stay positional (D16); conformance `r10a/`.
- **R9** (D85): our own QEM decimation (`decimateMesh`, kernel `decimate` feature, studio "Simplify mesh"): feature lines kept (open edges, regions/groups, creases when asked), no fold or broken manifold, faces keep their names, the distance measured both ways (`meshDistance`); 200k → 20k in 0.84 s, 1M → 100k in 4.8 s; conformance `r9/`.
- **PERF3 A1–A6** (D82): A1 `49c4da306`; A2 `818f92cef`; A3 `dfae081e1` and memo key `8ddb29262`; A4 `4e4e7017d`; A5 `bf02e4204`; A6 `2831d318a`.
- **PERF3 D18** (D82 § D18): bench budgets about 2× the latest values, Node and browser; all rows pass.
- **PERF3 D19** (D82 § D19): eleven new benches (plate and SubD torus mass, gear verdict and interfering report, library fits, STEP 200k read, F1 200k, F2 20k, orientation 100k, printability, 3MF 200k), budgets about 2×.
- **PERF3 B7** (D82 § B7): hover repaints only the faces whose state changed (`fillColors` ranges); plate hover 0.44 → 0.009 ms, 62 → 0.8 KiB; the hover now clears when the pointer leaves the canvas.
- **PERF3 B8** (D82 § B8): edge picks through a segment hierarchy (`nearestSegment`, the same answers as the walk); 120-hole plate 0.267 → 0.014 ms a pick.
- **PERF3 B9** (D82 § B9): mesh bodies' mass and area exactly from their triangles and loops, once per B-rep (`polyhedralIntegrals`); 40k planar mesh 355/651 → 70/73 ms, 200k facets 17 → 6 ms.
- **PERF3 B10** (D82 § B10): F2's exact Boolean skips a probe's second search where the first face misses it; axis-plane splits put cut points exactly on the plane (caps 156 faces → 4); F2 hole 20k 586 → 460 ms, 80k 1 192 → 872 ms.
- **PERF3 B11** (D82 § B11): mesh repair's edge adjacency and self-intersection grid in typed arrays (the same order), a plane-side rejection before the crossing test; 200k diagnose + repair 1 255 → 677 ms, results identical; `report.flipped` counts a triangle once (it double-counted).
- **PERF3 B12** (D82 § B12): worker replies send only meshes the client lacks (tokens per slot, `meshWire.ts`); face-table key without the whole JSON; a snapshot slot per purpose; clash probes ask volumes only; an edit beside a 200k mesh: worker 33 → 2 ms, 5.3 MiB → 0 sent.
- **PERF3 B13** (D82 § B13): recovery copy from per-node JSON (an edit beside a 200k inline mesh 36 → 0.8 ms; past the storage limit not tried); parameter rename copy-on-write; STEP meshes posted as typed arrays; STL weld 165 → 27 ms; uv and blob eviction measured, left (TODO).
- **PERF3 C14** (D82 § C14): the outline's mask search only in the outlined meshes' screen box (pixel-identical); its GPU cost at DPR 2 2.1–3.6 → 0.9–1.1 ms a frame; `bench:browser` orbit with a body outlined.
- **PERF3 C15** (D82 § C15): measured, no change — a 60-step handle drag in a production build: App re-renders 0.25 ms a move (1.6 ms script a move in all); the dev server's 16 ms a move is React's development JSX.
- **PERF3 C16** (D82 § C16, in parts): gears — the interfering report 5.8 → 1.17 s (stop at the first crossing, each point once, searches seeded; the same results), the sweep kept across face widths; SubD — the caps kept whatever the cage's extent (a top-raising drag 109–162 → 35–69 ms), the topology read from the mesh, `opposite()` counted; kernel — mass and area share one quadrature (plate STEP export 732 → 512 ms), an import's text out of the reuse keys (10 MB: 27 → 1 ms an edit), STEP tokens sticky; studio — cage overlay 3.6 → 1.5 ms a frame and its validation once a drag, render_views highlight 215–263 → 83–106 ms, library fit ends kept. Open items in `handover/notes/c16-review-findings.md`.
- **PERF3 C17** (D82 § C17): closures hoisted or written out on hot paths (rays, vertex normals, frustum planes, frame sorts, lights, vertex snap, display-edge mates now by face pair, SubD nets); the same results hashed; the AM4 wall-clock test given headroom.
- **PERF3 D20** (D82 § D20): RB trend and properties rows for HEAD (205 cases, 0 new, the 8 known TODOs); todo.json checked, unchanged. **PERF3 done.**

**Next, in this order:**
1. **R10.4b** (rolling onto a sharp edge, the cliff edge) → R10.5 → R11 general shell/offset → **R11b DXF writer** → R12 sheet metal → FR1–FR4 frames → **R12b** gears+ (internal, bevel, worm; including the R6a.6 trochoid root) → R12c machine elements → RM1–RM6 robot kinematics + RD1–RD3 actuator sizing → IM1–IM6 injection moulding + CNC1–CNC6 → R14 drawings → A5–A8 (DSL/MCP, inputs, multi-agent).
   - R10 / R11: design input `handover/notes/research-r10-r11-fillet-shell-2026-10-18.md` (stages R10.1–R10.5 taken as R10's order by its S0, D87; R11.1–R11.3 proposed).
   - A5 (DSL, one tool layer for the chat and an external MCP server): design input `handover/notes/research-cad-server-2026-10-18.md` (the owner, 2026-10-18: option 0 — order unchanged, the note kept as A5/A7 design input only).
   - A7 (multi-agent v1, the Integrator's op patches against a base revision): design input the same note.
2. Later stages: RD4–RD10, RM7–8, AM6–7, IM7–8, CNC7–8, FR5–6, DWG/SAT import.
   - PCB/ECAD: see `handover/notes/research-pcb-ecad-2026-10-19.md`, not scheduled; deferred by the owner (2026-10-19).
3. RB5–RB9.

Scope and acceptance per track: §4 below ("Mesh bodies and SubD roadmap", "Standard elements, manufacturing and robot tracks") and the coordination note.

### Standing rules
- Own TypeScript implementation: no WASM, no new runtime dependencies. External engines are reference or test oracle only.
- No functions inside functions on hot paths (per frame, per element, per sample): hoist them to module level.
- One serial implementation session; parallel agents only for read-only research.
- Every step:
  - a decision record (`decisions.md`);
  - tests and conformance fixtures;
  - lint, type-check and the affected benches;
  - a README row update;
  - a checkpoint (SHAs and numbers) to the coordinating session, if one is running.
- Name and contract changes are versioned, never silent: saved documents keep resolving (the D16 pattern, versioned nodes).
- A typed refusal rather than a wrong result. Never loosen a tolerance to pass. State accuracy honestly.
- Every SubD test checks shape metrics (cap Jacobian ratio, normal turn, deviation) and tessellates the body.
- Data provenance:
  - every library, material or standard value is sourced or flagged as an estimate;
  - no ISO/ANSI standard text;
  - no non-commercial or unclear-licence datasets;
  - vendor CAD is never bundled;
  - legal review before any release.
- Hard stops:
  - no push, PR, publish or release;
  - no deleting branches, worktrees or user files;
  - no touching other sessions' checkouts.
- Git identity: `easylogic <cyberuls@gmail.com>`. Commits end with the `Co-Authored-By` line. Replies to the owner in Korean; code, commits and peer messages in English.

### Owner decisions so far
- **Autonomy L2 = (b):**
  - value edits of one feature apply directly, and everything else is a proposal;
  - exception: the first build on an empty part applies directly;
  - assembly, mates, drawing and locked parts are always proposals (D41).
- **STEP caps:** 32 MiB B-rep, 128 MiB tessellated (D49).
- **Helical threads** by default; old documents keep faceted `.facetK` names through the node version.
- **F0 planar fallback** for mesh × mesh only, until F3.
- **Library data rules:** sourced or estimate-flagged values, no vendor CAD bundled, a licence needed to share, legal review before release.
- **Gears** follow barocss/barocss#2167.
- **Mesh body / SubD:** one B-rep body, a Parasolid-convergent subset F0–F2 plus SubD; Hunyuan3D is never in the pipeline (licence).

### Pending decisions (reversible defaults taken)
- **R8.2 / R8.3 split (D83):** the hand-over put "the browser-flow step" under R8.2, while the original R8 plan made R8.3 the browser flow.
  - Taken: R8.2's step is the agent's cage tools through the chat; R8.3 is the person's end-to-end cage edit (extrude, loop, crease, mirror, undo) with screenshots.
  - To change: say which, and the steps move.
- **Sketch side ids (D86):** command-made sketches (primitives, fasteners, library, the agent's features) stay positional (`side<k>`) until edited in the sketcher; ids read `e<k>`; constraints stay stored by index beside the ids.
  - To change: say so and command sketches get ids at creation (every new box's walls `side[e<k>]`), or constraints move to an id-keyed store.
  - The solver note's other stages (S1, S3–S6) and multi-entity sketches stay unscheduled: `handover/notes/research-sketch-solver-2026-10-18.md`.
- **"Attribute-aware" decimation (D85):** read as open boundaries, groups/regions and creases (meshes carry no normals, UVs or colours today).
  - Taken: those kept as feature lines; the `decimate` feature's creases from its regions (an angle only when asked).
  - To change: name the attributes (OBJ normals, UVs, colours) and they join the quadric.
- **The clamp's lug and hole (D84):** the coordinating session's message said the lug's plane is square to the tube's axis and the hole's axis parallel to it; the reference image shows the lug along the tube and the hole across it.
  - Taken: the image (the lug's plane holds the tube's axis, the hole square to it).
  - To change: the other reading is a lug from a ring of rim faces; say so and it is added as a second case.

### Open TODOs and known defects
- 1 nm graze gives a wrong body (RB TODO; `cylinder-box-graze-*` rows).
- Helical × helical Boolean is refused (`gear-helical-pair-crossing-intersect`).
- F2 at 1M positions: 3 of 8 holes.
- Crease and boundary-vertex caps deviate most from the limit; a warning past 0.2% of size (D78/D79).
- D79 boundary slivers: concave folds of 14–38° remain at cap boundaries (box3 18°, box6 38°; they were 51° and 180°). On the pipe clamp (D84) up to 88.6° between sliver triangles about 0.01 mm high inside exact patches along the rims' tight holding loops (held below 89° by its test; A5).
- The Selection panel's "Surface area" sums the tessellation's triangles: 0.11% under the exact area on the pipe clamp (11 007 against 11 019.5 mm²) (D84).
- 3MF: opening it in a slicer (PrusaSlicer or Bambu) is pending for the owner.
- εγ: pending (the coordinating session's open item).
- Blob eviction (PERF3 B13, not done): the blob store keeps every mesh blob of the session, in the studio and the worker. Safe eviction needs every holder — document, undo/redo, proposals, a pending repair, the chat's states, and the worker wire's sender (it assumes the worker keeps what it sent).
- Kernel suite: one environmental failure, `actual native Split source…`, which pins Node 22.23.3.
- **General fillets are slow** (D89, D90): the pipe tee is 1.8 s since contact cuts are made once (D90; it was 3–5 s), a rod through a cone was 11 s (30 patches); mostly the analytic Boolean. Candidates: fewer patches (a higher-order loft), the arrangement of many cuts.
- **Mass at a ball's corner** (D93): a corner blend's ball patch holds its pole, where the quadrature does not converge cleanly (up to 2e-4 of the corner's fillet; the convex box test holds 5e-5 of the part). A ball turned with its poles off the patch integrates exactly but trips the Boolean's march on some boxes. Next: exact integration of ball patches.
- **General fillet ends** (D90, D92, D94): a run-past end can keep a tiny edge (4e-4 mm on the oblique groove) where the end plane meets the tangent contacts. Square ends, ends at curved or several faces and mitres with curved faces are refused — the analytic Boolean fails with a tool face along a body face (coplanar sections, coincident cylinders across a seam): a Boolean robustness item. R10.1's tools at a cylinder end across a seam of it stop square (D94). Overflow is R10.4. Chamfers round inside corners still stop square.
- **Analytic Boolean, a tool tangent to a cone** (D88; `robustness/properties-todo.json`): for some coaxial cone-rim fillets (9 in 200 random, e.g. R 9, h 10, a 45° cone, r 1) the Boolean leaves a sliver of the body's seam edge and refuses the result ("not a manifold solid"); D87's hand-built tool too. Next: R10.2's contact pcurves or a seam-sliver repair. The `faceReach` upper bound (D87) is fixed: the true reach (D88).
- **Chat turn overwrites edits made during it** (confirmed by code reading, 2026-10-18; not fixed, the owner's decision): `ChatPanel.send` takes `base = props.base()` when the message is sent (`src/ui/ChatPanel.tsx:106`) and at the end commits the agent's whole document built on it (`:131` → `App.tsx:2042` `commit(next)`); nothing stops editing while a turn runs (`blocked` covers only an open sketch or command). Repro (not yet run): send a turn that takes a while and changes the part (e.g. a scripted run of many `subd_move` calls), add a box or change a parameter meanwhile; when the turn ends the box or value is gone. ⌘Z brings back the document with the edit, without the agent's change. Design input for the fix: `handover/notes/research-cad-server-2026-10-18.md` (merge the agent's ops onto the current document, or refuse/re-propose).
- The browser flow's chat steps take the first free port from 52091 up (`CAD_STUDIO_CHAT_PORT` overrides it): another tool's dev server on 52091 once failed them with EADDRINUSE (D86); fixed in the flow, D87.
- Kernel `B9 performance` (mass-polyhedral) asserts wall-clock times (40k planar mesh < 400 ms; 75 ms alone): it failed once at 417 ms with the studio suite running beside it (D84). Load-sensitive, as AM4's was; move it to the bench or give it headroom when next touched.

### How to run
§2 below has the setup. In short:
- Node 22 (`export PATH=$HOME/.nvm/versions/node/v22.19.0/bin:$PATH`). Node 18 breaks the gpu tests.
- `pnpm build:library` in `packages/barocss-cad` and `packages/barocss-gpu` before their tests and the studio (never bare `tsc` there).
- Studio: `pnpm test`, `pnpm type-check`, `pnpm bench` (Node benches with budgets), `pnpm bench:browser` (submits per frame; needs `CHROME`/`PW_DIR` as in §2), `pnpm test:browser` (the browser flow, `node test/browser-flow.mjs <out-dir>`).
- Kernel (`packages/barocss-cad`): `pnpm test`, `pnpm rb` (robustness bench; TODO rows are the known items above), `pnpm rb:props`, and the conformance suite `node --test test/conformance.test.mjs`.

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
- Sketch solver: 64 points, 64 segments and 128 constraints per outline (kernel profile `bounded-length-angle-v1`
  since `ced02dd39`; v0's 16 stays frozen); each placed circle still costs helper points ("Too many points…" past
  the limit). Scaling it: `handover/notes/research-sketch-solver-2026-10-18.md`.
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
9. **R9 — M4**: our own QEM decimation, attribute-aware, with a reported error. Done (D85).

Then the **AI mechanical parts track** (owner, 2026-10-18: serial, one implementation session, "그냥 순서대로
하는게 좋아"). For an AI to model anything the kernel must express it; mechanical parts and sheet metal are
most real demand, and fillet is the most used feature after extrude (today only plane/plane and
plane/cylinder edges, `edge-finish.ts`). Kernel breadth, robustness and automatic verification before UI.
An S0-style feasibility checkpoint before each large step (R10, R11, R12).
    **R10a — stable sketch-entity side names** (from A1.4, deferred in D31; before R10, whose fillets name sides). Done (D86):
    - segment ids in polygon and loop profiles, kept through vertex insertion, with the sketcher's
      constraints and dimensions keyed by them;
    - an optional `sideTags` on the kernel profile, used by every side-naming generator (prismatic, drafted,
      loft, revolve, part-model loops) for `side[tag]`;
    - a studio sketch node version 2 that sends the tags, with old nodes keeping `sideK` (D16);
    - conformance: a vertex inserted keeps every other side's name.
10. **R10 — general fillet and chamfer** (S0: D87; **R10.1 done, D88**: translational and coaxial fillets in closed form, typed refusals, the true face reach; **R10.2a done, D89**: the rolling-ball fillet of closed general chains; **R10.2b done, D90**: open chains, oblique ends; **R10.3a done, D92**: the ball round an edge at inside corners; **R10.3b done, D93**: three-edge corners; **R10.3c done, D94**: closed-form ends at cylinders; **R10.4a done, D95**: overflow over smooth edges) (on R2/B0): any edge incl. B-spline and cylinder/cylinder; constant
    radius, then variable; vertex blends and setbacks where three or more fillets meet; rolling-ball blends as
    exact NURBS approximations with a reported deviation; clear refusal codes (radius too large, degenerate).
11. **R11 — general shell and offset** for B-spline and facet faces: offset surfaces, then self-intersection
    trimming; failures diagnosed per face.
12. **R12 — sheet metal**: base flange from a sketch, edge flange, bend (radius, K-factor), reliefs, flat
    pattern, DXF export of it, bend table data in the part.
13. **R13 — automatic verification and DFM checks** (owner, 2026-10-18: replaced by the per-process tracks AM, IM
    and CNC below; kept as history) for AI loops: minimum wall thickness, tool access and
    moulding draft, hole/thread standards, intended versus actual dimensions; machine-readable reports in
    the existing diagnostic codes.
14. **R14 — automatic drawings**: view selection and layout, dimensions from feature intent, GD&T and
    tolerance suggestions.

### Standard elements, manufacturing and robot tracks (owner, 2026-10-18, relayed by the peer)

Owner's words: "기어 넣는건 니가 정해서 전달해줘" (the peer chose the place); "그러자" (standard elements);
"제조·로봇 트랙 배치안 그대로 엔진 리뷰 세션에 전달해줘" (manufacturing and robots).

**Order, all serial.** The per-process DFM tracks replace R13.

R6 (F2) → **R6a** gears → **LIB1–LIB4** library system → **R6b** enclosure elements → **AM1–AM5** → R7 SD2 → R8
SD3 → R9 decimation → R10a → R10 fillet → R11 shell → **R11b** DXF writer → R12 sheet metal → **FR1–FR4** → **R12b** gears+ → **R12c** machine elements →
**RM1–RM6 + RD1–RD3** → **IM1–IM6 + CNC1–CNC6** → R14 drawings (feeds CNC5 PMI) → A5–A8 → **RD4, RM7–RM8,
AM6–AM7, IM7–IM8, CNC7–CNC8, FR5–FR6, RD5–RD10, DWG/SAT import** → RB5–RB9.

**Common rules.**
- Every element follows the thread pattern:
  - a parametric generator;
  - meaningful face names;
  - mates and A3 check queries;
  - conformance fixtures with independent values;
  - typed refusals, with no silent approximation;
  - an S0 feasibility check before each larger item;
  - a decision record per sub-step.
- **Data.**
  - Standard dimension tables, and manufacturer or process data, are written by us with provenance; every value
    cites its source ID.
  - Never ISO or catalogue text, and never bundled vendor STEP or catalogue files. Flag the data for legal review
    before release.
  - Process rules are data in a process profile: a recommended level that warns, and a feasible level that errors.
- **Implementation.**
  - Our own only. TetGen, Gmsh, OpenCAMLib, KDL, V-HACD and CoACD may be read for reference, never linked or ported.
  - Robot joints, kinematics and sizing live in the studio and kernel, not in @barocss/physics (8 joints, ±90°, no
    certified loads; adding it to cad-studio is an Integration manifest change).
  - Units convert (mm·g·kg·mm²·deg ↔ m·kg·kg·m²·rad) at exactly one documented boundary.
  - Checks are A3 query functions, so agents get structured margins.

**R6a — gears.** Follows owner issue [#2167](https://github.com/barocss/barocss/issues/2167), whose terms take
precedence. The first brief also stands: reuse the helical machinery and the batched patch mass, and unblock RB9's
gear crank.
- **Stages:**
  - R6a.1, the MVP: an external, parallel-axis, straight-tooth involute spur gear at 20° and x = 0.
  - R6a.2: solid, bore and identity.
  - R6a.3: feature, UI, persistence and export.
  - R6a.4: pair checks.
  - R6a.5: profile shift and rack, then helical.
  - Last: tool-generated (trochoid) roots and manufacturing validation.
  - Until a stage lands, its input is refused with a diagnostic (x ≠ 0, other kinds); never approximated silently.
- **Root.** A root transition that is not tool-generated is marked schematic: `rootPolicy`,
  `ROOT_TRANSITION_UNVALIDATED`, `manufacturingValidated: false`. The involute is never extended below the base
  circle.
- **Contract fields.**
  - `toothThicknessReductionMM` per gear, at the reference circle.
  - Pair backlash = Δs1 + Δs2 at nominal centre distance. A changed centre distance recomputes the working pressure
    angle and the pitch circles.
  - `profileToleranceMM`, the involute fit error, apart from the render chord. It reports the measured maximum
    deviation from X(t) = rb(cos t + t sin t), Y(t) = rb(sin t − t cos t).
  - Over the segment, pole or time budget: `PROFILE_BUDGET_EXCEEDED`; never a looser tolerance or fewer teeth.
- **Diagnostics:** INVALID_INPUT, UNSUPPORTED_PROFILE_SHIFT, UNSUPPORTED_GEAR_KIND, PROFILE_BUDGET_EXCEEDED,
  SELF_INTERSECTION, ROOT_TRANSITION_UNVALIDATED, BORE_INTERSECTION, MATE_INCOMPATIBLE. A bore into the root or
  past a minimum rim margin is refused, with a rim value that does not claim strength.
- **Pair checks (R6a.4):**
  - the same module, pressure angle and system;
  - parallel axes, with face widths overlapping;
  - relative phase;
  - clearance and interference over the full rotation period, refined until converged;
  - contact ratio from the usable flank segment, apart from the ideal formula.
- **Oracle** (m 2, α 20°, x 0, z1 20, z2 40):
  - d = 40, db ≈ 37.5877048314, da = 44, df = 35 mm;
  - a = 60 mm, ratio −0.5;
  - ideal εα ≈ 1.6351859636.
  - Formula provenance: the KHK technical references cited in the issue, as textbook formulas.
- **Identity.** A change of tooth count changes topology; stale references go through A1.3's re-match or refusal.
- **First brief, kept where #2167 does not override:**
  - Face names `.flank#k`, `.tip`, `.root`, `.face0/1`, `.bore`.
  - Volume against a polygon-integrated exact profile; a STEP round trip; an RB seed.
  - A gear mate (ratio −z1/z2); A3 queries `gear_center_distance`, `gear_backlash` and `gear_contact_ratio`, plus
    swept interference.
  - A rotation preview; a Gear command and agent tool docs.
- **Not adopted:** the external solidcore.

**R6b — enclosure and 3D-printing elements** (AI scenarios 8, 9 and 13), each its own sub-step and decision record:
1. Screw boss with ribs and gussets, from fastener size. Checks: wall uniformity, and sink risk (rib ≤ 0.6 t).
2. Heat-set inserts and PCB standoffs (hole tables with provenance). Checks: fit, and alignment with a reference PCB
   STEP's hole pattern.
3. Cantilever snap-fit. Check: ε = 1.5·t·y/L² ≤ the material limit. An assumed material gives "unknown".
4. Enclosure lip and groove, and the split between the two halves. Checks: clearance and interference.
5. Vents and grilles (slots and hexes). Checks: minimum web and open-area ratio.
6. Living hinge: thickness and material (PP).
7. **Material library** (shared): density, E, yield, allowable strain and process suitability, with provenance. It
   ends assumed-material mass and strain wherever a material is set.

**AM — 3D printing** (sources: Xometry, Formlabs, Protolabs, Prusa, Bambu, the 3MF spec):
- AM1: process and printer profiles (FDM, SLA, SLS, MJF): wall, overhang, bridge, hole, fit gaps, escape holes,
  shrink and warp.
- AM2: overhang map per face and triangle, −n·b > sin θ against the build direction; bed faces excluded.
- AM3: rule checks: wall, hole, inter-body gap, enclosed cavity without a drain, bed fit.
- AM4: orientation search over Fibonacci directions and hull normals, scored on support area, height and contact.
  Support volume by downward rays through a BVH. Under 2 s at 100k triangles.
- AM5: 3MF export (items, transforms, base materials, colour groups, Production UUIDs), opening in PrusaSlicer and
  Bambu with the same pose and colours.
- Later: AM6 split with dowel or plug connectors; AM7 SDF voxel hollowing with drains, then lattices.

**FR — weldments and frames:**
- FR1: profiles (rectangular tube, angle, channel, 2020-class T-slot).
- FR2: members along 3D sketch segments, with alignment and roll.
- FR3: corners (miter, butt, coped, none) with per-corner override, an ordered trim for joints of 3+ members, and trim
  to a plane or body.
- FR4: cut list (profile, material, long-point length, angles, quantity, mass), identical members grouped, a drawing
  table.
- Later: FR5 T-slot hardware; FR6 gussets, end caps, weld metadata and symbols, stock nesting.

**RM — robot kinematics** (onshape-to-robot conventions; URDF and MJCF specs; Lynch and Park PoE; Buss DLS):
- RM1: mate graph to joint tree with a chosen base link.
  - Joints: revolute, continuous, prismatic, fixed; cylindrical and ball mates as chains of dummy links.
  - Limits, effort and velocity.
  - A redundant mate is reported as a loop, never dropped (today's solver refuses loops, mates.ts:192).
  - Gear mate (from D56, peer 2026-10-18): the assembly-level mate between gear instances is a coupled joint (URDF
    `mimic`, MJCF equality), its ratio −z1/z2, centre distance and phase taken from `checkPlacedSpurGears`.
- RM2: FK over a general joint tree, and a joint-slider preview. Planar 2R to 1e-9.
  - Gear preview (from D56): the animated rotation and joint preview land here; a gear pair turns together, the
    clearance verdict shown.
- RM3: link-frame inertia about the CoM, I_L = R·I·Rᵀ, checked against an analytic rotated off-origin cuboid; SPD
  and the triangle inequality.
- RM4: URDF export (child frame at the joint, meshes in the link frame, convex-hull collision, mm→m).
  - Accept: check_urdf passes.
  - Accept: MuJoCo/PyBullet mass, CoM and principal inertia within 1e-6.
  - Accept: FK equals MuJoCo xpos. MuJoCo is an external test tool only.
- RM5: MJCF export with the same checks; a 6R arm hangs under gravity stably.
- RM6: sampled collision sweep with a conservative-advancement bound (|Δp| ≤ Σ|Δqᵢ|·rᵢ), using the exact interference
  with a prefilter.
- Later:
  - RM7 DLS/LM IK: ≥99% of 1000 reachable targets, errors ≤1e-4 m and 1e-3 rad, a singularity flag.
  - RM8 four-bar loop (closed-form oracle, branch kept, MJCF equality).
  - RM9 SDF/USD, CCD, workspace map.

**RD — dynamics, actuators, FEA** (maxon and Harmonic Drive sizing; NAFEMS):
- RD1: static gravity torques; planar 2R and 3R closed forms to 1e-9.
- RD2: RNEA, trapezoid and S-curve profiles, RMS and peak torque. RNEA = M(q)q̈ + C + G over 100 random states.
- RD3: motor and reducer envelopes written from datasheets, and a selection solver:
  - τ_m = τ/(Nη) + J_m·N·q̈;
  - RMS ≤ continuous, peak ≤ peak;
  - the torque–speed envelope;
  - Harmonic Drive cube-mean torque and life;
  - inertia ratio ≤ 10.
  - It reproduces a published worked example.
- Later:
  - RD4 beam FEA and modal (cantilever δ, σ, f1–f3 within 0.5%).
  - RD5 our own tet mesher.
  - RD6 tet4 with Jacobi-PCG on workers.
  - RD7 tet10 (NAFEMS LE10 within 3% of 5.38 MPa, LE1 within 2% of 92.7 MPa).
  - RD8 solid modal.
  - RD9 harness v1.
  - RD10 an agent sizes a 3-DoF arm with every margin above zero (L3 evidence).

**IM — injection moulding and casting** (Protolabs, Fictiv, Stratasys, LyondellBasell, Dynacast, Engineers Edge):
- IM1: process rule (material wall range and shrink, pull direction, finish to minimum draft).
- IM2: draft field on curved faces, with steep and straddle classification (isocline n·d = 0).
- IM3: undercuts by ±d ray visibility.
- IM4: wall uniformity, rib ≤ 0.6 t, boss rules, inside radius ≥ 0.5 t, sink risk.
- IM5: parting line from silhouette loops, straddle-face split, manual override.
- IM6: quote package.
- Later: IM7 shut-offs, parting surface, core and cavity, side cores; IM8 casting presets, allowances, section and
  solidification checks.

**CNC — machining** (Hubs, Protolabs, Fictiv, DFMXpress, Fusion inspect tools, CAx-IF PMI v4.1):
- CNC1: process profile (metal or plastic, ISO 2768 class), with warn and error levels.
- CNC2: standard holes and threads (clearance, tap drill, thread depth, runout, counterbores, cosmetic threads,
  callouts).
- CNC3: concave radius against tool radius, pocket depth, walls, hole depth, text stroke.
- CNC4: six-direction ray accessibility, undercut flag, greedy setup count, envelope.
- CNC5: drawing and PMI minimum: views, hole callouts, datums, tolerance note, material, Ra; AP242 semantic PMI that
  survives a round trip.
- CNC6: turning: axisymmetry, grooves, thread relief, L/D.
- Later: CNC7 feature recognition and stock export; CNC8 an optional 2.5D CAM preview marked "not for production"; no
  production G-code.

**R12b — internal, bevel and worm gears**, and the tool-generated (trochoid) root moved here from R6a.6 (peer, 2026-10-18, D60): the envelope of a basic-rack tip of radius ρ (a parameter, 0.38 m by default), checked against the textbook form-circle radius and against the rack never cutting the generated root.

**R12c — machine and power-transmission elements**, in order:
1. Springs via the helical sweep (rate k = Gd⁴/(8D³n), solid height, stress).
2. Fits and tolerances (ISO 286-style classes) as attributes feeding clearance checks.
3. Shafts: steps, keys and keyways, retaining rings and grooves, pins and dowels.
4. Bearing envelopes with housing and shaft seats.
5. O-ring grooves by compression ratio.
6. Pulleys and timing belts, sprockets and chain, couplings, cams and followers, linkages, hinges.
7. Standard profiles (2020 extrusion, structural shapes) and connector envelopes (USB-C, etc.).

**Library system (owner, 2026-10-18: "좋아 라이브러리 시스템을 전달하자").** LIB1–LIB4 go right after R6a, before R6b.
- **Model.** The kernel holds what needs new geometry or maths: B-rep, Booleans, fillet, SubD, gears, threads,
  springs. Catalogue parts that compose existing features come from loadable libraries.
  - Reference structure only: the FreeCAD extrusion library (LGPL; not copied).
  - Parts are built from tables of functional dimensions; every value has a source or is flagged as an estimate;
    simplified internals say "not for structural calculation"; tests build every part and check fits.
- LIB1: a declarative library format and loader. Pure data: a manifest, and parts made of a parameter table (source
  and estimated), a recipe of existing part-model features with a small safe expression language, metadata and named
  interfaces. Validated on load, with typed refusals.
- LIB2: interfaces and placement. Named mating interfaces with roles; snapping one onto a face or interface makes real
  mates; fit checks of the declared pairs are part of the library's own tests.
- LIB3: insertion and document independence. An inserted part becomes ordinary features carrying `library: {id,
  version, part, params}`; it opens without the library; with it, it regenerates; versions go through A1.3; estimates
  are warned on the body.
- LIB4: a browser panel, built-in, team and user libraries, and agent tools `list_library` / `insert_part`. Agents may
  author entries as data, validated by LIB1 and LIB2.
- **Acceptance:** a built-in "T-slot 20 series" library (20×20 to 20×40 with 1–4 open slots, M5 slot nut, angle
  bracket, end cap) from data; fit tests pass; insert, save and reopen without the library give the same bodies; an
  agent lists and inserts a part and snaps a nut into a slot.
- **After it,** R6b, much of R12c and FR are built as library items where they can be (profiles, nuts, brackets, end
  caps, inserts, standoffs, bearing, motor and connector envelopes, keys, retaining rings). Gears, threads, springs
  and sheet-metal unfolding stay kernel work.

**DXF and AutoCAD interoperability (owner, 2026-10-18: "acadrust 활용안 그대로 … DXF 쓰기는 R12 앞에, DWG/SAT 가져오기는
후반에").** acadrust (Rust, MPL-2.0, v0.6, 2026) is not a product dependency: it would need WASM and is young. It is
read for the formats only, never copied or ported, and may serve as a test-only oracle in tooling (else ezdxf, MIT,
recorded).
- **R11b, a DXF writer** (our own code; right before R12).
  - ASCII DXF AC1015 by default, with an R12 option; $INSUNITS.
  - Entities: LINE, ARC, CIRCLE, LWPOLYLINE with bulges, SPLINE, TEXT/MTEXT, DIMENSION with its block,
    INSERT/BLOCK, HATCH, with layers and line types from the drawing.
  - Sources: drawing sheets; later R12 flat patterns (bend lines on their own layer) and FR4 cut lists.
  - Tests: an oracle round trip (entity types and counts, coordinates to 1e-9 mm, arcs and bulges, layers, units); a
    free viewer opening it without warnings (L1 by hand); conformance for a plate drawing and a flat pattern.
- **Late (after A5–A8, before RB5–RB9), DWG/SAT import.** DWG R2000–R2018+ 2D entities as a drawing or underlay; ACIS
  SAT/SAB solids into our B-rep through the STEP import's tolerance and validation gate; optionally DWG writing of
  drawings. Only after an S0 that weighs demand against effort, recorded either way.

**AI scenario ladder.** A new rung, the "2-axis robot arm": joints, reducer, reach check, and a URDF that loads in
MuJoCo with matching inertia.

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
  - Two crossing helical gears (twisted × twisted B-spline flanks): the intersection is refused as not a manifold (D60). Keyways, slots and holes on helical gears pass.

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
| A1.4 — sketch-entity side names | `8ff632c6a` | Deferred: D31; done as R10a (D86). |
| A2.1 — facts and inspect | `0c18974c7` `b56b8ba98` | |
| A2.2 — analysis tools, assumed mass | `4eda0269e` `5d61428b7` | |
| A2.3 — render_views PNG | `fa1b3313b` `84dc64919` | |
| A2.4 — response format | `4d651f316` `ca3ace65a` | |
| A3.1 — declarative requirements | `a798dce2b` `50091aada` | |
| A3.2 — mutants and policy | `e9b66afa0` `99801dd8b` | |
| A3.3 — panel | `ce24750eb` `48a0f2c78` | |
| A4.1 — transactions, field registry | `deb9283ca` `2381f66f4` `7f121134b` | |
| A4.2 — proposals, design history | `802ed22be` | Fixed D39's carry-over leak (a new or opened part inherited the old one's history and looks). |
| A4.3 — rebase before accept, partial accept, autonomy, chips | `47df11eb1` `9fcdac730` | Stale proposals are never accepted blind; assembly, mate, drawing and locked-part changes only through proposals (peer's decisions). |
| R3.1 — F0 facet faces | `1ec8f4d8f` `79c74f8f2` | 200k: convert 10.5 s → 0.2 s; 1M: 1.3 s, 845 MB. Pieces as bodies; Booleans previewed to 5k, committed to 16k (D43). |
| R3.2 — BVH point classification | `9b57d5f4e` | 1000 points at 1M: 6.9 ms. The 18k mesh hole: 10.8 → 4.1 s (stitch and coplanar merge indexed). |
| R3.3 — M1 container | `4c8e19b4e` `454747f5f` | SHA-256 blobs; 1M file 17.2 MB (55 MB as inline JSON); chat sends blobs once; cap 2M. |
| R3.4 — M3 repair | `14aca6bea` `f1f267b00` | Diagnose and repair as a recorded step; Liepa fill; sheets; crossings refused; the gate in the worker. |
| R3.5 — AP242 tessellated STEP | `2234bfdb3` | 1M: 49.9 MB tessellated (planar refused past 250k); mixed files; mesh-only STEP through the gate. |
| D49 — STEP size caps | `daa9b0989` `737d64196` | 32 MiB outside meshes; tessellated up to 128 MiB (owner); 2M opens in the studio in 11.2 s, renderer peak 3.06 GB. |
| D41 — L2 is option (b) (owner) | `737d64196` `1b9049a66` | Value edits of one feature apply with an Undo toast; the rest is a proposal; the first build on an empty part applies. Tested through the real chat and tool servers. |
| R4 — F1 facet × plane split and section | `d571d6f2d` `c2e79c1b9` | Any size, exact planar cap; 1M in 2.0 s. Oblique splits of planar bodies had always failed: fixed. RB round trip of meshes checked tessellated. |
| R5 — SD1 SubD cage | `235c6a422` `80defded1` | Regular cages exact (Catmull–Clark step agrees to 1e-12); creases, boundaries, corners; SubD torus command; batched patch mass 3.9 → 0.22 s at 20k quads. |
| R6 — F2 mesh × exact Booleans | `5f3a01486` | Mesh near the tool alone through the exact Boolean, tool faces exact; holes on 30k meshes in 0.64 s; mixed bodies go on; mass of mixed bodies fixed; weld across cell boundaries fixed. Dense symmetric cases refused (analytic Boolean limit, TODO). |
| R6a.1–2 — involute spur gear (#2167) | `46973ef7c` | The oracle to 1e-9; flanks C1 cubic pieces with the deviation measured; solid and bore; typed refusals (D53). |
| R6a.3 — gear feature and command | `e48e9d098` | Persisted with `spur-gear@0`; its report in the body's panel; conformance and RB seeds (D54). |
| R6a.4a — pair checks | `95b5c1208` `9bada0cb9` | Working geometry, backlash, usable contact ratio, a converged sweep over the tooth period, each against an independent formula; verdict mode 185 ms clean, cached 0 ms (D55). |
| R6a.4b — meshing gears | `d02bb2cca` `6edc1e6ee` | A gear placed and turned by the one it meshes with; the pair's verdict in the panel; gear queries for requirements; the exact Boolean of a meshed pair is empty (D56). |
| R6a.5a — profile shift | `a0d1cf3ce` | x −0.5 to 1; the working centre distance by inv α_w; KHK's shifted pair to 1e-4, the sweep touching at it (D57). |
| R6a.5b — rack | `eea43ab1e` | The basic rack on a bar; gear-and-rack checks against independent formulas; a rack meshing with a gear, travelling with its turn; the exact Boolean of the pair empty (D58). |
| R6a.5c — helical gears | `75c3c5171` | Normal module, β, hand; the transverse involute turned along the helix (fit measured, axial segments); KHK's helical pair; εα + εβ = εγ; the solids' own sections clear when meshed (D59). |
| R6a.5c — helical rack | `29e290c71` | The z → ∞ gear: β, the opposite hand derived; a sheared prism, exact; sections clear when meshed, crossing slid or of the same hand (D60). Trochoid root moved to R12b. |
| LIB1 — library format and loader | `a098334d4` | Data only: sourced or estimated parameters, variants, recipes of part-model features with a safe expression language, typed refusals, instantiation with origin and warnings (D61). |
| LIB2–LIB3 — interfaces, fits, library nodes | `697be24a0` | Exact placement by facing frames; fits checked by building (overlap and contact); snapping with real mates; library parts kept with the document and regenerated; the T-slot 20 series as data (D62–D63). |
| LIB4 — panel, team and user libraries, agent tools | `89a9f5b3b` | Licence required to share, estimates counted, a check kept beside each shared library, no imported models, agents' libraries marked until confirmed; list/insert/snap/add tools; acceptance met (D64). |
| R6b.1 — checks with context, add to body, screw boss | `3369324aa` | Rules as data (recommended warns, feasible refuses, unknown without context); a library part added to a body as one honest step; the screw boss M2–M5 with gussets (D65). |
| R6b.2 — insert holes, PCB standoffs, hole alignment | `c6f38e6df` | Cut library parts; depth and material round a hole measured; a board's STEP holes against the standoffs' axes (D66). |
| R6b.7 — materials and process profiles | `1449c6f68` | 13 materials (E, yield, allowable strain, shrink, walls) and three process profiles, every value sourced; checks read the body's material and the part's process, unknown when unset (D67). |
| R6b.3 — cantilever snap hook and ledge | `a76087166` | Tapered-beam strain derived (checked by integration to 1e-9), push-on and pull-off forces, FDM print-plane rule, a declared hook-on-ledge fit with engagement (D68). |
| R6b.4 — enclosure halves, lip and groove | `87a8d3a59` | Base and lid as library parts; the lid-on-base fit checks interference and contact; clearance against the process (D69). |
| R6b.5 — vents and grilles | `abb9e75b7` | Slots and staggered hexagons cut as deep as the wall; webs against the process; open ratio reported (D70). |
| R6b.6 — living hinge | `478ae15d6` | A thinning groove; thickness and strain against polypropylene's values; other materials not hinge materials (unknown); R6b closed (D71). |
| AM1 — process and printer profiles | `346f72b9f` | SLS and MJF; printing thresholds (wall, overhang, bridge, hole, gap, escape holes, horizontal hole) sourced; warp risk; five generic printers (D72). |
| AM2 — overhang map | `23cf547a9` | Exact normals for planar faces, triangles for curved ones (approximate, said); bed left out; overhang_area query; viewport overhang look (D73). |
| AM3 — printability rules | (see git log) | Wall, hole, horizontal hole, gap, cavity, bed fit, overhang, warp and tip, each with status, value, limit and source; unknown and n/a said (D74). |
| AM4 — print orientation | (see git log) | Fibonacci and face-down candidates, normalised terms with the profile's weights, support by rays through a triangle tree, deterministic top three; `orient_for_print`; cavities by B-rep shells (D75). |
| AM5 — 3MF export | (see git log) | Own ZIP and CRC-32, CompressionStream deflate; welded objects, base materials, face colours (base or colour group), Production UUIDs, items turned and set on the bed by the print direction; Export 3MF button (D76). |
| Stale results | (see git log) | Bodies tagged with the document they were computed for; while stale, no names, values, checks or exports paired with the new document (D77). |
| R7 — SD2 caps | (see git log) | Extraordinary vertices, n-gons and darts: one or two Catmull–Clark steps, exact B-spline away from them, G1 caps (double knots at ¼, α C1 at the knot — an earlier kink folded them) fitted to the limit within exact G1 conditions; `subdReport` measures G1, gaps, folds and deviation; boundary vertices the weak spot (TODO); SubD box command (D78). |
| D79 — SubD shading and caps shown | (see git log) | Display normals the surfaces' own; tilting edge chords split (51° dents gone); caps' deviation in body notes, warned past 0.2% at crease/boundary vertices; `subd_deviation` A3 query (D79). |
| R8.1 — SD3 cage operations | (see git log) | `@barocss/cad` subd-cage: topology, validation, loop/ring, move, extrude faces and edges, insert loop, delete, fill, bridge, weld, crease, mirror (D80). |

Checks at the end:

| Suite | Result |
|---|---|
| kernel | 955/956 (the known environmental demo-spawn test) |
| studio | 300/300 |
| browser flow | 114 steps: a full run 113/114; the one failure read the panel before it changed, fixed and rerun with its neighbours |
| RB and props | 0 NEW |
| bench | within budget |

Pending decisions (reversible defaults taken):
- A placed part with a source file counts as locked (D40).

Decided by the owner (2026-10-18): L2 is option (b), value edits of one feature applied directly and everything
else a proposal, the first build on an empty part applied directly (D41); STEP caps 32 MiB B-rep / 128 MiB tessellated (D49).

Settled by the peer's override: changes to assemblies, mates, drawings and locked parts go through proposals at
every level (D41). Deferred with plans: R10a (D31), RB5's first item (D25), a two-colour added/removed material overlay for proposals (D40).

Next: see §0 (PERF3 done, D82; R8.2b done: D83; R8.3 and the pipe clamp done: D84; R9 done: D85; R10a done: D86; R10 S0 done: D87; R10.1 done: D88; R10.2a done: D89; R10.2b done: D90; R10.3a done: D92; R10.3b done: D93; R10.3c done: D94; R10.4a done: D95; R10.4b next) (R8.2a done: D81; R8.1 done: D80; R7 done: D78; AM1–AM5 done: D72–D76; R6b done: D65–D71; LIB1–LIB4 done: D61–D64; R6a done: D53–D60; the trochoid root moved to R12b, manufacturing validation pending; R6 done: D52; R5 done: D51; R4 done: D50; R3 done: D42–D49).

**Current order (owner, 2026-10-18, all serial):** R1 ✓ → R2/B0 ✓ → RB1 ✓ → RB2 ✓ → RB3 ✓ → all-edge fillet corner ✓ (D22: a validator false positive at poles; geometry and names unchanged) → RB4 ✓ → cylinder − turned-box fix ✓ (D25) → **A1** (A1.1 stable feature ids ✓, A1.1b body keys by id ✓ D26; A1.2 selectors ✓ D27; A1.3 re-match on edit ✓ D28, A1.3b persisted signatures ✓ D29, A1.3c references shown and settled ✓ D30; A1.4 sketch-entity side names deferred, D31) → **A2** (A2.1 facts and inspect ✓ D32; A2.2 analysis tools ✓ D33, A2.3 render_views ✓ D34, A2.4 response format ✓ D35) → **A3** (A3.1 requirements and check_spec ✓ D36; A3.2 mutation check and iteration policy ✓ D37, A3.3 requirements panel ✓ D38) → **A4** (A4.1 transactions and field registry ✓ D39; A4.2 proposals and history ✓ D40; A4.3 rebase, partial accept, autonomy, chips ✓ D41) → **R3** (R3.1 facet faces ✓ D42; R3.2 BVH containment ✓ D43; R3.3 M1 binary blob ✓ D44–D45 (cap 2M); R3.4 M3 repair ✓ D46–D47; R3.5 AP242 tessellated ✓ D48; STEP size caps D49) → **R4** (F1 facet × plane split and section ✓ D50; oblique split of planar bodies fixed) → **R5** (SD1 SubD cage node, regular regions exact ✓ D51) → **R6** (F2 mesh × exact Booleans ✓ D52) → **R6a** (R6a.1–2 spur gear ✓ D53; R6a.3 feature and command ✓ D54; R6a.4a pair checks ✓ D55; R6a.4b meshing gears ✓ D56; R6a.5a profile shift ✓ D57; R6a.5b rack ✓ D58; R6a.5c helical ✓ D59, helical rack ✓ D60; trochoid root → R12b; manufacturing validation pending) → **LIB** (LIB1 format and loader ✓ D61; LIB2 interfaces and fits ✓ D62; LIB3 library nodes ✓ D63; LIB4 panel, sharing rules, agent tools ✓ D64) → **R6b** (R6b.1 screw boss ✓ D65; R6b.2 inserts, standoffs, alignment ✓ D66; R6b.7 materials and process profiles ✓ D67; R6b.3 snap hook ✓ D68; R6b.4 lip and groove ✓ D69; R6b.5 vents ✓ D70; R6b.6 living hinge ✓ D71) → **AM** (AM1 profiles ✓ D72; AM2 overhang map ✓ D73; AM3 rules ✓ D74; AM4 orientation ✓ D75; AM5 3MF ✓ D76) → **R7** (SD2 caps ✓ D78) → **R8** (SD3: R8.1 cage operations ✓ D80; R8.2a editor ✓ D81; PERF3 ✓ D82; R8.2b agent tools ✓ D83; R8.3 end to end and the owner's pipe clamp ✓ D84) → **R9** (QEM decimation ✓ D85) → **R10a** (side ids ✓ D86) → **R10** (S0 ✓ D87; R10.1 ✓ D88; R10.2a ✓ D89; R10.2b ✓ D90; R10.3a ✓ D92; R10.3b ✓ D93; R10.3c ✓ D94; R10.4a ✓ D95; R10.4b next) → … (the full order: "Standard elements, manufacturing and robot tracks" above) → **A5–A8** → **RB5–RB9**.

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
