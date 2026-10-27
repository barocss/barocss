# JavaScript performance and code-shape review of `@barocss/cad` and `@barocss/cad-model` (2026-10-27)

Review at `local/cad-dev` `682af3f1a` (no code changed by it); the refactors it planned, P1–P4, and their measurements are in §5. Two sources:

- **A static survey** of every `.ts`/`.tsx` under `packages/barocss-cad/src` (410 files, 102.8k lines) and
  `packages/barocss-cad-model/src` (333 files, 48.3k lines), parsed with the TypeScript compiler API (script and raw
  JSON in the session scratchpad, not committed).
- **CPU profiles** of representative tests: kernel — analytic-boolean, boolean-tangent-crossing, face-fillet,
  face-thread, box-shell, mesh-repair, mesh-decimate, loft-multi-conic, brep-step2, facet-boolean (99.6 s sampled);
  model — api-face-fillet, api-face-thread, engine, feature-handles, api-studio-commands, drawing* (202.8 s, of which
  41 s the test runner's esbuild).

## 1. Where the time goes

| share | function | file |
|---|---|---|
| kernel 12.7 % | the memoised curve → face-domain map (`memo`, Map keyed by float parameters, up to 65 536 entries a curve) | `brep/analytic-boolean.ts` 377 (called from 233, 247, 255) |
| kernel 11.6 % + 9.4 % | NURBS basis and the (already buffered) curve/surface evaluators | `core/math.ts` `basisInto`, `curveEvaluator`, `surfaceEvaluator` |
| kernel ~9 % | `paramOf`, `segDistance`, `crossingsAt`, `segAt`, `d2` | `brep/curved-arrangement.ts` |
| kernel ~5.6 % | the seed grid of `intersectPatches`: `tris`, `boxOf` (`T.reduce`), the pair loop | `intersect/surface-intersection.ts` 176–190 |
| kernel 1.7 % | `nearBoundary` | `brep/brep-mass-quadrature.ts` |
| model 11.0 % | `bgcd` — exact rationals in the polyhedral Boolean | `brep/polyhedral-boolean.ts` 30 |
| model ~4 % | hidden lines: `projectBrepHiddenLines`, `smoothNormal`, vertex keys | `brep/brep-hidden-line.ts` 238–250 |
| **GC** | kernel 13.5 %, model 19.1 % (of non-runner time) | small arrays everywhere (vectors, tuples, temporary lists) |

Built-ins (JSON, Map) do not show separately; they are inside their callers' self time.

## 2. Concrete hot-path findings (highest expected gain first)

1. **`intersectPatches` seed grid** (`surface-intersection.ts` 176–184), run for every face pair a Boolean tests:
   per triangle `[[…],[…]]`, `t.map`, and `[0,1,2].map(k => Math.min(...pts.map(p => p[k])))` for min and max (a dozen
   arrays and closures each); `boxOf` reduces with a fresh `{ min: [...], max: [...] }` every element; `within` uses
   `[0,1,2].every(...)`. Then every triangle of A against every triangle of B (box test inside an O(n²m²) loop).
   Fix: scalar min/max loops into flat typed arrays, one mutable box, an explicit `within`; a uniform grid or sort-and-
   sweep for the pair loop.
2. **`polyhedral-boolean.ts` rationals**: `bgcd` swaps by `[a, b] = [b, a % b]` (an array a step); every `add`, `sub`,
   `mul`, `div` normalises by gcd; `cmp`/`sgn(sub(a, b))` normalises just to read a sign. Fix: swap with a temporary;
   compare by cross-multiplication (`a.n * b.d` vs `b.n * a.d`, denominators kept positive) with no gcd; normalise lazily
   (when numerator/denominator bit length grows past a bound) or only on output.
3. **`curved-arrangement.ts`**: `crossingsAt` builds `Array.from({ length: CURVE_SAMPLES * 2 + 1 }, …)` — the same
   parameters — for every curve segment it scans, plus closures `at`/`above` per segment; `paramOf` makes a closure
   `d2` per call and runs a fixed 60-step golden-section search, each step allocating a point in `segAt`; `segDistance`
   calls both. Fix: one module-level parameter table; module functions taking (s, p, u); a `segAt` that writes into a
   caller's scratch pair; stop the searches at a tolerance instead of 60 fixed steps (keep results within the
   current tolerances).
4. **The domain-map memo** (`analytic-boolean.ts` 377): a `Map<number, XY>` per curve keyed by doubles (heap-number
   hashing, up to 65 536 entries kept alive → GC). Measure first: a key hit rate and the share of the self time that is
   the map versus the projection it saves. Options: the existing `tabulated` Hermite map (already used for some NURBS
   cases) for more curve kinds; a small direct-mapped cache instead of an unbounded Map.
5. **Direct `evaluateSurface` / `evaluateCurve` in loops**: 71 files call `evaluateSurface` directly (21 use the
   buffered `surfaceEvaluator`). Each direct call validates the whole surface and scans every pole three times for a
   constant coordinate (`validateCurve` alone is 0.5 % in the kernel profile). Fix: in loops, take an evaluator once.
6. **`brep-hidden-line.ts` 238–250**: a string key `${x},${y},${z}` per vertex (number-to-string conversions), rebuilt
   again inside `smoothNormal` on every query; `together.set(k, [...(together.get(k) ?? []), v])` copies the group on
   every insert (O(k²)); a point array per neighbour. Fix: compute the group of each vertex once (an `Int32Array`),
   push into the existing list, read normals by index.
7. **Small vector allocation** (the GC share): `sub`/`add`/`scale`/`cross` return new arrays. Only in the hottest
   inner loops (Newton steps, quadrature, the arrangement), write scalar code or `subInto(out, a, b)` variants; not a
   blanket rewrite.

## 3. Code-shape findings across both packages

| pattern | kernel | model | judgement |
|---|---|---|---|
| functions inside functions | 4 361 (519 capture nothing; 676 created per element — inside a loop or an iteration callback; 51 both) | 1 351 (317; 187; 25) | Most are closures that need their context and run once per call: leave them. Hoist the per-element ones in hot files (part-model 44, brep-hidden-line 27, analytic-boolean 20, brep-tessellate 16) and any that capture nothing. |
| constant array/object literals inside functions | 2 383 (660 per element) | 846 (238) | Hoist when per element or in a hot function (e.g. `[0, 1, 2]` axis lists, unit vectors, option tables). Small vectors passed as arguments are often fine. |
| repeated strings (≥ 4 uses) | 1 234 | 833 | `typeof` names and union tags (`'line'`, `'forward'`, `'INPUT'`) are checked by the types: keep them literal. The real duplication is **validation messages copied into 40–80 kernel files** (`'exact fields required: '` 81 files, `'An own record is required'` 62, `'Exact own fields are required'` 60, `'Plain own-data prototypes are required'` 50 …): the own-data validators themselves are copied per module — consolidate into one shared module. Model messages repeat little. |
| search inside loops (`find`/`filter`/`includes`/`indexOf`/`some`) | 256 | 248 | O(n²) candidates; replace with a `Map`/`Set` where the collection grows with the model (B-rep edges, vertices, faces, document nodes), e.g. `brep.vertices.find(...)` per edge. |
| `Math.max(...xs)` / `Math.min(...xs)` | 357 per element (1 119 spread calls in all) | 73 (350) | Also a **correctness risk**: spread arguments overflow the call stack (`RangeError`) past roughly 100k elements — mesh-sized arrays. Use a loop helper. |
| `push(...xs)` | 88 | 110 | Same stack limit; fine for short lists. |
| spread building arrays/objects inside loops | 932 | 756 | The accumulator form (`acc = [...acc, x]`, `{...o}` per step) is O(n²); fine once per call. |
| `new Set`/`new Map`/regex/`JSON.stringify`/`Object.keys`… per element | 604 | 449 | Hoist regexes to module constants; avoid `JSON.stringify` as a key in loops. |
| `delete` | 3 | 148 (editFields 41, references 12) | Turns objects into slow dictionary mode in V8; prefer building the object without the key (`const { k, ...rest } = o`). Not hot today. |

## 4. Proposed refactor plan

| phase | scope | done when |
|---|---|---|
| P1 | The seven hot-path items of §2, each on its own commit: before/after timing of the same profile workload, and the affected kernel suites plus the face-fillet, face-thread, full-round, boolean and mesh tests unchanged (volumes and test names compared, per the checkpoint rule). The kernel's "same arithmetic, same order" comments mark bit-identical evaluators: keep their results identical. | Each item's own measured gain; GC share reported. |
| P2 | Hygiene in hot files only: per-element nested functions and constant literals hoisted, searches in loops turned into maps, `Math.max(...)`/`push(...)` on unbounded arrays replaced by loops. | Survey counts down in those files; suites unchanged. |
| P3 | One shared own-data validation module for the kernel's copied validators (messages as constants there). | The repeated messages each defined once; refusal texts unchanged (the refusals table check). |
| P4 | Guard rails: ESLint `no-loop-func`; a project rule (or a CI script like this survey) flagging `Math.max/min(...)`, accumulator spreads and per-element literal arrays in `brep/`, `intersect/`, `core/`, `blend/`, `mesh/`. | Lint clean; the survey runs in CI with its counts recorded. |

Not in scope here: algorithmic changes (fewer projections per Boolean, the face-fillet restore's cost) — those are the
Boolean core's own work (see `research-rolling-ball-face-fillet-2026-10-27.md` §7).

## 5. Results (2026-10-27, P1–P4 built on `local/cad-dev`)

Measured with a bench of nine kernel workloads (session scratchpad, not committed): each result's JSON hashed (sha256), so
"same" means bit-identical output; times are medians of 3 runs (1 for the long case), A/B against the previous commit.
Every step kept every result bit-identical.

| step | commit | what | measured |
|---|---|---|---|
| P1.1 | `de8463047` | SSI seed grid: module functions, scalar min/max, one mutable box | fillets −14 to −21 %, thread −31 %, hidden lines −22 % |
| P1.2 | `0457891e8` | polyhedral rationals: cross-product compare, raw ops for values only compared, swap without an array | model `drawing-manufacturing` test 16.2 s → 6.7 s |
| P1.3 | `a6b0d006c` | curved arrangement: one parameter table, no per-segment closures (the 60 fixed steps kept) | threads −15 to −17 %, face fillet −9 % |
| P1.4 | `5d98989ef` | domain maps on planes/cylinders: one direct-mapped cache of 65 536 slots instead of a Map a curve (measured first: 75 M calls, 51 % hits, 13.7 M entries alive; dropping the memo made traced cases +16 %) | tee over a round −26 %, hidden lines −19 %; small cases ±2 % |
| P1.5 | `2d49446e7` | buffered evaluators where hot loops called `evaluateCurve`/`evaluateSurface` (measured first: ~1.5 % of the profile) | 0–4 % |
| P1.6 | `29c323346` | hidden lines: coincident-vertex groups found once | projection alone 9 → 8 ms |
| P1.7 | `538ff825c` | NURBS evaluators sum in scalars; finite checks written out; D1 quotient without a closure | −3 to −6 %; projection −27 % |
| P2 | `bc6a7ff67` | `core/extent.ts` (Math.min/max without spreading, the same NaN/−0 results); per-element boxes, sort keys, check fractions hoisted | ±3 % (hygiene) |
| P3 | `a2473c263` | `core/own-data.ts`: one own-data copier and record check, messages as constants; 18 of 55 snapshot copies (the most common structure) and 26 record helpers moved | refusals unchanged: differential run on 20 020 inputs identical |
| P4 | `e001b12c7` | ESLint `no-loop-func` in `brep/ intersect/ core/ blend/ mesh/` (18 findings fixed); `scripts/code-shape.mjs` in the package lint, counts may not grow | lint clean; probe files fail as they should |

P1–P4 against the original baseline (same results): edge fillet tee −26 %, face fillet tee −27 %, pin over a round −34 %,
shaft thread −40 %, tapped hole −18 %, polyhedral boxes −35 %, hidden lines −38 %, tee over a round (face fillet restore)
23.1 → 16.1 s (−30 %); 24 tilted boxes unchanged (±5 %). The GC share of the fresh profile was 19 % before P1.7.

Left for later (each needs its own measurement; none was required by the plan's done-when):
- The other 37 snapshot copies (19 structural variants: checks split, budgets coded differently) and the other record
  forms; moving them needs each variant's order of checks kept, as the differential run did for the first group.
- `no-loop-func` outside the hot folders (55 findings in the rest of the kernel and the model); code-shape counts are a
  ceiling, not zero: 119 Math.max/min spreads, 32 push spreads, 291 loop spreads, 82 loop literals in the hot folders.
- The golden-section searches keep 60 fixed steps (results identical); a tolerance stop would be faster but changes results.
- F2 of the rolling-ball plan (the restore Boolean's cost) is the Boolean core's algorithmic work, outside this review.

## 6. Algorithmic follow-ups that keep results identical (2026-10-28)

Two candidates were taken on as "results bit-identical", each measured first:

| candidate | measured | outcome |
|---|---|---|
| NURBS basis reused on grids | Grid evaluation (tessellation points, mass quadrature) is under 1 % of the kernel and bench profiles; the basis time (8–14 %) is the Boolean's domain maps evaluating traced curves at arbitrary parameters during the closest-point searches. A cached knot span in the buffered evaluators (identical: the span is unique) gave no change beyond noise (±3 %). | not kept |
| Candidate pairs by sort-and-sweep | The arrangement's all-pairs box loop and the SSI seed pair loop are under 1 % on the fillet/thread cases. On many-face Booleans (24 and 48 tilted boxes, new bench case) the time was the **stitch's vertex grid** instead: 263 k lookups doing 3.9 M Map gets with keys built by `[0,1,2].map(...).join(',')`. | vertex grid fixed (`4081e262a`); sweep not kept |

`4081e262a`: the 3D stitch grid and the 2D arrangement's vertex grid find a point's cell once and look in a neighbour
cell only when the point lies within 2 eps of their shared side (cells are 16 eps / 64 eps wide, so other neighbours
cannot hold a point within eps); keys built directly, cell lists grown in place. Same cells, same order: the same point is
returned (differential run on 360 000 points crowded at cell sides). Tilted boxes 24: −29 %, 48: −28 %; others ±3 %.

The sweep (`boxPairs`, pairs found along x and taken in (i, j) order so cuts arrive as before; differential run on 3 000
box sets with NaN, inverted, infinite and degenerate boxes identical) changed nothing measurable: a face's arrangement
holds few pieces. Kept out.

Observed for later: 48 boxes take about 4× as long as 24 (two Booleans' worth of faces each step, every step re-stitches
the whole body), so a chain of Booleans grows with the square of its face count. Keeping the faces a tool's box does not
reach out of the arrangement and stitch would make each step cost what it touches; it changes how the B-rep is rebuilt
(ids, splits), so it belongs with the candidates whose results change within tolerance: a Boolean broad phase (faces
wholly inside or outside the other operand classified whole), closest-point searches by Newton instead of 60 fixed
golden-section steps, and a floating-point filter in front of the polyhedral Boolean's exact predicates. Those need an
acceptance rule other than bit-identical output (volumes and topology within tolerance, every test passing).

## 7. Boolean broad phase (2026-10-28, owner: accept when volume and topology are the same within tolerance and every test passes)

Measured first, per phase of the analytic Boolean (bench cases):

| case | Boolean | largest phases |
|---|---|---|
| face-fillet restore (60° tee over an r 2 round) | 15.1 s | regions of cut faces 10.6 s; cut pairs 2.6 s (pairs ending with no cut 1.9 s); cut clean-up 0.7 s |
| pin over a round | 5.3 s | regions 2.6 s; merge 1.1 s; cut pairs 0.7 s |
| edge fillet tee | 0.7 s | cut pairs 0.43 s (0.41 s of it pairs ending with no cut) |
| 48 tilted boxes | 1.5 s | stitch 0.6 s; merge 0.34 s; classify 0.17 s |

Faces with no cut were already classified whole (one point each). The cost sat elsewhere:

- **Cuts lying along each other** (`ad0e2f6e5`). In the restore, four of W's cylinder faces carried 55–65 curve cuts each
  (the old round's contact curve, cut once from the face that made it and once from a coincident face's boundary):
  151 of 2 855 curve pairs had one curve lying along the other and took 11.5 s, the polyline/Newton search finding
  points all along each, each walked for a touch (15 862 walks, 28 touches) and then dropped by `overlapEnds`. A pair
  where one segment's 65 samples all lie within eps of the other now returns the ends and `overlapEnds` at once; on the
  real workloads the old search gave the same points on all 212 such pairs. Restore 16.2 → 6.7 s, pin over a round
  6.4 → 2.3 s, hidden lines −7 to −12 %.
- **Clear patches skip the march** (`e675ff065`): a patch whose control points keep 1000 tolerances clear of a plane or
  of the infinite cylinder (inside it, or beyond a tangent line square to their mean radial direction) cannot meet it;
  the march's domain box is made once a face. 0–5 %: it caught 64 of the edge fillet's 100 such pairs, the cheap ones;
  the costly ones cross the other surface outside both faces, which only the trace itself shows.

Both changes left every bench result bit-identical (beyond the shape check: validity, body/face/edge/vertex counts,
volume, centroid, projected lines). Kernel full suite 1924 of 1958 (the 28 baseline failures); model tests of drawing,
face fillet/thread, full round, engine, handles and studio commands 264 of 266 (the two baseline solver failures).

Against the original baseline of §5: face-fillet restore 23.1 → 6.4 s (−72 %), pin over a round 9.5 → 2.2 s (−77 %).
Still open: the 48-box chain's quadratic growth (each Boolean re-merges and re-stitches the whole body), the restore's
remaining 2.6 s of cut pairs and 0.7 s of cut clean-up, and the closest-point searches (Newton instead of 60 fixed steps).
