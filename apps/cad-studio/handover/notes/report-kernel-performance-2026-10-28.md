# Kernel performance work — report and reusable techniques (2026-10-27 … 28)

What was changed in `@barocss/cad` (and one rule in `@barocss/cad-model`'s records) to make it faster, how each change
was checked, what was tried and dropped, and what is still open. Written so other lanes (studio, GPU, model, docs) can
reuse the methods: the techniques in §3 are general JavaScript/geometry ones, not kernel-specific. Detail per step:
[research-js-perf-review-2026-10-27.md](research-js-perf-review-2026-10-27.md) §§1–8; decision D281 in
[decisions.md](../decisions.md).

All on `local/cad-dev`, local only (not pushed), commits `de8463047` … `b3485b5e9`.

## 1. Results

Bench of fixed kernel workloads (`packages/barocss-cad/scripts/perf-bench.mjs`), median of 3 runs, same machine.
"Before" is `682af3f1a` (start of the work); later cases were added during the work and are measured from when they
were added.

| case | before | now | change |
|---|---|---|---|
| edge fillet, 90° pipe tee | 1.09 s | 0.80 s | −26 % |
| face fillet, 60° tee | 1.71 s | 1.18 s | −31 % |
| face fillet over an earlier round (restore + fillet) | 23.1 s | 5.8 s | −75 % |
| pin face fillet over a round | 9.46 s | 1.97 s | −79 % |
| thread on a shaft | 1.14 s | 0.69 s | −39 % |
| tapped hole | 0.83 s | 0.66 s | −20 % |
| hidden lines of a filleted tee | 2.14 s | 1.26 s | −41 % |
| 24 tilted boxes (Boolean chain) | 0.52 s | 0.33 s | −36 % |
| 48 tilted boxes (added 2026-10-28) | 1.97 s | 1.19 s | −40 % |
| rounded plate + 48 bosses (added 2026-10-28) | 1.16 s | 0.55 s | −53 % |
| cad-model `drawing-manufacturing` test | 16.2 s | 6.7 s | −59 % |

(Final run on `b3485b5e9` under another session's load, so "now" is if anything high.) The first nine cases' results
are still **bit-identical to the start** except the tilted boxes, whose face names changed by D281.

Every step but D281 left every bench result **bit-identical** (sha256 of the whole result's JSON). D281 (owner
decision: names may change) left every shape identical (validity, body/face/edge/vertex counts, volume, centroid) and
renamed coplanar faces that had been wrongly renamed after a neighbour.

Final checks on `b3485b5e9`: see §6.

## 2. What changed, by kind

| commit | kind | change | gain (A/B) |
|---|---|---|---|
| `de8463047` | allocation | SSI seed grid: module functions, scalar min/max, one mutable box instead of per-triangle arrays/closures | fillets −14…−21 %, thread −31 % |
| `0457891e8` | arithmetic | exact rationals compared by cross-multiplication (no gcd), raw ops for values only compared | model drawing test 16.2 → 6.7 s |
| `a6b0d006c` | allocation | constant parameter table and closures hoisted out of the curved arrangement | threads −15 % |
| `5d98989ef` | caching | one fixed-size direct-mapped cache (65 536 slots) for pure domain maps instead of a growing Map per curve | restore −26 % |
| `2d49446e7` | validation | evaluators created once instead of `evaluateCurve/Surface` (which validate the whole curve) in loops | 0–4 % |
| `29c323346` | data structure | hidden-line vertex groups found once (was a spread copy per insert, O(k²)) | projection −11 % |
| `538ff825c` | allocation | NURBS evaluators sum in scalars, finite checks written out, no `[0,1,2].map` closure | −3…−6 % |
| `bc6a7ff67` | hygiene | `core/extent.ts`: Math.min/max without spreading (no RangeError on large arrays) | ±3 % |
| `a2473c263` | dedupe | one shared own-data validator (`core/own-data.ts`) for 18 + 26 copies | refusals unchanged |
| `e001b12c7` | guard rail | ESLint `no-loop-func` in hot folders; `scripts/code-shape.mjs` in the package lint (counts may not grow) | — |
| `4081e262a` | spatial index | vertex grids read only neighbour cells that can hold a match (1 cell, not 27) | box chains −29 % |
| `ad0e2f6e5` | algorithm | cuts lying along each other: the run's ends at once (no point-by-point search + touch walk) | restore 16.2 → 6.7 s |
| `e675ff065` | broad phase | patch clear of a plane/cylinder (control-point hull) skips the intersection march; march box cached per face | 0–5 % |
| `71eb1d99f` | correctness + speed | D281: coplanar pieces joined only where they meet; faces apart keep their own names | bosses −10…−14 % |
| `8cfd1608f` | spatial index | point-in-region and ray classification read only rings / hits whose box can matter | bosses −22 %, boxes −12 % |
| `b3485b5e9` | broad phase | uncut faces far from the other solid kept whole without a ray; interior point found lazily | bosses −10 % |

How to rerun: `pnpm -s build:library`, then `node scripts/perf-bench.mjs run` in `packages/barocss-cad`; profiles with
`node --cpu-prof --cpu-prof-dir=prof scripts/perf-bench.mjs run <case>` and `python3 scripts/perf-profile.py under prof
<function>`.

## 3. Techniques worth reusing

Each with the situation it fits, the check that kept results the same, and the trap met.

1. **Measure before changing; drop what does not pay.** CPU profile (`node --cpu-prof`) plus two questions: which
   functions own the self time, and *where does one function's time go* (inclusive time under it). The second found
   every real win here (`scripts/perf-profile.py self|under|callers`). Four planned items measured < 1 % and were not
   built (§4).
2. **Bit-identical check for refactors.** Hash the whole result (sha256 of its JSON) per workload, A/B against the old
   build. Anything that should be a pure refactor must give the same hash; it caught nothing wrong this time but made
   every claim checkable.
3. **Differential run for a shortcut.** When a fast path replaces a test, run both on the real workloads and count
   disagreements before trusting it: ring culling (85 085 calls, 0), region-box skip (217 861 skips, 0), interior
   point (23 482, 0), own-data copier (20 020 generated inputs, 0). **It caught one wrong assumption**: a face's 3D box
   made from its edges' control points did *not* contain its region (0.03 mm off on a threaded shaft's end face); the
   box was then made from the region itself, the same way the point test samples it.
4. **Shape check for changes judged within tolerance** (validity, counts, volume, centroid, projected lines). It caught
   the incremental-stitch attempt changing topology by one edge (§5).
5. **Fixed-size direct-mapped cache instead of an unbounded Map** for a pure function of a double: key slot by a hash of
   the float's bits and an owner id; a collision only recomputes. Bounded memory, no GC pressure, cheaper lookups
   (Map keyed by doubles was 12.7 % of a profile, with 13.7 M entries alive). Only for pure functions: a stateful one
   (a projection warm-started from the last call) keeps its exact memo.
6. **Spatial culling by boxes, proven not to change the answer.** A box that contains a ring (as the point test itself
   samples it) lets the test skip that ring: outside it, the point is on none of its segments and a horizontal ray
   crosses it an even number of times. Same idea for grid lookups (only neighbour cells within 2 eps of the side) and
   for ray hits (outside the region's box → out).
7. **Convex-hull broad phase.** A NURBS patch with positive weights lies in its control points' hull: if they all lie on
   one side of a plane, or inside / beyond a tangent line of a cylinder, the surfaces cannot meet.
8. **Recognise degenerate pairs and answer them directly.** Two cuts lying along each other share only the ends of
   their run: 93 % of a restore's time was the general search finding points along such pairs and discarding them.
9. **Lazy values with identical results.** A piece's interior point (used only for numbering repeated names and voting
   a shell's sense) computed on first read: same value when read, skipped when not.
10. **Allocation hygiene in hot loops** (no closures/arrays per element, scalar accumulators, `Math.min/max` over
    arrays by a loop with spread-identical NaN/±0 semantics). Small single gains, but the evaluators are called tens of
    millions of times. Guarded now by lint (`no-loop-func`) and `scripts/code-shape.mjs`.

## 4. Tried and dropped (measured, no gain)

- NURBS basis reused on grids: grid evaluation < 1 %; a cached knot span changed nothing.
- Sort-and-sweep for candidate pairs: the pair loops < 1 %; a face's arrangement holds few pieces.
- Clustered union of coplanar groups, before D281's naming fix: merge cost spread over hundreds of small groups.
- Ring culling in `regionInteriorPoint`'s line crossings and candidate distances: identical, no gain.

## 5. Not landed: incremental stitch (patch kept)

Keeping far faces' input loops and edges in `stitch` (instead of rebuilding them) gave −28…−42 % on the rounded-plate
boss chains and was valid with no fallback, but changed topology by one edge/vertex there: the full rebuild re-derives
a vertex slightly off the input one and splits a neighbouring circle edge in two (`c0.side0#1|p.top#1/#2`); the frozen
path keeps it one edge. That is arguably cleaner, but the acceptance rule was "topology the same", so it is not
committed. The patch: [patches/incremental-stitch-frozen-faces-2026-10-28.patch](patches/incremental-stitch-frozen-faces-2026-10-28.patch)
(applies to `b3485b5e9`). Deciding it needs either a relaxed rule (fewer spurious vertices accepted) or finding why the
rebuild re-derives that vertex.

## 6. Checks and baselines

- Kernel suite on `b3485b5e9`: 1924 of 1958 pass; the 28 failures are the known baseline set, the same before and after
  every step (none new, none lost).
- Model suite on `b3485b5e9`: 1709 of 1711 pass; the two failures are the known solver ones (`the numerical solver keeps
  H/V edges…`, `arcs in the solver…`). D240's timing assertion failed once under load earlier and passes alone.
- Docs: `api-inventory --check`, `check-docs`, `refusals --check`, `agent-tools --check` clean after P4.
- Records changed on purpose by D281 only: `r12-s0`, three R12 conformance `faceNames`, flat-DXF fixtures (last-digit
  coordinates, ezdxf oracle re-run), one line of the O7 oracle.

## 7. Still open (where the time is now)

- Boolean chains still grow with the body's size per step: stitch (~40 % of a chain), coplanar merge, interior points
  and face set-up are linear in the whole body. The incremental-stitch patch (§5) and caching face analysis across
  Booleans (faces kept verbatim would let `facesOf` and checks skip them) are the next lever.
- Face-fillet restore: ~2.6 s of surface-surface marching, mostly pairs that cross outside both faces.
- Closest-point searches use 60 fixed golden-section steps (results identical); Newton would cut evaluations 3–5×
  but changes results within tolerance.
- 37 own-data snapshot copies of other structures; `no-loop-func` outside the hot folders (55); code-shape ceilings.
