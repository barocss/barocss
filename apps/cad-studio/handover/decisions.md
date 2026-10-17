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

## D23 — Mass quadrature about the body's centre, with trims' curved strips integrated (2026-10-18, RB4)
Decided:
- The divergence-theorem integrals are taken about the centre of the box of the faces' control points, then
  moved to the world origin (parallel-axis relations), so a body's mass no longer depends on where it sits.
- On meshed (Boolean-trimmed) faces, the parabolic strip between each boundary chord and its edge, in the face's
  parameters, is integrated; the remaining error is extrapolated as h³ (h² beside a surface's pole, where no strip
  is added).
Why: RB4's rigid-motion property found 8e-5 between a body and the same body moved. Closed forms:
- top-edge fillet box 4.8e-6 → 8.6e-9;
- oblique holed-plate split 8.9e-6 → 5e-7 a half;
- countersinks 1e-9.
The vertices' box was tried as the centre and rejected: it put a torus cut by a box off-centre (`087f5d9db`).

## D24 — Property tests: our own harness, tolerances by mass method, known failures as TODO (2026-10-18, RB4)
Decided: `scripts/rb/property.mjs` holds the harness (seeded mulberry32, shrinking to the smallest failing value,
crashes as failures) and eight properties:
- inclusion–exclusion;
- difference;
- commutativity;
- exact rigid motions;
- uniform scale;
- knot insertion and degree elevation;
- fillet monotone and Lipschitz;
- quadrature against tessellation.

Generators tilt half the primitives, so the general Booleans run, not just the upright family. Volumes
compare within the accuracy their mass method claims: 1e-9 closed form or planar, 2e-5 quadrature,
2e-3 tessellated. `pnpm rb:props` runs about 200 cases a property with seed 20261018 (RB_PROPERTY_SEED=random
nightly), `--record` appends to `robustness/properties.jsonl`, and `pnpm test` runs a 5-case slice. Known
failures live in `robustness/properties-todo.json`: their failures show as TODO, and passing again shows as
IMPROVEMENT.
Why: metamorphic checks find what fixed tests miss. Findings (TODO, with an exact oracle in
`robustness/corpus/oracle`, `scripts/rb/oracle-cylinder-box.mjs`):
- an upright cylinder minus a box turned 80.79° about X encloses 6.8e-5 too little (the Boolean result);
- its intersection integrates 8.7e-4 high at default quadrature;
- the rigid-motion property still misses by 2.2e-5 on two tilted cylinders.

(Corrected by D25: the Boolean result was exact. All three were the trimmed faces' quadrature.)

## D25 — Trimmed-face mass by exact strips; grazing slivers; exact-oracle families (2026-10-18, owner: before A1)
Root cause of RB4's cylinder − turned-box defect: not the Boolean. Against exact per-face areas the result's
faces are right: its planar faces to 1e-7, and the trimmed cylinder face's area is 9.3965144. The mass
quadrature was wrong. D23's strips were keyed by vertex index; a face's vertex list repeats points, so most
boundary chords got no strip and some got two. The same mechanism explains the 9e-6 mm STEP centroid drift:
the re-imported edges are sampled differently, so different strips went missing.

Decided:
- **Strips.** Strips are found by position. Each strip, the region between a chord and its edge in the face's
  parameters, is integrated once:
  - a ruled map from the chord to the edge's (u, v) curve, Φ(t, s) = L + s (C − L);
  - C′ from the surface's tangents;
  - Gauss–Legendre 8 × 4.

  An edge straight in (u, v) to rounding gets no strip. Its probes evaluate points only, because a circle's C0
  knots have no derivative.
- **Coverage guards.**
  - The domain's area is checked against the flat mesh before the strips.
  - The face's vector area is checked against the exact ½∮ x × dx along its edges. That is computed once per
    curve per pass, with 4 points a span for polynomial cubics (exact) and 12 for rational curves.
  - A failure falls back to the tessellation.

  The old single check, against the coarse mesh's chords, rejected thin faces. Such a face fell back to the mesh
  and came out 2–38% low on 10 µm slivers.
- **Shell signs (analytic Boolean).** A shell's volume about the origin is good to about tol × reach × its
  boundary length. When |v| is within that, its nesting decides: a shell inside an odd number of other shells is
  a cavity. Before, a 100 nm sliver could come out as "a cavity in no outer shell" (refused).
- **Plane normals.** A bilinear plane patch takes its normal from its corners. The difference quotient across a
  sliver's 1e-4 mm width tilted STEP planes by 2e-6 rad, and the re-imported sliver's volume then depended on the
  centre.
- **Cylinder tessellation frame.** The frame is right-handed (e1 × e2 = a). An axis at 45° ties its two largest
  components, so `a` flipped sign with rounding. One face of two crossed cylinders was then wound inside out:
  the B-rep was valid, but mass fell back to the mesh and came out 38% low.
- **Accuracy (stated).**
  - Quadrature mass: 1e-6 relative, with an absolute floor of 1e-12 mm³, since a sliver's volume is known
    absolutely.
  - Centroids: max(1e-6, 1e-11 / V) mm.
  - Conformance `volumeMM3` takes an optional `absTol`. RB's round trip uses the same floor.

Evidence:
- **RB4 pair.**
  - |A ∩ B| = 5.652209677: off by −1.8e-10, −1.5e-10 and −2.1e-10 at q 8, 16 and 32 (before: 8.7e-4).
  - |A − B| = 229.905016958: off by 2.3e-11 (before: −6.8e-5).
  - Centroids within 1.6e-8 mm; through STEP within 5e-11 mm (before: 9e-6).
- **Families against independent oracles.**
  - Box turned about X, Y or Z at 0.01–135°: worst 6.2e-9.
  - Grazes 10 µm and 100 nm in: 100 nm slivers of 3e-10 mm³ within 9e-15 mm³.
  - Crossed cylinders at 15–90°, including equal radii (Steinmetz, 16 r³/3 at 90°): worst 1.6e-8.
- **Property sweep.** The oracle property found no wrong result in 1200 random cases over 6 seeds.
- **Cost.** Mass of the 16-hole plate is about 30% slower (0.36 s against 0.28 s); its evaluation is unchanged.
  All studio bench scenarios are within budget; the 16-hole plate's cold evaluate is 1.2 s against 3 s.
- **Suites.** All conformance cases pass (7 new in `conformance/rb4-oracle`). The other suites:

  | Suite | Result |
  |---|---|
  | kernel | 896 pass; the one failure is the known environmental Node-version test |
  | studio | 235/235 |
  | RB | 0 NEW |
  | props | 0 failing |
  | browser split/section steps | pass |

Oracles:
- `scripts/rb/oracle-cylinder-box.mjs`: an upright cylinder against a box turned about X, Y or Z. Volume and
  first moments come from an exact piecewise-polynomial inner integral, with Gauss–Legendre in φ between every
  kink of the outer one, to rounding.
- `scripts/rb/oracle-cylinder-pair.mjs`: crossed cylinders by parallel slices, ∫ 4√(a² − t²)√(b² − t²) dt / sin α.
- `scripts/rb/oracle-cases.mjs`: builds the cases. The seed writes 93 of them; the property "exact oracles"
  runs nightly with a random seed; `pnpm test` runs the fixed slice.

Known, for RB5 (`robustness/todo.json`):
- Within 1–30 tolerances of the wall, X- and Y-turned boxes refuse (typed: the sliver is thinner than the
  stitch's 20-tolerance vertex merge).
- At 1 nm, X at 30° and 45° return a body that fails strict L0 (loops cross; 534 mm³ against 253 mm³). This is
  RB5's first item.

  A guard was tried after review (owner's delegate): the strict loop and edge-on-surface checks on the
  Boolean's cut faces only, with an analytic chart for cylinder pieces. It cost 1–2% of Boolean time (the
  16-hole plate; the corpus), but it was not adopted:
  - L0's "cross or touch" also refuses results the kernel accepts on purpose: cylinder walls touching from
    inside, schema-1 seams, shell slabs (4 kernel tests).
  - Counting proper crossings only misses this case.

  A discriminating check is needed, such as each cut face's vector area from its loops against its piece's
  region, or tolerant stitching.
- Two random X-turned grazes at 10 µm and 1 µm refuse (an edge with one use).
- A 10 µm lens's tessellation folds: two faces share a diagonal; it has no crack.

## D26 — Stable feature ids: a face keeps its feature's name, a body its key, through deletes, moves and inserts (2026-10-18, A1.1, A1.1b)
Decided:
- **Ids.** Every studio node carries `id`, `n<k>`. The serial k is handed out once by `StudioDoc.nextId` and
  never again, and the kernel feature is that id.
  - A document built by appending numbers its features as they come (node i is `n<i>`), so names read exactly
    as before.
  - A node without an id takes `n<i>` when that is free and was never handed out (i ≥ `nextId`), else the next
    serial (`withIds`, engine/ids.ts).
- **Schema 2.** A schema-1 file reads with node i as `n<i>`: every stored name, whether a fillet's edges, a
  mate's face or a drawing dimension's edge, resolves unchanged. A note says the ids were given. Nothing is
  renamed (the D16 rule).
- **History edits rename nothing.** Deleting, moving or rebuilding a range renumbers only index references
  (parents, sketches, body keys `b<i>`); names keep their ids.
  - A replaced range keeps the old nodes' ids in order.
  - `edit_feature` with a whole feature keeps the feature's id.
  - `add_features` ignores ids an agent sends, and `checkNode` accepts `id`, so a document read back can be
    sent again.
- **New features.**
  - A duplicated body is new features: fresh ids, and its fillets name the copies' edges.
  - Parts folded into an assembly move their ids past the assembly's own (by serial; with nothing deleted, by
    node count, as before).
  - A section's splits are the next ids: their cut faces are `n<next>.cut…`.
- **Readers by name.** Every reader of names now goes by id: threads (keyed by feature id), hole callouts,
  edit handles, picking a face's feature, dependents, reorder checks, flatten, part conversion and output body
  keys.

Why: A1's first need is that a name an agent or a user stored keeps meaning the same face when the history
changes around it. Before, deleting or moving a feature renamed every later name (`renameIds`), and a name kept
outside the document (an agent's plan, a note) went stale.

Evidence:
- Studio 243/243, with 5 new A1 tests:
  - ids are never reused;
  - names survive insert, move and delete, with volumes checked;
  - a duplicate gets fresh ids;
  - a rebuilt range keeps its ids;
  - flattened instances get unique ids.
- 3 conformance cases (`apps/cad-studio/conformance/a1`): schema-1 read, delete, move.
- The full browser flow passes (102 + 1 updated: the older-file step now reads schema 2 with ids n0 and n1).
- Bench unchanged.

A1.1b, body keys (owner's delegate, after review). Bodies are keyed by the stable id of the feature that makes
them: `b<k>` for `n<k>`, `b<k>_<side>` for split halves, `b<k>_part<j>` for a file's or a separation's solids.
- **Why.** The maps keyed by body are document state: looks (colour, material, name, hidden, face colours),
  render appearances and animation tracks. With index keys, a delete or move either rewrote them, so holders
  outside the document went stale, or attached them to the wrong body.
- **What changes.** Nothing is re-keyed on move. A delete drops only the deleted features' keys. A rebuilt range
  gives its solid the old last node's id, so the shape keeps its key. A document built by appending has the
  same keys as before.
- **Schema 3.** A schema-2 file's index-keyed maps move to the id keys once on read, with a note; schema-1 files
  are identical.
- **Code.** `BodyResult.ref` carries the body's node and side now (`refOf`). Agent tools return and accept the id
  keys, and `checkNode` names a bad reference with its body key.
- **Tests.** A coloured, brass, animated body keeps its look, appearance and track through a move and a delete
  above it, plus the schema-2 → 3 migration. The conformance case is `conformance/a1/body-keys`.

Next in A1 (open):
- **A1.2 selectors.** `{feature, role}` and `{on, normal, pick}`, each resolved to its name and returning it.
  Exposed to the agent tools; no kernel indices.
- **A1.3 re-match.** A stored name that no longer resolves after an edit is matched again by geometric
  signature (surface kind, normal or axis, area, centroid), and refused with the candidates when ambiguous.
- **A1.4 sketch-entity side names.** `side[sk.l3]` instead of `side3`, versioned per node as D16 did, so that
  editing a sketch does not renumber the sides.

## D27 — Selectors: a face or edge said by what it is, resolved to its name (2026-10-18, A1.2)
Decided: wherever the agent tools take a face or an edge (`run_command` faces and edges, `select`, `measure`
a and b), a selector may stand in for the name. Each resolves to the persistent name(s) it stands for, and the
result reports them (`resolved: [{selector, names}]`), so the agent learns the name and uses it afterwards.
- **`{feature, role}`.** The feature is an index or a stable id. The role is exact (`top`, `bottom`, `side2`,
  `cut`) or a family (`side`, one of its sides).
- **`{normal, pick}`.** The flat face facing the direction (to 1e-9 in cosine), the farthest along it (`max`,
  the default) or the nearest (`min`).
- **`on` and `all`.** Either may take `on` (a body key) and `all: true` (every face that fits).
- **`{between: [face, face]}`.** The edge two faces share.

Several faces fitting is refused with them listed; none fitting is refused with what there is (the feature's
faces, the bodies). No mesh index is exposed. The system prompt and tool schemas say so; selectors are JSON
objects next to names (`anyOf` string or object).

Why: A1 asks that an agent can say "the top of feature 1" or "the face at +X" without first reading the name
list. Refusing ambiguity, rather than picking one, keeps a plan from silently acting on the wrong face.

Evidence:
- Studio 249/249, including 3 selector tests: roles, families, directions, `on`, refusals, and a fillet and a
  measure through `runTool`.
- Conformance case `conformance/a1/selectors` (7 selectors, two of them refusals).

## D28 — Re-matching stored names an edit renumbered (2026-10-18, A1.3; A1.3b and A1.3c to follow)
Decided: `edit_feature` (the agent's edit of an existing feature) runs `rematchNames(before, after)`
(engine/rematch.ts) before it accepts.
- **Scope.** Every later fillet, chamfer, shell or draft whose parent body the edit changed has its parent body
  evaluated as it was and as it is.
- **When names are trusted.** If that body's names are the same, each of the same kind facing the same way, every
  stored name is trusted. A dimension edit therefore never guesses.
- **When names are re-matched.** Otherwise each stored name is matched by its geometry before the edit (face:
  kind, normal, centroid; edge: straight or curved, direction, midpoint). Among the new faces or edges of the same
  kind facing the same way (1°, an edge either way), the nearest wins when it is clearly the nearest: the next is
  at least twice as far. That rule is scale-free, so no absolute length enters it.
- **Substitutions.** A substitution replaces the stored name and is reported to the agent (`rematched: [{feature,
  was, now}]`). It is also kept on the node (`rematched`, new → old) until the user confirms it, so a wrong
  guess cannot hide.
- **Refusals.** When the match is unclear the edit is refused with the candidates. When nothing alike is left it
  is refused as gone. The part is unchanged either way.

Why: an edit that renumbers sides, such as a sketch given another corner, left a fillet's edge name naming
another corner. That was silent and wrong; see the conformance case where the old name lands on the corner at
(10, 0).

Split (owner's delegate asked for persisted signatures and a visible notice; recorded as the next steps):
- **A1.3b.** Each stored reference keeps a compact signature: mates, placement faces, fillet, chamfer, shell and
  draft names, drawing dimensions, per-face colours. On evaluate, a name that does not resolve, or resolves to
  geometry unlike its signature beyond a tolerance relative to the model's size, is matched against the stored
  signature. This covers a reopened file on a kernel that numbers differently, where there is no prior document.
- **A1.3c.** The studio shows a re-matched reference on its feature in the tree, with confirm or pick another
  candidate. Confirming clears `rematched`.

Evidence:
- Studio 254/254, with 2 tests and 3 conformance cases (`conformance/a1/rematch-*`):
  - a corner inserted renumbers sides and the fillet follows its corner, by closed-form volume;
  - a dimension change keeps names;
  - a cut-off corner is refused naming both edges.

## D29 — Stored references keep a signature; verified on open by the same matcher (2026-10-18, A1.3b)
Decided:
- **Where.** Every stored face or edge reference keeps a compact signature of what it named (engine/references.ts):
  - fillet and chamfer edges, shell open faces and draft faces (`node.sigs`, by name);
  - mate faces on the base part (`sig`);
  - drawing dimensions' edges (`sig`);
  - per-face colours (`look.faceSigs`).
- **What.** A signature records kind, normal or direction, centroid or midpoint (to 1e-6 mm), size, and radius.
- **Written.** With the reference, from the bodies it was picked on: an agent tool's `accept`, or the studio's
  `commit`. A document replaced whole, as on open, is not captured from the old part's bodies.
- **Refreshed.** Only after an accepted `edit_feature`, which has first gone through the prior-document match
  (D28), and never for a reference still marked re-matched. Never on open, a plain re-evaluation or a kernel
  change. Otherwise a renumbering that still resolves, to the wrong face, would overwrite the good signature with
  the wrong face's geometry.
- **Verified on open.** No prior document is needed (`verifyReferences`). The one matcher
  (`rematch.matchSignature`) runs against each stored signature:
  - its clear best is the stored name: the reference stands;
  - its clear best is another name: substituted and marked (`was`, `rematched`, `facesWas`), with a toast;
  - several as near: refused, naming them;
  - none alike: refused as gone.
- **Tolerances.** No equality tolerance is used. Kind, direction (1°) and radius (relative 1e-6) gate what is
  alike, and the clearly-nearest rule (the next at least twice as far) decides. A kernel moving centroids by 1e-9
  changes nothing.
- **Cost.** `captureSignatures` copies the document only when some reference lacks a signature.

Why: a file reopened on a kernel that numbers faces otherwise has no prior document (D16's thread names, D22's
corner numbers); its references must carry their own evidence.

Evidence:
- Studio 259/259.
- A signature-writing test: a mate on the base part, a fillet by an agent, and a marked reference not refreshed.
- 4 conformance cases (`conformance/a1/refs-*`):
  - a mate whose stored name now names another face is matched back on open;
  - 1e-9 jitter: no re-match;
  - a dimension edit, then reopen: no re-match;
  - two tops as near: refused.
- Full browser flow 103/103.
- Bench unchanged.

## D30 — References shown and settled; every part's mates signed; a reference that cannot be told holds only its feature (2026-10-18, A1.3c)
Decided:
- **Shown.** A "References" card says "N matched again, M need a choice" at once on open. Each re-matched
  reference is listed with *was → now*, **Confirm** and **Pick another** (the alike candidates nearest its stored
  signature). Each problem is listed with its candidates, or "gone; pick it again on the feature". A history step
  holding a mark or held is underlined, and its tooltip says what was matched or why it is held.
- **Settled.** Confirming or picking (`confirmReference`) clears the mark, takes the signature from that face or
  edge as the part now stands, and releases a feature held for it. It is one undoable change.
- **A refusal on open no longer stops the open.** `verifyReferences` lists problems (ambiguous: the candidates;
  gone: none) instead of failing.
  - The feature storing such a reference is held, `suppressed` with `held` saying why, so the rest of the part
    builds and a reference that cannot be told is never built on.
  - A mate, dimension or colour with a problem is listed only.
  - Nothing else changes.
- **Coverage.**
  - Mates on every part, the base and each instance (sub-assemblies too), are signed from that part's face table
    (plane: point and normal; cylinder or bore: axis point, axis one way, radius), in the part's own coordinates.
  - Holes and face-anchored sketches store their placement as geometry (a centre and an axis; a `DocPlane`), not
    a face name, so there is nothing to match.
  - Agent-held selections are not stored in the document. A4's proposals will join this list when they hold some.

Evidence:
- Studio 260/260. New conformance case `refs-gone`: the file opens, the fillet is held with its reason and listed,
  and the box builds at 600 mm³. The mate cases now use face-table signatures; ambiguity is a problem, not an
  abort.
- Browser flow 104/104, with a new step:
  - a file whose fillet edge a renumbering kernel would name otherwise opens with it matched again;
  - the card says "1 matched again" and the step is marked;
  - Confirm clears the mark;
  - a file with a gone reference opens with the fillet held, "1 needs a choice", and the box built.
- Bench unchanged.

## D31 — Sketch-entity side names (A1.4) deferred; A1 closes on stable ids, selectors and signatures (2026-10-18)
Decided: A1.4, naming an extrusion's sides by a stable sketch-entity id (`side[s3]`) instead of position
(`side3`), is deferred and recorded here rather than shipped.

Scope found:
- **Kernel.** The kernel names sides by position in five generators: prismatic, drafted, loft, revolve, and the
  part-model loops. Stable side names need a new public part-document field (per-segment tags) honoured by all
  of them, and a per-node version so old documents keep `sideK` (D16).
- **Studio.** The sketcher has no stable segment identity: its constraints and driving dimensions are indexed by
  segment as well.

Why deferred (policy 6, risk over value now): the harm, a name landing on another side after a sketch edit, is
already caught.
- On edit, the names are matched again by geometry (D28).
- On open, they are verified against stored signatures (D29).
- Ambiguity is refused and shown (D30).

Stable side names would mainly avoid the re-match notices.

Plan for when it is taken up, best alongside the sketcher's entity ids (R-track sketch work):
1. Segment ids in polygon and loop profiles, kept through vertex insertion.
2. An optional `sideTags` on the kernel profile, used by every generator for `side[tag]`.
3. A studio sketch node version 2 that sends the tags.
4. Conformance: a vertex inserted keeps every other side's name.

## D32 — Observation: facts after every change, what changed, and detail on request (2026-10-18, A2.1)
Decided:
- **Facts.** Every accepted change returns `facts`, and `get_part_summary` carries them too (chat/observe.ts):
  - built;
  - solids;
  - volume;
  - mass, by each body's material (aluminium by default; the materials are in app/materials.ts);
  - volume-weighted centroid;
  - bounding box;
  - face, edge and vertex counts, vertices being the distinct ends of edges.
- **Change.** Every accepted change also returns `change`: only what moved since the step before.
- **Detail.** `inspect` (faces and edges, by name or selector, D27) gives the detail.
  - A face: kind, area, normal or axis (a round face's axis from its mesh), radius, centre, its adjacent faces,
    and the feature that made it (index and label).
  - An edge: its ends, chord, line (along an axis, oblique) or curve, its two faces, and its maker.
- **No indices.** No mesh index is exposed anywhere. The system prompt tells the agent to read the facts and the
  change after each step.

Why: A2 asks that the agent observe what each step did without parsing the face lists, and see a face's
context (neighbours, maker) when it needs it.

Next in A2:
- **A2.2.** Mass properties, interference and clearance, section, wall thickness and draft tools.
- **A2.3.** `render_views`: orthographic views plus isometric with face labels, rendered at milestones and
  cached by model hash.
- **A2.4.** `response_format` concise or detailed, with pagination.

Evidence:
- Studio 263/263: facts and change for a plate and a hole; inspect of a top, a bore and an edge.
- Conformance case `conformance/a2/facts-hole`, checked against closed forms.

## D33 — Analysis tools; a mass from an assumed material is said so (2026-10-18, A2.2)
Decided: five agent tools analyse the part without changing it (chat/analysis.ts).
- **`mass_properties`.** Per body: volume, surface area, and mass by its material. Also the centroid, the
  inertia about it (the kernel's aluminium inertia scaled to the density) and the box.
- **`interference`.** Every pair of bodies, or those given: an overlap by the kernel's intersection volume; the
  others' smallest clearance and where.
- **`section`.** Across x, y or z at a position, by the kernel's split: each body cut, with the cut's area,
  regions and box.
- **`wall_thickness`.** Inward rays from every triangle's centre: the thinnest wall, where and on which face, and
  the faces thinner than `below`.
- **`draft`.** Each flat wall's draft angle against a pull (default +Z; negative is an undercut), and those under
  `min_deg`. Curved faces are said not to be judged.
- **Stated accuracy.** Clearance, wall thickness and draft are on the display mesh, good to its chord error,
  and say so. Overlap volume, section area and mass are the kernel's.
- **Assumed material (owner's delegate).** A body without a material is taken as aluminium, and the facts and
  mass properties say so: `materials: [{body, material, assumed}]`, `mass_assumed`. The system prompt tells the
  agent to set the material, or state the assumption, before checking a mass against a requirement. A3 treats a
  mass check on an assumed material as unknown, not as pass or fail.
- **Roadmap.** The A1.4 plan is placed in the roadmap as R10a, before R10, whose fillets name sides.

Evidence (studio 266/266), each against closed forms:
- **Mass.** A plate: area 2560, mass 17.28 g assumed. As steel: 50.24 g, not assumed, with I_zz = m(a² + b²)/12.
- **Interference.** An overlap of 250 mm³; clearances 15 and 20.
- **Section.** A cut area of 160; refused off the part.
- **Wall.** 8 mm.
- **Draft.** Four walls at 0°, all under 1°.

## D34 — render_views: exact line views on one PNG sheet, faces numbered with a legend (2026-10-18, A2.3)
Decided: `render_views` returns one 1000 × 1000 PNG and its legend (chat/views.ts).
- **Layout.** Four views: front, top, right and isometric, third-angle.
- **Edges.** From the kernel's exact hidden-line projection (`projectBrepHiddenLines`, as drawings use): visible
  edges solid, hidden ones thin and dashed. Line views are used rather than a shaded render because shading
  hides CAD-specific faults.
- **Faces.**
  - A light fill where a face shows, from our own z-buffer of the display mesh in the same projection.
  - A Set-of-Mark number on each face that shows at least 60 px, placed at the pixel deepest inside what shows
    (a chamfer distance transform; among nearly-deepest pixels, the one nearest its centre). So a face with a
    hole is not labelled at its rim.
  - The legend maps number → face name; `views.<id>.visible_faces` lists every face that shows in a view, and
    `mm_per_px` gives the scale.
- **Options.**
  - `highlight` fills faces red and rings their labels; it is meant for A3's failed checks.
  - `section` cuts the part first, keeping the side whose cut faces look at the matching view (y > at for the
    front, x < at for the right, z < at for the top).
- **Own code, no dependency.** Antialiased lines, a 3 × 5 digit font and the PNG encoding (CRC, filter 0) are our
  own. The deflate is the web-standard `CompressionStream`, so the module works in Node, where the MCP server
  runs the tools, and in the browser bundle.
- **Image delivery.** Tool outcomes carry `images`, and the MCP server returns them as image content.
- **Cost.** Rendered only on request (the description says: at milestones or when something seems wrong) and
  cached by model and options. A plate with a hole renders in well under a second; the cached repeat in under
  50 ms.
- **Stated accuracy.** Edges are exact; fill and labels follow the display mesh's chord error.

Evidence: studio 267/267. A view test checks:
- the PNG signature and 1000 × 1000 size, at 34 kB;
- the top labelled, and the bore seen in the isometric view through the hole;
- the top view showing the top and not the bottom;
- the cache;
- a y-section whose front view shows the cut face.

The sheet was inspected by eye.

## D35 — Response format and pages; A2 closed (2026-10-18, A2.4)
Decided:
- **`response_format`.** The tools that list the part (every mutator, and `get_part_summary`) take one:
  - `concise`: the facts and what changed, with the features by index and label only;
  - `detailed`: every body's faces and edges;
  - absent: as before, them when the part is small, otherwise one body at a time.
  The default is kept, so agents written against it see no change.
- **Pages.** A body's faces and edges come 60 to a page (`page`, from 1). Each page says how many there are and
  how to ask for the next. This replaces a silent truncation.

Why: an agent's context is the scarce resource. A concise step costs a few hundred tokens and a detailed one is
asked for. A big body is read in pages rather than cut off.

Evidence: studio 268/268 (concise and detailed results; a 30-hole plate's faces in two pages that differ; a
concise summary). A2 is closed: facts and inspect (D32), analysis (D33), views (D34), format (D35).

## D36 — Requirements as declarative checks, kept in the document (2026-10-18, A3.1)
Decided:
- **Where.** The brief is kept in the document as `requirements` (chat/spec.ts). Each requirement has an `id`, a
  quoted `source`, `hard`, a `basis` (stated, assumed or ambiguous), and optional `subject` and `assume`.
- **The predicate.** It is declarative JSON, never code that gets evaluated: `{op: == | <= | >= | between,
  query: {fn, …}, value | min and max, tol?, unit?}`.
- **Query functions.**

  | Query | Arguments |
  |---|---|
  | `bbox` | axis, body? |
  | `volume`, `mass` | body? |
  | `count_solids` | — |
  | `count_faces_of_kind` | kind, body? |
  | `distance_between` | a, b |
  | `radius`, `hole_diameter` | face |
  | `min_wall` | body? |
  | `draft_min` | body?, pull? |
  | `clearance` | a, b (body keys) |

  They measure with the agent's own facts, measure and analysis. Subjects are names or selectors, so they keep
  to the feature's stable id (A1).
- **Tools.** `set_requirements` checks and keeps them: it adds, replaces by id, or with `replace` replaces all, and
  refuses a malformed one saying what is missing. `check_spec` runs them and reports `{model_hash, summary {pass,
  fail, unknown, hard_failing}, failures [{req_id, check, measured, expected, delta, entities, feature, hint}],
  unknowns [{req_id, why}]}`, with passes as counts only.
- **Unknown, with why.** An assumed material (D33), a reference that does not resolve, or an analysis that does
  not apply (curved faces for draft).
- **Prompt.** The system prompt says to write the requirements before modelling and to run `check_spec` after
  changes and before finishing.

Why: A3 turns a brief into checks the part can fail, so an agent and a user can see what holds without
re-reading the prose. Being data rather than code keeps them deterministic, safe, serialisable, and portable into
the conformance format.

Next in A3:
- **A3.2.** Mutation check of a suite: driving parameters ±15%, the subject's feature suppressed, and the trivial
  stub. Plus the iteration policy kept by the tool layer: the best snapshot, a refused regression of passed hard
  requirements, repair rounds counted, and a restart hint after two rounds without progress.
- **A3.3.** The checklist panel.

Evidence:
- Studio 270/270. A brief of 7 checks on a plate with a hole gives 5 pass, R2 failing by 2 mm (hard), and the
  mass unknown. Malformed requirements are refused.
- Conformance case `conformance/a3/plate-brief`.

