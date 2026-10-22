---
artifact_type: owner-supplied-roadmap
source: user-attachment
received: 2026-10-22
source_sha256: c55218e6c4cc74c7435716db2e1b7da211b62186464ea46af583d23e5b009354
interpretation: Historical completion claims retain their original proof limits.
---

## 0. Roadmap status at hand-over (one page)

**The end goal** (owner): AI takes a brief to a manufacturable, buyable product, so most CAD areas are needed in the end. A9 is the first end-to-end run of that path. README §4 ("Mesh bodies and SubD roadmap", "Standard elements, manufacturing and robot tracks") has each track's scope and acceptance. This table says where each one stands. The id in brackets is the decision record (D = `decisions.md`, O = `decisions-outer.md`, G = `decisions-gpu.md`).

### Done

| Area | Items |
|---|---|
| Kernel core and mesh/SubD | R1–R9 (F0–F2 facet faces, SubD SD2/SD3, QEM decimation D85), R10a side names (D86), R10 fillets (D87–D103), R11 shell and offset (D105–D114), PERF3 (D82) |
| Elements and library | R6a gears (#2167), LIB1–LIB4, R6b enclosure elements, R12b gears+ (internal, bevel, spiral bevel as an ideal model, worm and wheel, D129–D138), R12c machine elements (springs, fits, shafts, keys and rings, bearings, O-rings, cams, drives, connectors, D153–D163) |
| Sheet metal and frames | R12 sheet metal (D115–D121), FR1–FR4 frames, trims and cut list (D122–D128), the outer lane's FR leftovers FRa–FRg (O115–O125, O140) |
| Robots and dynamics | RM1–RM9 (joint tree, FK, inertia, URDF/MJCF/SDF/USD, collision, IK, the four-bar loop, O14–O19, O43–O45, O62–O66), RD1–RD3 (O20–O22), RD9, and RD10's deterministic part (O47, O48) |
| Manufacturing (DFM) | AM1–AM7 (print, split, hollowing, gyroid, O51–O58), IM1–IM8 (moulding, quote package, mould halves, casting, O76–O82, O104–O113), CNC1–CNC8 (machining, turning, features, stock, the 2.5D CAM preview NOT FOR PRODUCTION, O83–O89, O100–O103) |
| Drawings and data exchange | R11b DXF writer (O1), R14 automatic drawings (O2–O7), R12c and the BOM on drawings (O142–O147), section views X1–X3 (O148) |
| AI collaboration | A1–A4, A5 tool layer, script, MCP server and CLI (O8–O13), v2 tools only (O105), A6 inputs (O23–O29), A7 multi-agent v1 (O30, O31, O94), A8 multi-agent v2/v3 (O32–O42), chat-turn merge (O133) |
| Package split | PKG: kernel, `@barocss/cad-model` (fully public, O107) and the app (O91–O99, O112), track K (generic geometry into the kernel) |
| Robustness | RB1–RB4. RB9's ladder harness, scripted (O70–O74) |
| GPU viewer | G1–G19 (posed instances, clip planes and caps, picking, benches, analysis maps, overlays, large assemblies, transparency, proposal overlay, LOD, SDF labels, WebGL2 parity, 3D skeleton tool, section upgrades), G20.1 (cut-outs in the viewer) |
| Data sides for the GPU | G22 clearance map, G23 print layers and CAM program, G24 model annotations (outer lane, built) |

### In progress (work in the branch is WIP or only partly checked; see §4 and §7)

| Lane | Item | State |
|---|---|---|
| Kernel | FR completion, kernel half (FRk) | FRk S0, FRk1 gussets and end caps, FRk2 weld beads and FRk8b the mass fix are done (D164–D167). FRk3 is next, not started |
| Outer | A9: brief → buyable, manufacturable product | S0 done. A9-3 verified. A9-1 and A9-2 have run only their own tests. A9-5/6 is WIP |
| GPU | G20.2: the studio's cut-out mode | WIP (3d85e6793, 398683cb6), unverified |
| Coordinator | Window checks on the tip | not run. Last verified window: 9fec9950c |

### Next (in order, per lane)

- **Kernel:** FRk3 I/H beams and tapered channels → FRk4 arc members, revolve with holes → FRk5 weld gaps, notch cutters → FRk6 ordered-trim speed (≤ 2 s) → FRk7 SubD slivers → FRk8a housing Da max → FRk8b's speed half if needed → FRk9 acceptance. Also: beads on ordered-trim ends (BEAD_SEAM_NOT_PLANAR), which A9's oracle needs.
- **Outer:** verify A9-1, A9-2 and A9-5/6 → A9-13 → A9-4 → A9-10 (with A9-8) → A9-9 rows rule (b) → A9-11 → A9-7 → the A9 acceptance run. Also fix the A9 brief's key/6204 clash (115 mm³).
- **GPU:** finish G20.2 → G21 silhouettes, display modes, isolate/hide → G22 clearance map on screen → G23 print layers and CNC material removal → G24 3D PMI → G25 GPU analyses → antialiased cap edges.
- **Coordinator:** the window checks on the tip first (§7). Then one merge window at a time.

### Later (on the roadmap, not started)

- **RB5–RB8:**
  - RB5: L4 fuzz of random CSG trees;
  - RB6: CI corpus with goldens;
  - RB7: STEP import hardening;
  - RB8: nightly ABC sweep.

  RB6 and RB8 need downloads, so they wait for the owner's permission.
- **Live AI runs:** RB9 live trials, RD10's L3 run, the A7/A8 live comparison. They need a token budget from the owner.
- **After G25, when need is measured:** GPU occlusion culling, progressive photoreal rendering, turntable and exploded-animation video.
- **Open items to decide:**
  - aligned sections for off-axis features;
  - a welded-fabrication DFM profile (A9-12);
  - oblique-end weld beads (refused until there is an independent oracle);
  - FRf2's sibling-part frames (refused by decision).
- **After the whole roadmap:** write the full spec and conformance suite, then test whether a fresh AI can reimplement from them (owner's experiment).

### Deferred or off the roadmap (owner decisions)

- **CAE:** FEM, the mesher and mould-fill simulation are off the roadmap (#2177, O46). RD4–RD8 are held for this reason.
- **PCB/ECAD:** deferred, mechanical CAD first (2026-10-19). The research note is kept.
- **DWG and SAT:** reading both is deferred and writing DWG is a no-go. A DWG is refused with a typed error (O61, O63).
- **Pending owner actions:**
  - the RD3 PDFs and the RB6/RB8 downloads (permission);
  - the A6.5 legal review of the data;
  - the `check:docs` manifest drift for @barocss/gpu (docs owner).
- **Standing:**
  - no WASM and no new runtime dependencies;
  - no standards text or built-in standards tables;
  - the icon font is never bundled;
  - benchmarks against Tailwind only.
