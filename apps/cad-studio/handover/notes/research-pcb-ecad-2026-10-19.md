# PCB / ECAD — what it would take (coordinator research, 2026-10-19)

Design input only; not on the roadmap. The owner asked whether BaroCSS could also make PCBs once the current
roadmap is done. From a read-only survey of this worktree and web research (dates are publication dates;
*unverified* where no primary source was reached). Not legal advice.

## 1. Short answer
The current roadmap is mechanical CAD; it covers the **mechanical half** of a PCB product (board shape, enclosure,
fit, 3D printing) but not the **electrical half** (schematic, footprints, routing, DRC, fab outputs). Recommended:
integrate with existing ECAD first (Phase 1), own minimum ECAD later (Phase 2), AI-assisted layout last (Phase 3).
Our differentiator would be real 3D mechanical co-design, which no ECAD product we found does fully (Fusion is
closest).

## 2. What we have
- **PCB today**: no ECAD code. D66 (R6b.2) has the `pcb-standoff` library part (`screw` interface, role
  `pcb-mount`) and the `hole_alignment { board }` check (`src/library/alignment.ts`, `src/chat/spec.ts`), which treats
  an imported board STEP as a part and compares its hole axes with the standoffs (test: four M2.5 standoffs, a
  50×40×1.6 board, through a STEP round trip). RB9 scenarios 9–10 are "PCB enclosure" and "sheet-metal PCB enclosure".
- **Reusable for ECAD–MCAD**: enclosure elements (D65–D71); materials/process profiles (D67) and AM1–AM5; STEP
  write AP214/AP242 (D48–D49) and import of solids; instances/mates/sub-assemblies; libraries LIB1–LIB4 (interfaces,
  `placeByInterfaces`, provenance and licence rules D61/D64); `interference` (exact overlap volume) and `clearance`
  queries; requirements (A3); 2D `booleanCurveRegions` (exact lines/arcs), `section-offset.ts` (disc-sweep offset),
  polygon regions; drawing SVG/PDF; planned R11b DXF writer.
- **Missing for Phase 1**: STEP import of product structure and colours (`NEXT_ASSEMBLY_USAGE_OCCURRENCE`,
  `STYLED_ITEM` — a board STEP arrives as one `import` node, not one instance per component); a board model
  (outline, thickness, layers, plated holes, placement by refdes and side); a component model (footprint, height,
  package, 3D model mapping); keep-out/keep-in bodies with height limits (A6/A8 text only); exact B-rep clearance
  (today on the display mesh); height/keep-out check tools; an ECAD change-sync/diff model.
- **Where it plugs in**: optional top-level `StudioDoc` fields and new node kinds (schema bump, `migrate.ts`
  allow-list); tools in `src/chat/*`; readers/writers in `packages/barocss-cad-interop` (today only preview packets).

## 3. Formats
| Format | Spec | Verdict |
|---|---|---|
| **IDF 3.0** (.emn/.emp) | 1996 spec "may be used by any party for any purpose" | Safe and simple; 2.5D (one height per part). **Implement first.** |
| **STEP board assembly** | AP242/AP214 (ISO text paid) | We already do STEP; add assembly structure + colours on import. Full AP210 out of scope. |
| **KiCad** s-expression (.kicad_pcb/.kicad_sch/.kicad_mod) | Documented at dev-docs.kicad.org/en/file-formats | Format is not code; write our own parser from the docs and sample files, never from KiCad's GPL source (MIT clean-room parsers exist). |
| **Gerber X2/X3**, **XNC drill**, job file | Free from Ucamco (Rev 2026.05, PEG grammar) | Implement for Phase 2; read the spec's IP clause first (*unverified*). |
| **Pick-and-place / BOM** | No single standard | Configurable CSV + Gerber X3. |
| **IDX / EDMD** (ProSTEP PSI 5) | Baseline + accept/reject change proposals; schema access *unverified* | The right long-term exchange; contact ProSTEP first. Mirror its semantics internally meanwhile. |
| **IPC-2581** | IPC sells Rev C; consortium free membership | Buying it = ingesting IPC text; owner decision. Defer. |
| **ODB++** | Spec PDF marked confidential | Avoid for now. |

## 4. ECAD pieces and difficulty
- Schematic, netlist, ERC — medium (graph model; mostly UX).
- Footprints/symbols — medium, a **data** problem: IPC-7351 is paid; KiCad's generator scripts are GPLv3. Write our
  own parametric generators fed from manufacturer datasheet land patterns, every value sourced or flagged.
- Stackup/impedance — closed forms from papers (Wheeler 1977, Hammerstad–Jensen 1980, Kirschning–Jansen, Cohn) are
  low effort; a 2D field solver is research-grade.
- Placement — manual/constraint-driven (rooms, keep-outs, MCAD-locked connectors, height zones) is easy;
  automatic placement is optimisation (force-directed/annealing + legalisation).
- **Routing — the hardest**: grid Lee/A* is easy but poor; gridless shape-based is hard; **interactive
  push-and-shove** (KiCad PNS: octagonal primitives, shove/hug, smoothing, diff pairs, length tuning) is the essential
  pro feature (GPL: study the FOSDEM 2015 talk, not the code); topological routing is research. FreeRouting is GPL-3.0
  with Specctra DSN/SES (a Cadence-copyrighted manual) — external oracle only.
- DRC, copper pours, thermal reliefs — medium-hard: an integer-robust polygon kernel with arcs (Clipper-style, own
  code), spatial index, net-class clearance matrices; pours = offset-and-subtract with island removal.
- Fab outputs — low-medium, but board houses reject subtle mistakes: needs a conformance suite.

## 5. Others
KiCad (GPL; IPC API via Protobuf/NNG, Python `kipy`, needs a running GUI; MCAD via STEP/VRML/IDF); Altium MCAD
CoDesigner (cloud push/pull with per-change accept/reject; not IDX); Cadence and Siemens use IDX; Fusion Electronics
(integrated ECAD+MCAD; EAGLE end of sale 2026-06-07); Flux.ai (web ECAD, AI auto-layout, prompt-to-board, vendor
claims); JITX (Python circuits, commercial); atopile (MIT, `.ato`, layout via KiCad); **tscircuit** (MIT,
React/TypeScript circuits, MIT TS autorouter — closest to our stack; reference/test oracle only); Quilter (RL layout;
the user still finalises the schematic, outline, connector placement, net classes); DeepPCB (RL router via DSN/SES);
Celus (requirements → schematic). Research: PCBWorld (arXiv 2607.05915, KiCad-based agent environment, 679 boards —
check each board's licence), OmniRouting (arXiv 2608.04434), PCB-Bench (ICLR 2026).
Typical ECAD–MCAD failures: Z/height clashes (worse with 2.5D models), IDF origin/hole mismatches, DXF without Z,
stale emailed files, simplified boxes hiding interference, problems found only at box build.

## 6. Phased plan (proposal)
- **Phase 1 — integration (KiCad as the reference ECAD).** Board as a B-rep body (outline, cutouts, holes, optional
  layer stack); components as instances with refdes/side/height/3D model; typed keep-out/keep-in regions with height
  limits; exact clearance/min-distance checks to the enclosure; MCAD-locked connectors and holes. Read IDF 3.0, STEP
  board assemblies (structure + colours), `.kicad_pcb` (outline, footprints, 3D refs); write IDF 3.0 outline/keep-outs
  and a DXF outline (R11b). A baseline + delta change model mirroring IDX; adopt IDX once access is clear; optionally
  drive a user-launched KiCad over its IPC API.
- **Phase 2 — own minimum ECAD.** Schematic/netlist/ERC → sourced parametric footprints → manual and constraint
  placement driven by Phase 1 keep-outs → interactive router (walkaround, then push-and-shove, diff pairs, length
  tuning) → integer polygon kernel for DRC/pours → closed-form impedance → Gerber X2, XNC, job file, X3/CSV, BOM.
  External oracles only: KiCad DRC, gerbv/Ucamco reference viewer, FreeRouting.
- **Phase 3 — AI-assisted.** Placement scored on mechanical (enclosure, heights, thermal) plus electrical constraints —
  our differentiator; agent routing with our router as the tool (PCBWorld-style); code-defined circuits (tscircuit-like
  TypeScript) toward brief-to-board.

## 7. Licence and provenance pitfalls
GPL code (KiCad incl. PNS and parsers, FreeRouting, footprint generators) — external oracles only, clean-room record;
KiCad libraries CC-BY-SA 4.0 + libraries exception — users may load them, we must not bundle or derive a library;
IPC-7351/IPC-2581 paid text — source land patterns from datasheets; ODB++ confidentiality notice; Specctra DSN manual
copyright; ISO STEP text paid; vendor/aggregator libraries (SnapEDA, Ultra Librarian, manufacturer models) often
non-redistributable; benchmark boards need per-board licence checks.

## 8. Hardest risks
1. Robust, fast gridless push-and-shove routing (years of KiCad/Altium work). 2. An integer polygon kernel with arcs
at board scale (100k+ objects). 3. A clean-provenance component/footprint library (data, not code). 4. Fab output
correctness (conformance suite). 5. Autorouting quality a human accepts. 6. SI/PI beyond closed forms needs field solvers.

## 9. Where it could sit (owner decision)
Phase 1 is mostly mechanical and could follow R14/A6 (keep-outs and reference bodies are A6 items); Phase 2–3 would be a
new ECAD track after the current roadmap. Nothing is scheduled.
