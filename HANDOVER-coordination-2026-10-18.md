# Coordination handover — cad / gpu / cad-studio (2026-10-17 → 10-18)

This file hands over the **owner's coordinating session** (direction, research, reviews), not the
implementation itself. Implementation is done by one serial session ("barocss-cad/gpu 엔진 리뷰") on
branch `review/cad-gpu-engine-2026-10-14`, worktree
`/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-review-efbb2c`. That session
keeps its own detailed handover in `apps/cad-studio/handover/README.md` and the decision log in
`apps/cad-studio/handover/decisions.md` (D1–D82+). **Read those first; this file adds the "why".**

Everything is **local only — never pushed, no PR**. Do not push unless the owner asks.

## 1. How the work is organised

- **Owner** decides direction; talks Korean in chat (code, commits, peer messages in English).
- **Coordinating session** (this one): researches with parallel read-only subagents, reviews each
  checkpoint of the implementation session (verifies the commit exists, reads the claims, asks for
  fixes), relays owner decisions, and nudges the implementation session when it goes idle.
- **Implementation session**: works the roadmap strictly in order, one step at a time, sends a
  checkpoint (SHAs, numbers, tests, decision record) after each step.
- Rule from the owner: **implementation is serial in one session; agents only for research.**
- Overnight/when away the owner delegated decisions under a written policy (see §4).

## 2. Vision and direction (owner decisions)

- End goal: **AI designs and makes products** (brief → manufacturable outputs). Multi-agent is
  required. Most CAD areas will eventually be needed (mechanical, sheet metal, SubD, mesh, drawings,
  verification, manufacturing outputs, robots).
- **One body kind (B-rep)**; faces may be analytic, NURBS or **facet** (mesh regions) — the
  Parasolid "convergent" subset we implement ourselves (F0–F2 done; F3 mesh×mesh deferred).
- **SubD** is a way of *making* bodies: cage → exact bicubic B-spline faces, G1 caps at extraordinary
  vertices (SD1, SD2 done; SD3 editor in progress).
- **Own implementation, avoid WASM / external numeric libraries**; algorithmic improvement first.
  External engines (manifold-3d, meshoptimizer, OCCT, TetGen, Gmsh, OpenCAMLib, KDL, acadrust) are
  reference or test-oracle only, never product dependencies. OCP/acadrust/ezdxf allowed only in test
  tooling to produce goldens.
- **Kernel vs library split**: new geometry/maths → kernel (gears, threads, springs, SubD, sheet-metal
  unfold); anything composable from existing features → declarative **part library** (LIB1–4 done).
- No nested functions on hot paths (owner perf rule).
- After the whole roadmap: try a **spec + conformance-suite reimplementation by a fresh AI**; every
  step already leaves a decision record + conformance fixtures for that.

## 3. Roadmap (serial), status at handover

Done (see decisions.md for each): perf pass 1 (A1–A5, B1–B4, P1–P8), tangent cylinders, helical
thread default, R1–R7, RB1–RB4, A1–A4 (AI collaboration: stable refs, observation, requirements →
checks, proposals/autonomy), R3 facet/blobs/repair/STEP, R4 F1, R5 SD1, R6 F2, R6a gears (#2167),
LIB1–4, R6b enclosure elements + materials, AM1–AM5 (3D printing), R7 SD2, R8.1 cage ops,
R8.2a cage editor (part), PERF3 A1–A3.

Next, in order:
1. **PERF3** (second perf pass, 20 items; A4 SubD build in progress at handover) → A5–A6 → D18/D19
   benches + tighter budgets → B7–B13 → C14–C17 → D20 RB bookkeeping.
2. Rest of **R8.2** (agent cage tools, flow step, per-one-ring cap cache) → **R8.3**.
3. R9 QEM decimation → R10a sketch-entity side ids → R10 general fillet → R11 general shell/offset →
   **R11b DXF writer** → R12 sheet metal → FR1–FR4 frames → R12b gears+ (internal/bevel/worm,
   trochoid root) → R12c machine elements (springs, ISO 286 fits, shafts, bearings, O-rings, pulleys…)
   → RM1–RM6 robot kinematics + RD1–RD3 actuator sizing → IM1–IM6 injection moulding + CNC1–CNC6
   (replace old R13) → R14 drawings → A5–A8 (DSL/MCP, inputs, multi-agent v1→v3) → later stages
   (RD4–RD10 FEA/harness, RM7–8, AM6–7, IM7–8, CNC7–8, FR5–6, DWG/SAT import) → RB5–RB9
   (fuzz, CI corpus NIST/MFCAD++/FreeCAD-lib, STEP import hardening, ABC nightly, AI scenario ladder).

Track details (scope + acceptance) were sent to the implementation session and are in its README.

## 4. Policies the implementation session follows

- Defects found with an independent oracle: fix now if contained, else plan + TODO.
- Contracts/names: saved documents must keep resolving — keep old behaviour or version the node
  (D16 pattern); never rename silently.
- Never loosen tolerances to pass; typed refusal over a wrong result; state accuracy honestly.
- Product decisions only the owner can make → reversible default + "pending decisions" in README.
- Hard stops: no push/PR/publish/release; no deleting branches/worktrees/user files; no touching
  other sessions' checkouts; no new runtime deps; no ISO/ANSI standard text ingestion; no
  non-commercial/unclear-licence datasets (Fusion 360 Gallery, Text2CAD, CAD-Recode, GrabCAD).
- Data rules (libraries, materials, standards): every value sourced or flagged estimate; vendor CAD
  never bundled; libraries need a licence to be shared; legal review before release.

## 5. Owner decisions recorded (beyond the roadmap)

- Autonomy **L2 = (b)**: value edits of one feature apply directly; anything else is a proposal.
  Exception: first build on an empty part applies directly. Assembly/mates/drawing/locked parts are
  always proposals at every level.
- STEP caps: **32 MiB** B-rep, **128 MiB** tessellated.
- Helical threads default (old docs keep faceted `.facetK` names via node version).
- F0 planar fallback kept for mesh×mesh only until F3.
- Gears follow issue barocss/barocss#2167 (owner's design issue).
- Hunyuan3D licence excludes Korea/EU/UK — never in the pipeline.

## 6. Pending for the owner

- Open the exported **3MF in a slicer** (PrusaSlicer/Bambu; none installed here) and confirm pose and
  colours.
- Disk: `/private/tmp/claude-501/...hub-review-f565f8` (≈8.4 GB) still there; the owner may delete it
  (`rm -rf` it themselves).

## 7. Research done here (for context; conclusions already applied)

Perf reviews (×2), mesh bodies (Manifold/repair/commercial CAD), SubD (algorithms, products, kernel
readiness), robustness benchmarking (datasets/licences, OCCT-style methods, AI-CAD benchmarks), AI
collaboration (interface, observation loop, co-design UX, inputs, multi-agent), manufacturing tracks
(injection moulding/casting, CNC, frames, 3D printing), robots (kinematics/URDF, dynamics/actuators/
FEA, physics package audit), references (acadrust → DXF writer plan; freecad-extrusion-library →
library system; GrabCAD → sharing rules).

## 8. How to resume

1. Read the implementation session's `apps/cad-studio/handover/README.md` (state, roadmap, how to run)
   and `decisions.md`.
2. Check `git log --oneline -15` on `review/cad-gpu-engine-2026-10-14` and `git status` for anything
   uncommitted.
3. Continue the roadmap from the "Next" line, one step at a time, with the same rules and checkpoints.
4. Memory files for this project live in
   `/Users/user/.claude/projects/-Users-user-github-barocss-barocss/memory/` (vision, roadmap order,
   own-implementation rule, serial-implementation rule, nested-functions rule, spec experiment).
