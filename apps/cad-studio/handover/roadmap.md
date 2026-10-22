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

## Phase 0: make integration green again (Codex's leftovers), now

Each item has an owner lane and an exit. Phase 0 ends with a full window and full browser flow at one commit; that
commit becomes the new "last fully verified".

| # | Problem (cause) | Lane | Exit |
|---|---|---|---|
| S1 | **Import cycle in cad-model.** Codex's `chat/outputs.ts` closes `outputs → team/bundle → baseline → assembly → parts → chat/tools`, so `commands` is undefined at load ("ROBOT_TOOLS is not iterable"). It breaks whole test files: chat, decimate, frame, palette, palette-rank, sheet and cageEdit. | outer | No path from `outputs` back to `tools`; those files load and pass; public module paths unchanged |
| S2 | **Rows rule (b) fixtures.** Codex added rule (b) (agent-written rows refused) without moving the existing tests and the cad-cli/cad-mcp paths to person-supplied files. Affected: the model frame/stock/clearance tests, and studio CNC7b, CNC8, IM7, IM8b, nest, robot-check/size and A8.6 bundles. | outer | Every fixture loads rows through a person file. Raw `rows` are still asserted refused. cad-cli/cad-mcp take a person-file input mirroring chat. Rule (b) unchanged |
| S3 | **The frozen v2 contract test fails.** Codex changed tools (`load_rows`, the refused `rows` property, `output_*`) without updating `tools-v2.json`. | outer, then owner if breaking | A written diff of the contract: additive → update the frozen file with a record; breaking → owner decides v3 or rework |
| S4 | The rest of the window's model and studio failures (O73 set_material, the read-tool output schema test, inherited-context identity, A7.5, cad-cli spawned), each classified first | outer | Each fixed or assigned with a cause |
| S5 | **Kernel failures:** | kernel | D176 committed with the four fixed; the V notch back within 1e-11 without changing tolerance or oracle |
| | (a) frk-3's oracle was dropped with the evidence folders | | restored as a test helper |
| | (b) S0 tests pinned "revolve refuses holes", which FRk4 changed | | |
| | (c) **the V notch mass regressed to 1.42e-11 relative** (tolerance 1e-11), probably Codex's FRk5 quadrature change | | |
| | (d) **sweep silently drops holes**: Codex gave sweep revolve's new check; a Ø30/Ø26 tube swept 100 mm gives the solid's 70 685.83 mm³, not 17 592.92 | | sweep refuses again |
| S6 | Studio lint, no-this-alias in `bench-assembly.mjs` | GPU | **done**: `59582a911`, merged as `6bfd0ad97` |
| S7 | **Model review findings** (2026-10-23): | outer | Each verified in code, then fixed with a test or closed with a reason |
| | P2 stock rows replaced wholesale on a placed part with inherited stock (being fixed in S2: merge by id) | | |
| | P3 bend receipts by digest | | |
| | P3 a nested closure and a whole-document key in `bearingDependencyKey` on the evaluation path | | |
| | P3 refused `rows` still advertised in three tools | | |
| | P3 `cadMcp` re-reads the state file on every save | | |
| S8 | **REVIEW-A1:** recovery metadata can report success before the mesh blob is stored | outer | A failed blob write is reported, recovery stays coherent, with a test |
| S9 | **Window and flow** | coordinator | Full package suites, studio, tsc, lint, then the full browser flow, all at one commit |

Phase 0 rules:
- No tolerance or expected value changes to pass.
- Evidence is never committed again.
- Codex's `codex/*` branches are kept as history.

## Phase 1: the roadmap, per lane (starts as each lane's Phase 0 items close)

### Kernel lane: finish the frame track (FRk)

| # | Item | Exit |
|---|---|---|
| K1 | **FRk6** ordered-trim speed. From Codex's unverified WIP `abb697f2`: hoist `stripSpanD1`'s closure and per-element callbacks first (owner rule). | Member5 mass at 1e-9, the reversal case, the general fallback and the frame regression set pass; the round-cornered table ≤ 2 s (one corner was 1.2–1.5 s, the table 5.7 s). D177 |
| K2 | **FRk5 leftovers.** The notch screen/file flow, and the WebGPU failure Codex retained (with the GPU lane for the viewport part). | The notch made, saved and reopened in the app on both renderers |
| K3 | **FRk7** SubD display folds inside single B-spline faces (`surfaceTriangles`) | The pipe clamp's worst fold under 25° (88.6° now) |
| K4 | **FRk8a** the bearing housing's shoulder checked against the row's Da max, read from the housing's faces | A typed refusal when it doesn't fit |
| K5 | **FRk8b's second half** (exact-trim integration), only if K1 still needs speed | — |
| K6 | **FRk9** acceptance by the agent: a welded table with gussets, caps and beads; a tapered-I portal; a bent-tube rail | `conformance/frk/accept-*` pass through v2 tools |

### Outer lane: A9, brief → buyable, manufacturable product

| # | Item | Exit |
|---|---|---|
| O1 | Verify A9-1, A9-2, A9-5/6 and A9-13, A9-4, A9-10/A9-8 in the full suites (Codex checked them only in focused runs) | Their tests pass in the Phase 0 window |
| O2 | **A9-11** the Studio download flow (CSV and outputs with their sources) | The flow step downloads, reopens and matches |
| O3 | **The A9 brief** fixture: the default shaft's key clashes with the 6204 (115 mm³) | The key or the bearing moved; the clearance map shows no clash |
| O4 | **A9-7** linked bearing housing in the app: the GPU lane ports the UI (G-lane item below); the outer lane owns the model side | Linked-bearing success flow. **Needs a real person-supplied row/fit file from the owner**; never a generated one |
| O5 | **The A9 acceptance run** (`test/a9-acceptance.test.ts`, `conformance/a9`) | Brief → part, drawings, BOM, CSV, manufacturing outputs and purchase list, all through v2 tools; reopened identical |
| O6 | Open items: aligned sections for off-axis features; a welded-fabrication DFM profile (A9-12, needs sourced rules) | Decide, then build or close |

### GPU lane: viewer track G21–G25

| # | Item | Exit |
|---|---|---|
| G1 | **A9-7 UI**, ported from Codex's `8789e468`: Housing path, linked BOM refusal CSV, useAssembly faceTable. Its tests move to `apps/cad-studio/test`. | The no-row flow as before; linked success with the owner's file (O4) |
| G2 | **G23 CNC preview** from Codex's source `5c9f861f`: App, Viewport and renderer connections and tests | Material removal shown on both renderers; NOT FOR PRODUCTION kept |
| G3 | **G21 rest**: silhouettes, isolate/hide in every display mode, the WebGL2 instance display | Each mode on both renderers, picks unchanged |
| G4 | **G22** the clearance map on screen (states overlap/contact/touching/designed/near/clear) and **G23** print layers: dual-renderer and Save/Open acceptance | Flow steps on WebGPU and WebGL2 |
| G5 | **G24** 3D PMI, using the outer lane's glyph builders | Annotations placed, picked and saved |
| G6 | **G25** GPU analyses | Each analysis matches its CPU result within its stated tolerance |
| G7 | Antialiased cap edges | — |

## Later (on the roadmap, not started)

- **RB5–RB8:** fuzzing, the CI corpus, STEP import hardening and the nightly ABC sweep. RB6 and RB8 need downloads, which need the owner's permission.
- **Live AI runs:** RB9 live trials, RD10 L3 and the A7/A8 live comparison. They need a token budget from the owner.
- **After G25, when need is measured:** occlusion culling, progressive photoreal rendering, turntable and explode video.
- **Publication:** the cad-model package build, the docs inventory (`check:docs` drift for @barocss/gpu), the A6.5 legal review, release. Only when the owner asks.
- **After the whole roadmap:** the full spec and conformance suite, and a fresh-AI reimplementation test (owner's experiment).

## Waiting on the owner

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
