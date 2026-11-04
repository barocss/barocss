# Independent physical reference 01

Status: AUTHOR_ONLY_NOT_EXECUTED. This contract and its source are new. They do not change an old receipt. Root owns execution after its current qualification boundary.

## Inputs and independence

The complete physical bank is `before`, `at`, `after`, in that order. Input bytes are the original files in `../physics-persistent-cone-design-2276/evidence/model-01`. `bank.json` freezes their SHA256 and relevant binary64 words before any candidate call. The script authenticates all files and all words before doing numerical work. It imports only Python standard-library modules. It never imports a candidate, engine, geometry builder, old reference, solver, or saved solution. The old static reference was read as historical geometry evidence; its matrix and targets are not source inputs to this implementation. No candidate source was read.

The script independently derives normalized Hamilton axes from each actual quaternion. It builds the Cartesian contact map one column at a time from a virtual unit impulse: `deltaV=e`, `deltaOmega=6*(r cross e)`, `response=deltaV+deltaOmega cross r`, with `r=point-COM`. The native matrix is a coordinate change of those physical columns. Exact 3x3 Gaussian elimination supplies sticking impulses and branch signs. Equality has static priority.

The native point is the unique maximum floor support in the native cube normal. The fixed touching COM is `[0,1/2,3/8]`. All 15 line/box SAT directions are checked exactly. Only the native face direction has zero overlap. Native local contact coordinates must be finite and inside the face. Original binary64 drift and reconstruction must reproduce the fixed COM words with no change to a model word. Initial native separation and closing velocity must be positive and negative, respectively.

## Frozen work limits

These limits are set before the first reference execution. A failed limit is a typed `REFERENCE_NO_GO`; there is no automatic budget or precision change.

Per physical input, across both precisions and all refinements:

- 4096 binary splits; 2048 terminal coverage cells; maximum depth 128.
- 32768 complete 3x3 interval Gaussian solves, including derivative solves and failed pivot attempts.
- 32768 complete exact Fraction Gaussian solves, including endpoint sign solves.
- 16384 bits for every checked Fraction numerator and denominator and every proposed exact product.
- Product guards run before multiplication, including all three unreduced cross-products in exact addition. Adding two bounded products can use one extra temporary bit; an oversized sum is rejected before Fraction construction. This does not increase the 16384-bit stored-rational or product limit.
- 80 and 120 Decimal significant digits only; exponent range -999999 through 999999; traps on overflow, invalid operation, and division by zero.
- Deterministic row order, no interval pivot swapping. A pivot interval containing zero causes subdivision during coverage, or refusal during final certification. Exact point solves may use the first nonzero row pivot.
- The whole script has a 180 second wall-clock limit and a 16 MiB combined JSON output limit. It checks time during exact arithmetic, interval operations, solves, and subdivision. Root must also enforce its whole-command/campaign limit externally.

Candidate arithmetic limits remain separate and unchanged. No World is created. No solver slot is added. Evidence counts, physical 8x8 census, input words, tolerances, first failures and held work remain unchanged.

## Complete root proof

For native coordinates `x=[N,T1,T2]`, form the full physical system directly:

```
L(s) row 0 = K row 0
L(s) row i = s*K row i + (1-s)*unit row i, i=1,2
b(s) = [-un,-s*ut1,-s*ut2]
L(s)*x(s)=b(s)
g(s)=T1^2+T2^2-qD*N^2
```

`qD` is the exact product of the two stored dynamic-friction words. No decimal 0.49 is used. For positive s, this is the physical equation with tangential penalty `(1-s)/s`. Its unscaled normal row enforces zero normal speed.

At both fixed precisions, outward interval Gaussian elimination bounds `x`. A second full solve bounds `x'` using `L*x'=b'-L'*x`. This bounds `g'`. A cell is excluded when `g` excludes zero, or when a strictly signed `g'` and exact equal-sign endpoint evaluations exclude zero. A cell contains exactly one root when a strictly signed `g'` and opposite exact endpoint signs prove a crossing. Every endpoint sign is derived by a separate full exact Gaussian point solve. An exact endpoint root causes refusal. Every leaf stores its dyadic boundaries, depth, reason, `g`, `g'` when used, and exact endpoint signs. Sorted leaves must form [0,1] without a gap or overlap. There must be exactly one crossing leaf.

The unique crossing is refined by exact physical point signs and interval solves, within the same limits. Its physical enclosure must prove positive N, slip greater than 1e-10 m/s, zero normal-speed containment, cone and opposition residual bounds of 1e-12 Ns, and passive midpoint work. The proof does not use a quartic, Schur complement, adjugate, Sturm chain, or candidate root. The two independent precision runs must have intersecting root intervals and identical certified binary64 presentation words.

## Directed arithmetic and presentation

Each Decimal conversion and interval operation rounds its lower endpoint with ROUND_FLOOR and upper endpoint with ROUND_CEILING. Multiplication and division consider all endpoint products or quotients. Square roots use Decimal's correctly rounded estimate only as an initial value. The next lower and upper Decimal neighbors are checked by exact Fraction squared inequalities before accepting the enclosure.

For each ideal world J, native N/T and world tangent component, a single binary64 estimate proposes a cell. Exact Fraction midpoints to its two neighboring binary64 values prove that the entire outward enclosure belongs to that round-to-nearest-even cell. Midpoint equality is accepted only for an even significand. No neighbor search occurs. Ambiguity triggers root refinement or refusal. Static exact values use the same cell proof. The represented world J is then independently applied to the exact Cartesian physical map. The physical error gates use this represented J and separately represented cache N/world T. Gates are 1e-12 Ns for impulse, cone and opposition errors and 1e-10 m/s for final normal speed and native/Cartesian velocity consistency. Positive dynamic slip remains greater than 1e-10 m/s. Ideal and represented midpoint work must be nonpositive.

The JSON output contains values and certificates for verification only. It never seeds World. A successful reference means `REFERENCE_READY`, not a candidate, Source, Native, World, browser, public API or whole-engine PASS. The script creates only a fresh `evidence/<id>/reference.json`, with exclusive creation. On failure it writes a typed partial report, preserves first failure, and leaves unvisited cases `NOT_RUN`. It cannot overwrite an old receipt.
