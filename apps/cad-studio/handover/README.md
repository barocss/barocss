# cad-studio hand-over — 2026-10-16

Hand-over from the Claude account that ran the 2026-10-16 cad-studio work (organization NAVER_TEAM_17,
then the next one) to whoever continues it. Session transcripts do not move between accounts; this folder,
the git history and the QA report are the record. Everything is **local only**: nothing was pushed, no PR,
no npm publish.

## 0. Start here — hand-over of 2026-10-18 (read this section first)

### Kernel lane: hand-over at the FR → R12b boundary (2026-10-20) — read this block first

The kernel lane goes on in a new session at each track boundary (the owner, 2026-10-19). This block is that hand-over.
FR1–FR4 frames and weldments are complete (D122–D128). The next kernel session starts **R12b gears+**: internal, bevel
and worm gears, and the trochoid root moved there from R6a.6. The R12 → FR block below is kept as history.

**State**
- Branch `review/cad-gpu-engine-2026-10-14` (the integration branch, local only). The tip is the FR4b commit, which adds this block, followed by its RB-rows commit (`git log -2`). The coordinator merges the outer lane into this branch between steps.
- FR is done:
  - S0 (D122): members are exact as extrusions of a section square to any 3D segment. Mitres, butts and copes are exact by planes and Booleans. The stages and what is not in FR are frozen. Owner: section sizes are loaded by the user, not built in.
  - FR1 (D123): `frame-section.ts` sections (rectangular tube sharp or round-cornered, angle, channel, flat bar, round tube, 2020-class T-slot, a sketch's closed profile) and the `frame-member` kind. Area, centroid and inertia are in closed form. A tube's inner radius is ro − t, a derived rule said so (`derived`). The studio's Structural member command flags its prefilled sizes as estimates.
  - FR2 (D124): `frame` on a skeleton (points and segments; the palette's rectangle, table and box), its anchor, offset, the up rule with its +X fallback, roll (quarter turns exact) and mirror.
  - FR3a (D125): two-member corners (mitre, butt, none; per-corner overrides) and the planar route's fix. A Boolean coplanar only to binary64 goes to the analytic route.
  - FR3b (D126): ordered trims for joints of 3+ members, against the trimmed envelopes; copes; T-joints; trims to a plane or a body; MEMBERS_CLASH. Hardening: the fallback dispatches on the typed `NOT_PLANAR_WITHIN_FLOAT`, and a butt onto an open side is refused (`BUTT_ON_OPEN_SIDE`).
  - FR4a (D127): the cut list (`frame-cutlist.ts`: `cutPiece`, `cutList`, `cutListCsv`), the studio's dialog and CSV, and the agent's `cut_list`.
  - FR4b (D128): the cut list as a drawing table (`cut-list` source, a "Cut list" checkbox). Acceptance: a welded table frame and a 2020 T-slot frame, each built by the agent's tools in one turn, by closed forms. Conformance `fr/accept-*`, a flow step through the real chat.
- **The frame model now:**
  - Kernel: `frame-section.ts` (sections and their reports), `frame-cutlist.ts`, and the `frame-member` and `frame` kinds with their planner in `part-model.ts`. A member's output carries its `member` report (line, axes, ends).
  - Studio: `frameCommands.ts` (Structural member, Frame on a skeleton), `cutList.ts`, `CutListDialog.tsx`, the edit fields, and the two node kinds in the agent's `add_features`.
  - Refusals are listed in D123–D127.
- Checks at the FR4b commit:

  | Check | Result |
  |---|---|
  | Kernel | 1290/1295 (4 skipped); only "actual native Split source…" fails, an environment failure |
  | Conformance | 174/174 |
  | Studio | 643/643 |
  | Full browser flow, run on its own | 188/188 |
  | RB | 316 cases (+2: the accept cases), 0 new, the 8 known TODOs |
  | Properties | 11/11, no failures |

- The tree is clean, apart from the earlier review session's untracked drafts (see "Where the work is").

**For the owner: not in FR** (D122's list, plus what FR left; place them on the roadmap or drop them)
- **A 3D sketch in the viewport.** Skeletons are points and segments typed in the panel or given by the agent, or the palette's three shapes. There is no drawing them in 3D, and no constraints (D122).
- **Shared skeletons.** One skeleton does not drive several frames, and a frame cannot follow another part's sketch.
- **Members along arcs** (bent or curved members, D122). Members are straight segments only.
- **The 7.5 s round-cornered ordered trim** (D126). It runs in the engine worker and the studio stays live. Candidates: envelopes shared across a joint, cheaper envelopes, the analytic Boolean's speed.
- From D122's list:
  - FR5: T-slot hardware;
  - FR6: gussets, end caps, weld beads, weld metadata and symbols, stock nesting;
  - tapered-flange channels and beams (I/H);
  - end gaps for welds, and notches for tube-to-tube saddles other than a full cope.
- Left by FR:
  - a user's section library and an editor for it (nothing is built in, by the owner's rule);
  - the drawing's cut list on A4 (D128, the outer lane's placement): the 166 mm table is auto-placed over the right view's name, with no fix. A3 is clean.
- **Decided (the owner, 2026-10-20, D122):** "프레임 단면 치수도 굽힘표처럼 내장하지 말고 사용자가 불러오게 해." (Don't build in frame section sizes either; let users load them, as with bend tables.) The studio's prefills stay flagged as estimates.

**What R12b (gears+) needs**
- **Scope**, §4 "R12b": internal, bevel and worm gears, and the tool-generated (trochoid) root. The root is the envelope of a basic-rack tip of radius ρ (0.38 m by default), checked against the textbook form-circle radius and against the rack never cutting the generated root (D60).
- No research note for R12b yet. Run an S0-style feasibility checkpoint first, as R10, R11, R12 and FR did.
- **Data:** the same sourcing rule as bend tables and sections. No standard text (ISO/ANSI/AGMA) copied; derived formulas are said so; values are a named public source with a record, an estimate, or the user's own.
- **Pieces to build on:** R6a's spur, shifted, rack and helical gears (`gear.ts`, `gear-rack.ts`; D53–D60) and their meshing checks; sweeps (`brep-sweep.ts`, `sweep-solid.ts`) and the twisted Boolean of D60; the analytic Boolean.

**Open items carried over** (none blocks R12b):
- The shell's concave join stays sharp (owner's decision); `join: 'arc'` is the one switch (D106, D107).
- The analytic Boolean's one union order (D107/D108), the region route's refusals (D113), the offset route's limits (D112), mesh shells' limits (D114): as in the R11 → R12 block below.
- R12.5's and FR4b's agents are the scripted one (L2). A live model building them needs the owner's OK.
- Run the full flow on its own (beside the kernel suite some drawing and A5 steps time out). B9's known flake keeps its budget.
- ~~Kernel-lane request (O75): `bvhOfTriangles` from `facet-bvh.ts`~~ — **withdrawn** (coordinator, 2026-10-21): the outer lane builds RM6's mesh distance on a dual-tree traversal over the studio's own triangle BVH (`print/orient.ts`), after IM.

**How to resume**
1. Read this block, then D122–D128 in `decisions.md` (for the frame model), then §4's R12b item and D53–D60 (R6a gears).
2. Set up as in "How to run" below: Node 22 (`export PATH=$HOME/.nvm/versions/node/v22.19.0/bin:$PATH`); `pnpm build:library` in `packages/barocss-cad` before kernel tests; the flow with `CAD_STUDIO_CHAT_PORT=52491`, on its own; RB by `node <abs>/packages/barocss-cad/scripts/rb/run.mjs --record` (`pnpm rb` resolves to pnpm's rebuild).
3. **Each step** has a decision record (the next is D129), tests (failing on HEAD where a defect is fixed), conformance fixtures, lint, type-check, the kernel, studio and flow runs, a flow step, a §0 row, a commit, an RB-rows commit, and a checkpoint to the coordinating session. Compare the passing test names with the last run at each checkpoint. After the checkpoint, end the turn and wait for the go-ahead.
4. **Ownership** is as below. New kernel files of FR: `frame-section.ts`, `frame-cutlist.ts`. Outer-lane files FR touched, each declared: `drawing/tables.ts` (the source's registration), `DrawingWorkspace.tsx` (the checkbox), `test/drawing-table.test.ts`, and the agent's tool infrastructure (`chat/contract.ts`, `chat/groups.ts`, the tool contracts through `UPDATE_TOOL_CONTRACT=1`).

### Kernel lane: hand-over at the R12 → FR boundary (2026-10-20) (history: FR is done, see the block above)

The kernel lane goes on in a new session at each track boundary (the owner, 2026-10-19). This block is that hand-over.
R12 sheet metal is complete (D115–D121); the next kernel session starts **FR1–FR4 frames and weldments**. The
R11 → R12 block below is kept as history.

**State**
- Branch `review/cad-gpu-engine-2026-10-14` (the integration branch, local only). The tip is the commit that adds this block, followed by its RB-rows commit (`git log -2`). The coordinator merges the outer lane into this branch between steps.
- R12 is done:
  - S0 (D115): construction exact today; the B-rep unfolds against the K-factor's area identity; flanges leaning in were united silently. The stages and what is not in R12 frozen.
  - R12.1 (D116): sheet rules (T, R, K), `sheet-base` and `sheet-contour`, role names, the part's `sheet` report; the studio's Sheet plate and Sheet profile commands. The RB basis changed here (non-part JSON skipped).
  - R12.2 (D117): `flatPattern` from the B-rep (`sheet-flat.ts`), carried through later cuts; its DXF (OUTLINE, BEND_UP, BEND_DOWN, BEND_NOTES); the studio's flat view and export; NOT_A_SHEET, NON_NORMAL_CUT, BEND_NOT_CYLINDRICAL, FLAT_OVERLAPS.
  - R12.3a (D118): edge flanges (`sheet-flange`), end reliefs, FLANGES_COLLIDE, SHEET_IN_PIECES; the report dropped past moves, patterns, mirrors and unions.
  - R12.3b (D119): no relief defaults in the kernel (RELIEF_REQUIRED); corner reliefs (`sheet-corner-relief`, square or round).
  - R12.4 (D120): bend tables in the part (`bendTable`: rows of T, R, angle → K, BA or BD, each sourced or an estimate); lookup exact, bilinear or linear in R, else BEND_TABLE_MISS. No built-in table: the owner decided users load their own shop's table (D121).
  - R12.5 (D121): acceptance. RB9 rungs 5 (L-bracket) and 10 (PCB enclosure) built by the agent's tools in one chat turn each, by closed forms; their flats' DXF audited by ezdxf; a flow step through the real chat. No product code changed.
- **The sheet-metal model now:**
  - Kernel: `sheet-metal.ts` (BA, OSSB, BD; sections; bend tables), `sheet-flat.ts` (the flat and its DXF), the four sheet kinds in `part-model.ts`.
  - Studio: `sheetCommands.ts`, `FlatPatternDialog.tsx`, "Bend table…" in the body's panel, the four node kinds in the agent's `add_features` and `run_command`.
  - Refusals are listed in D116–D120.
- Checks at the R12.5 commit:

  | Check | Result |
  |---|---|
  | Kernel | 1228/1233 (4 skipped); only "actual native Split source…" fails, an environment failure |
  | Conformance | 149/149 |
  | Studio | 586/586 |
  | Full browser flow, run on its own | 177/177 |
  | RB | 291 cases (+3: the two accept cases, the enclosure's DXF case), 0 new, the 8 known TODOs |
  | Properties | 11/11, no failures |

- The tree is clean, apart from the earlier review session's untracked drafts (see "Where the work is").

**For the owner: not in R12** (D115's list, plus what R12 left; place them on the roadmap or drop them)
- Hems, jogs, sketched bends, miter and lofted flanges.
- Closed corners, louvres and forming tools.
- Cuts across a bend made in the flat (unfold, cut, refold).
- Converting a solid or shell to sheet metal.
- Sheet DFM rules (minimum flange, hole-to-bend distance, minimum radius per material), as a process profile with warn and error levels and sourced values, like AM/IM/CNC.
- Left by R12:
  - flanges on curved edges, and one flange over several edges;
  - corner reliefs on corners that are not square, and other relief shapes (tear, obround corners);
  - a bend-table editor in the studio, and tables per material from a library;
  - a drawing's bend table (the outer lane's R14, from this data).
- **Decided (the owner, 2026-10-20, D121):** "SendCutSend 굽힘표는 내장하지 말고, 사용자가 자기 공장 표를 불러오게 해." (Don't bundle the SendCutSend bend table; users load their own shop's table.) No table is built in; sheets run on a K or a table the user loads. The SendCutSend values stay in the research note as a reference only.

**What FR (frames and weldments) needs**
- **Scope**, §4 "FR — weldments and frames":
  - FR1 profiles (rectangular tube, angle, channel, 2020-class T-slot);
  - FR2 members along 3D sketch segments, with alignment and roll;
  - FR3 corners (miter, butt, coped, none) with per-corner override, an ordered trim for joints of 3+ members, trim to a plane or body;
  - FR4 a cut list (profile, material, long-point length, angles, quantity, mass), identical members grouped, a drawing table.
- No research note for FR yet. Run an S0-style feasibility checkpoint first, as R10, R11 and R12 did.
- **Profile dimensions** fall under the same sourcing rule as bend data: no standard tables copied (ISO/ANSI/EN text); a named public source with a record, or values flagged estimates, or the user's own library.
- **Pieces to build on:** sweeps along a path (`CadPartSweepStep`) and extrusions; the analytic Boolean for trims and copes; the library (LIB1–LIB4) for profiles; mass properties for the cut list; the outer lane's drawing tables (R14) for FR4's table (ask the coordinator).

**Open items carried over** (none blocks FR):
- From R12 (D121): the studio's body notes show a flange's bend as "bend:" (the name's last part only), so several flanges can't be told apart; a one-line fix in `evaluate.ts` `sheetNotes`. The flat dialog's title gives the box's axes in its own order.
- The shell's join at concave edges: sharp by default, `join: 'arc'` the one switch (D106, D107). The owner's choice is still pending.
- The analytic Boolean's one union order (D107/D108), the region route's refusals (D113), the offset route's limits (D112), mesh shells' limits (D114): as in the R11 → R12 block below.
- R12.5's agent is the scripted one (L2). A live model building the two rungs needs the owner's OK.
- Run the full flow on its own (beside the kernel suite some drawing and A5 steps time out).

**How to resume**
1. Read this block, then D115–D121 in `decisions.md`, then §4's FR item.
2. Set up as in "How to run" below: Node 22 (`export PATH=$HOME/.nvm/versions/node/v22.19.0/bin:$PATH`); `pnpm build:library` in `packages/barocss-cad` before kernel tests; the flow with `CAD_STUDIO_CHAT_PORT=52491`, on its own; RB by `node <abs>/packages/barocss-cad/scripts/rb/run.mjs --record` (`pnpm rb` resolves to pnpm's rebuild).
3. **Each step** has a decision record (D122 is FR S0, D123 FR1, D124 FR2, D125 FR3a, D126 FR3b, D127 FR4a; the next is D128), tests (failing on HEAD where a defect is fixed), conformance fixtures, lint, type-check, the kernel, studio and flow runs, a flow step, a §0 row, a commit, an RB-rows commit, and a checkpoint to the coordinating session. After the checkpoint, end the turn and wait for the go-ahead.
4. **Ownership** is as below. New kernel files of R12: `sheet-metal.ts`, `sheet-flat.ts`; of FR: `frame-section.ts` (FR1).

### Kernel lane: hand-over at the R11 → R12 boundary (2026-10-20) (history: R12 is done, see the block above)

The kernel lane goes on in a new session at each track boundary (the owner, 2026-10-19; "Two lanes" under the roadmap
below). This block is that hand-over. R11 general shell and offset is complete (D105–D114); the next kernel session
starts **R12 sheet metal**. The R10 → R11 block below is kept as history. (Since: R12 S0 done, D115 — construction exact today, the
B-rep unfolds against the K-factor's area identity, flanges leaning in are united silently. R12.1 done, D116 — sheet rules, base and contour
flanges, role names, the `sheet` report. R12.2 done, D117 — the flat pattern from the B-rep, its DXF, the studio's flat view and
export, four refusals. R12.3a done, D118 — edge flanges, end reliefs, FLANGES_COLLIDE, the report dropped past moves. R12.3b done,
D119 — no relief defaults in the kernel (RELIEF_REQUIRED), corner reliefs; R12.3 done. R12.4 done, D120 — bend
tables in the part (no built-in table: the sources found are not cleared). R12.5 done, D121 — acceptance; R12 done.)

**State**
- Branch `review/cad-gpu-engine-2026-10-14` (the integration branch, local only). The tip is the commit that adds this block (`git log -1 -- apps/cad-studio/handover/README.md`). The last code commit is R11.3 (D114), with RB rows after it.
- R11 is done:
  - S0 (D105): today's slabs checked against closed forms; two over-thick walls found.
  - R11.1a–c (D106–D108): the slab route fixed and extended; the join as one switch (`ShellJoin`, sharp by default).
  - D109: the step-116 flake (a flow wait), `window.__studioFresh`.
  - R11.2a (D110): a smooth closed SubD body shelled as its offset cavity.
  - R11.2b (D111): the same, faces opened.
  - R11.2c-1 (D112): trimmed planes and cylinders in the offset route.
  - R11.2c-2 (D113): bounding planes' bands and smooth regions' slabs for sharp edges (`region-shell.ts`).
  - R11.3 (D114): mesh bodies' shells (`mesh-offset.ts`) and thicken's fold refused.
- How a shell is made now (`part-model.ts` `shellOf` / `shellPart`), in this order:
  - a mesh body: `meshInnerOffset`;
  - upright, revolved, swept or moved: their own exact routes;
  - then the slab route: `generalShell`, planes, cylinders, surfaces of revolution;
  - where that refuses a face's kind or trim: the offset route, if the opening leaves no sharp edge between kept faces (`offsetCavity` / `offsetShell`);
  - else the region route (`regionShell`).
  - Each route refuses by name; a list is in D113 and D114.
- Checks at the R11.3 commit:

  | Check | Result |
  |---|---|
  | Kernel | 1182/1187; only "actual native Split source…" fails, an environment failure |
  | Conformance | 129/129 |
  | Studio | 519/519 |
  | Full browser flow, run on its own | 164/164 |
  | RB | 341 cases, 0 new, the 8 known TODOs |
  | Properties | no failures |

- The tree is clean, apart from the earlier review session's untracked drafts (see "Where the work is").

**What R12 (sheet metal) needs**
- **Scope**, §4 item 12: a base flange from a sketch, an edge flange, a bend (radius, K-factor), reliefs, the flat pattern, its DXF export, and the bend table data in the part.
- There is no research note for R12 yet. Run an S0-style feasibility checkpoint first, as R10 and R11 did (§4, "before each large step").
- **Pieces to build on:**
  - Upright extrusion and its exact shell (a sheet's wall is the shell of a flat plate).
  - `thicken` (a surface to a solid, its fold now refused). A bend is a cylinder piece, so a bend's inner and outer faces are exact cylinders, the offset route's exact faces (D112).
  - The outer lane's DXF writer (R11b): the flat pattern's DXF goes through it. Ask the coordinator; the writer is the outer lane's.
  - The analytic Boolean, which now keeps its inputs' tolerance (D113).

**Open items carried over** (none blocks R12):
- The shell's join at concave edges: sharp by default, `join: 'arc'` the one switch (D106, D107). The owner's choice is still pending.
- The analytic Boolean's one union order: the four-slab repro of D107/D108 ("Open TODOs" below), its root not traced.
- The region route (D113):
  - concave sharp edges between regions, or beside a plane the body crosses (a boss on a curved face, a pocket), are refused by name;
  - an opened curved face beside a region is refused;
  - the opened tee's one Boolean takes about 20 s (327 faces).
- The offset route: trimmed freeform patches, and exact faces other than planes and cylinders, are not taken (D112).
- Mesh shells (D114): no opened faces; the sharp join only; a mesh coarser than its curvature is refused, not refined.
- The flow, run beside the kernel suite, times out some drawing and A5 steps (5–30 s waits) and once logged a page error ("reading 'every'", passed to the outer lane). Run the full flow on its own.

**How to resume**
1. Read this block, then D110–D114 in `decisions.md`, then §4's R12 item.
2. Set up as in "How to run" below.
   - Node 22 (`export PATH=$HOME/.nvm/versions/node/v22.19.0/bin:$PATH`).
   - `pnpm build:library` in `packages/barocss-cad` before kernel tests.
   - The flow with `CAD_STUDIO_CHAT_PORT=52491`, on its own.
3. **Each step** has a decision record (the next is D115), tests (failing on HEAD where a defect is fixed), conformance fixtures, lint, type-check, the kernel, studio and flow runs, a flow step, a §0 row, a commit, an RB-rows commit, and a checkpoint to the coordinating session. After the checkpoint, end the turn and wait for the go-ahead.
4. **Ownership** is as below. New kernel files of R11: `offset-cavity.ts`, `region-shell.ts`, `mesh-offset.ts`.

### Kernel lane: hand-over at the R10 → R11 boundary (2026-10-19) (history: R11 is done, see the block above)

The kernel lane continues in a new session at each track boundary (the owner, 2026-10-19; "Two lanes" under the
roadmap below). This block is that hand-over. R10 is complete; the next kernel session starts R11. (Since: R11 S0 done, D105 — two `generalShell`
over-thick walls found; R11.1a done, D106 — both fixed; R11.1b done, D107 — plane–plane concave corners, concave vertices, the join switch; R11.1c done, D108 — R11.1 done, R11.2 next.)

**State**
- Branch `review/cad-gpu-engine-2026-10-14` (the integration branch, local only). The tip is the commit that adds this block (`git log -1 -- apps/cad-studio/handover/README.md`). The last code commits are `1e2d7c13a` (R10.5b, D103), with RB rows in `b2436b5fb`, and the D104 tessellation fix after it (see below).
- R10 general fillet and chamfer is done, D87–D103 (and D104, a tessellation fix at the boundary):
  - S0, then R10.1–R10.4b;
  - the plane–plane reach fix and the wedge chamfer's ends;
  - R10.B, the analytic Boolean with coincident tool faces;
  - R10.5a variable radius and R10.5b conic / G2 sections;
  - D101 determinism and D102 trimmed-end slivers.
- Checks at `1e2d7c13a`:

  | Check | Result |
  |---|---|
  | Kernel | 1114/1119; only "actual native Split source…" fails, an environment failure |
  | Conformance | 105/105 |
  | Studio | 384/384 |
  | Full browser flow | 138/138 |
  | RB | 243 cases, 0 new, the 8 known TODOs |
  | Properties | 11/11 |

- The tree is clean, apart from the earlier review session's untracked drafts (see "Where the work is").

**What R11 (general shell and offset) needs**
- **Design input:** `handover/notes/research-r10-r11-fillet-shell-2026-10-18.md`, sections R11.1–R11.3 and their tests. Run an S0-style feasibility checkpoint first, as R10's S0 did (D87; §4, "before each large step").
- **Today's shell:**
  - `part-model.ts` `shellOf` dispatches by how the part was made: an upright body with its edge-finish history, revolved, swept, or a moved copy.
  - `general-shell.ts` takes the union of a slab per face. It handles planes with line/arc regions, cylinders on rectangular domains and surfaces of revolution trimmed by circles and meridians.
  - It refuses freeform faces by name: every rolling-ball fillet face (R10.2a on) is one. It also refuses facet (mesh) faces.
  - No shell history is recorded past a variable-radius fillet (D100) or a conic or G2 one (D103), so a shell after them is refused.
  - `thicken-solid.ts` has an unchecked fold-over, which R11.3 should replace with a refusal.
- **Available pieces:**
  - `local-curvature.ts` and `second-derivatives.ts`: principal curvature, for R11.2's `OFFSET_FOLDS` (t·κmax ≥ 1 on the concave side).
  - `section-offset.ts`.
  - The rolling-ball loft (`rolling-ball.ts`, `loftTool`) and its reported deviation, as a pattern for "fit, then report how far off".
  - The analytic Boolean (R10.B), which the slab union goes through.
- **Oracles the note lists:**
  - a hollow sphere, 4/3 π (R³ − (R − t)³);
  - hole radius < t, and a torus's minor radius < t;
  - a NURBS bump whose curvature radius is < t;
  - walls thinner than 2t;
  - a fillet radius below the wall, which gives a sharp inner corner (closed form);
  - the enclosure-lip offset that waits on R11.

**Fixed at the boundary (D104):** the bench regression the outer lane found, "tessellate: SubD body of a ~2k-face cage", 7 s against a 2 s budget. D91 had raised the tessellation's flip-pass cap to 50 + n, and flat triangles flipping into flat triangles cycled to that cap. Now a flat triangle is flipped only if fewer stay flat. The bench is 659 ms and the mesh is the same to the bit.

**Open items carried over** (none blocks R11):
- Conic and G2 corners (the ball round an edge at a corner) are refused. Rho and tension do not vary along a chain. There is no G2 at a chain's ends (D103).
- Closed loops round curved paths are only as accurate as the loft's reported deviation (`sectionMM`), not 1e-9: a boss's foot is 3.5e-7 at its default stations (D103).
- Why HEAD's lens-free station counts were 1e-4 mm³ off before D102 was not traced (D102).
- No test compares the browser worker with Node (D101).
- PERF3 C16 review findings: `handover/notes/c16-review-findings.md`.

**How to resume**
1. Read this block, then D99–D103 in `decisions.md`, then the research note's R11 part.
2. Set up as in "How to run" below.
   - Node 22.
   - `pnpm build:library` in `packages/barocss-cad` before kernel tests.
   - Kernel: `node --test --test-concurrency=8 test/*.test.mjs`.
   - Studio: `pnpm test` in `apps/cad-studio`.
   - The flow, run from `apps/cad-studio`. Don't edit studio files while it runs: vite reloads the page and later steps fail.
     `CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" PW_DIR="$HOME/.cache/barocss-playwright/node_modules/playwright" node test/browser-flow.mjs <out>`
   - RB: `node scripts/rb/run.mjs --record`, then `node scripts/rb/props.mjs --record`.
3. **Each step** has a decision record, tests (failing on HEAD where a defect is fixed), conformance fixtures, lint, type-check, the kernel, studio and flow runs, a flow step, a §0 row, a commit, an RB-rows commit, and a checkpoint to the coordinating session. After the checkpoint, end the turn and wait for the go-ahead.
4. **Ownership.** The kernel core files stay this lane's: `edge-finish`, `part-model`, `analytic-boolean`, `rolling-ball`, `fillet-section`, `brep-*`, `solid-mass`, tessellation. The outer lane asks for changes there through the coordinator. A merge commit from the coordinator on this branch at the start of a turn is the outer lane's work, merged while this lane was idle.


The owner's usage ran out on 2026-10-18; work continues from another account. This section is current.
The sections after it are the older hand-over (2026-10-16/17), kept as history: where they disagree, this one wins.

### Where the work is
| What | Value |
|---|---|
| Branch | `review/cad-gpu-engine-2026-10-14` — **local only, never pushed; no PR, no publish** |
| Worktree | `.claude/worktrees/barocss-cad-gpu-review-efbb2c` |
| HEAD at hand-over | the commit that adds this section (`git log -1 -- apps/cad-studio/handover/README.md`); last code commit `2831d318a` (PERF3 A6) |
| Uncommitted, not ours | `REVIEW-2026-10-14-cad-gpu.md`, `review-drafts/`, `packages/barocss-gpu/src/engine-uv-material-wgsl.ts`, `.claude/`: the earlier review session's drafts — keep, do not commit or delete |
| Decision log | `handover/decisions.md`, D1–D133 (D82 = PERF3, with sections A1–A6; D84 = R8.3 and the owner's pipe clamp; D85 = R9 QEM decimation; D86 = R10a side ids; D87 = R10 S0; D88 = R10.1; D89 = R10.2a; D90 = R10.2b; D91 = mass on trimmed patches; D92 = R10.3a; D93 = R10.3b; D94 = R10.3c; D95 = R10.4a; D96 = R10.4b; D97 = the plane–plane reach past a round; D98 = the wedge chamfer's ends; D99 = R10.B; D100 = R10.5a variable radius; D101 = determinism; D102 = no sliver at a trimmed end; D103 = R10.5b conic / G2 sections; D104 = the tessellation's flat-flip cycle; D105 = R11 S0; D106 = R11.1a; D107 = R11.1b; D108 = R11.1c; D109 = the step-116 flake; D110 = R11.2a; D111 = R11.2b; D112 = R11.2c-1; D113 = R11.2c-2; D114 = R11.3; D115 = R12 S0; D116 = R12.1; D117 = R12.2; D118 = R12.3a; D119 = R12.3b; D120 = R12.4; D121 = R12.5; D122 = FR S0; D123 = FR1; D124 = FR2; D125 = FR3a; D126 = FR3b; D127 = FR4a; D128 = FR4b; D129 = R12b S0; D130 = R12b.1a; D131 = R12b.1b; D132 = R12b.2a; D133 = R12b.2b) |
| Conformance fixtures | `packages/barocss-cad/conformance/` (`r5/`, `r6/`, `r7/`, …; superseded cases carry `supersededBy`) and the RB corpus `packages/barocss-cad/corpus/` |
| Coordination hand-over | `handover/notes/coordination-2026-10-18.md`: the owner's coordinating session's direction and research decisions, the "why" (copied from `.claude/worktrees/amazing-euler-c18b94/HANDOVER-coordination-2026-10-18.md`) |

### Roadmap (serial, one implementation session), status
Done:
- R1–R7, RB1–RB4, A1–A4 (AI collaboration), R3–R6, R6a gears, LIB1–4, R6b, AM1–AM5.
- R8.1 cage operations (D80); R8.2a cage editor (D81); R8.2b the agent's cage tools and their browser-flow step (D83).
- **R8.3** (D84): the cage editor by hand end to end in the browser flow (extrude by Shift-drag, loop, crease, mirror, session undo, Done, document undo); the owner's acceptance part, a **SubD pipe clamp** (`handover/notes/acceptance/subd-pipe-clamp.png`), built by the agent's cage tools (43 calls, unit test and through the real chat) and its shape by hand in the editor; one body of genus 2, its SubD metrics, mass, STEP round trip and tessellation in the kernel's conformance case `r8/subd-pipe-clamp`. New: `subd-tube` primitive, `subd_insert_loop`'s `t`, the boundary query's box, a hole's rim by double-click, the editor ending its session when the part changes under it, a drag of nothing no step.
- **R12b.2b** (D133): the shaper-cut internal root, generator `internal-gear@1` (`rootPolicy: 'shaper-cut'`, `cutter: { teeth, profileShiftCoefficient?, tipRadiusMM? }`): the cutter rolls inside the ring at a_c (inv α_c = (z2 ψ_s − z0 ψ0)/(z2 − z0)), the root circle a_c + ra0, the fillets the closed-form envelope of its tip round fitted by D130's Hermite pieces (6–7, 1.6e-4 mm at m 2 within 2e-4); the default tip radius min(0.38 m, 0.8 × the most the cutter holds), flagged an estimate. Refusals: K1 Table 4.8's trimming (`TRIMMING_INTERFERENCE`), the cutter's involute interference naming a ring shift, a tip round that does not fit, helical shaper rings. Found: the trimming condition reproduces K1 Table 4.8(1) row for row (18 rows); the straight insertion agrees for cutters ≥ 27 and clears one tooth below the table at 24 and 25 — so a pair's trimming verdict is now the insertion **or** the condition (revises D132: 24/40 and 25/40 flagged). Studio: the ring `@1` with a 24-tooth cutter by default, the x2 0.5 default visible in the field and notes ("Profile shift 0.5 (default: clears rack-cut pinions; see D132)"), Root and Cutter fields; the gear survey behind `GEAR_SURVEY=1` (`gear-internal` 78 s / 167 s, `gear-internal-shaper` 6 s / 36 s); conformance `r12b/` 12; RB seeds 3; the flow step extended.
- **R12b.2a** (D132): internal gears built directly — an annulus whose hole is a "space gear"'s outline (the spur machinery at x2 + 0.25), turned so tooth 1 is on +X, the hole twisting for helical rings; 1–5 ms against S0's 14.7 s Boolean. Refusals: the tip inside its base circle naming the least x2, `RIM_INTERSECTION`, shift and reduction limits. The internal pair: K1's working distance, +z1/z2, backlash, contact ratio, the same-way sweep (a grid; contact up to the ring's chord sag; depth by the star-shaped ray test), the involute and trochoid conditions, and a radial-insertion sweep for trimming. A `spur-gear` meshes inside a ring by `mesh`. Found: an unshifted ring's tip corners cut a rack-cut pinion's fillet at no backlash (0.026 mm for 24/60; the exact Boolean agrees) — x2 0.5 clears every pair surveyed, the studio's default; the recalled trimming condition disagrees with the exact insertion at 24/40 and 25/40 (the insertion is the authority, the test's own insertion agrees). Studio: Internal gear command and node, Meshing gear inside a selected ring, notes; `tools-v1.json` +1 command; conformance `r12b/` 9; RB seeds 4; a flow step.
- **R12b.1b** (D131): the generated root on helical gears — in the transverse plane the tool's tip round is an ellipse (ρ/cos β along, ρ across), its envelope closed form in the ellipse's angle θ, φ(θ) inverted for the fit on φ; spur gears bit for bit as before. The rack's own root fillet (`spur-rack@1`, ρ 0.38 m): one exact rational arc a corner (an ellipse when helical), the flank ending 1.25m − ρ(1 − sin α_n) down; the gear's usable path of contact stops there. Fillet faces renamed `filletL2#k` (the tooth last, apart from helical axial `#k.2`). Oracles in `test/gear-generated-root-helical.test.mjs` (5): the transverse tool's signed distance (point-to-ellipse) over its travel on the B-rep's curves, r_F, the volume, j cos α_t/2, the rack's closed-form volume to 1e-9 and arcs on their ellipses. Studio: helical gears `@1`, racks `@1` with Root and Root fillet fields; conformance `r12b/` 6; RB seeds 4; a flow step.
- **R12b.1a** (D130): the generated root on external spur gears, generator `spur-gear@1` (`rootPolicy: 'generated'`, `toolTipRadiusMM` ρ = 0.38 m by default): the root arc the rack's flat cuts, exact; fillets the closed-form envelope of its tip round, Hermite pieces on φ at breaks of equal turning (6–9 pieces, five to a face: `filletL#k`, `filletL2#k` — renamed so in D131), up to the form circle (tangent) or, undercut, the involute's crossing (`UNDERCUT`, the involute trimmed; the schematic root still refuses undercut gears). Pairs and rack checks take the involute's start `rs`. Oracles in `test/gear-generated-root.test.mjs` (7): the B-rep's own curves against the tool's signed distance over its travel (fillets ≤ their fits, root arcs 7e-15; D129's ray oracle fails for non-star-shaped undercut teeth), r_F to 1e-9·m, the volume by the test's own boundary area, the pair j cos α/2, a rack's sharp tip corner passing the fillet nearer (0.0467726 vs its own path 0.0467779). Studio: spur gears `@1` by default, Root and Tool tip radius fields, notes; conformance `r12b/` 3; RB seeds 4; a flow step (an undercut 12-tooth pinion, the editor's fields).
- **R12b S0** (D129): gears+ feasibility against oracles in the probe, apart from `gear.ts`. An internal gear is already exact as an annulus less a "space gear" (spur, x 0.25, thinned 0.5·m·tan α): m2 z40 to 3.1e-6, but 14.7 s by the Boolean, so R12b builds it directly. An internal pair's sweep is conjugate (j cos α/2 to 5e-7), and the involute and trochoid interference conditions (K1's are images; derived here) agree with it on nine pairs (31/40 clear, 32/40 crosses). The rack-generated root's envelope equals a brute-force simulated cut to 5.7e-14 mm, ends on the derived form circle to 1e-9·m, G1; an undercut z12 is cut 0.73 mm inside its involute. Bevels: a spherical-involute pair is conjugate on the sphere (spread 5.6e-7), Tredgold's back-cone profile is not (13–23× more, micrometres); a stereographic-lifted cubic holds a flank exactly on its sphere, 3 pieces within 1e-4·m. Worms: ZI is the helical machinery at β = 90° − γ (refused past 45° today); twist 12–79 segments, transverse flank 4–11 pieces (budgets to raise, never the tolerance). Verdict: R12b.1a generated root (spur) → R12b.1b helical and rack roots → R12b.2a internal gears and pair checks → R12b.2b shaper-cut internal root → R12b.3 straight bevel (spherical involute) → R12b.4 spiral bevel (ideal conjugate; the owner may drop) → R12b.5 ZI/ZA worms and cylindrical wheel → R12b.6 throated wheel (conditional) → R12b.7 acceptance (planetary set, bevel pair, worm reducer). Sources K1/K2 (KHK, public HTML, 2026-10-20). Evidence `test/r12b-s0.test.mjs`.
- **FR4b** (D128): the cut list as a drawing table — `cutListTable` / `cutListSource` (`app/cutList.ts`), registered as the `cut-list` source in `drawing/tables.ts`; a "Cut list" checkbox in the drawing panel. Acceptance by the agent's tools in one turn each (`test/fixtures/frame-*.calls.json`): a welded table frame of sharp 40 × 40 × 3 tubes (mitred 1000 × 600 top, legs 730, lower rails butted on the legs) and a 400 × 300 × 500 2020-class T-slot frame (square, between faces). Oracles: every member A·L, the welded union one body of the sum, the T-slot members not overlapping, the cut lists' rows and totals by hand, the table on an A3 sheet clean and in its SVG, PDF and DXF. Conformance `fr/accept-*` (+2); a flow step through the real chat. Found: on A4 the table lands on the right view's name with no fix (the outer lane's placement). **FR done** — the FR → R12b block at the top of §0.
- **FR4a** (D127): the cut list — the kernel's `cutPiece` (axis length by the end planes in closed form, else by volume; long point from the body; each end's mitre and bevel about the section's y and x; reversible or not) and `cutList` (identical pieces on a row, reversible ones end for end, mirrored apart, by material; mass ρ·A·L or ρ·V; totals) and `cutListCsv`. Oracles: a mitred rectangle, an ordered table, a 60° butt, a compound mitre atan(cos ρ·tan θ) / atan(sin ρ·tan θ), grouping by hand. Studio: "Cut list" in a member's panel (rows, totals, the estimated densities said so, CSV), the agent's `cut_list` (`query.cutlist`). Also the D126 check: the 7.5 s round-cornered table runs in the worker — no freeze (the longest main-thread gap about 50 ms), a performance follow-up. Conformance `fr/` (+2, a `cutList` expectation); two flow steps. FR4b (the drawing table and acceptance) done: D128.
- **FR3b** (D126): ordered trims, copes and envelope trims, T-joints, trims to a plane or a body — and FR3a's two hardening points (the planar fallback dispatches on the typed reason `NOT_PLANAR_WITHIN_FLOAT`; a butt on an open side is refused `BUTT_ON_OPEN_SIDE`, naming the side and spans, never a silent gap). `corners.multi: 'order'` (the first through, each next trimmed to the earlier members' trimmed envelopes), `corners.tee: 'butt' | 'cope'`, `at` kinds cope and order and `trim: 'envelope'`; `trims` to a plane (run on to meet it) or an earlier body (not consumed); `MEMBERS_CLASH` for crossing lines, `TRIM_PARALLEL`, `TRIM_EMPTY`, `TRIM_MISSES`. Oracles: S0's quadratures (a round-cornered envelope 1e-9, a fish-mouth cope 1e-9), ordered corners and tables by closed form welded to their sum, an inclined-floor trim's cut-prism centroid. Studio: the palette's joint choices (new frames: ordered trims, butted T-joints), the editor's, the notes' trims and copes, the agent's corners and trims. A round-cornered ordered table takes 7.5 s (curved Booleans). Conformance `fr/` (+5); a flow step. FR4a (the cut list) next.
- **FR3a** (D125): two-member corners and the planar route's fix. Planar Booleans whose faces are coplanar only to binary64 (a member off the axes, a slanted cut) now go to the analytic Boolean when the polyhedral one refuses "not planar" (a test failing on HEAD; S0's two assertions turned). A frame's `corners`: `default` (mitre) and `at` per point — mitre (both on the halfway plane; refused `MITRE_SECTIONS_DIFFER` unless the sections meet face to face), butt (`through` runs on to cover, the other ends on its box face; `BUTT_NOT_ON_A_FACE`), none; `CORNER_ANGLE`, `CORNER_NOT_A_JOINT`; three or more members left square (FR3b). The member report's `ends`. Oracles: a mitred rectangle A·L each, long points L + b, welded to one body and their sum (1e-12); round corners at 120° and 3D (1e-8 quadrature, θ and long points 1e-12); butts square and at 60° by (b/2)·sin φ and (b/2)/sin φ. Studio: the palette's corners, the editor's per-point corners, the ends and three-member warnings in the notes; the flatten test (a sketch-section frame in an assembly instance). Conformance `fr/` (+4); a flow step. FR3b (ordered trims, copes, trims to a plane or body) next.
- **FR2** (D124): frames on a skeleton — the kernel's `frame`: `points` and `segments` (from → to), a member along each (FR1's), each its own body `<id>/<k>`, never united; the frame's section, anchor, offset, roll and `mirror` (turned over across its own y) shared, `overrides` setting a member apart; faces `<id>.m<k>.<role>`; the member report's `frame` place. Refused by name: `SEGMENT_ZERO_LENGTH`, `MEMBER_DUPLICATE`, `SKELETON_OVERLAP` (by position). Oracles: a 12-member box frame (A·L each, centroidal lines on the skeleton's points, frames orthonormal to 1e-15, legs by the fallback), overrides, a mirrored angle (x̄ negated), an oblique tetrahedron by parameter. Studio: "Frame" — a table, box or rectangle preset, or picked straight edges (their ends shared); bodies named by member; the member's place in its notes; the editor's section, roll and points; the agent's raw node with overrides. The rect-tube's derived bore radius is said so (`derived`, "ri 3 (concentric)"). Conformance `fr/` (+4); a flow step. FR3a (two-member corners and the planar-route fix) next.
- **FR1** (D123): structural sections and a straight member — the kernel's `frame-member`: a `rect-tube` (corners ro, a concentric or given bore radius), `round-tube`, `angle` (root and toe radii), `channel` (root radii), `tslot` (the tslot-20 part's shape as one loop) or `sketch` section, every dimension given (no defaults, D122), square to a line between two points, its anchor (centroid, origin or a box point) on the line, moved by an offset, its y along up made square to the line (a vertical line takes +X, reported), rolled. Faces by role (`top`, `bore.left`, `root`, `t1.floor`, `.start`, `.end`); the `member` report (area, centroid, line, frame, centroidal line); mass closed form even off the axes. Refused by name: `SECTION_DIMENSIONS`, `SEGMENT_ZERO_LENGTH`. Oracles: A·L to 1e-12 by the textbook areas, centroids by Green's theorem, the T-slot against the library part's own 3D Booleans (1e-12, 1–4 slots and 20 × 40). Studio: "Structural member", the panel's section and frame notes, the prefilled radii and slot sizes flagged estimates (dropped when edited), the editor's dimensions, length and roll, the agent's command and raw node; tool contract recorded. Conformance `fr/` (8); a flow step. FR2 (3D skeleton) next.
- **FR S0** (D122): frames' feasibility, against closed forms and quadratures written in the probe — members are exact as extrusions of a section square to any 3D segment (a rectangular tube sharp or round-cornered, an angle with root and toe radii, a channel: A·L to 1e-12; roll exact); `split` mitres them (θ and the long point L + c·tan θ to 1e-12; the pair welds to the sum) but keeps both pieces; trims must be against the envelope (the tube itself leaves stubs in its bore), and a round-cornered envelope lets a member reach into its rounds (486.004 mm³, 1.1e-10); a fish-mouth cope against the two-cylinder quadrature to 8.7e-11; mass on cut round corners is the kernel's quadrature (1.6e-9), so the cut list takes ρ·A·L_c. A defect: planar bodies off the axes (a sharp tube on a 120° or 3D corner, two mitred sharp tubes' union) are refused by the exact polyhedral Boolean ("face … is not planar"); the analytic one unites them exactly — FR3a fixes it. Missing: a 3D skeleton, section kinds, profile data, a member feature, trims keeping one side, a cut list, a drawing table (the outer lane's). Verdict: FR1 sections and a straight member → FR2 3D skeleton, alignment, roll → FR3a two-member corners and the planar-route fix → FR3b joints of 3+, copes, trims → FR4a cut list → FR4b drawing table and acceptance. No section sizes built in (user-loaded, as bend tables). Before it, two fixes: a sheet's bends read apart in its notes (`n3.bend`), studio lint 0 errors. Evidence `test/fr-s0.test.mjs`.
- **R12.5** (D121): acceptance — RB9 rungs 5 (a sheet L-bracket) and 10 (a PCB enclosure: base, four corner reliefs, four flanges, four standoff holes, a connector slot), each built by the agent's tools in one chat turn on a new part (`test/fixtures/sheet-*.calls.json`). Oracles: the volume by the middle line, the flat by the textbook BD (1e-12) and the K-factor's area identity (1e-11); conformance `r12/accept-*` (genus 2 and 5, STEP round trip) and `r12/flat-dxf/pcb-enclosure` (ezdxf audits clean); a flow step through the real chat, the flat view and DXF export. No product code changed; the agent is the scripted one (L2). **R12 done** — the R12 → FR block at the top of §0.
- **R12.4** (D120): bend tables in the part — a sheet's `kFactor` or `bendTable` (rows of T, R, angle → K, BA or BD, each citing a source or `estimate: true`), looked up exactly, bilinear in R and angle or linear in R, else `[BEND_TABLE_MISS]`; `[BEND_TABLE]` for a bad table; each bend's K and rows in the report and the flat (developed twice: angles first). Oracles: a row's BD/BA is what the flat honours (50 + 35 − 4.2 to 1e-12), interpolation by hand. Studio: "Bend table…" (a JSON file) in the body's panel, the rows in the notes, an estimate a warning. Sourcing on the coordinator's terms found SendCutSend (air-bending 90° rows) and a handbook copy — neither cleared, so none built in (`notes/research-r12-bend-data-2026-10-20.md`; the owner's decision). Conformance `r12/` (+2); a flow step. R12.5 (acceptance) next.
- **R12.3b** (D119): no relief defaults in the kernel — a part-width flange's relief given whole or `[RELIEF_REQUIRED]` (the coordinator's check; the studio writes T, an estimate) — and corner reliefs (`sheet-corner-relief`): a square or round quarter off a plate's square corner, exactly the corner (`CORNER_NOT_CLEAR` else, `CORNER_NOT_SQUARE`, `EDGE_NOT_SHEET`), so full-length flanges on both edges clear each other: an open-corner box, its flat (80 + 2(20 − BD)) × (50 + 2(20 − BD)) to 1e-12. The flat names a cut-off sliver of skin. Studio: Corner relief; tool contract recorded. Conformance `r12/` (+2); a flow step. **R12.3 done**; R12.4 (bend tables) next.
- **R12.3a** (D118): edge flanges (`sheet-flange`) on a sheet's straight skin edge — any angle in (0, 180), material inside / outside / bend outside, length to the outer or inner sharp or from the tangent, its own radius, part width with rectangular, obround or no reliefs (one cut tool with the trim) — the report gaining each bend; refused by name: `EDGE_NOT_SHEET`, `FLANGES_COLLIDE` (the union short of its parts, or a cut reaching another bend), `SHEET_IN_PIECES`, `BEND_DOES_NOT_FIT`, `BEND_ANGLE`, `NOT_A_SHEET`. The report dropped (never stale) past moves, turns, mirrors, patterns, unions. Textbook flats to 1e-12 and volumes to 1e-11 over 36 position × angle × measure cases; a four-flange tray. Studio: Flange (fillet's reference machinery via `edges: [name]`), tool contract recorded; the C16 cage-edit timing by median. Conformance `r12/` (+4); a flow step. R12.3b (corner reliefs) next.
- **R12.2** (D117): the flat pattern (`sheet-flat.ts`), from the B-rep with only T and K — the skin from a fixed face across smooth edges, planes rigid, bends unrolled at R + K·T, the outline walked through the B-rep's loops (lines, arcs, exact planar splines), bends with up/down, angle, BA and centre and tangent lines. The sheet's report carried through `difference` and `hole`; an output's `flatPattern()`, the kernel's for bodies without the rules. Refused by name: `NOT_A_SHEET` (a face T-off, a volume ≠ T × skin), `NON_NORMAL_CUT`, `BEND_NOT_CYLINDRICAL`, `FLAT_OVERLAPS` (crossing outline, winding 2), `CUT_ACROSS_BEND` (a guard). Oracles: the textbook length (outside less BD) to 1e-12, the K-factor's area identity to 1e-11, either skin, through STEP. DXF (`flatPatternDxf`, layers OUTLINE, BEND_UP/BEND_DOWN dashed, BEND_NOTES) checked by ezdxf 1.4.5 (`conformance/r12/flat-dxf/`). Studio: the flat in the body's panel and a Flat dialog with DXF 2000/R12 export. Conformance `r12/` (+4 and 2 DXF cases); a flow step. R12.3 (edge flanges, reliefs, corners) next.
- **R12.1** (D116): sheet rules, the base flange and the contour flange. The kernel's `sheet-base` (a plate from a closed sketch, T thick) and `sheet-contour` (an open path, one skin of the sheet, the material to its side, a bend of inner radius R at each corner, extruded a width), each with T, R and K given (no defaults). Faces by role (`.leg<i>.a/.b`, `.bend<k>.inner/.outer`, `.start`, `.end`, `.front`, `.back`); the output's `sheet` report (each bend's faces, R, θ, axis, BA, OSSB, BD). Refused by name: `BEND_ANGLE` (in line, 180°), `BEND_DOES_NOT_FIT`, `SHEET_CROSSES_ITSELF` (closed-form section test). Volumes to 1e-12 by the textbook virtual-sharp relations (L 30°–170° either side, hat, zed, channel on XZ); bend faces R and R + T on the reported axis. Studio: Sheet plate, Sheet profile (L, U, Z, hat), the rules and bends in the body's panel with K 0.5 flagged an estimate, the agent's commands and raw nodes, icons. Conformance `r12/` (6); a flow step (a hat, 5406 mm³). R12.2 (flat pattern and DXF) next.
- **R12 S0** (D115): sheet metal's feasibility, against closed forms and the kernel's own volume — today's kernel builds a sheet's pieces exactly (a contour flange as one section extruded 1e-16; edge flanges as unions, 30°–175°, up and down, full or part width, 1e-12; reliefs by difference; a tray of four flanges with holes 2.8e-12), but names no sheet roles and unites flanges leaning in at a corner silently (0.3–1.8 % under, valid). A probe unfolder of the B-rep (skin across smooth edges from a fixed face, planes rigid, bends at R + K·T): the flat's area to V/T + (K − ½)T·Σθw within 4.7e-12 (K 0.33–0.5, either skin, after a STEP round trip), the textbook reach h + θ(R + K·T) to 4e-15; its outline lines and arcs through `writeDxf`, ezdxf's audit clean. Verdict: R12.1 rules, base and contour flanges → R12.2 flat pattern and DXF → R12.3 edge flanges, reliefs, corners → R12.4 bend tables → R12.5 acceptance (RB9 rungs 5 and 10). Evidence `test/r12-s0.test.mjs`.
- **R11.3** (D114): mesh bodies shelled — the cavity the mesh's own triangles, each vertex the least-squares point of its triangles' planes moved in (the sharp join exactly where up to three meet), the wall it achieves measured and reported on the output (`shell`); refused by name: a triangle turned over or the whole offset inside out (`OFFSET_FOLDS`), the offset crossing itself or the mesh (`WALL_TOO_THIN`), a wall more than 1 % thin (`MESH_WALL_THIN`). Polyhedra exact (octahedron, box, U-prism, pocketed box); an icosphere's wall within 5e-4. `thicken` refuses its fold by name (D110's check). Hollow mesh bodies round-trip through STEP (planar and tessellated). Conformance `r11/`; a flow step. **R11 done.**
- **R11.2c-2** (D113): shells of bodies whose smooth regions (freeform or trimmed faces) meet planes that bound the body at sharp edges — a bounding plane's band unbounded along it (no outline, no growth: planes bounded by conics or trims as any other), a region's slab (its offsets in and out on one grid, closed by normal bands), closed shells as the union's voids (no Boolean with the body), openings beside a region through the body first extended by a glued prism. The conic-filleted box closed and open (±1e-8 of its eroded section), the closed pipe tee (−2e-7 of its bands less the caps' overlaps), 1.5–20 s. Planes and cylinders always exact in the offset route. Kernel fixes: the analytic Boolean keeps its inputs' tolerance and no longer rounds past a patch's domain (three places), nor does the tessellator. Refused by name: regions meeting sharply, a crossed plane beside a region, a curved opening beside a region. Conformance `r11/`; a flow step. R11.2 done; R11.3 next.
- **R11.2c-1** (D112): the offset route takes kept planes and cylinders however trimmed — offset exactly (moved, scaled about the axis: affine maps of the face's own NURBS and edges, its trims kept) beside fitted patches — where the opening leaves no sharp edge between kept faces: a filleted pipe tee with its three ends opened, one smooth region, no Boolean. The kept faces' normal bands (a cylinder's A·(t − t²/2r), its area by Green's theorem on its own edges) to −1.5e-6 – −1.6e-6, 1.5–2.2 s; refused by name past the fillet's convex radius. Three latent bugs found: the cell fit's span search hung at a Greville point rounding below the knot; the tessellator took a small cell's tolerant edges for off its surface, and its mean of an iso run rounded past the domain. Conformance `r11/`; a flow step. R11.2c-2 (region slabs for sharp edges) next.
- **R11.2b** (D111): the same bodies shelled with faces opened — the kept faces, their offset's cells turned inside out, and along the opening's edges the wall's ends (bands ruled along the kept face's normal, one per piece of the edge where the cells cut it: exact curve pieces by knot insertion), no Boolean. The kept faces' normal bands ∫∫(t − Ht² + Kt³/3) dA to 6e-7–1.1e-5 (cube top, one cap, a tube, a torus patch, a membrane's top; 0.4–1.5 s); refused by name: an opening touching itself at a vertex (`OPENING_AT_A_VERTEX`), a wall running out through an opened face (`WALL_TOO_THIN`), every face opened. Conformance `r11/`; a flow step.
- **R11.2a** (D110): a closed body of untrimmed freeform faces meeting smoothly (SubD) shelled as its cavity — each face's offset fitted (cubic, its knots each once more, refined, cut into cells under the 16-pole cap where needed, within 1e-6 of the size), on the body's own topology, tolerant edges, no Boolean. Steiner's formula to 1e-6–2e-6 (cube 216 cells 0.9 s, 16 × 8 torus 0.5 s); refused by name past the tightest curvature (`OFFSET_FOLDS`: the cube's 1.480 mm lies on a cap's side, not 1.509 inside — D105 corrected), a wall meeting another part (`WALL_TOO_THIN`), an opened face (R11.2b). `buildBrep`/`withCavities` keep entity tolerances, the whole-patch quadrature takes tolerant edges, STEP carries the accuracy (round trip 1e-9). Conformance `r11/`; a flow step.
- **The step-116 flake** (D109): not a wrong body — R10.3c's "before" was R10.3b's filleted boss (39 603 mm³), its wait (6 nodes, 1 body) passing on the last document while a loaded machine read the file. `window.__studioFresh` (dev) and the flow's `openModel()` wait for the new document's own bodies; a back-to-back stress step (the old wait 2 of 8 wrong under load, the new 0 of 8). No kernel change.
- **R11.1c** (D108): the wall's union in order, retried by halves and reversed where the analytic Boolean cannot close a step (the notched box at t 2.9–3.1, untyped on HEAD: exact over t 2.5–5); every other failure a typed refusal (`[SHELL_NOT_CLOSED]`, `[SHELL_WALL_UNION]`), a convex round face the wall all but reaches refused by name (`[WALL_NEAR_RADIUS]`, HEAD left a 0.005 mm core); shells past a variable-radius fillet on its history: the hollow rounded r(s) − t on the same spine — exact for a straight chain with two radii (1.6e-14), refused by name for three or more radii, a curved chain or the radius meeting the wall partway (`[SHELL_VARIABLE_RADIUS]`). Conformance `r11/`; a flow step. R11.1 done.
- **R11.1b** (D107): a plane's slab grows across a concave edge between planes by t·tan(θ/2) (as far as the offsets reach before meeting), mitred where two such sides meet — a vertex of concave edges needs no piece of its own; corners sharper than a right angle filled as R11.1a's; every other region grown as before, to the bit. The join is one switch (`generalShell(…, join)`, `'sharp'` by default; `'arc'` gives the upright route's rounds, a vertex of concave edges refused under it). Closed forms to 1e-12: 225° and 315° inside corners (HEAD 2.5e-3, 5e-4 over), a notched box's vertex (HEAD −1.2e-5 … −2.4e-4: a wall thinner than t). Conformance `r11/`; a flow step. TODO: the notched box at t 2.9–3.1 (untyped, as on HEAD).
- **R11.1a** (D106): the general shell's slabs grow per side — across convex edges and concave plane–plane edges as before; not across smooth edges (they meet in the normal plane) nor concave edges beside curved faces, whose corners are filled apart: the region beyond both normals within the wall of both offsets (the sharp join), solved across a straight edge or in a circle's meridian, joined per run or axis. No clamp on thin convex cylinders; a concave face's slab reaches 1.29t. Closed forms to 1e-12: the filleted rod on a plate (6.9e-4 – 7.9 % over on HEAD), rods half sunk r 1–5 (1.1–7.8 %), a torus ring in a round plate by Pappus (0.5–18 %, untyped failures from t 2.5). Conformance `r11/`; a flow step. Left for R11.1b: concave plane–plane corners off a right angle (2.5e-3 at 225°) and concave vertices (HEAD −1.2e-5, fails at t 3).
- **R11 S0** (D105): today's slab method checked against closed forms — exact where its routes are (a hollow sphere 1e-9), but two silent over-thick walls in `generalShell`: a slab grown across a smooth edge into a concave face (a rod on a plate, R10.1-filleted: 6.9e-4 – 7.9 % over), and a cylinder slab past a concave junction (a rod thinner than the wall closes into a ring: 3.4 % over; a thicker rod 1.1 %). Hand-built slabs not grown there are exact (1e-12). A SubD body's cavity as its faces offset and fitted on its own topology, no Boolean: valid, 9e-7 / 4.5e-6 of Steiner's V − At + Mt² − (2πχ/3)t³; knots +1, the 16-pole cap, poles and the mass quadrature's whole-patch test found as R11.2's needs; t·κmax ≥ 1 predicts folding. Verdict: R11.1 fix and extend the slabs → R11.2 offset sheets (cavity; region slabs) → R11.3 mesh offsets. Evidence `test/r11-s0.test.mjs`.
- **R10.2a** (D89): the rolling-ball fillet of any closed chain between two faces (a pipe tee, crossing rods, a rod through a cone): stations solved where the ball touches both faces, the tool lofted through their sections (C² cubic, patches breaking where the contacts cross seams), applied by the analytic Boolean told which tool faces touch the body only along their contacts (`contactFaces`). Forced on closed-form cases it matches them to 1.7e-7–2.8e-6 of the fillet; contacts within 2.5e-7 mm of their faces, G1 to 1e-4°; a report per fillet (`fillet` on the output). Refusals `CONTACT_LEAVES_FACE`, `APPROX_TOLERANCE_NOT_MET`; open general chains wait for R10.2b. Conformance `r10/general-*`; a flow step (pipe tee). The pipe clamp's B-rep lug: each edge by R10.1, the loop needs R10.3 (D89).
- **R10.2b** (D90): open chains of general edges — the tool runs past a convex end where the body ends (the junction marched past the edge, the Boolean trimming it) or is clipped by an oblique end face's plane; square ends, ends at curved or several faces and ends meeting another finished edge are refused (R10.3). R10.1's closed-form tools now end at an oblique end face as well (they stopped square: 0.6–1.5 % over). Contact cuts made once, as exact pieces of the tool's curves: the pipe tee 3109 → 82 edges, 1.8 s. Names across a radius edit settled (D89): face references stand, open-end edge references re-match. Conformance `r10/general-oblique-groove`, `translational-rod-across-oblique`, `plane-rib-oblique-ends`, `refuse-overflow-end`; a flow step (oblique groove).
- **R10.3a** (D92): the ball rolls round an edge at an inside corner — a box boss's whole foot, the pipe clamp's lug loop on its tube (the coordinator's case), an L-plate's inner corner under a rounded top — one tool for the chain, its corner a canal surface about the edge (a horn torus quarter on a plane), closed forms to 1e-8; rolling-ball chains mitred with another finished edge at convex corners of planes. A corner of three finished edges is refused `[VERTEX_BLEND_UNSUPPORTED]` (R10.3b). Conformance `r10/corner-*`, `refuse-vertex-blend`; a flow step (box boss).
- **Mass on trimmed patches** (D91): quadrature no longer declines where a fillet's mesh reaches its patch's edge (a derivative's stencil stepped off the domain) or where a revolved face is cut along a parameter line (zero-area slivers in its triangulation): 200 random cone-rim fillets all by quadrature (7 fell back before), the oblique groove too (its tessellated value was 9e-6 of the part high).
- **R10.3b** (D93): corners of three finished edges — all concave between planes (a pocket's corner) the ball's eighth, as convex ones had; the two ways round (a boss's uprights and foot, an L-plate's inner upright and top) in two passes in one feature, the odd one out first. Closed forms to 1e-10 (the pocket's to its corner patch's quadrature, 2e-4 of the fillet). More than three edges at a mixed corner refused. Conformance `r10/corner-pocket`, `corner-boss-uprights-and-foot`, `corner-l-plate-top-and-inner-upright`; a flow step (boss, 8 edges).
- **R10.3c** (D94): R10.1's closed-form fillets ending at a cylinder across the edge (a rod's feet at a round plate's rim) run past and are cut by it near that end — they stopped square, 1.7–6.5 % over; across a seam of the rim, or where the Boolean fails, square as before. A general fillet ending square on a plane, at a cylinder or at several faces stays refused: the analytic Boolean fails there (coplanar sections, coincident cylinders). Conformance `r10/translational-rod-across-disc`, `refuse-general-end-at-cylinder`; a flow step (rod on a disc).
- **R10.4a** (D95): overflow over smooth edges — the ball's contact running off a face onto a round already made rolls on over it; R10.1's closed forms no longer reach past a smooth edge onto another surface (a rounded boss's large foot fillet was 7.8 % over, silently) and hand such a chain to the rolling ball. Pappus to 9e-8. Conformance `r10/overflow-boss-rounded-top`; a flow step.
- **R10.4b** (D96): overflow onto a sharp edge — where a rolling-ball fillet's contact would run off its face across a sharp edge, the ball rolls on along that edge (a cliff), the fillet meeting it there (a pipe tee with a short branch, refused at R10.2a, builds). Against Pappus round a boss's sharp rim to 7e-8 (forced; R10.1 still refuses a closed form larger than its face). Conformance `r10/cliff-tee-short-branch`; a flow step.
- **The plane–plane reach past a round** (D97, the coordinator's fix): a straight plane–plane fillet or chamfer whose face runs onto a round already made — a concave one was not checked at all and built valid but wrong (a riser's foot past its rounded top 3–121 % over); now checked convex and concave, a fillet handed to the rolling ball (it rolls over onto the round, closed forms to 1e-7, convex too where it refused), a chamfer refused. The rolling ball's own check no longer skips contacts within 2r of an end run past (only those beyond the end). Radii the analytic Boolean cannot close are refused typed (R10.B). The concave wedge chamfer's square ends found here: fixed in D98. Conformance `r10/overflow-step-concave-fillet`, `refuse-concave-chamfer-past-round`; a flow step.
- **R10.5b** (D103): conic and G2 fillet sections — `section: { kind: 'conic', rho } | { kind: 'g2', tension? }`, between the ball's contacts: the rational quadratic to the faces' corner (weight ρ/(1 − ρ)), or a quartic tangent there and curving as each face does across the contact (G2, read from the face's own surface). The rolling ball's chains, with a varying radius too; not round a corner (CAPABILITY). Two arrangement defects found by the second-order contact fixed (half-edge order by chords; Newton's stall at a touch). Closed forms to 1e-9 on planes (convex, concave), a groove's rim curving as its cylinder to 1e-5; closed loops within the loft's reported deviation (a boss's foot 3.5e-7, 1024 stations 5e-9). Studio: Section, Rho, Tension in the Fillet HUD. Conformance `r10/conic-parabola-box-edge`, `g2-step-foot`; a flow step.
- **No sliver at a trimmed end** (D102): a rolling-ball tool's patch break near an end the Boolean trims is moved until its section clears the end plane — a section straddling it left a two-vertex lens (the variable groove at 175/200/350 stations, 1e-4 mm³; a constant groove's one rim, 2.8e-3 mm³, its mirror image clean). Strict checks now flag such lenses. Same volume at every station count; the two rims equal to 1e-11.
- **Determinism** (D101): the order dependence reported at D100 was a misdiagnosis (342 against 350 stations). Every conformance case and RB corpus part matches to the bit in order, in reverse and again; the module-level caches were reviewed; `test/determinism.test.mjs` keeps eight models to the bit. The station-count sensitivity of a trimmed-end sliver stays D100's follow-up.
- **R10.5a** (D100): variable-radius fillets — `radii`, the radius at points of the edges, a shape-preserving cubic between them by arc length (two points: linear; periodic round a loop); the section at each station the ball of that radius centred in the plane square to the chain. Closed forms: straight edges to 1e-11 (convex and concave), a boss's foot periodic to 3e-8, curved faces within 1e-7 of the part of twice the stations. Rolling-ball chains only (not where the ball rolls round or onto an edge). Studio: an End radius in the Fillet HUD. Conformance `r10/variable-radius-linear`, `variable-radius-boss-foot`; a flow step.
- **R10.B** (D99): the analytic Boolean with tool faces coinciding with or lying along body faces — four of the five blocked items build. The rolling ball's tool capped in an end face's plane (D97's foot past a round, every radius tried, oblique and square ends, closed forms to 1e-7); general fillets ending square on a face (D90/D94; refused typed where the Boolean still cannot close one); the coaxial cone-rim TODO (D88: the property 200/200); the corner ball turned off its pole (D93: rounded boxes 1e-7 of Steiner, a pocket's corners 8e-7 of the fillet). Fixes: the tool's break on the end plane, exact cut ends on planes, duplicate curve cuts, the arrangement's order at tangent vertices, two-ray classification, a NaN ray step (an untyped failure in HEAD). A general fillet ending at a cylinder stays refused (measured). Conformance `r10/overflow-step-square-ends`, `coaxial-cone-rim-tangent`, `rounded-box-corner-balls`; a flow step.
- **The wedge chamfer's ends** (D98): a straight plane–plane chamfer ends in its end face's plane — a filling one stopped square (2.6–17 % over at oblique ends), a cutting one ran past into a wall (30 % over); a cutting one still runs past where the body ends. Closed forms to 1e-12. Conformance `r10/wedge-chamfer-oblique-ends`, `wedge-chamfer-into-wall`; a flow step.
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

**Two lanes (owner, 2026-10-19):** "B로 가자. 커널 줄은 트랙 경계마다 새 세션으로 이어 가고, 커널과 무관한 바깥 줄(R11b DXF → R14 → A5 → RM) 구현 세션을 하나 더 띄워서 병렬로 진행해. 합치기는 네가 순서대로 해줘."
(Go with B: the kernel lane goes on in a new session at each track boundary, and one more implementation session runs the outer lane, which is independent of the kernel, in parallel. The coordinator merges, in order.)
- **The kernel lane** works on this branch, `review/cad-gpu-engine-2026-10-14`, the integration branch. Its order is R11 → R12 → FR1–FR4 → R12b → R12c → RD / IM / CNC → … It keeps `decisions.md` (D-ids) and this §0.
  - It is handed over at every track boundary: a hand-over block at the top of §0, a checkpoint, then a fresh session.
  - It owns the kernel core files (see the hand-over block above).
- **The outer lane** covers R11b DXF writer → R14 drawings → A5 → RM. It works in its own worktree and branch, cut from this branch's tip.
  - It keeps its own decision log, `handover/decisions-outer.md` (ids O1, O2, …), and its own §0 subsection.
- **Merging:** the coordinator merges the outer lane's steps into this branch, in order, only while the kernel lane is idle after a checkpoint with a clean tree. It then runs the checks.

**Next, in this order:**
1. Kernel lane: **R11** general shell/offset (R10 done: D87–D103; R11 S0 done: D105; R11.1a done: D106; R11.1b done: D107; R11.1c done: D108 — R11.1 done; R11.2a done: D110; R11.2b done: D111; R11.2c-1 done: D112; R11.2c-2 done: D113 — R11.2 done; R11.3 done: D114 — **R11 done**) → **R12** sheet metal (S0 done: D115; R12.1 done: D116; R12.2 done: D117; R12.3a done: D118; R12.3b done: D119; R12.4 done: D120; R12.5 done: D121 — **R12 done**) → **FR1–FR4** frames (S0 done: D122; FR1 done: D123; FR2 done: D124; FR3a done: D125; FR3b done: D126; FR4a done: D127; FR4b done: D128 — **FR done**) → **R12b** gears+ (internal, bevel, worm; including the R6a.6 trochoid root; S0 done: D129; R12b.1a done: D130; R12b.1b done: D131; R12b.2a done: D132; R12b.2b done: D133) → R12c machine elements (IM1–IM6 and CNC1–CNC6 moved to the outer lane, below). Outer lane: **R11b DXF writer** → R14 drawings → A5 (DSL/MCP) → RM1–RM6 robot kinematics → RD1–RD3 dynamics and actuator sizing (moved from the kernel lane, coordinator 2026-10-20: they sit on the outer lane's `src/robot` model). → **IM1–IM6 injection moulding, then CNC1–CNC6 machining** (moved from the kernel lane by the coordinator, 2026-10-21: DFM analyses, drawings and process rules, like the outer lane's AM printability; each track with an S0; a stage that needs a kernel-core change stops and goes back to the kernel lane). A6–A8 (inputs, multi-agent) were not named in the two-lane decision; the coordinator assigns them.
   - R10 / R11: design input `handover/notes/research-r10-r11-fillet-shell-2026-10-18.md` (stages R10.1–R10.5 taken as R10's order by its S0, D87; R11.1–R11.3 taken as R11's order by its S0, D105, with its changes).
   - R12: no research note; its S0, D115, is the design input (stages R12.1–R12.5, data rules, what is not in R12).
   - A5 (DSL, one tool layer for the chat and an external MCP server): design input `handover/notes/research-cad-server-2026-10-18.md` (the owner, 2026-10-18: option 0 — order unchanged, the note kept as A5/A7 design input only).
   - A7 (multi-agent v1, the Integrator's op patches against a base revision): design input the same note.
   - R14 (automatic drawings): design input `handover/notes/research-draftwright-2026-10-19.md` (a web drawing editor's flow: grouped hole dimensions, feature callouts, a drawing issue list; order unchanged).
   - A6 (inputs): design input `handover/notes/research-draftwright-2026-10-19.md` (its spec-question panel: required vs. worth-a-check, accept-all, nothing blocked).
2. Later stages: RD4–RD10, RM7–8, AM6–7, IM7–8, CNC7–8, FR5–6, DWG/SAT import.
   - **RD4–RD8 held** (owner, 2026-10-20, #2177's CAE decision; O46): FEA and the mesher are off the roadmap. RD9 and RD10 only without FEA.
   - PCB/ECAD: see `handover/notes/research-pcb-ecad-2026-10-19.md`, not scheduled; deferred by the owner (2026-10-19).
3. RB5–RB9.

Scope and acceptance per track: §4 below ("Mesh bodies and SubD roadmap", "Standard elements, manufacturing and robot tracks") and the coordination note.

### Outer lane (owner, 2026-10-19: a second implementation session; the coordinator merges it into this branch)
Order: **R11b DXF writer** → R14 automatic drawings → A5 DSL + MCP → RM1–RM6 robot kinematics (→ RD1–RD3) → IM1–IM6 → CNC1–CNC6 (coordinator, 2026-10-21). Its own
decision log `handover/decisions-outer.md` (O1, O2, …); conformance in `conformance/r11b/`, `r14/`, `a5/`, `rm/`; it
stays out of the kernel's core files (requests for them go through the coordinator to the kernel lane).
- **R11b** (O1): done. `writeDxf` (kernel `dxf-writer.ts`): AC1015 by default, R12 option; LINE, ARC, CIRCLE, ELLIPSE,
  LWPOLYLINE with bulges, SPLINE, TEXT/MTEXT, SOLID, HATCH, INSERT/BLOCK, DIMENSION with its block; layers, line types
  and weights, `$INSUNITS`; Windows-1252 text; typed refusals; R12's changes counted, curves within an explicit
  tolerance. Studio: the drawing sheet at true size (layers by pen, the title block a block, DIMENSION entities,
  the section a HATCH), section A–A alone 1:1, a sketch's profile 1:1 (history menu). Oracle ezdxf 1.4.5 run
  outside the product: every case audits clean, its reading matches to 1e-9. Opening in a free viewer: the
  owner's L1 check. Flat patterns: with R12.
- **R14** (design input `notes/research-draftwright-2026-10-19.md`), steps R14.1 auto-dimension → R14.2 issue list →
  R14.3 views and layout for the dimensions → R14.4 tolerance/GD&T suggestions → R14.5 agent tools and pitch circles (O2).
  - **R14.1** (O2): done. The drawing's “Auto” button: overall sizes, steps, hole positions from the view's extremes
    (a row at one pitch as `3× 20`), one callout per kind of hole with its count (`4× Ø6.6 THRU`, the feature's
    THRU/DEEP/thread/counterbore/countersink); its own replaced, hand-placed kept; skipped and crowded sides listed.
    Conformance `conformance/r14/` (six parts). Fixed: a pattern copy's diameter reads the hole's callout.
  - **R14.2** (O3): done. The drawing's ISSUES card: lost, overlapping, over-lines and off-sheet annotations, views that do
    not fit (errors); duplicates, re-matched references, holes without size or position, unlocated steps, missing
    overall sizes (warnings); a fix each where safe (remove, move clear, accept, automatic scale, Auto-dimension) and Fix
    all. Conformance `conformance/r14/issues-*` (five drawings).
  - **R14.3** (O4): done. "Auto" lays out first: the right view left out when it adds nothing, room per view side for
    the rows (`settings.room`), the largest scale and the sheet that give a clean drawing with holes ≥ 2.5 mm on paper
    (an estimate), then auto-dimensions. View switches for the right and isometric views; VIEW_NEEDED for a hole round
    only in a hidden view. Conformance `conformance/r14/layout-*` (five parts). Deferred: R14.3b, choosing the front side.
  - **R14.4** (O5): done. TOLERANCING card: a ± or geometric mode; suggestions with their basis, accepted one by one
    or all — a general note (an estimate), ± on hole positions (T/(2√2)), datums A B C from the largest flat sides, a
    position frame per kind of hole with basic locations. T from the studio's ISO 273 fastener data: floating
    (H − F) or fixed ((H − F)/2, mating medium clearance assumed), else an estimate said so. No fit codes (no sourced
    limits-and-fits table). Conformance `conformance/r14/tol-*` (four drawings).
  - **R14.5** (O6): done. Pitch circles (`Ø40 PCD · 6× EQ SP`, a point at their centre) for holes evenly round a point,
    located by a bore on the centre or by the circle's own centre; the agent's drawing tools (`drawing_issues`,
    `tolerance_suggestions`; `auto_dimension`, `fix_drawing`, `accept_tolerances`, `set_drawing` only as proposals).
    Conformance `conformance/r14/pcd-*` (four parts).
  - **R14.3b** (O7): done. `orientation` (none: −Y, as every saved drawing): the front from −Y, +X, +Y or −X; turning
    re-maps every annotation to the view showing its axes or is refused, typed (ORIENTATION_REMAP_FAILED, SECTION_ACROSS);
    section A–A square to the front's depth; Auto takes the side that tells more when nothing by hand ties it.
    Conformance `conformance/r14/orient-*`.
- **A5** DSL + MCP (design input `notes/research-cad-server-2026-10-18.md`): S0 done (O8) — 57 tools, a 64.5k-character
  tool list every turn, a per-turn MCP on a state file without annotations or output schemas; a script is 2.5× smaller
  than op JSON per part, so its value is fewer calls and a smaller surface. Steps: A5.1 tool contract v1 → A5.2
  `run_script` → A5.3 consolidated tools (≤ 15k characters) → A5.4 external MCP + CLI → A5.5 A/B (live runs on a go-ahead).
  - **A5.1** (O9): done. The tool contract `barocss-cad-tools-v1`: every tool classified (read / adds / alters),
    MCP annotations, output schemas and structured results for read tools, frozen in `src/chat/tools-v1.json` with a
    breaking-change test. tools/list 76 697 characters (64 531 before), system prompt 6 588.
  - **A5.2** (O10): done. `run_script` (`barocss-cad-script-v1`): a JS-like script (const, for … of range, if, arithmetic,
    handles naming a feature's faces by role) whose commands and features run as tool calls, all or nothing, typed errors
    with their line; proposable. Conformance `conformance/a5/`. tools/list 79 171 characters, system prompt 6 870.
  - **A5.3** (O11): done. The consolidated tools `barocss-cad-tools-v2`: 13 tools, each action a v1 tool (one layer,
    the same gates), `describe` for the detail, `CAD_TOOLSET=v2` to serve them (v1 the default until A5.5). tools/list
    10 985 characters (v1 79 171), system prompt 7 094 (v1 6 870); the whole suite replays through v2.
  - **A5.4** (O12): done. `cad-mcp --doc part.bcad` (any MCP client; each change saved atomically with its blobs;
    local files only; the studio's gates) and `cad-cli run script -o part.bcad [--step] [--stl] [--check]` (exit 3 on a
    failing hard requirement); scripts may state `requirements([...])`.
  - **A5.5** (O13): harness built, dry run done. `pnpm ab --scripted`: 10 RB9 briefs × json | hybrid × 3 runs through the
    real chat server, a hidden kernel oracle; all 60 pass. Ideal calls 6.4 against 2, estimated input 152k against 14k
    tokens a brief. Live runs (`--live` with `CAD_AB_LIVE=1`) wait for the owner: about 5M input tokens at the least,
    about 17M if an agent makes 3× the ideal calls. Report: `notes/ab-dry-run-2026-10-20/`.
- **RM** robot kinematics:
  - **RM1** (O14): done. The mate graph as a joint tree (`src/robot/joints.ts`, `doc.robot` v1): each pair's joint read
    from its mates' free twists (fixed, revolute/continuous, prismatic, dummy-link chains for cylindrical, planar, ball;
    the rest typed MOTION_UNSUPPORTED), a minimum-freedom spanning tree from the base link, loops reported, gear pairs
    coupled (mimic −z1/z2), limits by pair key; tools get_joints / set_joints (proposed); a Joints card. Conformance
    `conformance/rm/`.
  - **RM2** (O15): done. FK by the product of exponentials (`src/robot/fk.ts`): planar 2R to 1e-9, equal to the
    moving-axis form on random 3D trees; gear followers with the tooth phase re-checked and held at every pose; joint
    sliders, Home and play in the Joints card, a preview on copies (nothing saved); tool forward_kinematics.
  - **RM3** (O16): done. Link inertia (`src/robot/inertia.ts`): bodies combined at their densities by the parallel-axis
    theorem, `I_L = Rᵀ I R` in the link frame (at the joint, Z on its axis), SI; principal moments by Jacobi; SPD and
    triangle checks typed. An analytic rotated off-origin cuboid to 1e-12; tool link_inertia; masses in the Joints card.
  - **RM4** (O17): done, except the external oracle. URDF export (`src/robot/urdf.ts`): frames at the joints, RM3
    inertials, meshes and own-quickhull collision hulls in metres, mimic for gears, typed refusals; our reader checks
    the URDF spec's structure, and its FK equals RM2's to 1e-12. Export URDF (zip), `cad-cli urdf`, tool export_urdf.
    **Pending**: MuJoCo/PyBullet comparison (`scripts/urdf-oracle.py`, commands in O17) on the owner's go-ahead.
  - **RM5** (O18): writer checkpoint; acceptance pending. MJCF export (`src/robot/mjcf.ts`) on the shared robot model;
    our reader checks MuJoCo's structure, and FK equals RM2's and the URDF's to 1e-12; the 6R arm document
    (`conformance/rm/arm-6r`); Export MJCF, `cad-cli mjcf`, tool export_mjcf. **Pending**: the gravity hang in MuJoCo
    (`scripts/mjcf-oracle.py`, commands in O18).
  - **RM6** (O19): done. The collision sweep (`src/robot/sweep.ts`): conservative advancement with a pose-independent
    bound `Σ|Δq_i|·r_i`, the clearance by GJK on the hulls (our own) and exactly on the meshes where those meet; the
    whole path certified. A 2R arm meets a post within 1e-4 rad of a plane oracle; the 6R arm against a dense sweep.
    Check path in the Joints card; tool sweep_path. Conformance `conformance/rm/sweep-post`.
- **RD** dynamics and actuators (moved from the kernel lane):
  - **RD1** (O20): done. Static gravity torques G = ∂V/∂q (`src/robot/dynamics.ts`) from RM3's masses at RM2's pose;
    planar 2R and 3R closed forms to 1e-9, finite differences of the potential energy on random 3D trees; tool
    gravity_torques; the holding torque per joint in the Joints card. Conformance `conformance/rm/gravity-3r`.
  - **RD2** (O21): done. RNEA over the tree; M from the Jacobians (its oracle), the 2R Lagrangian to 1e-9, the kinetic
    energy from FK velocities, M SPD, the energy balance along a move; trapezoid and jerk-limited S-curve profiles by
    their closed forms; peak and RMS torque with stated sampling (segment ends, 256 a segment, golden-section peaks).
    Tool motion_torques. Conformance `conformance/rm/move-2r`.
  - **RD3** (O22): done, its worked-example check pending. Source records `{v, unit, src}` (a product page's URL, the
    date read and its label, or a flagged estimate with why); maxon 608131 and 18 Harmonic Drive CSG-2A-LW sets from
    their HTML pages, five reducer values estimated (not on the pages). The solver checks every motor × reducer pair
    over the move out and back with dwells: motor RMS, the torque–speed line, speeds, inertia ratio, the reducer's
    repeated peak, cube-mean torque, average input speed, L10. It takes the lightest pair that passes, refined and
    checked again. Closed forms to 1e-9. Tool size_actuators. Conformance `conformance/rm/size-1r`.
- **A6** inputs (coordinator, 2026-10-20; after RM1–RM6 + RD1–RD3):
  - **A6 S0** (O23): done. Scope and acceptance frozen for A6.1 brief template, A6.2 clarifying policy, A6.3 locked
    reference body, A6.4 drafts from images and drawings, A6.5 standards data with provenance. Acceptance is
    deterministic (the scripted agent, fixtures for briefs and answers); no live-model run without the owner.
  - **A6.1** (O24): done. The brief in the document (`src/chat/brief.ts`): purpose, process and material required, each
    field with its basis and the user's words; an assumption never replaces what the user stated (typed refusals);
    gaps with their questions; a stated process with rules becomes the part's (CNC and sheet metal as intent); a
    stated library material is the bodies'. Tools set_brief, get_brief; the Brief section in the Browser with
    Confirm. Conformance `conformance/a6/briefs` (10 hand-written cases).
  - **A6.2** (O25): done. A quote said to be the user's is checked against what they typed this conversation
    (SOURCE_NOT_SAID; without a conversation, stated but unverified), for the brief and the requirements; only the user
    confirms; ask_user holds the policy (≤ 5 a batch, ≤ 2 batches, one open, each naming a gap get_brief reports or an
    assumed hard requirement, else NOT_BLOCKING); the Specify panel (answers, skip, accept all) writes answers as the
    user's and sends them to the chat. Conformance `conformance/a6/questions` (8 hand-written cases).
  - **A6.3** (O26): done. Locked reference bodies kept outside the part's tree (`doc.references`, src/chat/references.ts):
    evaluated on their own, placed, ghosted; no feature may use them (REFERENCE_LOCKED); in no mass, export or print
    check. Datums from their faces' exact surfaces (1e-9), verified on open; sketch planes, measure and
    datum_distance. Keep-outs (box, cylinder, envelope + offset): overlap exact, clearance exact on the meshes, the
    chord tolerance stated, undecided within it. The Reference bodies card. Conformance `conformance/a6/references`.
  - **A6.4** (O28): done. Features from an image or a DXF drawing are drafts (`doc.drafts`): their dimensions (scaled,
    or read from the drawing) unconfirmed until the user confirms them in the Drafts list or by answering a question
    (ask_user blocks {dimension}); another value re-drives the features. Unconfirmed: check_spec unknowns, export
    warnings. Our own DXF reader (LINE, ARC, CIRCLE, LWPOLYLINE, POLYLINE; $INSUNITS; typed refusals). PDF drawings
    are not read (no renderer). Conformance `conformance/a6/drawings`.
  - **A6.5** (O29): done. One provenance format for standards-derived tables (a source per value: page, standard,
    derived, estimate or own, with its licence; GPL, share-alike, non-commercial and unknown refused). The fasteners
    are migrated to per-field and per-row sources with their values unchanged (a snapshot), and the tolerances and
    material densities are registered. standards_lookup. A test holds prompts and tool descriptions to standard
    numbers from an allowlist, with no quotes. Conformance `conformance/a6/standards`.
  - **A6 done** (O23–O29). Next per the coordinator: A7 (its single-versus-multi comparison needs live runs: the
    owner's OK).
- **A7** multi-agent v1 (coordinator, 2026-10-20):
  - **A7 S0** (O30): done. The deterministic core frozen: patches on a base revision (STALE_BASE, explicit rebase); the
    Integrator's serial gates (validity → interference/clearance → interfaces → DFM → analysis), typed verdicts, a
    trace per patch; roles as interfaces, the Verifier given artifacts and requirements only; exposed as `src/team/`
    and `cad-cli team`, no new chat tools. The live single-versus-multi comparison pending with its protocol.
  - **A7.1–A7.4** (O31): done. `src/team/`: revisions (64-bit, canonical), patches (STALE_BASE, explicit rebase), the
    Integrator's serial gates with typed verdicts (applied, rejected, held, stale) and a byte-reproducible trace;
    roles as interfaces; the Verifier's built, frozen view; scripted roles; `cad-cli team`. Ten seeded-defect
    scenarios in `conformance/a7/scenarios`. No new chat tools. The live comparison waits for the owner (O30).
- **A8** multi-agent v2 and v3 (coordinator, 2026-10-20):
  - **A8 S0** (O32): done. A8.1 parallel read-only DFM and Analysis reviewers, and a Drafting agent on a frozen
    revision; A8.2 the Architect's interfaces, Part agents with leases; A8.3 ECRs with impact and the user's approval;
    A8.4 the Assembly integrator and a BOM agent; A8.5 per-role precision and recall on seeded defects. Scripted, no
    new chat tools; live numbers pending (O30).
  - **A8.1** (O33): done. Parallel read-only DFM and Analysis reviewers on their own frozen views, joined by role name;
    a Drafting agent with drawing ops only on a frozen revision (STALE_BASE, NOT_A_DRAWING_OP, DRAWING_ISSUES).
    Six scenarios in `conformance/a8/scenarios`.
  - **A8.2** (O34): done. The Architect's interfaces (`doc.interfaces`: hole patterns, envelopes, budgets, datums,
    keep-outs; their own revision); leases; Part agents' patches checked: lease (NO_LEASE, LEASE_EXPIRED,
    CONTRACT_MOVED, OUT_OF_PART), validity, contract (OUT_OF_ENVELOPE, HOLE_OFF_PATTERN on the exact cylinders,
    OVER_BUDGET). Eight scenarios in `conformance/a8/scenarios`.
  - **A8.3** (O35): done. ECRs (`doc.ecrs`): changes and impact computed (parts, requirements, open patches,
    leases); only the user decides (APPROVAL_IS_THE_USERS); approved, the interfaces move, the touched leases stay on
    the old contract (CONTRACT_MOVED until renewed), the untouched ones move; rejected, nothing changes; STALE_ECR,
    DECIDED, NO_CHANGE. Fixture `conformance/a8/scenarios/ecr-move-pattern.json`.
  - **A8.4** (O36): done. The Assembly integrator's gate after each part (PARTS_MEET; PARTS_TOUCH undecided;
    PATTERN_MISALIGNED on every built part; OVER_TOTAL_BUDGET on the whole); the read-only BOM agent (derived lines,
    checked against the assembly, library sources). ECR decisions only through a minted user token.
  - **A8.5** (O37): done. Per-role precision and recall on the seeded defects (29 labelled scenarios; `cad-cli team
    --metrics`): the scripted roles at 1 and 1, with the confusion counts; the metric checked on mislabels and on a
    Verifier that rejects all. Declared contact (a shared pattern or a mate) passes as EXPECTED_CONTACT; undeclared
    touching is held.
  - **A8 done** (O32–O37). Live numbers pending the owner (O30).
  - **#2177** (O39, the owner's decision): approval baselines, result freshness and the export bundle into A8 (the S0
    addendum to O32: A8.4b → A8.5b → A8.6); CAE (FEM) a reference only. Material and display looks checked apart (no
    inference; a test keeps it so).
  - **A8.4b** (O40): done. Baselines pinned by SHA-256 of canonical JSON (BOM, interfaces, every part's revision),
    chained to their parents; draft → review → approved | rejected by the user's token only; frozen once decided;
    tampering named on read-back; an approved ECR pins what it approved.
  - **A8.5b** (O41): done. Every result stamped with what it read (model, material, process, interfaces, references,
    requirement, drafts, drawing; faces by A1 signature); current, stale (input named) or unresolved (gone, ambiguous,
    renamed — never re-targeted; A1's re-match carried in); stale never shown as current nor approved on; late results
    kept under their own run; failed, unsupported, non-converged never 0 or a pass.
  - **A8.6** (O42): done. The export bundle (`cad-cli bundle write | verify`): the document, the approved baseline chain,
    sourced materials, results with freshness, ECRs and a manifest of SHA-256s; read back in a fresh process from its
    files alone, every pin checked; missing, changed and stale listed; never complete when anything is.
- Kernel lane's intermittent flow step 116 (R10.3c, a wrong body once in four runs): its log and screenshot are in
  `notes/flaky-step116-flow12.log` / `.png`.
- Pending decisions (outer lane, reversible defaults taken): cad-mcp's default autonomy is L2, the studio's (O12); `--autonomy 4` is one flag.
- Waiting for the owner: A5.5's live A/B runs (O13; the cost estimate there).
- **Drawing table** (O49 S0, O50): done. A generic table on drawings (header, units, anchor; auto-placed clear; R14's issue
  check and a move fix; SVG, PDF and DXF through the existing writers, ezdxf audit clean); R12's bend table on it (BA, BD
  by the kernel's formulas; a shop row's 4.2). Its API is for the kernel lane's FR4b cut list (`TABLE_SOURCES['cut-list']`).
- **RD4–RD8 held** (O46, the owner, 2026-10-20: "RD4~RD8(FEA·메셔)도 CAE로 보고 로드맵에서 빼서 보류해. RD9·RD10은 FEA 없이 가능한 범위만."). Outer lane order: RM7 (done, O44) → RM8 (done, O45) → RD9 → RD10, deterministic parts only, each with an S0.
- MuJoCo 3.3.0 run (O38, the owner's go-ahead): RM4's URDF oracle passed (worst 2.2e-16), RM5's MJCF oracle passed after the equilibrium start and the contacts were found (gravity torques against RD1's to 4.4e-14; passive energy 1.0e-6; the damped hang settled, 8.8e-13 rad/s). RM4's external check and RM5's acceptance are closed.
- Waiting for the owner: A7's live single-versus-multi comparison (O30: tasks, equal token budget, metrics, 10 runs a task an arm).
- Waiting for the owner: the legal review of the standards-derived data and the material library before release (A6.5, O29).
- Waiting for the owner: RD3's published worked examples and the catalogue values the HTML pages lack (O22). Both are
  PDFs, and opening one is a download: the Harmonic Drive CSG-2A / CSF catalogue and the maxon motor catalogue.
- Outer-lane follow-ups (logged, not scheduled):
  - Done in O75: the Joints card's masses collapsed; the look- ids; RD3's stop check and coupled sizing; datums as mate targets.
  - RM6's mesh distance where hulls meet is box-pruned, not a BVH: the R3.2 BVH needs a kernel export over raw triangles
    (`bvhOfTriangles`), a kernel-core change (O75: skipped, listed for the coordinator).
  - RD3's refinement is most of its 735 ms (an RNEA per probe for one joint); coupled sizing (O75) runs it once a round.
  - A6.3's datums mate (O75). The tool contract's overhead: 13 470 of
    A5.1's 15 000 guard after O27's trim (from 14 804); 1 530 left.
  - Known flaky timing check (O27): PERF3 C16 in `test/cageEdit.test.ts` (the kernel lane's file) failed once in the full
    suite under load; its slowest warm step against the cold one is typically 0.025 of the 0.5 limit, so a single ~5 ms
    stall fails it. The threshold is unchanged.

### Standing rules
- Own TypeScript implementation: no WASM, no new runtime dependencies. External engines are reference or test oracle only.
- No functions inside functions on hot paths (per frame, per element, per sample): hoist them to module level.
- Two implementation lanes (above), each serial; parallel agents only for read-only research.
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
- **Bend tables (D120, decided 2026-10-20, D121):** "SendCutSend 굽힘표는 내장하지 말고, 사용자가 자기 공장 표를 불러오게 해." (Don't bundle the SendCutSend bend table; users load their own shop's table.) No table is built in; the SendCutSend values stay in `notes/research-r12-bend-data-2026-10-20.md` as a reference only.
- **Frame section sizes (D122, decided 2026-10-20):** "프레임 단면 치수도 굽힘표처럼 내장하지 말고 사용자가 불러오게 해." (Like the bend tables, don't build in frame section sizes; users load them.) No catalogue is built in; the studio's prefills are estimate-flagged.
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
- **The join at a concave edge in a shell (D106):** the upright route erodes its sections in 2D, so its vertical concave edges get an arc of the wall's radius (an L-section shelled 2: 6610.27 mm³); the general route meets the offsets sharply (6624 mm³); ledges are sharp in both.
  - Taken: each as it is.
  - To change: say sharp or arc, and the other route follows (a versioned shell node). The general route's join is one switch since D107 (`join: 'sharp' | 'arc'`; arc refuses a vertex of concave edges for now).
- **The clamp's lug and hole (D84):** the coordinating session's message said the lug's plane is square to the tube's axis and the hole's axis parallel to it; the reference image shows the lug along the tube and the hole across it.
  - Taken: the image (the lug's plane holds the tube's axis, the hole square to it).
  - To change: the other reading is a lug from a ring of rim faces; say so and it is added as a second case.

### Open TODOs and known defects
- **Analytic Boolean, one union order** (D107, D108): four of a notched box's slabs at t 3 (end, top, floor, then one wall last) fail ("an edge with one use"; the wall's slab swallows a 0.89 mm convex edge of the end slab whole); every other order closes. The shell retries by halves (D108); the Boolean's root not traced.
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
- **A round-cornered ordered frame is slow** (D126): the palette's default table of round-cornered tubes takes about 7.5 s (the trimmed envelopes' curved Booleans; sharp tubes 0.1 s). It runs in the engine worker, so the studio stays live (measured by a flow step). Candidates: envelopes shared across a joint, cheaper envelopes, the analytic Boolean's speed.
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
- **The flow's Playwright (`PW_DIR`, owner 2026-10-19: "download Playwright and use that"):** the flow needs only the `playwright` package; it drives the system Chrome given as `CHROME`, so no browser download is needed.
  - It is installed outside the repo, so no manifest or lockfile changes. Its own npm cache is used because `~/.npm/_cacache` has entries this user cannot write (EACCES):
    `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --prefix "$HOME/.cache/barocss-playwright" --cache "$HOME/.cache/barocss-playwright/.npm-cache" --no-audit --no-fund playwright@1.62.1`
  - `PW_DIR=$HOME/.cache/barocss-playwright/node_modules/playwright` (1.62.1).
  - The old npx cache path (`~/.npm/_npx/e41f203b7505f1fb/…`) is gone. The read-only install in another checkout, used for D99–D100, is no longer needed.

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
PW_DIR=$HOME/.cache/barocss-playwright/node_modules/playwright \
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
10. **R10 — general fillet and chamfer** (S0: D87; **R10.1 done, D88**: translational and coaxial fillets in closed form, typed refusals, the true face reach; **R10.2a done, D89**: the rolling-ball fillet of closed general chains; **R10.2b done, D90**: open chains, oblique ends; **R10.3a done, D92**: the ball round an edge at inside corners; **R10.3b done, D93**: three-edge corners; **R10.3c done, D94**: closed-form ends at cylinders; **R10.4a done, D95**: overflow over smooth edges; **R10.4b done, D96**: cliffs; **the plane–plane reach fix, D97**; **the wedge chamfer's ends, D98**; **R10.B done, D99**: coincident and along-face tool faces; **R10.5a done, D100**: variable radius; **R10.5b done, D103**: conic / G2 sections) (on R2/B0): any edge incl. B-spline and cylinder/cylinder; constant
    radius, then variable; vertex blends and setbacks where three or more fillets meet; rolling-ball blends as
    exact NURBS approximations with a reported deviation; clear refusal codes (radius too large, degenerate).
11. **R11 — general shell and offset** (S0: D105; **R11.1a done, D106**: slabs stop at smooth edges and at concave edges beside curved faces, those corners filled with the sharp join; **R11.1b done, D107**: concave plane–plane edges at any angle, vertices of concave edges, the join as one switch; **R11.1c done, D108**: the wall's union retried, typed refusals, shells past a variable-radius fillet — R11.1 done; **R11.2a done, D110**: a smooth closed freeform body (SubD) shelled as its offset cavity; **R11.2b done, D111**: the same with faces opened; **R11.2c-1 done, D112**: trimmed planes and cylinders offset exactly, a pipe tee with its ends opened; **R11.2c-2 done, D113**: bounding planes' bands and regions' slabs for sharp edges — R11.2 done; **R11.3 done, D114**: mesh shells, thicken's fold refused — **R11 done**) for B-spline and facet faces: offset surfaces, then self-intersection
    trimming; failures diagnosed per face.
12. **R12 — sheet metal** (S0: D115; **R12.1 done, D116**: sheet rules, base and contour flanges, role names, the `sheet` report; **R12.2 done, D117**: the flat pattern, its DXF, the studio's flat view; **R12.3a done, D118**: edge flanges, end reliefs, FLANGES_COLLIDE; **R12.3b done, D119**: corner reliefs, no relief defaults; **R12.4 done, D120**: bend tables; **R12.5 done, D121**: acceptance, RB9 rungs 5 and 10 by the agent — **R12 done**): base flange from a sketch, edge flange, bend (radius, K-factor), reliefs, flat
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
(RD4–RD8 held by the owner, 2026-10-20, as CAE under #2177 — O46; the outer lane's order is now RM7 → RM8 → RD9 → RD10, RD9 and RD10 without FEA.)

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
  - **AM7a done (O53 S0, O54, O56)**: `hollow` — the kernel's exact closed shell first (box, sphere, torus exact), else an SDF
    voxel cavity for planar parts; drains into each cavity; the wall measured; route and why reported. A curved body the shell
    refuses: `CURVED_BODY`, waiting on the kernel's F3.
  - **AM7b done (O57 S0, O58)**: `lattice` — a gyroid infill as a separate mesh body in the exact hollow; wall vertices on
    the exact wall, loose pieces dropped, one drain a round until every empty region drains; fraction within the derived bound,
    one solid, no overlap by the kernel's intersection. STEP leaves it out by its `infill` role and says so; 3MF and mass
    keep it (O60).
  - **A6.3 chord tolerance fixed (O55)**: bounded in both directions from the mesh's normals (sphere 0.144, was 0.072; torus
    finite, was unbounded).
  - **A6.3 freeform guard (O59)**: NURBS/SubD faces are unbounded until measured against the exact surface (sampled both ways,
    × 1.25) on request — keep-outs and the assembly gate measure; the plain model undershot a SubD face 1.102 vs 1.143.
  - **AM6 done (O51 S0, O52)**: `split-bed` — the fewest even pieces that fit the bed, dowels or plugs at the fit; volumes,
    bed fit, exact radii and the kernel's no-overlap check; typed refusals.

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
  - RM7 DLS/LM IK: ≥99% of 1000 reachable targets, errors ≤1e-4 m and 1e-3 rad, a singularity flag. **Done (O44)**:
    999/1000 by the oracle FK; worst 9.6e-8 m, 7.8e-7 rad; singular flagged at σmin/σmax < 1e-4.
  - RM8 four-bar loop (closed-form oracle, branch kept, MJCF equality). **Done (O45)**: Freudenstein to 3.0e-14 rad
    over a full turn; BRANCH_FLIP and NO_CLOSURE typed; MJCF <connect> held by MuJoCo (static 4.7e-16 m; passive at 0.1 ms 1.7e-6 m, 3.6e-5 rad).
  - RM9 SDF/USD, CCD, workspace map. **S0 (O62)**: RM9a timed multi-segment CCD with a TOI to 1e-9 s (MuJoCo on the boxes case),
    RM9b a Halton workspace map against the 2R annulus and manipulability, RM9c SDF 1.11 / UsdPhysics export (ours now; the
    usd-core and libsdformat checks wait for the owner's install go-ahead).
    - **RM9 done (O64–O66)**: RM9a TOI to 2.6e-11 s (MuJoCo 9.3e-9 s); RM9b the 2R annulus by exact set relations, the 6R
      reach; RM9c SDF 1.11 and USD, the four formats agreeing to 1.9e-16, FK to 2.2e-13 mm, usd-core 26.8's UsdPhysics reading
      matching; SDF checked by our reader only (the owner declined an SDFormat install).

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
  - **RD4–RD8: held** by the owner on 2026-10-20 under #2177's CAE decision (O46): FEA and the mesher are off the
    roadmap. The rows are kept as history:
    - RD4 beam FEA and modal (cantilever δ, σ, f1–f3 within 0.5%). **Held.**
    - RD5 our own tet mesher. **Held.**
    - RD6 tet4 with Jacobi-PCG on workers. **Held.**
    - RD7 tet10 (NAFEMS LE10 within 3% of 5.38 MPa, LE1 within 2% of 92.7 MPa). **Held.**
    - RD8 solid modal. **Held.**
  - RD9 harness v1 — **without FEA** (O46): RD1–RD3 sizing, RM limits and sweeps, closed-form checks. **Done (O47)**:
    `cad-cli robot-check`; the arm-3r fixture's 80 margins above 0; seven seeded defects each at its own check; closed form to 1e-9.
  - RD10 an agent sizes a 3-DoF arm with every margin above zero — **without FEA** (O46). The deterministic part is
    done first; the L3 evidence needs a live model run, pending the owner, with its protocol. **Deterministic part done (O48)**:
    `cad-cli robot-size`; from 16 failing margins to all above 0 in 8 rounds; BRIEF_INFEASIBLE and NOT_CONVERGED typed.

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
  - **DXF underlay done (O68 S0, O69)**: splines, ellipses, blocks and text from an imported DXF shown grey to trace over (never
    regions); points against ezdxf to 3e-14, blocks against the closed form to 7e-14. **A4 table fix (O67)**: verified A3/scale fix.
  - **S0 done (O61)**: DWG read deferred, SAT import deferred, DWG write no-go — DXF and STEP already reach the need; both
    specs are PDF-only; AutoCAD's 3DSOLID SAT is an undocumented variant. Revisit conditions in the note.

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

Next: see §0 (PERF3 done, D82; R8.2b done: D83; R8.3 and the pipe clamp done: D84; R9 done: D85; R10a done: D86; R10 S0 done: D87; R10.1 done: D88; R10.2a done: D89; R10.2b done: D90; R10.3a done: D92; R10.3b done: D93; R10.3c done: D94; R10.4a done: D95; R10.4b done: D96; the plane–plane reach fix: D97; the wedge chamfer's ends: D98; R10.B done: D99; R10.5a done: D100; determinism checked: D101; trimmed-end slivers: D102; R10.5b done: D103; R11 S0 done: D105; R11.1a done: D106; R11.1b done: D107; R11.1c done: D108; R11.2a done: D110; R11.2b done: D111; R11.2c-1 done: D112; R11.2c-2 done: D113; R11.3 done: D114 — R11 done; R12 S0 done: D115; R12.1 done: D116; R12.2 done: D117; R12.3a done: D118; R12.3b done: D119; R12.4 done: D120; R12.5 done: D121 — R12 done; FR S0 done: D122; FR1 done: D123; FR2 done: D124; FR3a done: D125; FR3b done: D126; FR4a done: D127; FR4b done: D128 — **FR done**; R12b S0 done: D129; R12b.1a done: D130; R12b.1b done: D131; R12b.2a done: D132; R12b.2b done: D133) (R8.2a done: D81; R8.1 done: D80; R7 done: D78; AM1–AM5 done: D72–D76; R6b done: D65–D71; LIB1–LIB4 done: D61–D64; R6a done: D53–D60; the trochoid root moved to R12b, manufacturing validation pending; R6 done: D52; R5 done: D51; R4 done: D50; R3 done: D42–D49).

**Current order (owner, 2026-10-18, all serial):** R1 ✓ → R2/B0 ✓ → RB1 ✓ → RB2 ✓ → RB3 ✓ → all-edge fillet corner ✓ (D22: a validator false positive at poles; geometry and names unchanged) → RB4 ✓ → cylinder − turned-box fix ✓ (D25) → **A1** (A1.1 stable feature ids ✓, A1.1b body keys by id ✓ D26; A1.2 selectors ✓ D27; A1.3 re-match on edit ✓ D28, A1.3b persisted signatures ✓ D29, A1.3c references shown and settled ✓ D30; A1.4 sketch-entity side names deferred, D31) → **A2** (A2.1 facts and inspect ✓ D32; A2.2 analysis tools ✓ D33, A2.3 render_views ✓ D34, A2.4 response format ✓ D35) → **A3** (A3.1 requirements and check_spec ✓ D36; A3.2 mutation check and iteration policy ✓ D37, A3.3 requirements panel ✓ D38) → **A4** (A4.1 transactions and field registry ✓ D39; A4.2 proposals and history ✓ D40; A4.3 rebase, partial accept, autonomy, chips ✓ D41) → **R3** (R3.1 facet faces ✓ D42; R3.2 BVH containment ✓ D43; R3.3 M1 binary blob ✓ D44–D45 (cap 2M); R3.4 M3 repair ✓ D46–D47; R3.5 AP242 tessellated ✓ D48; STEP size caps D49) → **R4** (F1 facet × plane split and section ✓ D50; oblique split of planar bodies fixed) → **R5** (SD1 SubD cage node, regular regions exact ✓ D51) → **R6** (F2 mesh × exact Booleans ✓ D52) → **R6a** (R6a.1–2 spur gear ✓ D53; R6a.3 feature and command ✓ D54; R6a.4a pair checks ✓ D55; R6a.4b meshing gears ✓ D56; R6a.5a profile shift ✓ D57; R6a.5b rack ✓ D58; R6a.5c helical ✓ D59, helical rack ✓ D60; trochoid root → R12b; manufacturing validation pending) → **LIB** (LIB1 format and loader ✓ D61; LIB2 interfaces and fits ✓ D62; LIB3 library nodes ✓ D63; LIB4 panel, sharing rules, agent tools ✓ D64) → **R6b** (R6b.1 screw boss ✓ D65; R6b.2 inserts, standoffs, alignment ✓ D66; R6b.7 materials and process profiles ✓ D67; R6b.3 snap hook ✓ D68; R6b.4 lip and groove ✓ D69; R6b.5 vents ✓ D70; R6b.6 living hinge ✓ D71) → **AM** (AM1 profiles ✓ D72; AM2 overhang map ✓ D73; AM3 rules ✓ D74; AM4 orientation ✓ D75; AM5 3MF ✓ D76) → **R7** (SD2 caps ✓ D78) → **R8** (SD3: R8.1 cage operations ✓ D80; R8.2a editor ✓ D81; PERF3 ✓ D82; R8.2b agent tools ✓ D83; R8.3 end to end and the owner's pipe clamp ✓ D84) → **R9** (QEM decimation ✓ D85) → **R10a** (side ids ✓ D86) → **R10** (S0 ✓ D87; R10.1 ✓ D88; R10.2a ✓ D89; R10.2b ✓ D90; R10.3a ✓ D92; R10.3b ✓ D93; R10.3c ✓ D94; R10.4a ✓ D95; R10.4b ✓ D96; plane–plane reach ✓ D97; wedge chamfer ends ✓ D98; R10.B ✓ D99; R10.5a ✓ D100; determinism ✓ D101; trimmed-end slivers ✓ D102; R10.5b ✓ D103) → **R11** (S0 ✓ D105; R11.1a ✓ D106; R11.1b ✓ D107; R11.1c ✓ D108; R11.2a ✓ D110; R11.2b ✓ D111; R11.2c-1 ✓ D112; R11.2c-2 ✓ D113; R11.3 ✓ D114) → **R12** (S0 ✓ D115; R12.1 ✓ D116; R12.2 ✓ D117; R12.3a ✓ D118; R12.3b ✓ D119; R12.4 ✓ D120; R12.5 ✓ D121) → **FR** (S0 ✓ D122; FR1 ✓ D123; FR2 ✓ D124; FR3a ✓ D125; FR3b ✓ D126; FR4a ✓ D127; FR4b ✓ D128) → **R12b** (S0 ✓ D129; R12b.1a ✓ D130; R12b.1b ✓ D131; R12b.2a ✓ D132; R12b.2b ✓ D133) → … (the full order: "Standard elements, manufacturing and robot tracks" above) → **A5–A8** → **RB5–RB9**.

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
    - **S0 (O70)**: 14 rungs (+ the owner's 2-axis arm) frozen — samplers, hidden predicates, mutants (100 % kill), metrics; ready on
      today's tools: 1–3, 5, 8–10, 12–14; rungs 6 (closed-form beam at the root section) and 11 (translation captivity) need one
      small outer-lane predicate each; held: rung 7's bolt (R12c) and rung 4's machining rules (CNC1–CNC6), both kernel lane.
      Live trials pending the owner.
    - **RB9.1a done (O71)**: `pnpm rb9` — rungs 1, 2, 3, 5, 10, 13 scripted: 30/30 trials (edge values forced), pass^5 = 1, RS 1, 76/76
      mutants killed; report `notes/rb9-scripted-2026-10-20/`. RB9.1b: rungs 8, 9, 12, 14.
    - **RB9.1b done (O72)**: rungs 8 (snap-fit box, material from the brief, no context numbers), 9 (PCB enclosure), 12 (5-part
      assembly), 14 (2-axis arm: RM1 tree, RM9b reach, RD9 margins, URDF FK/inertia) — 50/50 trials on ten rungs, 130/130 mutants;
      a library part's material from the brief (O72).
    - **set_material + RB9.2 done (O73)**: `set_material` (a body's look material; contract overhead 14 544 / 15 000);
      rungs 12 and 14 state steel; rung 6 (beam: Green's-theorem sections on the kernel's cut, σ and δ closed form) and rung 11
      (print-in-place: RM6 translation captivity) — 60/60 trials on twelve rungs, 158/158 mutants. Held: rungs 4 and 7 (kernel lane).
    - **RB9.3 done (O74)**: rungs 4 (machined plate: holes, pocket, corner radii, volume) and 7 (lap joint: mated plates, coaxial
      clearance holes, 1.5 Ø edges) scoped — 70/70 trials on all fourteen rungs, 184/184 mutants; CNC1–CNC6 and R12c's bolt held, named.
    - **Follow-ups (O75)**: Joints masses collapsed; `look-` appearance ids; RD3 stop check (`estop_rad_s2`) and coupled sizing;
      datums as mate targets; the R3.2 BVH under RM6 skipped (needs a kernel export).
- **IM — injection moulding (outer lane from 2026-10-21)**: S0 done (O76) — exact draft on curved faces by projection onto the B-rep's NURBS (a 3° cone to 5.8e-15°; the mesh normal off by 0.014°), straddle by n·d's sign, undercuts by ±d triangle visibility (side hole 0/64), walls by rays; Protolabs' guide readable; IM rules proposed inside `check_printability` (no contract overhead). Next IM1.
  - **IM1 done (O77)**: the injection profile sourced page by page (Protolabs: wall by material, finishes PM-T1 3° / PM-T2 5° / smooth 0.5°, largest part 751 × 480 × 203, ±0.08 mm + 0.002 mm/mm, shrink ABS/PC 0.002); `doc.mould` {pull, finish}; `check_printability` = the manufacturability report naming its process (v2 `query.manufacturability`, `print.check` an alias); pull and finish in the Library panel.
  - **IM2 done (O78)**: the draft field from exact normals (planes, cylinders, NURBS by projection, facets) — drafted / steep / straddle with isocline points on the exact surface; the report's draft rule, `query.draft` and `draft_min` on it; a 3° cone 3° to 1e-9.
  - **IM3 done (O79)**: undercuts by ±d visibility on a sub-triangle grid (the step stated), regions with their side action across the pull (counted, exact); the report's undercut rule (warn with a side action, fail with none); a side hole, a snap latch, an internal groove. Next IM4.

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
