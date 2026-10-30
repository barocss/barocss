# Refactor batch 3b — kernel steps ① and ② (2026-10-30)

Roadmap order step 3b (behaviour-preserving). ① is D360; ② follows in its own decision.

## ① R7.3d — the 137 kernel files nothing outside the kernel uses

Source: [kernel reachability](../kernel-reachability-2026-10-30/README.md) set D (137 files, 28,681 lines). Judgment on Opus;
the index/script, mixed-test and README/docs edits by three Sonnet sub-agents from frozen briefs, audited on Opus.
[retired.txt](retired.txt) (100) and [kept.txt](kept.txt) (37) are the two lists, paths under `packages/barocss-cad/src`.

| Group (folder) | D files | Retired | Kept | Reason |
|---|---|---|---|---|
| Legacy object API: `modeling.ts`, `modeling-*-internal.ts` (11), `core/public-api.ts` (the `cad` namespace) | 13 | 13 | 0 | R7.3d: `@barocss/cad/api` covers its modelling (`api-legacy-coverage.test.mjs`, 11/11); its own tests test the old API itself |
| Bounded solvers behind it (root): convex-planar-solid chamfer/intersection/mass/split, orthogonal-solid-boolean, stored circle-prism / plate-hole solids, xy-affine sketch / prism / prism document, qualified-strip STL encoding | 11 | 11 | 0 | Only the old API and old documents used them; the B-rep engine replaces them |
| `own-plate-circular-hole.ts` | 1 | 0 | 1 | `barocss-cad-interop`'s test imports it through `dist/index.js` (reach.py does not see relative dist imports) |
| planar-solids | 32 | 31 | 1 | V3 bounded preview, prism, polygon, hole and document experiments; kept `axis-rectangle-extrusion` (the kept plate hole builds on it) |
| sketch | 14 | 10 | 4 | Old XY sketch documents and graphs (the studio's sketch is cad-model's); kept the circular numerical solver (4 files), a documented kernel API (`how/sketch-solver.md`) with its own test |
| document | 4 | 4 | 0 | Old document versions: compatibility, export, assembly members, part replacement |
| paired, translated-strip | 8 | 8 | 0 | Bounded V3 roof-body and strip proofs |
| nurbs/source-wide | 6 | 3 | 3 | Retired the three graph experiments (knot-recipe loft, line-width extrusion, line-width material body); kept the curve-wide plane intersections and adaptive sampling (`how/curve-roots.md`, `how/nurbs.md`; #2253) |
| nurbs/curves, nurbs/surfaces | 9 | 2 | 7 | Kept Bézier spans, subdivision, degree elevation (#2253, #2266), curve vs face material, degree-matched ruled, surface-axis elevation, Z-axis revolved surface (documented; suite-run demos); retired quintic Hermite and endpoint continuity (no test, no row-30 consumer) |
| exact-proof | 14 | 7 | 7 | Kept the exact planar arrangement for #2255: `robust-orientation-v1` (#2255 cites it), segment intersection point, collinear overlap, straight-edge split plan, crossing incidence graph, half-edge twins, planar face boundary. Retired the V3 preview acceptance/session/leaf probes, feature impact plan, rebuild candidate, persistent face reference, boundary-face adjacency |
| intersect | 11 | 3 | 8 | Kept Bernstein roots, cubic and multispan curve–plane, coincident-plane clip, curve–line, convex-loop clip (#2253; `how/curve-roots.md`), plane–cylinder clip (a suite-run demo uses it), plate-hole preview (interop test). Retired the convex planar face intersection / holes / ray experiments |
| features | 9 | 6 | 3 | Kept `subd-report`, `cylindrical-wrap-chart-pair`, `cylindrical-wrap-moments` (tested helpers of live families). Retired the Z-axis revolve document and preview, Boolean-extrusion lifecycle, extrusion principal inertia (kg·m² record), known-solid qualification, split-face evolution |
| brep | 5 | 2 | 3 | Kept `brep-euler` + `brep-sweep` (Euler operators; #2256, #2264) and `axis-inertia`; retired `brep-adapters` (old solids → B-rep) and `closed-exact-patch-shell` |
| **Total** | **137** | **100** | **37** | |

Set E (19 files used only by other packages' tests or examples): **all kept**. Their consumers are
`packages/barocss-cad-interop/examples/*` (the GPU lane's package; cross-lane), and several are generic section, trim,
parameterization, loft and pattern tools; two (`vlinear-plane-section`, multispan) run in `nurbs-demos.test`. Revisit
with the interop owner.

What went with the retired files (commit `dca18afab`, 702 paths): their own tests, helpers, fixtures and 298 evidence
files under `test/` (modeling*, stored-circle-prism-solid, test/evidence/*); 26 consumer/exchange/evidence scripts and
OCP readers; 85 `examples/cad-nurbs` demos; `CONCISE_API.md` (the `cad.model()` guide) and `FEATURE_CACHE_CONTRACT.md`
(a proposal on the retired impact plan); 140 `index.ts` export statements; README 11,657 → 6,883 lines; two
library-docs lines (`how/mass-properties.md`, `packages/api.md`) and ROADMAP past tense.

Live tests that built inputs with the old API (analytic-boolean, brep-core, brep-step2, d149-split-face,
polyhedral-boolean, extruded-profile-solid, numeric-policy) read 12 JSON fixtures in `test/fixtures/legacy-inputs/`,
recorded from the pre-retirement build; each passed `deepStrictEqual(JSON round trip, original)` (`-0` encoded as
`"-0"` in numeric-policy-assets). `api-legacy-coverage` compares the facade with the old API's recorded volume and
centroid. Deleted cases inside kept files: extruded-profile-solid "model graph: a parametric slot loop loads…" (old codec),
numeric-policy's three C3/C4 cases (they asserted the old API's chart-lift reports). Two error-class count guards were
lowered (barocss-error `> 100` → `> 90`, now 100; error-codes `> 140` → `> 100`, now 106).

### Checks (worktree kernel-refactor-3b, base `fa79c9969`, Node 22.19.0)

| Check | Result |
|---|---|
| `node scripts/tool.mjs build` (packages/barocss-cad) | PASS |
| `perf-bench.mjs` fingerprints, `BASE=… save` on the base build, `compare` after | PASS: 34/34 SAME |
| Kernel suite `node --test --test-concurrency=4 test/*.test.mjs` | base 2363 tests, 2357 pass, 6 skip. First run after: 1851 tests, 5 fail (3 from `xy-affine-sketch-prism-offset.test`, a retired-API test the classifier missed, now deleted; 2 count guards, now lowered). Rerun on the merged tree (after `git merge origin/local/cad-dev`, `57adee015`): 1848 tests, 1846 pass, 0 fail, 2 skip; perf-bench again 34/34 SAME |
| Passing names, base vs final | 0 added; 515 missing, every one from a deleted test file or one of the four deleted cases (matched by name against the base tree) |
| Conformance fixtures | unchanged (no diff under `conformance/`; `conformance.test` passes) |
| Remaining tests and scripts import only exported names | PASS (scan of `dist/index.js` imports and `K.`/`kernel.`/`cad.` namespace use) |
| Kernel type-check, lint (eslint + code-shape) | PASS |
| cad-model, cad-studio, cad-interop `tsc --noEmit` | PASS (cad-model and studio rerun after the merge with origin) |
| cad-model / studio affected tests | NOT_RUN: no file outside the kernel imports a retired name (token scan; `SplitCode` in cad-model's print/splitBed.ts is its own type) |
| cad-interop `cad-integration.test` | NOT_RUN (needs gpu and interop builds); the three kernel names it imports are exported |
| API inventory | regenerated: 696 `@barocss/cad` names removed, 0 added; 15 exposures change only the printed order of union members; after the merge equal to a fresh `--write-expected` |
| `apps/library-docs` check-docs (refusals, agent tools, inventory) | PASS |
| RB / fuzz, browser flows, CI | NOT_RUN |

Limits:
- `features/boolean-extrusion-feature-graph.ts` (live, set B) lost its only kernel tests, which were the retired
  exact-proof tests that used it as input.
- `CAD_ERROR_CODES` may still list codes that only retired classes carried. The check is one-way: every class code is
  listed.
- The library-docs `.vue` components ValidCube, ValidBroken and TessDensity keep comments naming `cad.model()` and
  `brepFromBody`. Those comments are provenance for numbers computed earlier and were left unchanged.

## ② Split `part/part-model.ts` by feature family (D361)

Moves only, one family per commit, each by a Sonnet sub-agent from a frozen brief, its verbatim proof (the moved text
equals the base text after stripping an added `export`) and the diff outside the moved block audited on Opus.

| Commit | Family → module | part-model.ts lines |
|---|---|---|
| `e439ea31c` (2a) | frame and weldment helpers (102 statements: members, corners, trims, notches, gussets, end caps, weld beads) → `part-frame.ts` | 4,583 → 3,281 |
| `c2d4a3e7a` (2b) | edge finishing (`finishEdges`, `uprightCorner`, `cornerFinish`, `wedgeChamfer`, `endPlaneOf`, `prismBrep`, `buildBrepLocal`) → `part-finish.ts` | → 3,106 |
| `de609d639` (2c) | shell (`shellOf`, `shellPart`, `varyingHollow`, `shellRevolved`, `shellSwept`, `hollowOf` and ring helpers) → `part-shell.ts` | → 2,818 |
| `4ba070142` (2d) | sheet metal (`bendK`, `sheetFlange`, `edgeNamed`, `sheetCornerRelief`, `hasEdgeBelow`, `withSheet`) → `part-sheet.ts` | → 2,675 |
| `60549e5a3` (2e) | the `face-fillet` case (verbatim into `faceFilletOperation`) and its 20 helpers → new `part-face-fillet.ts` | → 2,192 |
| `f24c0a814` | API inventory and `_refusals.md` regenerated | — |

Design. D221's family modules imported only types from part-model.ts and got its values through `HELPERS`. The moved
helpers call part-model's stateful `boolean` (the `profiling` and `facetLimit` state of an evaluation; the
`frk-6-ordered-trim.test` coverage trap observes it in `part-model.js`) and a dozen small values. So the family modules
now import those values from part-model.ts: a function-level import cycle. Moving the Boolean and its state into a leaf
module would have changed code (setters for the state) and the coverage trap; threading `k` through every helper would
have changed signatures. The cycle is safe under one rule, checked for each module: no top-level statement of a family
module reads a part-model value at evaluation time, and part-model's top-level `HELPERS` holds no `const` from a family
module (only hoisted functions such as `brepBodies`). Moved names left `HELPERS`; `frameOperation` lost its unused `k`.
Moved code was not restructured: nested closures inside it are as they were (no hoisting in a move-only step).

### Checks (tip `60549e5a3`, after ①)

| Check | Result |
|---|---|
| Build | PASS (2a and 2e) |
| perf-bench fingerprints vs the base | 34/34 SAME after 2a and after 2e |
| Kernel suite | after 2a and after 2e: 1848 tests, 1846 pass, 0 fail, 2 skip; passing names identical to ①'s final run |
| Import cycle, each family module imported first in a fresh process, then a frame part evaluated | PASS for part-frame, part-finish, part-shell, part-sheet, part-face-fillet, part-model (same volume 84164.600329) |
| Kernel type-check and lint | PASS at each of 2a–2e (code-shape counts unchanged: 119 / 32 / 269 / 69) |
| cad-model, cad-studio `tsc --noEmit` | PASS at the tip |
| API inventory | regenerated: 29 lines differ, each a permutation of the same characters (union member order) |
| `_refusals.md` | regenerated: `RELIEF_REQUIRED`'s example message is now the first literal in source order; no message changed |
| check-docs | PASS |
| Conformance fixtures | unchanged |
| 2b–2d built and suite-run on their own | NOT_RUN (type-check and lint only; the tip run covers them) |
| RB / fuzz, browser flows, CI | NOT_RUN |

Left in part-model.ts (2,192 lines): the document types, admission and evaluation, the operation() dispatcher with the
cases not yet in a family (extrude, revolve, Booleans, rib, wrap, reliefs, full-round, face-thread, hole, transforms
and patterns, sweep, loft, draft, split-face, sweep-curve, split), the Boolean dispatch with its state, sweep, outputs.
