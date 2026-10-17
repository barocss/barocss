# Decision records (kernel and studio)

Short ADR-style records: what was decided, why, and what it binds. Newest last. Each R/RB step adds its
records here. Conformance fixtures for the same steps live in `packages/barocss-cad/conformance/`.

## D1 — One body kind: B-rep with analytic, NURBS or facet faces (2026-10-18, owner)
Decided: meshes, SubD and modelled solids are all B-rep bodies; a face's geometry is an analytic or NURBS
surface or a facet patch (a Parasolid "convergent" subset). Imported meshes become facet faces grouped into
regions, never a B-rep face per triangle. SubD is a cage feature that converts to exact bicubic NURBS faces.
Why: one topology for picking, naming, mates, drawings and Booleans. Per-triangle faces measured 10.5 s to
convert, 3.8–85 s to display and 2.2 GB at 200k triangles (R1 / M0).

## D2 — No WASM or external numeric libraries; our own TypeScript (2026-10-18, owner)
Decided: no manifold-3d, meshoptimizer or Rust core; `@barocss/cad` stays dependency-free. Hot loops get better
algorithms (culling, BVH, caches, filtered predicates, no allocation). If one still dominates, the numbers go
to the owner. WASM is not proposed unprompted.
Why: own the capability; manifold-3d's 1M-triangle union at 0.45–0.6 s was measured as a reference only.

## D3 — Small STL Booleans through the planar path until F2 (2026-10-18, owner)
Decided: during F0, a Boolean or split on a facet body under a size threshold explodes it to the per-triangle
planar B-rep and runs the polyhedral Boolean; above it, a clear refusal names the missing capability. One named
code path with a test; removed in the step that lands F2. The mesh node is versioned so old `<id>.facetK`
names resolve.
Why: STL Booleans work today; F0 must not take that away before F1/F2 replace it.

## D4 — Mitred fillet tools applied one by one; repeated names renumbered by position (2026-10-17)
Decided: overlapping fillet/chamfer tools go to the body one at a time, not unioned first. The finish's repeated
face names are renumbered `#k` by face position, and edges are named again from their faces. Where one step meets
the last along an edge (concave tangent chains, drafted walls), the tools are joined first as before.
Why: four mitred top fillets 110 → 56 ms. Cost: three mitred fillets can swap `#1`/`#2` against the old
key-ordered numbering (`25a98599e`).

## D5 — STEP imports have their own 32 MiB limit; the writer shares directions (2026-10-17, owner)
Decided: `CadPartLimits.stepBytes = 32 << 20`, separate from the 4 MiB part-document `fileBytes`.
Why: a modelled M8 bolt's STEP was 23.6 MB (18.9 MB after sharing directions) and could not be reopened. 32 MiB
bounds parse memory and time for an untrusted file (`3134a3868`).

## D6 — Cylinders touching at a point are built, not refused (2026-10-16)
Decided: two cylinders of different radii whose walls touch from inside are cut at the touch: the intersection's
branches are split at double zeros, so every piece ends there. Touching from outside (not a manifold) is still
refused.
Why: the result depended on operand order. The plate case is within 5e-6 of the exact volume (`5d24f6374`).

## D7 — A hole's miss check reads the result's faces, with a volume fallback (2026-10-17)
Decided: a hole that removes nothing is detected from the result's faces. When the hole has no faces of its own
(a copy coinciding with a bore), it falls back to comparing volumes.
Why: two volume computations per hole were slow; the face test alone refused valid coincident copies
(`dafa648bc`, `77c06d2b9`).

## D8 — Helical threads stay internal; faceted remains the default (2026-10-17)
Decided: `threadSolid({ form: 'helical' })` (@internal) builds half-turn ruled B-spline faces with quarter-turn
cubic spans. The default stays faceted until mass, display density and section split are fast enough. R2
re-measures this and proposes a switch.
Why (S2, M8×30): helical STEP is 273 kB against 19.4 MB, its split 18 s against 553 s, and its mate faces are named.
But its mass took 7.3 s against 0.25 s, and its display had 51k triangles against 28k.

## D9 — Binary64 filters in front of exact predicates; exactness kept (2026-10-18, R2)
Decided: the polyhedral Boolean decides clear cases (plane distance, ray crossing, point in face, collinearity) in
binary64 with a bound of 1e-9 of the terms' size, far beyond the conversion error. Only the uncertain cases reach
the exact rationals. Face pairs and T-junctions are found through x-sorted indexes.
Why: 66% of a mesh union was BigInt gcd. The 20k-triangle union went 409 → 3.2 s, and its volume agrees with an
independent mesh Boolean to 0.02 mm³ (`014e2f821`, `44cbb33bc`).

## D10 — Whole B-spline patches integrated without tessellation (2026-10-18, R2)
Decided: a curved face whose single loop lies on its patch's domain boundary, and is as long as that boundary,
is integrated by tensor Gauss–Legendre per knot span with analytic derivatives. The length test is required: a
union's seamed wall had a 315° surface under a full-circle loop.
Why: helical bolt mass 5.9 → 0.43 s at the same volume (`16028c0d7`).

## D11 — Far points are rejected by the control-point box in curved Booleans (2026-10-18, R2)
Decided: `offSurface` takes its caller's threshold. Past it, the distance from a NURBS patch's control-point
box is returned as a lower bound, without inverting the point. Patch sample grids are made on demand.
Why: helical bolt split 5.7 → 1.8 s with the same result (`189c0f9e8`).

## D12 — Mesh measurements are opt-in without budgets; fixtures are generated, never downloaded (2026-10-18, R1)
Decided: `pnpm bench:mesh` (and `--facets`) runs deterministic generated fixtures, each in its own process
with a timeout, and reports the first failure. It has no budgets until the facet path exists.
Why: honest numbers for M0/F0 without network fixtures or flaky CI gates (`f5d237c9f`).

## D13 — Twisted ruled faces get rows by their twist (2026-10-18, R2)
Decided: a twisted ruled face is cut across its rulings into ⌈twist / (π/2/perQuarter)⌉ rows: at least 2,
at most the old 2·perQuarter. The twist is the largest angle its normal turns along a ruling.
Why: a thread flank 0.7 mm across had 16 rows. The helical bolt's display went from 51k to 9.3k triangles with
the same chord error (`afdf0dbe5`).

## D14 — Sewing is hashed and evaluates once-validated (2026-10-18, R2)
Decided: `sewSolid` welds corners through tolerance-sized cells, keeping the lowest index within tol as the
scan did. It pairs sides through their two corners, and evaluates through `curveEvaluator`/`surfaceEvaluator`.
Why: identical output, 2.1× faster at 1536 patches (`984872627`).

## D15 — Conformance cases are part documents with toleranced expectations (2026-10-18, owner rule)
Decided: `packages/barocss-cad/conformance/<step>/*.json` holds an input part document and the expected
outputs: volume (relative tolerance), centroid (absolute), bodies, shells and genus per body, and face names
or a name pattern. A refusal is expected as an error code plus message text. Face and edge counts are never
compared. `test/conformance.test.mjs` checks every case, and `scripts/conformance-gen.mjs` regenerates the
kernel-measured values; a changed value is a changed contract.
Why: a spec plus conformance suite for a later reimplementation, and goldens for RB.

## D16 — The helical thread is the default; thread nodes say their form (2026-10-18, owner approved)
Proposal: switch `thread` to the helical B-spline form. On the R2 code (M8×30):
- split works in 3.7 s (faceted fails as non-manifold after 13 s);
- interference 2.6 s against 9.0 s;
- display 9.3k triangles against 28k;
- drawing 0.69 s against 0.98 s;
- STEP 273 kB against 19.4 MB;
- mate faces are named.

Its mass takes 0.47 s against 0.26 s.

Owner: "D16 승인: 나사산 기본값을 helical로 바꾸고, thread 노드에 버전을 붙여 예전 문서의 .facetK 이름이 계속 풀리게 해줘."
Decided:
- `threadSolid` defaults to helical.
- The part document's `thread` feature takes `form: 'helical' | 'faceted'`; left out, it builds faceted. So
  documents written before keep their `.facetK` names and mates without being renamed.
- The studio writes `form: 'helical'` on every new thread node (fastener inserts). Its faces are named
  `.thread#k`, `.end`, `.seat`, `.head`, `.hex0–5`.

Conformance `rb1/thread-legacy-faceted` and `rb1/thread-helical`.

## D17 — Robustness runs: a fixed taxonomy, known failures as TODO, trend rows per commit (2026-10-18, RB1)
Decided: `pnpm rb` (`packages/barocss-cad/scripts/rb/`) runs each case in a worker process with a SIGKILL
timeout. Each stage is classified as OK / REFUSED / INVALID / WRONG / CRASH / TIMEOUT / TOL_BLOWUP.
- A kernel's own error type is a REFUSED; a built-in type (TypeError, RangeError…) escaping is a CRASH.
- A refusal where outputs were expected is WRONG.
- Tessellation must be watertight by position.
- Known failures live in `robustness/todo.json`: TODO while they fail, IMPROVEMENT once fixed. Anything else
  failing is NEW and fails the run.
- `--record` appends a trend row keyed by commit and dataset hash.
- The seed corpus is generated (`rb:seed`): part families, broken meshes, STEP exports of our models.

Why: one honest pass-rate table per commit, comparable over time, before the larger corpora (RB6/RB8).
The first run found a STEP round-trip bug (duplicate face names and open edges after re-importing a
countersunk plate; TODO). By exact position, the helical builder's direct output has 342 open tessellation
edges (for RB2).

## D18 — Strict L0 validation is opt-in; outputs report it, imports are reported rather than refused (2026-10-18, RB2)
Decided: `checkBrep(brep, { strict: true })` adds four checks (`brep-check-geometry.ts`):
- every edge lies on the surfaces of its faces (9 samples per curve, 3 per line), within 10× its tolerance or
  1e-6 of the model's size, whichever is larger;
- no loop crosses or touches itself or another loop of its face, in the face's parameters (faces with a seam
  or pole are skipped: their parameter map is ambiguous there);
- no planar sliver, i.e. a face whose width 2A/P is under its edges' tolerance;
- no tolerance past 1e-3 of the model's size.

The builders' own `assertValidBrep` stays as it was (no extra cost, no new refusals). Every part output gets
`validate()` (strict, cached), so an imported STEP body carries a report instead of being refused. RB and the
conformance runner validate strictly.
Why: today's checks miss geometry that topology cannot see. On the first strict run, the corner patches of a
box filleted on every edge share edges 0.18–0.36 mm off their surfaces (radius 2), in the part and through
STEP. These are recorded as TODO for R10's vertex blends.

## D19 — Tessellation corners are the B-rep vertices' points (2026-10-18, RB2, `0d6da686d`)
Decided: an edge's first and last tessellation samples are its vertices' points, not its curve evaluated at
its ends.
Why: two curves meeting at a vertex evaluate their ends a few ulps apart, so the faces' rings disagreed at
corners. The helical bolt had 342 open mesh edges by exact position, in its display mesh and its STL.
Now there are none, and the volume is unchanged.

## D20 — Surface area is exact; STEP carries CAx-IF validation properties; RB checks the round trip (2026-10-18, RB3)
Decided:
- `brepSurfaceArea` (and `output.surfaceArea()`) integrates area in the same exact quadrature as mass, as an
  eleventh integral: Green's theorem along planar faces' edges, |Su × Sv| by tensor Gauss over whole patches,
  per-triangle rules over the parameter domains of trimmed faces. A fine tessellation is the fallback.
- `exportStep` writes the part's geometric validation properties by default: volume, surface area, centroid
  (CAx-IF: a PROPERTY_DEFINITION 'geometric validation property' → REPRESENTATION 'volume' / 'surface area' /
  'centroid') and a 'bounding box' (two points). Options `validationProperties: false` skips them.
- `stepValidationProperties` reads them, and `compareValidationProperties` checks a model against them with
  CAx-IF's limits (volume and area 1 %, centroid 0.1 % of the box diagonal).
- RB stages `roundtrip` (STEP out and back in: volume, area, centroid to 1e-6, the same V/E/F/S/genus, strictly
  valid) and `gvp` (an incoming file's properties against what was read).
Why: the L1 round trip is our own conformance; GVPs let other systems (and we) check what was exchanged.
Every corpus and conformance output round-trips within 1e-6 (typically 1e-11).

## D21 — Repeated names in a STEP file are numbered in file order on import (2026-10-18, RB3)
Decided: when a file repeats face or edge names (several bodies exported with the same feature names), the
repeats become `name#1`, `name#2`… in file order (the kernel's split-piece convention); unrepeated names stay.
Why: a B-rep's names are unique; a two-body export broke that on re-import (the countersunk TODO). That TODO
was itself a corpus mistake: its holes branched the plate into two bodies (fixed: holes chain).

## D22 — The all-edge fillet corner is exact; the corner ball keeps its pole at the apex, so names hold (2026-10-18, after RB3, owner)
Finding: the reported 0.18–0.36 mm "corner gap" (D18's first strict run) was a false positive. The corner
patches' edges lie exactly on the ball (every sample 2.000000 mm from its centre). The validator's inversion
failed at the patch's pole; fixed in `d6c19b84d` with seeds off collapsed sides and Levenberg–Marquardt. No
kernel geometry fix was needed.
Tried and reverted: turning the ball so no pole lies in the corner (`071705e31`) made mass and area 5× more
accurate (volume 3.6e-5 → 7.5e-6 at r = 4.99). But it reassigned every `f.face#k` of an all-edge fillet,
cylinder pieces included, because pieces are numbered by position across all of them. Mates, faces picked for
holes and sketches, and chat references store those names, and D16's rule is that saved documents keep
resolving. Versioning the fillet feature was not worth a 5× gain inside an already small error, so the ball
keeps its pole at the corner apex and the numbering is exactly as before (checked face by face).
Stated accuracy: rounded 40 × 30 × 10 box against its closed form, volume and area within 5e-5 relative
(3.6e-5 at r = 4.99, shrinking with finer quadrature: 2e-7 at q = 32). Strict gaps ≤ 1e-9; watertight across
r = 0.25–4.99.
Future: pole-aware quadrature for trimmed patches (re-parametrize near a pole) would give the accuracy without
moving any geometry or name.
