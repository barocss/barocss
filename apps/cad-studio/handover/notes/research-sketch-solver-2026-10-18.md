# Sketch constraint solver — scaling to large, multi-entity sketches (coordinator research, 2026-10-18)

Design input only; the roadmap order is unchanged. From a read-only survey at `eb8a49241` and published
sources (marked *unverified* where not confirmed).

## 1. Where the solver stands
- **Limits are 64, not 16.** Since `ced02dd39` the app uses kernel profile `bounded-length-angle-v1`: 64 points,
  64 segments, 128 constraints, 256 scalar rows, 128 unknowns, 32 branch guards
  (`packages/barocss-cad/src/xy-numerical-sketch-solver-internal.ts:10`); v0's 16/16/32 is frozen and tested.
  Stale "16" mentions: `apps/cad-studio/handover/README.md:356`, a comment in `apps/cad-studio/test/constraints.test.ts:414`,
  QA probe K23 (recorded before v1). App check: `apps/cad-studio/src/sketch/profile.ts:168`.
- **Scope**: one closed outline (lines, arcs as bulges) plus attached circles; constraints refer to segments by
  index (no stable segment identity, D31); several shapes only side by side, overlaps refused (`loops.ts`).
- **Variables**: point x/y only. An arc = centre `c<i>` + two equal radius segments; circle centres `k<j>` with
  fixed radii; `p0` always fixed.
- **Kernel primitives**: fixed, coincident, horizontal/vertical, length, equal-length, signed-angle
  (`solver-internal.ts:57-74`). The app builds the rest from these (`profile.ts:163-215`, `terms.ts`):
  parallel/perpendicular/tangent as signed angles nearest the drawing; equal radius as equal length;
  concentric as coincident centres; ΔX/ΔY as 2 helper points + 3 segments + 5 constraints each; symmetric as
  a helper midpoint + 4 constraints; line–circle tangent as a helper foot + 3. **These helpers are what use up
  the limit** (a placed hole costs ~4–8 unknowns).
- **Method** (`solve`, l.77-107): Levenberg–Marquardt, analytic Jacobian as dense `number[][]`, damping rows
  √λ·I, dense column-pivoted Householder QR per step (λ 1e-3, ×10 / ÷3, ≤12 trials, 100 iterations); tolerances
  1e-7 mm, 1e-9 rad, rank threshold 1e-10 relative; DOF = unknowns − rank. Cost ~O(m·n²) per step with heavy
  allocation (`Math.hypot(...a.slice(k).map(...))`, `segments.find` per evaluation); `settleShape` re-solves
  once per inferred relation.
- **Diagnosis**: redundancy = rows − rank; an edit that raises it is refused ("already implied … would
  over-define") — a count, not which constraint. Conflicts surface as `NONCONVERGENCE` (the kernel says this is
  not an inconsistency proof). Other refusals: `DEGENERATE_GEOMETRY`, limits, circles crossing/leaving the outline.
- **Branches**: held by signed angles and arc directions; the kernel supports branch guards but the app passes
  `branchGuards: []`; no closest-root guarantee. An unused circular solver with radii as unknowns exists
  (`xy-circular-numerical-sketch-solver-internal.ts`, 16 points, 4 circles).

## 2. How others do it
- **Siemens D-Cubed 2D DCM**: solves well/under/over-defined models with a status per dimension and constraint;
  consistent-but-dependent dimensions are flagged over-defined unless marked "rigid"; computes partitions and
  (v76) reports how under-defined geometry can move (Siemens PLM Components blog posts on v72/v76). Internals
  graph-constructive — *unverified*; SolidWorks/Onshape licensing DCM — *unverified*.
- **Onshape**: blue under-defined, black fully defined, red problem; drag to discover freedom (help: troubleshooting).
- **SolveSpace** (solvespace.com/tech.pl, `src/system.cpp`): symbolic derivatives, sparse Jacobian (Eigen
  SparseQR + COLAMD), `SolveBySubstitution` removes a−b=0 equations keeping the dragged parameter, Newton ≤ 50
  iterations with step halving, minimum-norm steps via QR of Jᵀ, dragged parameters scaled by 1/20 so the rest
  moves least; status codes OKAY / REDUNDANT_OKAY / DIDNT_CONVERGE / …; `FindWhichToRemoveToFixJacobian` names
  the bad constraints by leave-one-out re-ranking.
- **FreeCAD PlaneGCS** (`planegcs/GCS.h`): DogLeg (default), LM, BFGS; dense or sparse QR by size; lists of
  conflicting, redundant and partially redundant constraints plus dependent parameters; equality reduction;
  subsystem splitting. A WASM build (`@salusoft89/planegcs`) is usable only as a test oracle.
- **Graph methods**: Fudos & Hoffmann, ACM TOG 16(2) 1997 (triangle decomposition); survey (cse.uoi.gr survey-gc);
  Laman count 2|V|−3 as a cheap generic pre-check (misses degeneracies such as parallels).
- No authoritative public timings for hundreds–thousands of entities were found.

## 3. Recommended stages
- **S1 — native residuals, same solver**: native rows for dx/dy, point–line signed distance, point-on-line,
  symmetric, midpoint, line–circle tangency, radius as unknown → drops the helper points (≈3–4× fewer unknowns
  per placed hole). New profile `-v2`, v0/v1 frozen. Pass branch guards from the app (ccw triplets per outline).
- **S2 — stable entity ids + multi-entity sketches**: points, lines, arcs, circles, construction geometry with
  ids; constraints by id (this is R10a / the D31 prerequisite); loops derived from the graph.
- **S3 — decomposition**: substitute coincident/equal variables, drop fixed ones, split connected components by
  union-find, solve each alone; optionally block-triangular (Dulmage–Mendelsohn) ordering.
- **S4 — sparse linear algebra, own TS**: CSR Jacobian in `Float64Array`; LM with sparse Cholesky/LDLᵀ on
  JᵀJ+λD (AMD/COLAMD) or DogLeg with sparse QR; dense rank-revealing QR/SVD only per block (≤ ~200 columns) for
  DOF and redundant/conflict lists; scale angle rows by a characteristic length so rank tests are unit-free.
- **S5 — warm starts + drag**: seed from the last solution, reuse the symbolic pattern; drag = soft target +
  minimum-norm step, iterations capped per frame, only the dragged component re-solved.
- **S6 — diagnosis UX**: per-entity DOF colours from each block's null space; name the redundant/conflicting
  constraint; offer "add as driven/reference dimension" instead of only refusing.

**Keep**: typed refusals and "already implied" (matches DCM's policy), settle on every edit, nearest-drawing
branch choice, the final residual re-check, the per-shape solve cache.

**Contract (proposed)**: residuals ≤ 1e-7 mm / 1e-9 rad on scaled rows; deterministic (fixed orders, no
randomness); an edit within the feasible region never flips an orientation sign, triplet or arc direction —
refuse "would flip …" instead; the solution stays in the minimum-movement neighbourhood of the seed.

**Fixtures/oracles**: closed forms (rectangles, slots, tangent line–arc chains, SSS/SAS triangles with both
roots, symmetric pairs, circle by two edges); generated families (N-gons to 2000 segments, hole grids, tangent
arc chains); libslvs and PlaneGCS-WASM in test tooling only (DOF, redundant sets, coordinates); property tests
(rank invariant under rigid motion, constraint order permutation gives the same result).

**Benchmark targets (proposed, not measured)**: 100 entities < 2 ms per edit / < 1 ms per drag frame; 500 <
10 / < 4 ms; 2000 < 50 / < 16 ms (component-local). Track iterations, factorisation and diagnosis time
separately; diagnosis may run off the drag frame.

## 4. Risks → tests
Ill-conditioning (0.01 mm next to 9000 mm; angles on short segments) → mixed-scale sketch + condition logging;
near-singular configurations (collinear tangency, near-parallel distance, near-collinear three-point circle) →
rank stable under ±1e-6 perturbation or "ambiguous"; branch flips (SSS through degeneracy, arc through 180°) →
1 mm sweep asserting orientation signs; redundant-but-consistent (equal + implied length, closed H/V loops) →
reported, not a conflict, DOF unchanged; false conflicts from LM stalls → restart with different damping plus a
rank-based conflict list before showing a conflict; settle-loop cost → batch redundancy probes in the block QR.

## 5. Where it fits
S2 is the R10a step already on the roadmap (sketch-entity side ids); S1 and S3–S6 are not yet a roadmap item.
They can be scheduled with R10a or as their own track when the owner decides.
