# barocss CAD roadmap

Current as of 2026-10-23, after the Codex import. This file is the one place for **what we do, in what order, and
when each item is done**. It replaces Codex's continuation roadmap of 2026-10-22/23, which is at `0eabecf7f` and on
`codex/cad-coordinator-handover-20261022`.

Details and contracts live in the decision logs: `decisions.md` (kernel, D), `decisions-outer.md` (outer, O),
`decisions-gpu.md` (GPU, G). Each lane's README §0 block says where that lane stands. How the work is run (lanes,
coordinator, verification tiers) is in `notes/claude-resume-2026-10-23/`.

**The goal (owner):** AI takes a brief to a manufacturable, buyable product. A9 is the first end-to-end run of that path.

## Order now (2026-10-24, owner: "로드맵 제대로 정해서 진행해줘")

Each lane works its queue top to bottom. The coordinator merges every checkpoint, runs check:docs, and keeps this
section current.

| Lane | Now | Next | Then |
|---|---|---|---|
| Kernel | R7.3a batch 2, plan agreed (CadErrorCode union + CAD_ERROR_CODES; `code` = the specific bracketed code, the category in details.category; no category prefix on the ~400 uncoded refusals; 165 internal classes folded, the 6 used outside and BrepError kept, legacy left for R7.3d); O19's kernel half done (`78a84d506`, D277); K16 done (`ca9c6b0c4`, D276); R7.3d's packet tag done (`86da39e14`) | R7.3a batch 2 | R7.3b (results as data, MMGS), R7.3d (createCadModel, old document versions, the packet tag with GPU) |
| Outer | O21 (agent parameters, design approved); RS1 (sample robots) and RS2's poseAt; RS3 (the agent moves the robot) | R7.7a step 2 (rows, with the kernel's R7.7b), step 4 (results, with R7.3b) | the Later list |
| GPU | RS2 (joint motion playback) and RS1's Samples list; the WebGL2 full flow and the quiet section run as the load allows | 2–3 proposed next items | the Later list |
| API | P1 (the engine, end to end; gaps become PG items); RS5 between, once outer's RS2 lands | P2, P3, P4 in order | R7.7d after the cores' renames |
| Docs | RS4 after RS1/RS2 land; the prose for R7.4c's renames (api.md, cad/index.md); R7.6 part 1 done (merge 45c94eb09, samples 31/31) | R7.6 part 2 (the API inventory in check:docs, after R7.3) | the Later list |
| Coordinator | merges (S9 done at `16eabdd8e`) | a window at each track boundary | the owner's open decisions (below) |

## Where we are

Integration is `review/cad-gpu-engine-2026-10-14`, local only (tip in `git log`; last window 9b4e90f3e, see S9).

| | |
|---|---|
| Content | develop (#2185) + Codex's work squashed (`99da385a1`, no evidence files) + the GPU lint fix |
| Last fully verified commit | `1f43a0818`, 2026-10-24, after K16 (a track boundary): builds, types, lint, model 1051/1051, studio 286/286, gpu 201/201, kernel 1715/1722 (only native-split), RB and props pass, full flow 287/287 on WebGPU. Before it: `16eabdd8e` (S9) |
| Integration window at `99da385a1` | builds and tsc pass; gpu 179/179; kernel 1597/1608 (4 real failures); model 902/915; studio 166/187; studio lint 1 error (fixed since); browser flow not run |

Done, per area (see the logs):
- **Kernel core:** R1–R12c, track K and PKG.
- **Frames:** FR1–FR4, FRa–FRg, FRk1, FRk2, FRk3 (I/H, tapered channels, D172), FRk4 (curved and bent members, D173/D174) and FRk5 (weld gaps and notches, D175). FRk5 has open items below.
- **Shared weld seams:** D170.
- **Robots:** RM1–RM9 (joint tree from the mates by their free twists, FK and sliders, link inertia, URDF, MJCF, SDF, USD, collision sweep and continuous collision, workspace map, IK, the four-bar loop), RD1–RD3, RD9 (robot-check), RD10's deterministic part (robot-size). Compared with #2189 (robot CAD research), the open parts are O12–O14 below.
- **Manufacturing:** AM1–AM7, IM1–IM8, CNC1–CNC8.
- **Drawings and exchange:** R11b DXF and R14 drawings.
- **AI collaboration:** A1–A8.
- **Robustness:** RB1–RB4.
- **GPU:** G1–G20.2, plus G21's display modes, curved silhouettes and isolate/fade.
- **Codex review fixes:** REVIEW-K1, M1, M2, M3 and G1.
- **A9, built but not accepted end to end:**
  - A9-1 to A9-6, A9-8, A9-9 and A9-10 are built.
  - A9-13 (the part drawing draws every instance) is built.
  - A9-7's native cross-part housing context is built.

## Phase 0: only what a green baseline needs, now

Owner (2026-10-23): fix Codex's leftovers only where the roadmap needs them, and go by our own roadmap
("codex 가 남긴 문제가 로드맵에 필요 없으면 안해도 돼, 너만의 로드맵으로 가"). Phase 0 is therefore only what stops the
suites from loading or passing, so that the roadmap's work can be verified. The rest is folded into Phase 1 items or
moved to Later.

| # | Problem | Lane | Exit |
|---|---|---|---|
| S1 | **done** O149. **Import cycle in cad-model.** Codex's `chat/outputs.ts` makes `commands` undefined at load. Whole test files fail: chat, decimate, frame, palette, palette-rank, sheet and cageEdit. | outer | Those files load and pass; public paths unchanged |
| S2 | **done** O150, O153. **Rows rule (b) fixtures.** The tests and the cad-cli/cad-mcp paths still pass agent-written rows, which rule (b) refuses. | outer | Fixtures load rows through person files; raw `rows` still refused; rule unchanged. The P2 merge-by-id fix rides along |
| S3 | **done** O154 (load_rows to `features`; additive). **The frozen v2 contract test.** Codex changed tools without updating `tools-v2.json`. | outer, then owner if breaking | Diff written: additive → update with a record; breaking → owner decides |
| S4 | **done** O151, O152. Failures still left after S1 and S2 | outer | Each fixed or assigned with a cause |
| S5 | Kernel failures from the window: frk-3's dropped oracle, stale S0 expectations, sweep dropping holes | kernel | **done**: D176 `b0e22e572`. The V notch moves to K1 |
| S6 | Studio lint | GPU | **done**: `59582a911` |
| S9 | Window and full browser flow at one commit | coordinator | **done** at `16eabdd8e` (2026-10-24, the new account's first window): builds, types and lint pass; model 1028/1028, studio 286/286, gpu 195/195, kernel 1677/1684 (6 skipped; the one failure is the known native-split test), RB no new finding (the three graze/helical TODOs as before), properties pass; full browser flow 287/287 on WebGPU. Not covered: the K16 patch (not committed yet), gpu `test:browser` after R7.3a batch 1, the flow on WebGL2. The new "last fully verified" commit. **Earlier, window at 9b4e90f3e (2026-10-24, after R5 and G12a):** builds, types, lint, model 993/993, studio 274/274, gpu 189/189, kernel 1648/1655 (only the native-split test, as before), RB and props pass; flow 276/280, failing 72 and 273 (G12a, with the GPU lane), 207 (test fixed in d2d62a94e, outer) and 252 (GPU, G12). S9 closes when a rerun of those four passes. Earlier, window at 218c5604a: builds, types, lint, model 964, studio 250, gpu 189, kernel 1640/1647 (the Node pin), RB no NEW, properties pass; flow 269/272 (144, 166 fixed after it in cf8ce8fd9; 258 on WebGPU with the GPU lane). Next window after O7b and D206 |

Moved out of Phase 0:
- the V notch precision regression goes to K1 (same quadrature file as FRk6);
- the model review's P3 findings are fixed when a roadmap item touches that code (the owner's no-nested-functions rule still applies there);
- REVIEW-A1 (recovery metadata before the blob write) goes to Later.

## Phase 1: the roadmap, per lane (starts as each lane's Phase 0 items close)

### Kernel lane: finish the frame track (FRk)

| # | Item | Exit |
|---|---|---|
| K1 | **done** D177 (the V notch ribbon), D178 (FRk6, 5.7 → 1.1 s), D179 (the ribbon on facet rims). **FRk6** ordered-trim speed. From Codex's unverified WIP `abb697f2`: hoist `stripSpanD1`'s closure and per-element callbacks first (owner rule). Includes the V notch mass regression (rel 1.42e-11 against 1e-11 since the import), in the same quadrature code. | Member5 mass at 1e-9, the reversal case, the general fallback and the frame regression set pass; the round-cornered table ≤ 2 s (one corner was 1.2–1.5 s, the table 5.7 s). D177 |
| K2 | kernel side **done** D182 (the notch builds; case files in conformance/frk/); the flow and the WebGPU black canvas are the GPU lane's. **FRk5 leftovers.** The notch screen/file flow, and the WebGPU failure Codex retained (with the GPU lane for the viewport part). | The notch made, saved and reopened in the app on both renderers |
| K3 | **done** D180 (88.6° → 21.6°). **FRk7** SubD display folds inside single B-spline faces (`surfaceTriangles`) | The pipe clamp's worst fold under 25° (88.6° now) |
| K4 | **done** D181. **FRk8a** the bearing housing's shoulder checked against the row's Da max, read from the housing's faces | A typed refusal when it doesn't fit |
| K5 | closed, not needed (D178 met the speed). **FRk8b's second half** (exact-trim integration), only if K1 still needs speed | — |
| K6 | **done** D183. **FRk9** acceptance by the agent: a welded table with gussets, caps and beads; a tapered-I portal; a bent-tube rail | `conformance/frk/accept-*` pass through v2 tools |

| K7 | **done** D184. The r6 sphere-intersect ȳ pin (D179's open item) against a closed form | Pin or kernel corrected, with a record |
| K8 | **done** D185 (55 → 15 s). Profile F5: the A9 shaft's cnc-turning manufacturability report takes about 50 s | The cause found; kernel fixes made in the kernel, cad-model causes routed to the outer lane |
| K9 | stopped by decision: D186, D187 built or typed; the rest recorded. The RB TODOs: the cylinder-box graze cases ("1 nm graze, wrong body"), then helical × helical | A correct body, or a typed refusal; never a wrong body |

### Outer lane: A9, brief → buyable, manufacturable product

| # | Item | Exit |
|---|---|---|
| O1 | **done** (the coordinator window at 218c5604a: cad-model 964/964 with every A9 test, studio 250/250). Verify A9-1, A9-2, A9-5/6 and A9-13, A9-4, A9-10/A9-8 in the full suites (Codex checked them only in focused runs) | Their tests pass in the Phase 0 window |
| O2 | **done** O175 flow step. **A9-11** the Studio download flow (CSV and outputs with their sources) | The flow step downloads, reopens and matches |
| O3 | **done** O158. **The A9 brief** fixture: the default shaft's key clashes with the 6204 (115 mm³) | The key or the bearing moved; the clearance map shows no clash |
| O4 | **waits on the owner** (a person-supplied rows file). **A9-7** linked bearing housing in the app: the GPU lane ports the UI (G-lane item below); the outer lane owns the model side | Linked-bearing success flow. **Needs a real person-supplied row/fit file from the owner**; never a generated one |
| O5 | **done** O159, O164, O165 (automated end to end; the owner's own acceptance with a real file still pending). **The A9 acceptance run** (`test/a9-acceptance.test.ts`, `conformance/a9`) | Brief → part, drawings, BOM, CSV, manufacturing outputs and purchase list, all through v2 tools; reopened identical |
| O5a | A9 findings from O159: F1 madeBodies (**done** O160; GPU display G-R6), F2 each hole drilled once (**done** O161), F3 the Ø47 bore as a circular pocket or a typed refusal, F4 a clearance hole in the cover (owner-free choice (b)) | Each with an oracle |
| O6 | Open items: aligned sections for off-axis features (**done** O178); a welded-fabrication DFM profile (A9-12, needs sourced rules; waits on the owner) | Decide, then build or close |

### GPU lane: viewer track G21–G25

| # | Item | Exit |
|---|---|---|
| G1 | **done** G-R2. **A9-7 UI**, ported from Codex's `8789e468`: Housing path, linked BOM refusal CSV, useAssembly faceTable. Its tests move to `apps/cad-studio/test`. | The no-row flow as before; linked success with the owner's file (O4) |
| G2 | **done** G-R3, G-R4, G-R5 (overcut; found and fixed the pocket offset, O157); flow step authored. **G23 CNC preview** from Codex's source `5c9f861f`: App, Viewport and renderer connections and tests | Material removal shown on both renderers; NOT FOR PRODUCTION kept |
| G3 | **done** G-R7, G-R13 (Display popover), G-R15 (both renderers). **G21 rest**: silhouettes, isolate/hide in every display mode, the WebGL2 instance display | Each mode on both renderers, picks unchanged |
| G4 | **done** G-R38 (steps 273, 274 on both renderers: the clearance states, the print layers, Save/Open). Earlier: made-bodies previews G-R6; G23 CNC and K2 on both renderers G-R14. **G22** the clearance map on screen (states overlap/contact/touching/designed/near/clear) and **G23** print layers: dual-renderer and Save/Open acceptance | Flow steps on WebGPU and WebGL2 |
| G5 | **done** G-R8, G-R9, G-R16. **G24** 3D PMI, using the outer lane's glyph builders | Annotations placed, picked and saved |
| G6 | **done** G-R10–G-R12, G-R17, G-R18 (access map on WebGPU as a GPU estimate; thickness stays on the CPU, owner rule: the CPU is authoritative; scan deviation G25c deferred). **G25** GPU analyses | Each analysis matches its CPU result within its stated tolerance |
| G7 | **done** G-R19, G-R20. Antialiased cap edges | — |

### Next items (2026-10-23)
| # | Lane | Item |
|---|---|---|
| O7 | outer | **done** O7a–O7e (fe2bb2d3b, and this merge: casting rules as rows, enclosure kept as the library's own, D2). **Owner decision 2026-10-23 (option 3): built-in tables → sample rows.** `FASTENER_SIZES` (app/fasteners.ts), the casting allowances and die-casting thresholds in `library/builtin/materials.json`, leave the code (the M2–M5 boss/insert variants in `enclosure.json` stay the library's own estimates — owner, 2026-10-23, option D2 — like tslot-20's M5 values, option C) and ship as example rows files, each row with its source. A table is used only once the person loads its file (rows rule (b)). Drawn shape follows the document's rows; a size with no row is a typed refusal. No schema bump and no legacy migration (owner, 2026-10-23: unreleased, so documents track the latest schema); O7a's fixtures are the equivalence oracle — with the sample rows loaded they give today's results. Other `STANDARD_TABLES` entries are reported before conversion; formulas (ISO 68-1 minor diameter) stay. Order: after O179 and R3, before R4 |
| O8 | outer | **done** O8 5bca3663a (merged a19a54ae2). After the kernel's separate-bodies checkpoint (K10b: lumps touching along a line or at a point become separate solids of one output, as a disjoint union already does): STL/3MF exports and print checks per lump (a position-welded mesh would read a line touch as non-manifold), a "lumps touch along a line or at a point" DFM flag (it brings back, as a warning on the result, the words of the old union refusal "The bodies only touch along an edge or a point", which D204 retires), and the lump count on the BOM row |
| O9 | outer | **done** O9 (engine lanes, sources on outputs, REVIEW-A1; the existing hand-written guards audited, moved in R4b). **Results tied to their revision** (from #2188 M2): every worker reply (a command's preview, placed-part bodies, drawing views, CAM/print/clearance) is checked against the document revision it was computed from before it is shown; a late reply never overwrites a newer state; drawings and exports carry their source revision. Includes REVIEW-A1 (recovery reports success before the mesh blob is stored) and the robot bundles (URDF, MJCF, SDF, USD: their source revision, input digest and the hand-set values, #2189 M4). After O7 |
| O10 | outer + GPU | **done** (step A one body key, B the rebuild report, C the Rebuild panel and query.rebuild; the kernel profile D228; the GPU frame costs G-R39). **Rebuild-cost diagnostics, read-only** (from #2188 M3): per feature, the time and the kernel calls of the last evaluation; dependency cycles and mate problems listed with their source revision; a studio panel and a v2 query action for the agent (the per-turn budget kept). The GPU lane adds per-body frame cost by display mode (**done** G-R39: trackFrameCost/frameCosts). Fix first: a placed copy's body key differs by producer (studio i1/b2, clearance worker i1/b1) — one key scheme for every producer. Diagnostics never change geometry or history. The baseline R4's caching is measured against. After O9 |
| O11 | outer | **done** (UI `0e628d44e`, guard on setDoc `e5de80943`; K vs F open with the owner) — **Model and agent side done** (`9d4b22dc0`, `5deea84b5`: inputs, bindings, variantOf from the one master, A → B → A equal to fresh evaluations byte for byte, INPUT_* refusals, assembly.inputs/variants with their gates, 23,446 of 25,000 per turn); the UI after G12b. **Assembly-level variability** (from #2188 M1): a few named top-level inputs (name, type, unit, range, default) bound explicitly to dimensions, feature suppression, component choice and mates; variants regenerated from the one master and still editable; full regeneration the correctness oracle. Grows today's part-level `configurations`. After R4 |
| K12 | kernel | **done** (D235–D239): fuzz 25, 74, 110, 119 and 170 build; 51 built already; 85 a correct refusal (D205); the nudge findings recorded, open; fingerprint b6e18fab. D240 measured the opening time (report only) |
| K13 | kernel | **done** (D242–D244; pure speed, fingerprint b6e18fab unchanged): open time in Node, frames 13.2 → 10.4 s, spring 4.1 → 3.2 s, worm pair 2.7 → 1.9 s, A9 5.4 → 4.2 s. What stays: the spring's own mesh (1.2 s), the quadrature's tessellation (O18 removes it at open), the Boolean's other stages; a shared mesh/mass tessellation cache is a later proposal |
| K14 | kernel | **done** (D245–D254, stopped at the fix budget): the four seeds without findings (a WRONG and four INVALIDs fixed); the fuzz's APPROX status for an honest tessellated bound; seven causes fixed; refusals 18/13/11/13 on seeds 25/26/23/24; fingerprint cf100676. The open robust refusals are K15 |
| K15 | kernel | **done** (D257–D265): 25#62, 26#115, 24#185, 26#184, 26#47, 26#79, 25#170, s2#112 and 24#97 build; a turned-over wrapping face is now refused (D263); the fillet's [RADIUS_EXCEEDS_FACE] (D264); refusals 54 → 45 over the four seeds, no findings; fingerprint 6fe8417d. Open: 25#49 (K16), 26#34, 25#190 and near-degenerate/exact-contact classes |
| K16 | kernel | **done** (D260–D276, closing record `ca9c6b0c4`): slice(1) landed; the commutativity check (D271) and its six fixed (D273–D275); fuzz refusals 45 → 38, no findings; fingerprint dbc1ad33 (869); open: 24:125 (one-sided), 23:114's root (now refused at its non-manifold intermediate), 23:9, B ∪ B, K15's list. **The Boolean features' self-union** (D260): the first tool part is united with itself since a306e499d; without it Booleans 443 → 241 and corpus time −15 to −20 %, but r12c-fits (a nominal a few ulps past Ø50), r12-2's flat DXF (49 vs 52 entities) and r10-b (a pinned refusal now building) lean on the extra rebuild. Explain each, then land slice(1). **Checkpoint 2 in** (`6374a7351`, T2): slice(1) D268, D269, D270; kernel 1680/1687 (only native-split), RB no new, fuzz refusals 45 → 39 (11/9/10/9), fingerprint 4e3603b7 (869 cases; 23:13 now builds, 23:9 near-degenerate now refused, open). Left: the commutativity RB property, the closing record. **Commutativity check in** (`d582529b0`, D271, `pnpm rb:commute`): 2456 union/intersection nodes, 2412 the same, 37 refused both ways, 0 differ; 7 TODO: 24:125 one-sided, 24:165's root mixed, and 5 intermediates invalid in both orders without a refusal (23:114, 23:170, 24:51, 24:96, 24:165 r.a). The 5 are fixed before K16 closes (coordinator, 2026-10-24: a silent-invalid class) |
| O12 | outer | **Model, exports and agent side done** (`7bbf31c67`; MuJoCo 6.7e-16 m, usd-core 6.1e-17, check_urdf parses; SDF only by our reader); the sliders' and viewport's frames after G12b. **Tool and sensor frames** (#2189 M1): named frames on a link with a local pose (a TCP, a camera), kept apart from the joints; FK, IK, the workspace map and the sliders report the tool frame; URDF, MJCF, SDF and USD write each as a fixed child link; a frame on a missing or stale link is refused, typed. After O11 |
| O13 | coordinator | **done** (2026-10-23, owner's go-ahead for the downloads): MuJoCo 3.3.0 already closed RM4's and RM5's external read (O38, worst 1.1e-16 and 2.2e-16); now urdfdom 6.0.2 (`brew install urdfdom`) `check_urdf` parses urdf-2r, urdf-gears and arm-6r (cad-cli urdf) with the expected link trees, and MuJoCo's urdf-oracle on urdf-2r copied to another folder still passes (1.1e-16: the mesh paths are relative). **External read-back of the robot exports** (#2189 M4) |
| O14 | outer | **Model and agent side done** (`61b020f52`: the `mounts` row kind with MOUNT_LIMITS, the `mount` command, MOUNT_* refusals; samples: two NSK units sourced, NEMA 17/23 estimates pending their PDFs); the UI after G12b. **Mounts from datasheet rows** (#2189 M3): servo, motor and bearing mount profiles whose hole spacing, pilot, shaft height and clearance come from a person-supplied datasheet rows file (rows rule b, each value with its source); bound to the link through O11's named inputs. After O12 |
| O15 | outer | **deferred by the owner** (2026-10-23: "O15 는 다음에 하고 다른 것 부터 하자"; the tool and script are committed and inert, the dry run passed, the live runs not made — the CLI account was at its weekly limit). **RD10's L3 run** (owner's go-ahead 2026-10-23): the protocol of O46's S0 — a live model (the studio chat's default, claude-opus-5-5, through `claude -p` and cad-mcp) given the arm-3r sizing brief with a `robot_check` chat tool added for that run only (the per-turn budget kept); at least 3 runs; success only by a fresh harness run, never the model's word; rounds and margins compared with the scripted sizer's trace. Budget: at most US$25 of reported usage in all, a run stopped past US$8 or the turn cap. Comes back when the owner says |
| W0 | coordinator | **done** 736851196: the old documentation site removed; a new VitePress skeleton for the CAD stack (sidebar.mjs, page outlines, check:docs). Owner, 2026-10-23: "전부다 지우고 문서사이트를 다시 시작해도 좋아" |
| W1 | docs | **in progress** — all 32 pages written (`9d268fcd0`, none "Being written"; 16 samples pass; refusal codes and .bcad fields generated and checked). Left: the features gaps (SubD cage, sheet flat pattern, image tracing) and the studio shots after G12. the docs lane (its own session, branch claude/fervent-hopper-d9c6b2, worktree fervent-hopper-d9c6b2) writes every page from the code as it is: introduction and concepts → studio guide → AI agent → packages → reference → screenshots; code samples from running tests; "Being written" count to 0 |
| G11 | GPU | **done** (G-R42, `09ef149d4`, notes/g11-scene-profile.md): 11 heavy scenes on WebGPU and WebGL2 hold 60 Hz (p95 16.7 ms), main-thread 2.2–3.9 ms, WebGPU GPU ≤ 5.0 ms, so at least 3× headroom; no culling/LOD/instancing work. Was: **Measure, then decide** (the Later list's "after G25, when need is measured"): with O10's frame costs and the bench, profile the heaviest real scenes (the A9 assembly, the 120-bracket pattern, the large gallery parts) on both renderers; report where frame time goes; propose occlusion culling, LOD or other work only where a measured budget is missed |
| G12 | GPU | **done** (G12a–G12f, `9c6fd1f13`: three columns, the right dock, one preview mode, the shell and every panel on shadcn/ui + Tailwind v4; full flow 286/286 on both renderers). Was: **In progress:** G12a (three columns, `4220de61c`) and G12b (the right dock on shadcn/ui + Tailwind v4, `b51113a98`; flow 279/280 on both renderers) merged; G12c (preview mode, compact text, collapsible headers) and G12d (layout flow step, lint, R1 bench) next. **Studio layout, owner 2026-10-23**; from G12b on, built on shadcn/ui + Tailwind v4 (owner 2026-10-24: "shadcn + Tailwind v4"; Radix primitives, Resizable for the chat and dock widths, the existing dark tokens mapped to shadcn's variables, the generated cad icons kept) ("이 방향으로 해줘"; the floating previews overlapped the BOM panel, text-heavy, not tidy): one right-hand dock holding the inspector, BOM, Rebuild and the previews/analysis as tabs or collapsible sections, nothing floating over another panel, long content scrolling inside the dock; the previews (CNC, print layers, clearance, analysis maps) as one mode chosen at a time with only its settings shown; a one-line status and colour-chip legend by default, the long notes behind "Details" or an (i); a flow check that no two panels intersect at 1440/1280/1024/800. Before G11's follow-ups |
| G12f | GPU | **done** (`b5accd77c`, `9c6fd1f13`) — **The shell onto shadcn** (after G12e): the top bar, the Tools rail (ToolButton, ToolsTray), the view bar, the history bar, the section bar, the timeline, Tooltip, the context menu, the command palette, the shortcut help and the command HUD, on src/components/ui (Radix Tooltip, DropdownMenu/ContextMenu, Command where they fit); labels kept or reported old → new; R1 bench rows rerun |
| R1d | GPU | **done** (G-R49, `c30bbaece`: HUD typing 4 keys App 10 → 1, placing 30 moves 76 → 16, section drag 121 → 61) — **HUD typing and placing without App renders** (found in G12f, from before it): 4 HUD keystrokes render App 10 times, 30 pointer moves while placing render it 114 times; the HUD values and the placing pointer move into a store (like poseStore) read by SceneViewport and the HUD, the preview evaluation off that store; App renders at most once per evaluated result. After G12f, before G13 |
| G13 | GPU | **done** (G-R50, `26eb57498`; MuJoCo TCP at zero and after a quarter turn; App renders unchanged per pose) — **Robot frames in the viewport** (O12's UI, after G12d): a `frames` prop on Viewport.tsx drawn as small RGB triads with a name label, fed from poseStore inside the viewport (no App re-render per pose, R1c), data from the outer lane's `framePoses`; a flow check of the arm-6r TCP triad at the zero pose and after a quarter turn |
| O16 | outer | **done** (`e5de80943`; every panel on shadcn, the last batch included) — **Panels done** (Library, BOM, Parameters, drawing settings, Joints, Mates, Instance, Rebuild, References, Skeleton, Cage, Direct, Sketch, Render, Variants); last batch after O18: BriefPanel, DraftsPanel, SpecifyPanel, MeshRepairPanel, CutListDialog, FlatPatternDialog, MapLegend. The dock's panel contents (with G12), moved panel by panel onto G12's shadcn components (owner 2026-10-24): the BOM table's columns at the dock's width (no wrapped item names), the panels' long texts moved into "Details", one text style for status, limits and legends across src/ui |
| O17 | outer | **done** (`54d187fef`, `5641e7edb`): the chat on useChat through StudioTransport, shadcn-style messages, tools and linked proposal cards; scripted turns through createChat (flow steps 61–63); O17c's collapsed Thinking line, **unverified against the live CLI** until the owner allows one live turn; deps ai 7.0.137, @ai-sdk/react 4.0.140, @shadcn/helpers 0.2.0, zod 4.6.5, undici pinned 7.30.0. **Chat on the AI SDK, owner 2026-10-24** ("shadcn 쓰면 … ai 채팅도 쉽게 붙일 수 있어", ui.shadcn.com/docs/helpers/ai-sdk). After G12b: the chat column's insides on `useChat` (`ai`, `@ai-sdk/react`) with a client-side `ChatTransport` over the existing `/api/chat/turn` SSE. The chat server's protocol stays, because cad-mcp, the A/B harness and robotL3 use it. Messages, tool calls and reasoning render with shadcn's AI components; proposals become tool parts with approval (accept/reject, the risk badge); conflicts are re-proposed as now (A7). The flow's scripted chat steps and the docs' scripted shots move to `@shadcn/helpers/ai-sdk` `createChat()` transports, offline and deterministic. Labels kept or reported old → new; refusals and autonomy unchanged |
| O18 | outer | **done** (`e5de80943`, design P: the part's masses pushed after its reply, readers show … until they land, patched by mass ref; an edit right after opening the spring answers in 0.1–0.4 s instead of ~2.1 s; placed parts keep inline masses) — **Mass on request** (measured by the outer lane, recorded under D240 in decisions-outer.md): the worker's reply spreads each body (`MeshSender.pack`), so a lazy getter would still run the quadrature at open; nothing shows mass until the inspector, BOM, mass panel or agent asks. After G12b: the wire leaves mass out and a `mass(bodyKey)` worker call fills the readers, made async. Saves the spring's 2.05 s and the worm pair's 0.61 s at open (D240). Values byte-identical when read |
| O19 | outer (+ kernel for cad's side) | **done, with a regression open**: the full flow at 7c8c6c038 is 286/288 — 176 (R10.2a) and 183 (R10.4b), pipe-tee junction fillets round a closed curve loop, now refused (volume → NaN); likely the closed edge's signature; outer reproducing, before RS1; (kernel `78a84d506` D277; outer merge 7c8c6c038: node.sigs → expect, the agent's accept re-matches one clear candidate or refuses with candidates, verifyOpened handles REFERENCE_MOVED). **Stored edge names checked against their signatures** (found by the API lane in R7.4b, finding 4): a sketch without `sideTags` (what commands and add_features write) names its walls by position, so a polygon vertex inserted upstream makes a fillet's stored `side1|side2` silently round another corner — measured: a square's (40,40) fillet moved to (40,0), in both cores. The studio's fillet node carries `sigs`, but evaluation never compares them (only the edit tool's rematch does). Exit: a typed refusal when a stored edge no longer matches its signature (never another edge), with the vertex-insert case as the test. **Kernel half done** (`78a84d506`, D277: `expect`, [REFERENCE_MOVED]; fingerprint byte-identical). **Design agreed (2026-10-24):** the check sits where names resolve, in the kernel — fillet/chamfer/shell/draft take an optional `expect` (the stored signature, rematch.ts's shape and tolerances) and refuse typed (`[REFERENCE_MOVED]`-like) on a mismatch; kernel half right after K16 closes (it fixes the field shape in a D record), then outer wires part.ts (node.sigs → expect), the held/verifyReferences path and the tests |
| O20 | outer | **done** (`650c75873`, merge 730ab70ea: givenValues on the agent's and facade's path; split's and mirror's at, a tapped hole's Ø, a fastener's length — now refused when not offered; the derive list pinned). **The agent's given values kept through a command's derive** (found by the API lane, 2026-10-24): run_command split with `{axis: 'x', at: 2}` on a 10 mm box builds at 5 (the middle), no warning — split's `derive` in app/commands.ts moves `at` whenever the axis is among the changed keys, and runTool passes every given key as changed. Exit: a given value is never replaced (split and every other command with a derive audited), each with an agent-path test |
| O21 | outer | **The agent can make and set parameters** (found by the API lane in R7.4d's design): no v2 action creates or sets a named parameter today (only raw `{ parameter }` nodes and O11's assembly inputs); a `set_parameters`-style action (create, set, bind through editFields' rule), the per-turn budget kept; plus a core `withParameters(doc, edits) → doc` that the tool and the facade both call. After R7.7a |
| K17 | kernel | **A suppressed flag in the part document** (R7.4d): the studio's History toggle has `suppressed: true`, the kernel document has none, so the kernel facade refuses suppression (UNAVAILABLE). Low priority, after R7.3 |
| K10 | kernel | **done** D188–D196: RB5 fuzz harness; empty operands; six INVALID fixed; the KNOWN crescent; refusal triage |
| K10b | kernel | **done** D197–D210, D206 (fuzz s1 refusals 31 → 16, s2 29 → 14; INVALID 0, WRONG 0 on both; touching lumps are separate bodies). the 17 robust refusals of valid inputs (D197 on), then the 8 near-degenerate; separate lumps on exact contact as separate bodies |
| K11 | kernel | **done** D211 (turningOf 8.1 → 4.4 s; D1 calls 4.22 M → 1.40 M). F5's remainder (the turning report's first-derivative evaluations) |
| O5b | outer | **done** — A9 findings: F8 drawings (**done** O170–O174), F9 fasteners as bought lines (**done** O176), F10 base members in the BOM (**done** O169), F6/F7 (**done** O167/O168) |
| G8 | GPU | **done** G-R21: GPU contour for curved silhouettes, dirty-run block writes, clip flags kept; the two App findings moved to R1 |
| G9 | GPU | **done** G-R22: r16uint triangle key, 15.8 MiB at 1080p, 63.3 at 4K (key collision ~1/65 535 per pair, measured) |
| G10 | GPU | **done** G-R23: the full flow on WebGL2; analysis maps (thickness, draft, 3-axis access) and the mould's parting line and halves are WebGPU only, and WebGL2 says so |

### Robot samples and motion (owner, 2026-10-24)

The owner: "로봇 관련해서 좀 더 다양한 샘플, 예제를 만들어봐야하지 않아? 관절 움직임 같은거라던가?", then "로봇 샘플 확장(RS1–RS4)을 로드맵에 넣고 각 줄에 나눠서 진행해줘". The robot features (RM1–RM9, O12, G13) work, but only a few test fixtures exercise them, and a pose is shown one slider at a time.

| # | Lane | Item |
|---|---|---|
| RS1 | outer (+ GPU for the studio's sample menu) | **Sample robots**: ready-to-open robot documents — a 2R planar arm, a SCARA, a 6R arm, a Cartesian gantry (PPP), a pan-tilt camera head (a sensor frame), a parallel gripper (two coupled fingers), a four-bar linkage (a closed loop) and a gear-driven joint; geometry and joints only (no standards rows: rule (b)). Each tested: its joint tree, FK at a few poses against a closed form, its URDF/MJCF read back by urdfdom/MuJoCo. The studio opens them from a **Samples** list (GPU, the shell) |
| RS2 | GPU (+ outer for a core interpolation function) | **Joint motion playback**: waypoints played as motion over time (joint-space interpolation, the core function a pure `poseAt(doc, path, t)` from outer), play/pause, a time scrubber, loop, speed; a collision during playback marked on the bodies; no App re-render per frame (poseStore, as R1c/G13); flow steps on both renderers. Video export of the motion folds in here (the Later list's turntable/explode video). **Decided (2026-10-24):** motions are saved — `robot.motions?: Record<name, RobotPath>` (RobotPath { waypoints, profile?, limits? }, timed by ccd's timePath like Check path), the session waypoints are the unsaved draft with "Save as motion"; the shown pose and play state stay UI-only (no undo, not stored); core `poseAt(tree, path, t)`, `pathDuration`, `checkPath` (outer); RS3's set_pose/play return data the studio previews, waypoint/check_path work on robot.motions; the Motion row in the Joints card, the contact tint from toi, WebM video as checkpoint 2 (GPU) |
| RS3 | outer | **The agent moves the robot**: chat can set a joint, record a waypoint, run check path and play the path; first audit what the v2 actions already do, add only what's missing; the per-turn budget kept |
| RS4 | docs | **Robot docs examples**: the robots page per sample (its joints, a pose, an export), shots of the samples and of playback; samples run under test:samples |
| RS5 | API | **The robot on the facade**: assembly(...).robot() — joints(), pose(values) → frame and link poses, path(waypoints).check(), poseAt(t), exports — over the core functions, byte-equal to the tools; feeds RS4's samples |

### Real products (owner, 2026-10-24)

The owner: "지금은 각각의 기능별 잘 돌아가는지 샘플들만 만들었는데, 실제로 좀 제대로된 제품을 모델링 해봐야하지 않을까? 자동차 엔진? 전자 부품? 거대한 기계, 로봇 등등?", then "P1–P4를 엔진부터 차례로 로드맵에 넣고 진행해줘. 막히는 것은 로드맵 항목으로 만들어줘."

Each product is built end to end — parts, assembly, mates and motion, mass, interference, drawings, BOM and manufacturing outputs — as a deterministic, rerunnable build (`examples/products/<id>/`, written on the facade where it reaches, the core functions where it doesn't; the documents it writes open in the studio). Every point where the build can't go on, or goes on only by a workaround, becomes its own roadmap item below (PG-n), routed to its owner lane; the product resumes when it's fixed. Standard parts' sizes come only from person-supplied rows (rule b): the shipped sample rows where they fit, otherwise the gap is listed and the owner asked. PCB/ECAD stays deferred (owner, 2026-10-19): P2's board is a sized placeholder. A live-agent run of the same briefs (brief → product) comes after, with the owner's token budget.

| # | Lane | Product | What it tests |
|---|---|---|---|
| P1 | API (builds), gaps to their owners | **A single-cylinder four-stroke engine**: crankshaft (with counterweights), connecting rod, piston with rings and pin, finned cylinder block, head with valves and ports, camshaft, cam followers, crankcase halves, fasteners | complex solids (fin patterns, fillets, sweeps, shells), the slider-crank and the cam train as a mechanism (a closed loop, gear-timed cam 2:1), interference through a cycle, masses and balance, drawings, the BOM, CNC and casting reports |
| P2 | API, gaps to owners | **An electronics enclosure**: a handheld device's two-part moulded housing with bosses, snap fits, ribs, a battery bay, connector openings from connector rows, a heat sink with fins, the board as a sized placeholder | thin walls, draft, moulding DFM, connector rows, fits between halves, an exploded assembly |
| P3 | API, gaps to owners | **A large machine**: a gantry CNC router — a welded frame, linear rails, carriages, a gantry, motor mounts from mount rows, ball screws, many fasteners (hundreds of parts) | scale (opening, evaluation and display time with hundreds of parts), frames and the cut list, mounts, the BOM at size, the drawing set |
| P4 | API (+ outer for sizing), gaps to owners | **A real 6-axis robot arm**: link castings, joint housings for strain-wave gearboxes, motor mounts, bearings, a cable path, a tool flange | robot-size and robot-check on real link masses, motion (RS2), URDF/MJCF read back, manufacturing outputs of each link |

Gaps found (PG-n, added as they're found):

| # | Lane | Gap | Found in |
|---|---|---|---|

## Phase R: refactoring, once the current items close (owner, 2026-10-23)

The owner asked for one refactoring pass when the features are reasonably complete: code that is only laid out flat is
hard to find later, similar logic is likely duplicated, and UI code concentrated in one component hurts rendering.
It starts per lane when that lane's current items close (K10b/K11, O6, G8–G10) and after a green coordinator window.

Measured at 64df1c081 (lines): `App.tsx` 2905 with 110 `useState` and 252 hooks in one component; `Viewport.tsx` 1382;
`renderer.ts` 1172; `gpuRenderer.ts` 1081; cad-model `chat/tools.ts` 1698; gpu `viewer/viewer.ts` 2272; kernel
`part-model.ts` 4480.

R0 (the survey) is **done**: `notes/refactor-survey-2026-10-23.md` has the evidence, file:line, for every step below.
Order inside a lane is lowest risk first: duplicate copies, then hot-path allocations, then splits of big files, then folder moves.

| # | Lane | Item |
|---|---|---|
| R1 | GPU | **done** G-R24–G-R34 (LOADED): pick 129 → 47 ms, ghosted orbit 19.6 → 2.7, pose 23.4 → 4.0, explode 27.8 → 8.7, section drag 30.8 → 5.9; per-frame pose, explode and section in an external store; on WebGPU the exact section follows the drag's release. The studio's re-renders. `Viewport.tsx`: the per-frame `setTick` (449) re-renders the whole viewport. Move the projected overlay into a child that owns the tick; give the print-mode props stable identities; build the `viewState` Map only when `transforms` changes; cache the view-projection in studio `camera.ts` `project`; wrap Viewport in `memo` with stable App callbacks. `App.tsx` (2905 lines, 110 `useState`): state into domain hooks/contexts, so each panel subscribes only to its slice. First targets from G8: pick 121–151 ms (budget 90; 63 ms in the outliner's 120 rows) and the ghosted orbit re-rendering every step. Render counts before and after on the same flow |
| R2 | GPU | **done** G-R29 (per-frame allocations), G-R35 (displayPolicy.ts), G-R36 (shaders/ and scene.ts split), G-R37 (gpu folders). Per-frame allocations in the viewer and both renderers (dynamic-offset arrays, `packFrame`/`packOutput` reuse, `pipelineKey` cached on the mesh, closures and `[a,b]` arrays, `JSON.stringify` keys); then one studio display-policy module shared by `renderer.ts` and `gpuRenderer.ts` (theme, mode factors, dash, accent, face/edge state, instance sharing and matrix, bounds); then `viewer.ts`/`shaders.ts` split behind the facade; then the 98 top-level gpu files into folders (deep `dist/` test paths fixed in the same commit) |
| R3 | outer | **done** R3a–R3e (tools.ts 1,699 → 236 lines; the tools list and prompt byte-identical throughout). `chat/tools.ts` → `chat/part/*` + `toolKit` + `toolDefinitions` (plan approved, R3a–R3e), with the shared patterns the survey found; the tools list and prompt byte-identical |
| R6 | GPU | **done** G-R40: 65 gpu-scene flows kept and green through examples/gpu-scene/run-flows.mjs, 13 retired (missing research inputs). Was: the examples/gpu-scene flows fail before R2d's move too (some can't find packages/barocss-cad/src/types.js, others assert a git-diff file list against an old base). Triage them: still worth keeping and fix, or retire with a record |
| R4 | outer | **done** — batches A–D merged (`4a6b4f46f`, `c4e88e070`, `7b47c27dd`, `0e339b9f6`): the R4.0 fingerprint byte-identical at every batch; util/, analysis/, bom/, engine/schema/, engine/placement, evaluateTree, one material registry, editRows, robot/eigen; placed-output snapshots kept per copy (6R arm stepFor 131 → 3 ms); engine/ imports nothing from chat/. Rule (from #2188 M1): every cache or incremental path is checked against a full re-evaluation on the same fixtures, and where the dependencies are not known it re-evaluates in full or refuses, never skips on a guess. cad-model duplicates: util/ (round, guards, units, nextFreeId), one `boundsOf`, one `bodyMass`, one material registry, generic `editRows`, `engine/placement.ts` (fixes engine → assembly), one instance-evaluation helper, the kernel's `symmetricEigen3`; then `evaluate.ts` (notes split, evaluateDoc/evaluatePart merged, `placedOutputs` and frame geometry computed once); then folder moves with `export *` shims (analysis/, BOM out of team/, document-schema types out of chat/, rb9 out of src) |
| R4b | outer | **Guards done** (`2b287478c`; useCageEditor, section, bearing edit, placed parts, proposal diff, mould, the drawing sheet on O9 lanes; App's command preview and useAssembly's readFaces kept, recorded why); the shared panel pieces and the `DrawingWorkspace` split go with O16 onto shadcn. Was: `src/ui`: shared panel pieces; `DrawingWorkspace` split; the six hand-written stale-reply guards (App section/bearing/placed/preview/proposalDiff/mould, useCageEditor, useAssembly, useDrawingSheet, DrawingWorkspace) moved onto O9's engine lanes, one caller per checkpoint, behaviour unchanged |
| R5 | kernel | **done** (D212–D233; R5.4 folders in four batches, D229–D231 and D233; the fingerprint script committed as D232; 855 cases byte-identical at every batch) — R5.1, R5.2, R5.3 done (D212–D227: copies gathered, hot-path allocations out, part-model.ts 4443 → 3627 lines; the 855-case fingerprint byte-identical at every batch); R5.4 (folders) batches 1–3 done (D229–D231); batch 4 next. Exact copies first (vec3, Gauss–Legendre, `guardKnots`/`mapParameter`, `same`, the perpendicular frame, checked arithmetic); hot-path allocations (`rolling-ball` station solvers, `brep-mass-quadrature` nearest-4, `surface-intersection` all-pairs → the existing BVH, tessellate refinement); `part-model.ts` `operation()` split by family, then the other top-5 files; folders (part-model-only families first; modeling, sketch and planar-solids last, because of the 20 trap tests); the convex-planar templates as one factory; last, the admission boilerplate behind a budget object |
| R7 | all (the facade: API lane, own session, branch claude/api-lane-2026-10-24) | **API consistency and an object facade** (owner 2026-10-24: "겉 api 는 객체 형태로"). The core stays data + functions: JSON documents, `verb(doc, options) → result`, classes only for stateful resources (gpu Viewer, caches, editors), one typed error shape `{ code, message, where }` across cad, cad-model and gpu (cad's 163 per-module Error classes and the bracketed strings folded in). Over it, an immutable object facade in each package (owner 2026-10-24, "cad-model 만 api 가 있는거야? … 제대로 해줘"): `@barocss/cad/api` (a kernel part over CadPartDocument/evaluateCadPart, replacing createCadModel), `@barocss/cad-model/api` (the same verbs plus the studio layer: materials, rows, assemblies, variants) and `@barocss/gpu/api` (an immutable `scene()` whose `.data` is JSON; Viewer stays the stateful object and shows it), one shared selector set and one BarocssError, meshes passed by structural match with no package importing another; for people and the docs (references: replicad for TS ergonomics and the sketcher, build123d for result-as-data, selectors and Plane/Location, Manifold for immutability, FeatureScript for stable queries), each method adding a feature node and calling the core, `.doc` always the JSON; the agent stays on the JSON tools. Steps: R7.1 the public API inventory (docs lane, generated), R7.2 the conventions doc (coordinator), R7.3 the core (errors, cad's result methods to functions; fingerprint byte-identical), R7.4 the part facade with typed selectors, R7.5 the assembly facade, R7.5b the gpu facade (scene() and its display; `.meshes()` as plain `{ key, positions, normals, indices }` matching gpu's GeometryInput, no conversion needed: the Viewer is already Z-up and the packets' `right-handed-y-up` tag is a label nothing acts on, per the GPU lane on 2026-10-24; R7.3 renames the tag to say what it means), R7.6 the docs samples on the facade |
| R7.1 | docs | **done** (`26d4730d7`): the public API inventory, `apps/library-docs/scripts/api-inventory.mjs` |
| R7.2 | coordinator | **done**, owner-approved 2026-10-24 (`e5e5bdc53`): `handover/api-conventions.md` §1–§12 (core data + functions, MMGS, results as data, classes for resources, one BarocssError, the facades, §10 common data formats, §11 cad-model's part wraps cad's, §12 the agent's command names) |
| R7.3a | kernel, outer, GPU (each its package) | **cad-model done** (batch 1 merge 326edd70b, batch 2 merge 9be3fe6bf: 94 throws coded, the refusal table 145 → 254 codes from refusal()/problem()/coded() calls); **gpu done** (merge 3e14b0aeb, G-R52; batch 3 merge 15beb31f7, G-R57: 61 public input refusals coded, 40 internal throws plain by design); **cad** batch 1 done (`43ccf24df`, D272: BarocssError in core/barocss-error.ts, all 171 classes on it, 11 codeless classes given codes; fingerprints R5 4e3603b7 and R4 d1f8bb3c byte-identical), batch 2 next. **Errors to one shape** (§6): BarocssError `{ code, message '[CODE] …', where?, details? }` with each package's codes as one union; cad's 152 per-module classes, cad-model's 19 classes and 35 bracketed-string returns, gpu's 36 classes and `{ ok }` returns; validators `check… → Problem[]`; the refusal table generated from the unions. Fingerprints byte-identical (messages unchanged). Outer starts now; kernel after K16; GPU after G13 |
| R7.3b | kernel (then outer, API) | **Results as data, MMGS** (§2, §4): CadPartOutput's and CadPartSnapshot's methods become functions (`massPropertiesOf`, `exportStep(output)`, `reevaluate`…); public mass in g, g/cm³, g·mm²; cad-model's `bodyMass` inertia in g·mm²; the facades' adapters drop their conversions. The one intended value change, recorded per field; the studio's display unchanged |
| R7.3c | outer (cad-model), GPU (gpu) | **cad-model done** (`e3a9b6dd0`, merge 730ab70ea: boundsOf, exportStudioStep, assembly/edit.ts core verbs, engine/vec3; mass with R7.3b) and **gpu done** (G-R53). **One function per concept** (§3, §10.2): mass (outer, 2026-10-24: cad-model's four mass computations — bodyMass, massProperties, bom/core, robot/inertia — fold together with the R7.3b follow-up, so the last-ulp change and the MMGS change are one value change, one record and one fingerprint move), bounds (`boxOf` declared twice), STEP (`stepFor` → `exportStudioStep(doc, options)`), the Vec3/Mat3 declarations where they cross a package (**gpu done**, G-R53: one src/core/geometry-types.ts; cad's Vector3 → kernel, cad/src/api's → API, cad-model's 8 → outer); rotate's default pivot (the studio: the body's centre, the kernel: the origin; found in R7.4b, finding 5 — one default, recorded, then the facade gets rotate) |
| R7.3d | kernel + GPU | createCadModel's tests mapped by the API lane (merge 26fab1a59, api-facade-design.md: the modelling covered by cad/test/api-legacy-coverage.test.mjs; the rest tests the old API itself and retires with it). **Legacy out** (§8, §10.1): createCadModel retired once `@barocss/cad/api` covers its tests; the ~30 `evaluate…Document`/`…FeatureGraph` old-version paths; the y-up packet tag renamed in gpu and the kernel's core/packet.ts together. Scope (coordinator, 2026-10-24, from G-R52): the CAD mm mesh packet path only — cad core/packet.ts and its preview builders, gpu mesh-packet.ts, gpu-compiler, kernel-face-preview, barocss-cad-interop's packet reader — to `right-handed-z-up`, no alias; gpu's primitives and engine scene are truly Y-up and stay; pinned evidence JSON untouched; barocss-cad-interop and barocss-viewer (unowned) given to the GPU lane for this rename |
| R7.4a | API | **One part implementation** (§11): cad-model's `part()` wraps cad's; verbs and options on the v2 command names (§12); the oracle unchanged |
| R7.4b | API | **done** (`5cd3af988`, merge 887f638fd; api tests 21/21 in each package). **Part growth**: cylinder, sketch → extrude/revolve, chamfer, shell, union/subtract/intersect, patterns, a body chooser; Plane/Location; a selector-stability test (an upstream edit re-evaluated, the same named edge still picked or a typed refusal) |
| R7.7 | all | **No unit suffixes anywhere** (owner, 2026-10-24, widening R7.4c; conventions §2): (a) outer — the agent's tool arguments (`nearMM` → `near`, `toolMM` → `toolDiameter`, `layerMM` → `layerHeight`, `limitDeg` → `overhangLimit`, `bendDeg` → `bendAngle`; tools-v2.json refreshed in place with a record, the per-turn budget kept), rows file fields (~53, the sample rows and validators), cad-model's options and results (with its R7.3b follow-up); (b) kernel — the core's options and results, together with R7.3b (kg → g is the same fields: one change, one record); (c) GPU — gpu's options (cpuMs → cpuTime, stepMM → step, fovYRadians → fovY) and its stored scene/engine formats (rotateDegrees → rotation, fovYDegrees → fovY, timeSeconds → time, translationMm → translation; pointsMM/positionsMM with the kernel's window); byte counts keep …Bytes, mmToSceneUnit stays; (d) API — the facades' results (`massG` → `mass` …) after the cores; docs — every page, the tool and refusal tables. Renames recorded old → new per field; values unchanged except R7.3b's units. **Documents too** (owner, 2026-10-24): the part document's stored fields (`rotationDeg`, `lengthMM`, `upToMM`, `startDeg` …) by the kernel, the studio document's by outer, gpu's scene formats by GPU — renamed in place under the latest-schema rule, no alias or migration, fixtures and conformance regenerated, the fingerprints' moved names recorded |
| R7.4d | API | **done** (merge 25eb8561f: studio and kernel backends, api-parameters 5/5 and 3/3; sketch values and Location stay numbers until after R7.7). **Design approved** (`8bb34d75b`, api-facade-design.md: bindings through editFields' bind, PARAMETER_UNBINDABLE, withParameters as a function, configurations, features()/suppressed(); expressions out, pending the owner). **Parameters on the facade**: named parameters and expressions in place of numbers, named features and suppression, withParameters as a function over the doc; writes the studio's own parameter/configuration nodes byte-equal to the Parameters panel and the agent's tools (design first, coordinator review) |
| R7.5 | API | **done** (`2e96fcdef`, merge 8571ceff3; cad-model api 25/25). Finding 7 (add_part, place_part, add_mate and set_frames write inline in async tool handlers; make them `verb(doc, options) → doc` core functions both the tools and the facade call) goes to the outer lane with R7.3c. **Assembly facade** (cad-model): placing parts, mates, inputs and variants (O11), frames (O12) |
| R7.4c | API | **done** (`411678699`, merge 9e42e6ca2; samples 31/31). **Option names without unit suffixes** (owner, 2026-10-24; conventions §2, §12 amended): the facades' inputs take the agent's value names (`box({ w, d, h })`, `cylinder({ r, h })`, `mass({ density })`), results keep unit names (`massG`, `volumeMM3`); documents' stored names unchanged; the docs samples follow |
| R7.5b | API (GPU reviews) | **done** (`a45717b72`, merge 2e79a11db; show() 2/2 on hardware and SwiftShader; display lines are `lines`, §10.3 aligned). **gpu facade growth**: materials by id (§10.6), edges as lines, a camera view; `show()` browser check on both backends |
| R7.6 | docs + API | **Part 1 done** (`0b4848932`, merge 45c94eb09: the Object API page out of experimental, 7 new sample regions, the cad and cad-model pages lead with the facade; test:samples 31/31); part 2 (the inventory in check:docs) after R7.3. **Docs on the facades**: samples rewritten on them, the Object API page out of experimental, the API inventory in check:docs as a drift check on §1–§12 |

Rules: each R step is behaviour-preserving and its own checkpoint; no public export renamed without a re-export (saved
documents and package paths keep resolving); the touched package suites, lint and types per step, and the full window
plus the full flow at the end of the phase. Render counts and frame times are recorded in the decision logs, not as
evidence files.

## Item index (one line each; the /lanes pane shows the owner's Korean title after " · ko: ")

- **S1** — Import cycle in cad-model · ko: cad-model import 순환 해결
- **S2** — Rows rule (b) test fixtures and CLI paths · ko: 행 규칙 (b) 테스트 픽스처와 CLI 경로
- **S3** — Frozen v2 tool-contract test · ko: 고정된 v2 도구 계약 테스트
- **S4** — Remaining failures after S1–S2 · ko: S1–S2 뒤 남은 실패 정리
- **S5** — Kernel failures from the first window · ko: 첫 검증에서 나온 커널 실패
- **S6** — Studio lint error · ko: 스튜디오 린트 오류
- **S9** — Full window and browser flow at one commit (the "last fully verified" commit) · ko: 한 커밋에서 전체 검증과 브라우저 흐름 전체 (마지막 전부 검증된 커밋)
- **K1** — FRk6: ordered-trim speed (5.7 → 1.1 s) · ko: FRk6: 순서 있는 트림 속도 (5.7 → 1.1초)
- **K2** — FRk5 leftovers: notch cases on a tee · ko: FRk5 남은 것: T자 이음의 노치 경우
- **K3** — FRk7: SubD display folds · ko: FRk7: SubD 표시 접힘
- **K4** — FRk8a: bearing housing shoulder against Da max · ko: FRk8a: 베어링 하우징 턱을 Da max와 비교
- **K5** — FRk8b second half (not needed) · ko: FRk8b 후반 (필요 없음)
- **K6** — FRk9: weldment acceptance by the agent · ko: FRk9: 에이전트가 용접 구조물 인수 검사
- **K7** — r6 sphere-intersect pin against a closed form · ko: r6 구 교차 고정값을 닫힌 해와 비교
- **K8** — F5: cnc-turning report speed (55 → 15 s) · ko: F5: CNC 선반 보고서 속도 (55 → 15초)
- **K9** — Graze cases (1 nm, 10 µm, 1 µm) · ko: 스치는 경우들 (1 nm, 10 µm, 1 µm)
- **K10** — Fuzz harness and its first findings · ko: fuzz 도구와 첫 발견들
- **K10b** — Fuzz refusals: robust, near-degenerate, touching lumps · ko: fuzz 거부 줄이기: 안정성, 거의 퇴화, 맞닿은 덩어리
- **K12** — Near-degenerate refusals and the pole-safe map (fuzz 170) · ko: 거의 퇴화한 입력의 거부 정리와 극점 안전 매핑 (fuzz 170)
- **K13** — Opening time: box test in the Boolean, the NURBS basis, quadrature and tessellation cost · ko: 열기 시간 단축: 불리언 상자 검사, NURBS 기저 함수, 질량 적분·테셀레이션 비용
- **K14** — A fresh fuzz round: new seeds, triage, fix the robust refusals · ko: 새 fuzz 시험: 새 시드로 돌려 분류하고 견고성 거부 고치기
- **K15** — K14's open robust refusals · ko: K14에서 남은 견고성 거부 사례 고치기
- **K16** — Remove the Boolean features' self-union, explaining what relied on it · ko: 불리언 피처의 자기 합집합 제거 (의존하던 3곳 해명)
- **K11** — F5 remainder: the turning report's derivatives · ko: F5 나머지: 선반 보고서의 미분 계산
- **O1** — Verify the A9 items in the full suites · ko: A9 항목을 전체 테스트에서 확인
- **O2** — A9-11: Studio download flow · ko: A9-11: 스튜디오 다운로드 흐름
- **O3** — A9 brief fixture: key against bearing clash · ko: A9 브리프 픽스처: 키와 베어링 간섭
- **O4** — A9-7: linked bearing housing in the app (needs a person's rows file) · ko: A9-7: 앱의 연결된 베어링 하우징 (사람이 준 행 파일 필요)
- **O5** — A9 acceptance run, end to end · ko: A9 인수 실행, 처음부터 끝까지
- **O5a** — A9 findings F1–F5: made bodies, holes, bore, tool size, housing · ko: A9 발견 F1–F5: 만든 바디, 구멍, 보어, 공구 크기, 하우징
- **O5b** — A9 findings F6–F10: drawings, fasteners, BOM base members · ko: A9 발견 F6–F10: 도면, 체결구, BOM 기본 부재
- **O6** — Aligned sections; welded DFM profile (waits on the owner) · ko: 기울어진 단면; 용접 DFM 프로필 (오너 대기)
- **O7** — Built-in tables → person-loaded sample rows · ko: 내장 규격표 → 사람이 불러오는 예시 행 파일
- **O8** — Touching lumps: per-lump exports, DFM warning, BOM count · ko: 맞닿은 덩어리: 덩어리별 내보내기, DFM 경고, BOM 개수
- **O9** — Results tied to their revision; REVIEW-A1 · ko: 결과를 계산한 리비전에 묶기; 복구 결함 REVIEW-A1
- **O10** — Rebuild-cost diagnostics, read-only · ko: 재계산 비용 진단 (읽기 전용)
- **O11** — Assembly-level variability · ko: 조립품 수준 변형 (최상위 입력으로 제품군)
- **O12** — Robot tool and sensor frames · ko: 로봇 공구·센서 좌표계 (TCP, 카메라)
- **O13** — External read-back of the robot exports · ko: 로봇 내보내기를 외부 도구로 다시 읽어 확인 (urdfdom, MuJoCo)
- **O15** — RD10 L3: a live model sizes the 3-DoF arm · ko: RD10 실제 모델 실행: AI가 3자유도 팔 크기 정하기
- **O14** — Robot mounts from datasheet rows · ko: 데이터시트 행으로 만드는 서보·모터·베어링 마운트
- **R6** — Triage the stale examples/gpu-scene flows · ko: 오래된 gpu-scene 예제 흐름 정리 (고치거나 은퇴)
- **R7** — API consistency and an object facade over the core · ko: API 일관성 정리와 객체형 겉 API
- **P1** — A real product: single-cylinder four-stroke engine · ko: 실제 제품: 단기통 4행정 엔진
- **P2** — A real product: electronics enclosure · ko: 실제 제품: 전자기기 외함
- **P3** — A real product: large machine (gantry CNC router) · ko: 실제 제품: 대형 기계 (갠트리 CNC 라우터)
- **P4** — A real product: 6-axis robot arm · ko: 실제 제품: 실제 6축 로봇 팔
- **RS1** — Sample robots (8 kinds, opened from a Samples list) · ko: 샘플 로봇 묶음 (8종, 샘플 목록에서 열기)
- **RS2** — Joint motion playback (and motion video) · ko: 관절 움직임 재생 (경유 자세를 시간에 따라 재생, 영상 내보내기)
- **RS3** — The agent moves the robot (joints, waypoints, check and play) · ko: 에이전트가 채팅으로 로봇을 움직이기
- **RS4** — Robot docs examples · ko: 로봇 문서 예제와 화면
- **RS5** — The robot on the facade · ko: 겉 API에서 로봇 다루기
- **R7.1** — Public API inventory · ko: 공개 API 목록 자동 추출
- **R7.2** — API conventions (approved) · ko: API 규약 (승인됨)
- **R7.3a** — Errors to one BarocssError shape in all three packages · ko: 세 패키지 오류를 BarocssError 하나로
- **R7.3b** — Results as data, MMGS units · ko: 결과는 데이터로, 단위는 MMGS로
- **R7.3c** — One function per concept (mass, bounds, STEP, vectors) · ko: 개념마다 함수 하나 (질량, 경계, STEP, 벡터)
- **R7.3d** — Legacy APIs out (createCadModel, old document versions, the y-up tag) · ko: 옛 API 정리 (createCadModel, 옛 문서 버전, y-up 이름표)
- **R7.4a** — One part implementation; verbs on the agent's command names · ko: 부품 구현 하나로, 동사는 에이전트 명령 이름으로
- **R7.4b** — Part facade growth with a selector-stability test · ko: 부품 겉 API 확장과 선택자 안정성 검사
- **R7.4c** — Facade option names without unit suffixes · ko: 겉 API 입력 옵션 이름에서 단위 접미사 빼기 (결과에는 유지)
- **R7.7** — No unit suffixes anywhere (tool arguments, core options, rows fields, results) · ko: 단위 접미사 전부 빼기 (도구 인자, 핵심 함수 옵션, 행 필드, 결과 이름)
- **R7.4d** — Parameters, expressions and suppression on the facade · ko: 겉 API의 매개변수·식·피처 억제
- **R7.5** — Assembly facade · ko: 조립품 겉 API
- **R7.5b** — gpu facade growth · ko: gpu 겉 API 확장
- **R7.6** — Docs on the facades; the inventory as a drift check · ko: 문서를 겉 API로, API 목록을 검사에 포함
- **W0** — Documentation site cleared and its skeleton set up · ko: 문서 사이트 비우고 새 뼈대 만들기
- **W1** — Documentation written from the current code · ko: 지금 코드 기준으로 문서 전부 새로 쓰기
- **G11** — Measure the heaviest scenes, then decide on culling or LOD · ko: 가장 무거운 장면을 재고 나서 컬링·LOD 필요 여부 판단
- **G12** — Studio layout: one dock, one preview mode, compact legends, no overlaps · ko: 스튜디오 화면 정리: 오른쪽 도킹 하나, 미리보기는 하나씩, 짧은 범례, 겹침 없음
- **G12f** — The studio's shell (top bar, rails, bars, menus, palette, HUD) onto shadcn · ko: 화면 틀(상단 바, 도구 막대, 각종 바, 메뉴, 팔레트, HUD)을 shadcn으로
- **R1d** — HUD typing and placing without re-rendering the App · ko: HUD 입력·배치 중 App 다시 그리기 없애기 (렌더링 성능)
- **G13** — Robot tool and sensor frames drawn in the viewport · ko: 로봇 공구·센서 프레임을 뷰포트에 표시
- **O16** — Panel contents tidied for the dock · ko: 도킹 안 패널 내용 정리 (BOM 표 폭, 긴 설명 접기, 문구 스타일 통일)
- **O17** — The chat on the AI SDK (useChat over our SSE, shadcn AI components, scripted chats for flows) · ko: AI SDK 기반 채팅 (기존 SSE 위의 useChat, shadcn AI 컴포넌트, 흐름 검사용 대본 채팅)
- **O18** — Mass on request (the worker sends mass only when asked) · ko: 질량은 요청할 때만 계산 (열기 시간 단축)
- **O21** — The agent can make and set parameters · ko: 에이전트가 매개변수를 만들고 값을 바꿀 수 있게
- **K17** — A suppressed flag in the part document · ko: 부품 문서에 피처 억제 표시
- **O20** — The agent's given values kept through a command's derive (split's at) · ko: 명령의 자동 계산이 에이전트가 준 값을 덮어쓰지 않게 (분할 위치)
- **O19** — Stored edge names checked against their signatures (no silent wrong corner) · ko: 저장된 모서리 이름을 서명과 대조 (엉뚱한 모서리 처리 방지)
- **G1** — A9-7 UI port · ko: A9-7 UI 이식
- **G2** — G23: CNC preview · ko: G23: CNC 가공 미리보기
- **G3** — G21: display modes, silhouettes, isolate and hide · ko: G21: 표시 모드, 실루엣, 격리와 숨기기
- **G4** — G22: clearance map on screen · ko: G22: 화면의 간극 지도
- **G5** — G24: 3D PMI · ko: G24: 3D PMI
- **G6** — G25: GPU analyses (thickness, draft, access) · ko: G25: GPU 분석 (두께, 구배, 접근성)
- **G7** — Antialiased cap edges · ko: 단면 뚜껑 가장자리 안티앨리어싱
- **G8** — Performance regression check · ko: 성능 회귀 점검
- **G9** — Cap sample memory · ko: 단면 뚜껑 샘플 메모리
- **G10** — Full browser flow on WebGL2 · ko: WebGL2로 브라우저 흐름 전체
- **R1** — Studio re-renders: Viewport and the App split · ko: 스튜디오 다시 그리기: 뷰포트와 App 나누기
- **R2** — Viewer per-frame allocations, shared renderer code, viewer.ts split, gpu folders · ko: 뷰어 매 프레임 할당, 렌더러 공통 코드, viewer.ts 나누기, gpu 폴더
- **R3** — chat/tools.ts split by action group · ko: chat/tools.ts를 동작 그룹별로 나누기
- **R4** — cad-model duplicates, layering and folders · ko: cad-model 중복, 계층, 폴더 정리
- **R4b** — src/ui shared panel pieces; DrawingWorkspace split · ko: src/ui 공통 패널 조각; DrawingWorkspace 나누기
- **R5** — Kernel duplicates, hot paths, part-model split, folders · ko: 커널 중복, 핫패스, part-model 나누기, 폴더

## Later (on the roadmap, not started)

- **REVIEW-A1**: **done** in O9 (the recovery copy is written after its mesh blobs). · ko: 복구가 메시 저장 전에 성공을 보고하는 결함 (지금은 O9에 포함)
- **RB5–RB8:** fuzzing, the CI corpus, STEP import hardening and the nightly ABC sweep. RB6 and RB8 need downloads, which need the owner's permission. · ko: fuzz, CI 코퍼스, STEP 가져오기 강화, 야간 ABC 점검 (RB6·RB8은 다운로드 허락 필요)
- **Live AI runs:** RB9 live trials, RD10 L3 and the A7/A8 live comparison. They need a token budget from the owner. · ko: 실제 AI 실행 시험 (토큰 예산 필요)
- **Opening time:** measured in D240 (frames 13–14 s in Node, 11 s of it the 120 frame Booleans; the spring's and worm's time in mass quadrature and tessellation); the kernel's share is K13. · ko: 열기 시간: D240에서 측정 완료, 커널 몫은 K13
- **`.barocad` only** — **done** (merge 24353d870, G-R58; flow step 288) (owner, 2026-10-24): the studio's Open stops treating `.cad` as our curve/surface source (a generic extension other CAD programs use); GPU lane (App.tsx open), docs lane (studio/files.md). · ko: 우리 소스 확장자는 .barocad 하나만 (.cad는 받지 않음)
- **New part resets the camera** (G14, G-R54/G-R56): a new part keeps the last part's saved view today, so flow steps 74 and 270 depend on what ran before; a user-visible change, so later. · ko: 새 부품을 만들면 시점을 기본값으로 (흐름 순서 의존 해소, 화면 동작 변화라 나중에)
- **After G25, when need is measured:** occlusion culling, progressive photoreal rendering, turntable and explode video. · ko: 가려진 물체 생략, 점진 사실적 렌더링, 회전·분해 영상 (필요가 확인되면)
- **Publication:** gpu's entries — **done** (merge 9f66ec3e4, G-R61: tsc-only build, one module graph, a tarball consumer test) — (`@barocss/gpu` was one bundle, `@barocss/gpu/viewer` unbundled tsc output, so each has its own Viewer, ViewerError and BarocssError and `instanceof` fails across them; GPU lane, after R7.7c: bundles with the shared core external, a consumer test), the cad-model package build, the docs inventory (`check:docs` drift for @barocss/gpu), the A6.5 legal review, release. Only when the owner asks. · ko: cad-model 패키지 빌드, 문서 목록, 법률 검토, 릴리스 (오너가 요청할 때만)
- **After the whole roadmap:** the full spec and conformance suite, and a fresh-AI reimplementation test (owner's experiment). · ko: 전체 명세와 적합성 시험, 새 AI가 다시 구현해 보는 실험

## Waiting on the owner

- O11's UI: fold part-level configurations into the assembly's variants (F) or keep them separate in Parameters (K). Built as K for now; F is an adapter change. The outer lane's mock: one Variants card in the dock listing Master, variants and (under F) part configs with a source chip. · ko: O11 UI — 부품 구성(configurations)을 조립품 변형에 합칠지(F) 따로 둘지(K) (지금은 K로 구현)
- Two PDFs for O14's sample mount rows: Bondtech's 17HS datasheet (NEMA 17 pilot) and a NEMA 23 maker drawing; until then both rows are estimates, every field unchecked. · ko: O14 견본 장착 행용 PDF 2개 (NEMA 17·23 치수) 다운로드 허락
- One live chat turn to check whether the CLI emits thinking deltas for O17c's reasoning display (O17c is built to tolerate their absence and marked unverified until then). · ko: O17c 생각 과정 표시 확인용 실제 채팅 1턴 (허락 필요)
- A person-supplied row/fit file for A9-7/A9's acceptance (O4, O5). · ko: A9-7·A9 인수 검사용 사람이 준 행·끼워맞춤 파일 (O4, O5)
- Oblique-end weld beads stay refused (BEAD_ANGLE) until there is an independent oracle. · ko: 비스듬한 끝 용접 비드는 독립 오라클이 생길 때까지 거부
- A v3 decision, if S3 finds a breaking v2 change. · ko: S3에서 v2 호환이 깨지면 v3 결정
- Permissions and budgets: RD3 PDFs, RB6/RB8 downloads, live-model runs, the A6.5 legal review. · ko: 허락과 예산: RD3 PDF, RB6/RB8 다운로드, 실제 모델 실행, 법률 검토
- The 3MF slicer check (open the exported 3MF in PrusaSlicer or Bambu). · ko: 3MF를 슬라이서(PrusaSlicer, Bambu)에서 열어 확인
- Dimension expressions (`W/2 + 3`) in documents: today a value is a number or `{ parameter }`, neither document stores an expression; adding one is a schema change for the kernel and the studio. · ko: 문서에 치수 식(W/2+3 같은)을 저장할지 (지금은 숫자나 매개변수 이름만)
- A built-in display look per material id (al6061's colour, …) in gpu, or scenes keep registering their own looks (today: none; O75 keeps look ids apart from material ids; R7.5b finding 10; the GPU lane recommends none in gpu: looks stay with the app or the person). · ko: 재료 id마다 기본 표시 모양(색)을 gpu에 둘지, 장면이 직접 등록할지

## Off the roadmap (owner decisions)

CAE (FEM, mesher, mould-fill; RD4–RD8 held), PCB/ECAD (deferred), DWG/SAT reading (deferred; DWG writing no-go),
FRf2 sibling-part frames (refused). Standing:
- no WASM and no new runtime dependencies in the packages (cad, cad-model, gpu); the studio app's UI may use UI libraries (owner, 2026-10-24);
- no standards text or built-in tables;
- rows rule (b);
- v2 tools only;
- the icon font is never bundled;
- benchmarks against Tailwind only.
