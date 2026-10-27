# JavaScript performance and code-shape review of `@barocss/cad` and `@barocss/cad-model` (2026-10-27)

Review only; no code changed. At `local/cad-dev` `682af3f1a`. Two sources:

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
