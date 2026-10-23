# barocss CAD roadmap

Current as of 2026-10-23, after the Codex import. This file is the one place for **what we do, in what order, and
when each item is done**. It replaces Codex's continuation roadmap of 2026-10-22/23, which is at `0eabecf7f` and on
`codex/cad-coordinator-handover-20261022`.

Details and contracts live in the decision logs: `decisions.md` (kernel, D), `decisions-outer.md` (outer, O),
`decisions-gpu.md` (GPU, G). Each lane's README §0 block says where that lane stands. How the work is run (lanes,
coordinator, verification tiers) is in `notes/claude-resume-2026-10-23/`.

**The goal (owner):** AI takes a brief to a manufacturable, buyable product. A9 is the first end-to-end run of that path.

## Where we are

Integration is `review/cad-gpu-engine-2026-10-14` at `6bfd0ad97`, local only.

| | |
|---|---|
| Content | develop (#2185) + Codex's work squashed (`99da385a1`, no evidence files) + the GPU lint fix |
| Last fully verified commit | `9fec9950c`, 2026-10-22: full flow 264/264 |
| Integration window at `99da385a1` | builds and tsc pass; gpu 179/179; kernel 1597/1608 (4 real failures); model 902/915; studio 166/187; studio lint 1 error (fixed since); browser flow not run |

Done, per area (see the logs):
- **Kernel core:** R1–R12c, track K and PKG.
- **Frames:** FR1–FR4, FRa–FRg, FRk1, FRk2, FRk3 (I/H, tapered channels, D172), FRk4 (curved and bent members, D173/D174) and FRk5 (weld gaps and notches, D175). FRk5 has open items below.
- **Shared weld seams:** D170.
- **Robots:** RM1–RM9, RD1–RD3, RD9.
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
| S9 | Window and full browser flow at one commit | coordinator | The new "last fully verified" commit |

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
| O1 | Verify A9-1, A9-2, A9-5/6 and A9-13, A9-4, A9-10/A9-8 in the full suites (Codex checked them only in focused runs) | Their tests pass in the Phase 0 window |
| O2 | **done** O175 flow step. **A9-11** the Studio download flow (CSV and outputs with their sources) | The flow step downloads, reopens and matches |
| O3 | **done** O158. **The A9 brief** fixture: the default shaft's key clashes with the 6204 (115 mm³) | The key or the bearing moved; the clearance map shows no clash |
| O4 | **A9-7** linked bearing housing in the app: the GPU lane ports the UI (G-lane item below); the outer lane owns the model side | Linked-bearing success flow. **Needs a real person-supplied row/fit file from the owner**; never a generated one |
| O5 | **done** O159, O164, O165 (automated end to end; the owner's own acceptance with a real file still pending). **The A9 acceptance run** (`test/a9-acceptance.test.ts`, `conformance/a9`) | Brief → part, drawings, BOM, CSV, manufacturing outputs and purchase list, all through v2 tools; reopened identical |
| O5a | A9 findings from O159: F1 madeBodies (**done** O160; GPU display G-R6), F2 each hole drilled once (**done** O161), F3 the Ø47 bore as a circular pocket or a typed refusal, F4 a clearance hole in the cover (owner-free choice (b)) | Each with an oracle |
| O6 | Open items: aligned sections for off-axis features (**done** O178); a welded-fabrication DFM profile (A9-12, needs sourced rules; waits on the owner) | Decide, then build or close |

### GPU lane: viewer track G21–G25

| # | Item | Exit |
|---|---|---|
| G1 | **done** G-R2. **A9-7 UI**, ported from Codex's `8789e468`: Housing path, linked BOM refusal CSV, useAssembly faceTable. Its tests move to `apps/cad-studio/test`. | The no-row flow as before; linked success with the owner's file (O4) |
| G2 | **done** G-R3, G-R4, G-R5 (overcut; found and fixed the pocket offset, O157); flow step authored. **G23 CNC preview** from Codex's source `5c9f861f`: App, Viewport and renderer connections and tests | Material removal shown on both renderers; NOT FOR PRODUCTION kept |
| G3 | **done** G-R7, G-R13 (Display popover), G-R15 (both renderers). **G21 rest**: silhouettes, isolate/hide in every display mode, the WebGL2 instance display | Each mode on both renderers, picks unchanged |
| G4 | partly done: made-bodies previews G-R6; G23 CNC and K2 on both renderers G-R14. **G22** the clearance map on screen (states overlap/contact/touching/designed/near/clear) and **G23** print layers: dual-renderer and Save/Open acceptance | Flow steps on WebGPU and WebGL2 |
| G5 | **done** G-R8, G-R9, G-R16. **G24** 3D PMI, using the outer lane's glyph builders | Annotations placed, picked and saved |
| G6 | **done** G-R10–G-R12, G-R17, G-R18 (access map on WebGPU as a GPU estimate; thickness stays on the CPU, owner rule: the CPU is authoritative; scan deviation G25c deferred). **G25** GPU analyses | Each analysis matches its CPU result within its stated tolerance |
| G7 | **done** G-R19, G-R20. Antialiased cap edges | — |

### Next items (2026-10-23)
| # | Lane | Item |
|---|---|---|
| K10 | kernel | **done** D188–D196: RB5 fuzz harness; empty operands; six INVALID fixed; the KNOWN crescent; refusal triage |
| K10b | kernel | the 17 robust refusals of valid inputs (D197 on), then the 8 near-degenerate; separate lumps on exact contact as separate bodies |
| K11 | kernel | F5's remainder (the turning report's first-derivative evaluations) |
| O5b | outer | A9 findings: F8 drawings (**done** O170–O174), F9 fasteners as bought lines, F10 base members in the BOM (**done** O169), F6/F7 (**done** O167/O168) |
| G8 | GPU | **done** G-R21: GPU contour for curved silhouettes, dirty-run block writes, clip flags kept; the two App findings moved to R1 |
| G9 | GPU | **done** G-R22: r16uint triangle key, 15.8 MiB at 1080p, 63.3 at 4K (key collision ~1/65 535 per pair, measured) |
| G10 | GPU | the full browser flow on WebGL2 |

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
| R1 | GPU | The studio's re-renders. `Viewport.tsx`: the per-frame `setTick` (449) re-renders the whole viewport. Move the projected overlay into a child that owns the tick; give the print-mode props stable identities; build the `viewState` Map only when `transforms` changes; cache the view-projection in studio `camera.ts` `project`; wrap Viewport in `memo` with stable App callbacks. `App.tsx` (2905 lines, 110 `useState`): state into domain hooks/contexts, so each panel subscribes only to its slice. First targets from G8: pick 121–151 ms (budget 90; 63 ms in the outliner's 120 rows) and the ghosted orbit re-rendering every step. Render counts before and after on the same flow |
| R2 | GPU | Per-frame allocations in the viewer and both renderers (dynamic-offset arrays, `packFrame`/`packOutput` reuse, `pipelineKey` cached on the mesh, closures and `[a,b]` arrays, `JSON.stringify` keys); then one studio display-policy module shared by `renderer.ts` and `gpuRenderer.ts` (theme, mode factors, dash, accent, face/edge state, instance sharing and matrix, bounds); then `viewer.ts`/`shaders.ts` split behind the facade; then the 98 top-level gpu files into folders (deep `dist/` test paths fixed in the same commit) |
| R3 | outer | `chat/tools.ts` → `chat/part/*` + `toolKit` + `toolDefinitions` (plan approved, R3a–R3e), with the shared patterns the survey found; the tools list and prompt byte-identical |
| R4 | outer | cad-model duplicates: util/ (round, guards, units, nextFreeId), one `boundsOf`, one `bodyMass`, one material registry, generic `editRows`, `engine/placement.ts` (fixes engine → assembly), one instance-evaluation helper, the kernel's `symmetricEigen3`; then `evaluate.ts` (notes split, evaluateDoc/evaluatePart merged, `placedOutputs` and frame geometry computed once); then folder moves with `export *` shims (analysis/, BOM out of team/, document-schema types out of chat/, rb9 out of src) |
| R4b | outer | `src/ui`: shared panel pieces; `DrawingWorkspace` split |
| R5 | kernel | Exact copies first (vec3, Gauss–Legendre, `guardKnots`/`mapParameter`, `same`, the perpendicular frame, checked arithmetic); hot-path allocations (`rolling-ball` station solvers, `brep-mass-quadrature` nearest-4, `surface-intersection` all-pairs → the existing BVH, tessellate refinement); `part-model.ts` `operation()` split by family, then the other top-5 files; folders (part-model-only families first; modeling, sketch and planar-solids last, because of the 20 trap tests); the convex-planar templates as one factory; last, the admission boilerplate behind a budget object |

Rules: each R step is behaviour-preserving and its own checkpoint; no public export renamed without a re-export (saved
documents and package paths keep resolving); the touched package suites, lint and types per step, and the full window
plus the full flow at the end of the phase. Render counts and frame times are recorded in the decision logs, not as
evidence files.

## Later (on the roadmap, not started)

- **REVIEW-A1** (from Codex): recovery metadata can report success before the mesh blob is stored. A real defect, off the current path.
- **RB5–RB8:** fuzzing, the CI corpus, STEP import hardening and the nightly ABC sweep. RB6 and RB8 need downloads, which need the owner's permission.
- **Live AI runs:** RB9 live trials, RD10 L3 and the A7/A8 live comparison. They need a token budget from the owner.
- **After G25, when need is measured:** occlusion culling, progressive photoreal rendering, turntable and explode video.
- **Publication:** the cad-model package build, the docs inventory (`check:docs` drift for @barocss/gpu), the A6.5 legal review, release. Only when the owner asks.
- **After the whole roadmap:** the full spec and conformance suite, and a fresh-AI reimplementation test (owner's experiment).

## Waiting on the owner

- Built-in standards-like tables in cad-model (R0): `FASTENER_SIZES` (ISO M3–M12, drives tapped holes, drill sizes, threads, drawing tolerance, machining holes; person rows cover only what is bought), the NPTEL/efunda casting tables in `library/builtin/materials.json`, the M2–M3 boss/insert variants in `enclosure.json`. Keep, or move to person-supplied rows (a versioned change, saved documents keep resolving).
- A person-supplied row/fit file for A9-7/A9's acceptance (O4, O5).
- Oblique-end weld beads stay refused (BEAD_ANGLE) until there is an independent oracle.
- A v3 decision, if S3 finds a breaking v2 change.
- Permissions and budgets: RD3 PDFs, RB6/RB8 downloads, live-model runs, the A6.5 legal review.
- The 3MF slicer check (open the exported 3MF in PrusaSlicer or Bambu).

## Off the roadmap (owner decisions)

CAE (FEM, mesher, mould-fill; RD4–RD8 held), PCB/ECAD (deferred), DWG/SAT reading (deferred; DWG writing no-go),
FRf2 sibling-part frames (refused). Standing:
- no WASM and no new runtime dependencies;
- no standards text or built-in tables;
- rows rule (b);
- v2 tools only;
- the icon font is never bundled;
- benchmarks against Tailwind only.
