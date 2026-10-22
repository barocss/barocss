# Implementation session checkpoints (2026-10-18, continued)

Peer messaging from the implementation session was paused by the app (10 messages since the owner last typed). Checkpoints continue here until it resumes.

## Stale-recovery fix (coordinator's request on B13): fbf0a6bc1
- Decision: clear the stale copy, not mark it; recorded in D82 §B13 follow-up.
- `writeRecovery` returns 'ok' | 'too-large' | 'refused' and calls `clearRecovery()` whenever it does not write.
- The App shows a toast once per document ("Crash recovery is off for this document" / "No recovery copy"), again only after a successful write.
- Test: `test/recovery.test.ts`, with a quota'd fake storage.
- The AM4 load-sensitive timing test is recorded in README §0 TODOs.
- Studio 363/363, browser flow 119/119.
- Ordering: C15 (8e5a9dfd9, docs only) was committed before the request arrived.

## C16, part 1: gears (e8ac2a995, plus e4ad465fa, a type-only fix)
- Interfering report 5.8 s → 1.17 s. The output is identical: five cases hashed.
- The sweep cache key leaves out face widths; the axial and total contact ratios are recomputed for each width.
- Budgets: 11.5 s → 2.4 s and 450 ms → 300 ms.

## C16, part 2 — SubD: 2298f6eb0
- The caps' key no longer includes the cage extent. The dependent G1 conditions' misses are kept and re-checked against the current size, so a refusal comes out the same.
- A drag that raises the top vertex: 109–162 → 35–69 ms.
- The topology is read from the mesh that is already built (SD1 and SD2). `opposite()` is counted in one pass.
- Builds hash identical. The new test fails on the old code.

## C16, part 3 — kernel: d716605c0
- Quadrature is kept per B-rep, so mass and area share one run. Plate STEP export: 732 → 512 ms.
- Long texts are exact ids in the reuse keys. An edit beside a 10 MB import: 27 → 1 ms.
- STEP tokens use sticky regexes: reads are 10–25% faster.
- All outputs hash identical.

## C16, part 4 — studio: e8182d908
- Cage overlay: 3.6 → 1.5 ms a frame. Its validation is kept for the whole extrude drag.
- render_views with a highlight: 215–263 → 83–106 ms.
- Library fit ends are kept per library.
- Outputs identical. Browser flow 119/119.
- Open items are in c16-review-findings.md.

Next: C17 (nested functions), then D20.

## C17: 8f49f6d5d
- Hot-path closures hoisted or written out: the ray-triangle test, vertex normals, frustum planes, the frame sorts and request callback, lights and bounds, the vertex snap, SubD nets, twoIrregular.
- bodyMesh now finds a display edge's mate among its face pair only (it was O(E²)): a sharp 12k mesh 270 → 161 ms.
- Hashes identical.
- The AM4 wall-clock test bound is raised from 2 s to 6 s, with a comment that the bench row holds it to 1.2 s.
- Browser flow 119/119; bench:browser within budget.

## D20: 4aba4dea9
- RB trend and properties rows for HEAD: 205 cases, 0 new, the 8 known TODOs, 0 improvements; all properties pass.
- todo.json checked and unchanged: all 8 rows still fail. The note that two graze rows pass no longer holds.

**PERF3 complete.** Next: R8.2 rest (agent cage tools, the browser-flow step).

## Housekeeping: 54326ee7a
- The notes and the cdp-drag profiler are committed into the repository: handover/notes/ and test/tools/cdp-drag.mjs, with its run line in D82 §C15.

## R8.2b (D83): eb8a49241 — the agent's SubD cage tools
- **Read-only tools:** subd_cage and subd_select (faces by normal or box, vertices by box, loop, ring, boundary).
- **Editing tools:** subd_move, subd_extrude, subd_insert_loop, subd_bridge, subd_fill, subd_weld, subd_crease and subd_delete. They reuse the cage editor's own session steps and keep a node's mirror.
- **Refusals:** a non-manifold result, a no-op, and SubdError messages each come back as a typed error.
- **Autonomy L2 (D41):** a move counts as a value edit and applies. A topology change goes out as a proposal (needs_proposal).
- **Tests:** cageTools.test 5/5; studio 369/369; lint and type-check clean.
- **Browser flow:** a new step drives the real chat and tool servers, with the scripted claude stand-in. It runs a move (applied), then an extrude through propose → Accept (28 faces, 1 body). Full run 120/120.
- **Pending decision (reversible default, recorded in README §0):** R8.2 is split into R8.2b (the agent tools, done) and R8.3 (the cage editor end to end in the browser flow, plus the pole gizmo driven by cage data if it fits).
- **Messaging:** paused again after 11 messages, so this checkpoint is here. Next: R8.3 (D84).

## R8.3 + the owner's pipe clamp (D84): 9d6eb25af
- **Reference image:** in the repo at `apps/cad-studio/handover/notes/acceptance/subd-pipe-clamp.png`.
- **Reading of the part:** the image is followed. The lug's plane holds the tube's axis, and the hole is square to it, which is the opposite of the message's wording. Recorded in README §0 as a pending decision (reversible); the other reading can be added as a second case.
- **All of it lands in R8.3:** nothing deferred.
  - **Agent tools:** the clamp is built by the cage tools, 43 calls: `subd-tube`, then 8 rim holding loops; the lug in 4 extrusions with the step; the hole (delete both sides, round the rims, a 0.6 mm funnel, bridge); tunnel and lug holding loops; the top moved onto an arc.
    - Unit test `subdClamp.test.ts`, 60 s. The calls are kept as `test/fixtures/subd-pipe-clamp.calls.json`.
    - The editor's own session steps make the identical cage.
  - **Flow, through the real chat:** P1 accepted, 100 s; the conformance cage exactly; 16 476 mm³ shown; STEP exported and re-opened: 1 solid, the same volume.
  - **By hand in the editor (flow):** tube, rim loop, the lug by Shift-drags with its step, the hole deleted on both sides (in an ortho view), both rims double-clicked and bridged. Done: one body of genus 2. By hand the hole stays square-ish: a person's drags, not exact vertex placement.
  - **R8.3 editor e2e (flow):** on a SubD box, by hand: extrude by Shift-drag, L, C, mirror X, ⌘Z in the session, Done, then document undo and redo. Screenshots after each.
- **Kernel conformance `r8/subd-pipe-clamp`:** one solid, 1 shell, genus 2; 424 faces (88 caps, 20 irregular vertices, 1 Catmull–Clark step).

  | Measure | Clamp | Bound / oracle |
  |---|---|---|
  | G1 | 1.9e-6° | bound 1e-5° |
  | Gaps | 2.2e-14 mm | |
  | Cap deviation | max 0.0120 mm (0.0145% of size), rms 0.0006 | bound 0.02 mm |
  | Cap Jacobian ratio | 0.068 | > 0.05 |
  | Cap normal turn | 3.3° | < 15° |
  | Volume | 16 476.176 mm³ | independent CC oracle 16 476.177 (5e-8) |
  | Area | 11 019.525 mm² | oracle 3.4e-7 off |
  | Centroid | | within 3e-6 mm |
  | Tessellation | 56k triangles, watertight | |
  | STEP round trip | 1.8 MB, exact | |

  - New optional `expect.subd` bounds in the conformance runner.
- **Known open item, not loosened:** D79 tessellation folds up to **88.6°** between ~0.01 mm sliver triangles inside exact patches along the rims' tight holding loops (A5). They are not cap-boundary folds: the caps turn 3.3° at most. A ratchet test keeps them < 89°.
- **New or changed:**
  - `subd-tube` primitive;
  - `subd_insert_loop` `t`;
  - boundary query `box`;
  - a hole's rim by double-click (`openRun`).
- **Editor fixes the flow found:**
  - a new part during a cage edit crashed the panel; the session now ends with a toast when the part changes under it;
  - a Shift-click on the gizmo extruded by 0 (degenerate); a drag of nothing is now no step;
  - Esc with nothing picked dropped all steps unasked; now it asks for Done or Cancel.
- **Pole-gizmo item:** nothing to do; it is the same `TransformGizmo`.
- **Follow-up (not done):** the Selection panel's "Surface area" sums the tessellation (0.11% low on the clamp).
- **Suites:** kernel 1022/1028 (the known env Split test; B9 wall-clock 417/400 ms under the concurrent studio suite, 75 ms alone — load-sensitive, in README TODOs); conformance all; RB 206 cases 0 new, 8 known TODOs (trend row recorded); studio 374/374; bench all within budget; lint 0 errors, type-check clean; browser flow full run 123/123.
- **Chat-turn overwrite candidate:** confirmed by code reading (ChatPanel.tsx:106 base at send → :131 → App.tsx:2042 commit(next) of the whole document; nothing blocks edits during a turn); recorded in README §0 known defects with a repro; not fixed.
- **Docs commit:** the research notes (cad-server, R10/R11 fillet-shell, sketch solver) unchanged in handover/notes/, pointers under A5/A7, R10a, R10/R11; the 16 → 64 sketch-limit fixes; faceReach in known defects.

Next: R9 QEM decimation.
