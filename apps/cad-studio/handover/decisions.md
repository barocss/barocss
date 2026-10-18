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

## D37 — Checks tried on mutants; the iteration policy kept by the tools (2026-10-18, A3.2)
Decided:
- **Mutation check (`check_spec {validate: true}`).** The suite runs on at most 8 cheap mutants
  (`MAX_MUTANTS`), each one evaluation and one run of the suite:
  - every body scaled ×1.15 and ×0.87;
  - the first two parameters ±15%, or with none the first extrusion's height;
  - the features the subjects come from suppressed;
  - the trivial stub, a box as big as the part.

  The report states how many were tried and built, their labels, and the time.
- **Vacuous, unverified, invariant.**
  - A mutant that does not build, or on which a check is unknown (its subject gone), does not apply to that
    check. It is never a pass.
  - A check that passes on the model and on every mutant it applies to is **vacuous**: it cannot tell this model
    from a changed one. The exception is a requirement declared `invariant: true` with an `invariant_reason`
    (one piece, no interference), which is listed as **invariant**.
  - Fewer than two applicable mutants makes a check **unverified**, not vacuous.
- **Policy, in the tool layer, not only in the prompt.** `ChatState.policy` remembers across a session:
  - **best snapshot:** most checks passing, then the least relative miss;
  - **rounds:** each failing requirement's rounds without a smaller miss;
  - **passedHard:** the hard requirements that passed at the last check;
  - **calls:** the tool calls made.

  Every `check_spec` reports the best snapshot (`this_is_best`), the rounds without progress, the tool calls and
  the turn budget (`CAD_MAX_TURNS`, passed by the chat server). After two rounds without progress on a
  requirement it adds a hint: start again from the brief, the checks and the best snapshot.
- **Regression guard.** A change that breaks a hard requirement that passed at the last check is refused, naming
  it with its measured and expected values, unless it carries `because`.
- **`restore_best`.** It puts the best snapshot back.
- **Refused calls.** A refused call leaves the state the very same object.

Why: CADTests-style mutation catches always-passing checks before they are trusted, and an iteration policy kept
by the tools holds even when the agent's loop forgets it.

Evidence (studio 272/272):
- A bbox length check and a hole-diameter check are not vacuous (the mutants change them). "Under 100 tall" is
  vacuous. "One piece" is a declared invariant.
- With no mutant building, every check is unverified.
- Three checks without progress give rounds T: 2 and the restart hint.
- Scaling the plate ×1.5 is refused for breaking L (measured 60) and made with `because`. `restore_best` brings
  back the 40 mm plate.

## D38 — The requirements panel: checked as the part changes, a person warned and never blocked (2026-10-18, A3.3)
Decided:
- **The panel.** The studio's Browser lists the requirements.
  - Each row: ✓, ✗ or ?, the id, the source quote, the measured value against what it asks for, hard or soft,
    and its basis (stated, assumed or ambiguous).
  - The header gives counts and says "checking…" or "stale".
  - A filter shows the failing only.
- **Click.** Clicking a row selects its subject faces and edges in the viewport.
- **Editable assumptions.** An assumed or ambiguous requirement is editable in place: a value and **Confirm**.
  Confirming makes it stated and records `confirmed: {by: 'user', at}`, so a later reviewer or agent can tell
  what the user agreed to and what the AI assumed.
- **When checks run.** After evaluation settles: debounced (350 ms), a stale run dropped, and none while a command
  previews, a sketch is open or the engine is busy. The panel runs only when there are requirements, so the
  bench paths are untouched.
- **People are warned, never blocked.** A person's edit is never refused. A hard requirement that passed and now
  fails is said at once in a toast ("W now fails", what it measures, "your change is kept"). Only agent tool
  calls meet the regression guard (D37).
- **Fix: requirements carried over on commit.** Commands build on the evaluated document, which follows model
  edits only. `commit` now carries the document's requirements over, like render, drawing and instances.
  Before, a nudge after a confirmation reverted the confirmation.
- **Cost.** `min_wall` traces its rays through a uniform grid of the triangles (Amanatides–Woo, early exit)
  instead of testing every triangle: 4k triangles 447 → 78 ms, 8k 115 ms, same results.

Evidence:
- Studio 272/272.
- Browser flow 105/105, with a new step:
  - a brief opens as 1 ✓ 1 ✗;
  - the assumed height is set and confirmed: stated, confirmed by user, 2 ✓;
  - the second box is moved 10 mm left by the user: "W now fails" is said and the move is kept.
- Bench unchanged.

A3 is closed: requirements and `check_spec` (D36), mutants and policy (D37), the panel (D38).

## D39 — Transactions: batches all or nothing, dry runs, op ids, checkpoints and diffs; one field registry (2026-10-18, A4.1)
Decided:
- **Field registry (owner's delegate: the requirements carry-over bug is a class).**
  - `STUDIO_DOC_FIELDS` and `NODE_EXTRA_FIELDS` list every document and node field. Each is checked against
    its type at compile time, so a field added to the type but not to the list fails type-check.
  - `carryOver` (used by `commit`) carries every field but the model's own nodes and outputs. A field a command
    did not touch is never dropped because the command was built on the evaluated document.
  - `test/fields.test.ts` sets every field, typed so it cannot miss one. It runs carry-over, delete, move,
    duplicate, replaceRange, flatten, and opening at schemas 2 and 3, and asserts every field survives.
  - Flatten now renames the keys of `sigs` and `rematched` with the shifted ids.
- **`apply_ops`.** Tool calls as one change: `ops [{tool, args, opId?}]` run in order, each on what the one before
  left (set_requirements, run_command, add_features, edit_feature, delete_feature).
  - **All or nothing:** a refused op means none is applied and the state stays the same object.
  - **`dryRun`:** returns what would change — the feature-tree diff, the facts' change, and references that
    would break (`verifyReferences`) — without applying.
  - **Op ids:** an `opId` applied before is skipped (`already applied`), so a retried batch does not apply twice.
    The last 500 are remembered.
- **Checkpoints.** `checkpoint` names the part as it is (this session, the last 20), `restore` puts it back, and
  `diff` compares checkpoints, "best" or "current".
- **Tree diff.** By stable feature id: added, changed (before → after labels), deleted, moved, and parameter and
  requirement changes. Signatures and marks are ignored: they are what the studio keeps, not the feature.

Why: A4 starts from changes an agent can try and take back whole. The registry keeps A4's branches and proposals,
which add more fields, from dropping any.

Evidence: studio 276/276.
- Fields guard: every path.
- `apply_ops`: a dry run unchanged; applied; a retry skipped; a refusal applying nothing; no batch inside a batch.
- Checkpoint, diff and restore: added 2, changed n1 8 → 10, then back; the diff afterwards empty.

Next: A4.2, proposals on a branch with a ghost preview and a risk badge, and the history kept in the document.


## D40 — Proposals with a ghost preview and a risk badge; the design history in the document, under a budget (2026-10-18, A4.2)
Decided:
- **`propose`.** An agent proposes a change instead of making it: `{title, ops, plan?, requirements?}`, the ops as
  `apply_ops` takes them. They run on a copy; the part is unchanged (its model hash the same).
  - The result: the feature-tree diff, the facts' change, references that would break, the checks before and
    after (`checkSpec` both sides: counts, newly failing, newly passing) and a risk badge.
  - A proposal keeps its ops and the model hash it was made on (`base`), not a copy of the part: its result is
    the ops replayed. Recorded with it: agent and model (`CAD_MODEL`), the user's message (`CAD_PROMPT`, capped
    at 2,000 characters), the plan (500), requirement ids, a one-line summary.
  - The regression guard (D37) does not refuse a proposal: what it does to hard requirements is the badge.
  - `list_proposals` gives the open ones (all: decided too), stale when the part changed since.
- **Risk badge.** `features_touched` (added, changed, deleted, moved), `references_broken`,
  `hard_requirements_changed` (outcome flipped or definition changed), a level, and `approval`.
  - Level: high when a hard requirement changes, a reference breaks or a feature is deleted; medium when more than
    three features change, one moves or a parameter changes; else low.
  - `approval` lists why it always needs a person: an assembly, mates, a drawing, a part from a file.
    (Amended in D41: these are the *changes* to the assembly, mates, drawing or a locked part, compared
    before and after, not their mere presence; and an agent makes them only through proposals.) **Pending
    decision (reversible default):** the document has no "locked" flag yet; a placed part with a `source` file
    counts as locked. In A4.2 every proposal needs a person anyway; A4.3's autonomy levels read this list.
- **Accept and reject (studio).** The Proposals list in the Browser:
  - **Preview** shows the ghost: the bodies the proposal leaves, the changed ones tinted. **Before/After**
    switches between it and the part as it is. The volume change shows in mm³ and per cent.
  - **Accept** replays the ops on the part as it is now, one undoable commit. On a part changed since, it is
    replayed and that is recorded ("replayed on a part changed since it was proposed"). If an op no longer
    applies, nothing changes, the reason is shown and the proposal stays open. Accepting while rolled back is
    refused with a hint.
  - **Reject** keeps the proposal, marked rejected with who and when (and a note, from the API).
  - Decided ones are hidden behind a filter, never deleted.
  - The volume overlay is numeric plus tinted changed bodies. A region overlay (material added and removed, in
    two colours) needs a Boolean per body each way; deferred, recorded here.
- **Design history (`StudioDoc.history`).** A compact record per entry: id, time, kind (prompt, change,
  proposal, accept, reject, compacted), agent and model, prompt (2,000 characters), plan (500), summary (240),
  requirement ids, the model hash produced, the proposal id and its risk.
  - A chat turn that changes the document adds one `prompt` entry when it ends: the message (attachment names
    only), the diff in a few words, the model hash when the model changed. A turn that changes nothing adds
    none (it makes no commit).
  - No transcripts, tool outputs or images are stored. Full diffs are recomputed from ops and checkpoints.
  - A person's own edits are not entries: undo covers them, and the history is about agents and decisions.
  - **Budget:** the history's JSON is at most a tenth of the 4 MiB file limit (419,430 bytes). Over it, the oldest
    half is folded into one `compacted` entry: how many entries, by kind, and their time span. Folds fold
    again; ids keep counting.
- **Privacy.** The history and the proposals' prompts are saved with the part.
  - The Browser says so under Design history, with **Save a copy without it**: `<name>-shared.bcad`, the
    history removed and the proposals kept without prompts and plans (`stripHistory`).
  - The chat's empty state says messages are kept in the part's design history.
- **Chat base.** The chat now starts from the current document's own fields (requirements, proposals, history),
  not those of the evaluated copy, which follows model edits only. Before, an agent could see stale requirements.
- Both new fields are in `STUDIO_DOC_FIELDS`; the fields test sets them and they survive every path.
- **Fix: D39's carry-over, found by the full browser flow.** It was too wide in two ways.
  - A new or opened document (`replaceDoc`: New part, Open, templates, mesh and STEP import) went through
    `carryOver`. The previous document's own fields leaked into it: body names and looks, requirements, and now
    the history. That is a privacy leak once prompts are stored. `commit(next, capture, whole)` now skips the
    carry-over for a whole document.
  - A change built on the document itself, not on the evaluated copy, had what it cleared carried back. "Show
    all bodies" removes the hidden looks, and they returned. `carryOver` now leaves such a change as it is. It
    recognises one when the change's nodes are the document's own, or when it holds a field that only the
    document has.
  - Guarded by a new fields test, and by the browser step, which checks that a new part has no history,
    proposals, looks or requirements.

Why: a proposal lets the user see what an agent would do before it happens, and the history keeps who asked for
what in the file it changed. The budget keeps a long-lived part's file from being taken over by its history.

Evidence: studio 282/282; browser flow 106/106; bench within budget (16-hole plate 1.27 s of 3 s); lint clean.
- `test/proposals.test.ts`:
  - propose: model unchanged; diff n2; checks 1/1/0 → 1/1/0; risk low; refusals keep nothing; a bigger hole
    makes R2 newly passing (risk high); listed, then stale after an edit.
  - Accept replays the ops. A proposal made before another accepted one is replayed on the changed part, and
    that is noted. Each proposal is decided once.
  - Reject keeps the proposal. History kinds come in order. A proposal whose face is gone is refused on accept.
    Save and open round-trips.
  - History: a prompt capped at 2,000 characters; 200 × 2 kB entries under a 40 kB budget are folded with every
    entry accounted for; ids stay unique and keep counting; stripping leaves no prompt or plan.
  - Approval for an assembly and a part from a file.
- Conformance `a4/propose-plate`: R2 (≤ 6200 mm³) fails at 6400 and passes at 6173.81 after the proposed Ø6
  hole. Risk high (R2); accepted gives 3 features and history proposal → accept.
- Browser flow, new step:
  - a document with two proposals opens;
  - the P1 ghost shows −226.19 mm³ (−3.53%), and Before/After switches;
  - Accept makes the hole (3 features, history prompt → accept); P2 is rejected and kept;
  - the history lists 3 entries;
  - the shared copy has no history, prompt or plan, and keeps the proposals.

Next: A4.3. Accept a proposal per feature, dependency-aware: unticking a parent unticks its children, with a
rebuild preview. Then autonomy levels L1–L4 reading `risk.approval`, and viewport selections sent to chat as
context chips.

## D41 — Stale proposals are rebased before they are accepted; accept in part, dependency-aware; autonomy L1–L4; the selection as chat context (2026-10-18, A4.3)
Decided:
- **No blind accept of a stale proposal (peer's decision, under the delegation).** A proposal made on a part that has
  changed since (its `base` is not the model hash now) is refused by `acceptProposal` as stale.
  - `rebaseProposal` makes it again on the part as it is: ops replayed, and the diff, facts' change, broken
    references, checks' delta and risk all recomputed. It stays open, keeping
    `rebased: {original, from, at, risk_was}`.
  - The history records a `rebase` entry (`base_was` → `model_hash`). The accept entry carries `base_was`, the
    original base.
  - In the studio a stale proposal shows "stale", and its only way forward is **Rebase & preview**: it commits the
    rebased proposal (undoable), then shows its ghost. Accept appears only on the rebased version. A rebase that no
    longer applies shows why, and the proposal stays open.
  - An agent's `accept_proposal` on a stale proposal rebases it and returns the new preview with
    `accepted: false`; accepting takes a second call.
- **Accept in part.** `proposalParts(base, after)` lists the proposal's features: added, changed, deleted (sketches
  go with their features).
  - An added feature's children are the proposal's features that depend on it (built on it, or naming its faces and
    edges). A changed feature has none: put back, what is built on it stands as it did before.
  - `leaveOutClosure`: unticking a part unticks its children. `toggledLeaveOut`: ticking one back brings its
    parents back.
  - `partialDoc`: changed features left out are put back as they were (references renumbered to where those
    features are now; refused when one was built on a feature the proposal deletes). Added ones are deleted with
    the sketches only they use. Deletions are all or nothing (no tick).
  - The studio lists the parts with ticks under a previewed proposal. Each tick rebuilds the ghost, and Accept
    becomes "Accept 1 of 2".
  - The decision records `left_out`; a part left out that would leave the part unbuildable is refused with the
    kernel's reason.
- **An approved change carries its provenance.** The accept history entry holds who decided (`by`), who proposed it
  (`proposed_by`, agent and model), the prompt, plan and requirement ids, the risk, the model hash made, and
  `base_was` after a rebase.
- **Autonomy levels.** Set in the chat header (L1–L4, kept per browser). They are sent with each turn
  (`autonomy` → `CAD_AUTONOMY`) and stated to the agent in the turn's note.
  - L1: propose only. Part-changing tools are refused (requirements and dry runs allowed).
  - L2 (default): the agent changes the part; the user accepts proposals. **Owner decided option (b), 2026-10-18 — see
    "L2 is option (b)" below.**
  - L3: the agent also accepts proposals of low or medium risk that change no hard requirement.
  - L4: the agent accepts any proposal that breaks no hard requirement (newly failing).
  - At every level, a proposal with `approval` reasons (an assembly, mates, a drawing, a locked part) is the user's.
  - A rebased proposal is the agent's to accept only when its risk is no higher than `risk_was` and it changes no
    hard requirement.
  - **Changes that always need approval go through proposals at every level (peer's override of the earlier
    default).** `approvalOf(a, b)` compares the assembly's parts (added, removed, built, moved — mates moving them
    too), the mates, the drawing and parts placed from a file before and after.
    - An agent's direct tool call that makes any of these changes is refused at every level, the state unchanged.
      The refusal is typed: `code: 'needs_approval'` and `approval: [...]`, with the hint "propose it; this kind
      of change always needs the user's approval".
    - Such changes are possible only through `propose`. Its ops may now hold the assembly tools and part tools with
      `"part"` (add_part ids run p1, p2, … so later ops can name them). Their `approval[]` keeps them the user's at
      L3 and L4.
    - The user's own edits in the studio are unaffected. The tools themselves stay reachable through
      `dispatchTool`, the dispatcher proposals replay; tests use it too.
    - A base-part edit that moves mated parts is an assembly change too, so an agent proposes it.
    - The system prompt now asks the agent to build the base part directly and to propose the rest of an assembly.
- **The selection as context chips.** The viewport selection (faces, edges and bodies by persistent name, up to 12)
  shows as chips above the chat input; a chip can be removed. They are sent with the message as
  `[Selected in the viewport: face n1.top; …]`, names the tools take.
- **Small fixes.** History times are shown in local time. A rebased accept is noted "rebased before it was
  accepted", not with a hash.

Why: the reviewer must see what will happen before it happens. A proposal replayed on a changed part is a different
change, so it is shown again. Accepting part of a proposal and setting the agent's autonomy let a person take what
they want from an agent's work at the pace they choose.

Evidence: studio 287/287 after the override (285 before it); browser flow 106/106; bench within budget; lint clean.
- Override: an agent's add_part is refused at L2 and L4 (`needs_approval`, [assembly]). Proposed, it carries
  [assembly]; L4 cannot accept it; the user's accept builds the pin. Moving a placed part from a file gives
  [assembly, locked part]; a hole beside it needs none. A drawing changed gives [drawing]. In conformance
  `a4/assembly-needs-approval`, the direct move is refused at L1–L4, then proposed, refused to the agent and
  accepted by the user. In the browser, a proposal shows "needs you (drawing)".
- `test/proposals.test.ts`:
  - stale refused, then rebased (both bases kept, nothing built) and accepted; the history reads proposal,
    proposal, accept, rebase, accept, proposal, reject;
  - in part: without the hole, with the plate 10 tall; without the edit, the plate put back at 8 with the hole and
    block kept; a fillet goes with its block;
  - autonomy: L1 refuses a change but allows a dry run and requirements; L1 and L2 refuse an agent's accept, L3
    accepts; stale is rebased on the first call (`may_accept: true`) and accepted on the second; the rules table
    (L3 high refused, L4 newly passing hard allowed and newly failing refused, approval always refused, a rebase
    whose risk rose refused).
- Conformance `a4/stale-rebase`: refused stale; rebased (original 00000000; n2, n3, n4 added; R2 fails before and
  after); accepted without n4: sketch, extrude, hole.
- Browser flow, the proposals step:
  - P1 stale → Rebase & preview → −226.19 mm³ (−3.53%) → Before → Accept;
  - P2 rejected;
  - P3 rebased, its block unticked ("Accept 1 of 2"), then accepted: two holes, one extrude, `left_out` [n5];
  - 6 history entries;
  - the shared copy is stripped;
  - the chat shows the n1.top chip and L1 is chosen: the turn is sent with `autonomy: 1` and the selection line;
  - a new part starts clean.

A4 is closed: transactions (D39), proposals and history (D40), rebase, partial accept, autonomy and chips (D41).
Next on the roadmap: R3.

**L2 is option (b): the owner decided it (2026-10-18).** It applies on the tool server to each call that changes the
part, against the part as the turn found it (`turnBase`), so a run of small calls cannot add up past it.
- **What applies directly.**
  - Value edits of one feature (numbers, or a value bound to a parameter) and parameter values. A sketch counts as part
    of the feature built from it, so a box's width and height are one feature's values.
  - Only while every hard requirement that passed at the turn's start still passes.
- **What becomes a proposal.** Everything else in the turn is refused with `code: 'needs_proposal'` and the part left
  as it was; the agent proposes it instead. That covers:
  - a second feature;
  - a new, deleted or moved feature;
  - a change to what a feature is built on, its kind or options (`parent`, `tool`, `sketch`, `edges`, `count`, `axis`
    …);
  - a parameter added or removed;
  - a hard requirement broken.
- **Unchanged.** L1, L3 and L4; the always-approval kinds (assembly, mates, drawing, locked part) at every level.
- **Owner: the first build on an empty part applies at L2 (2026-10-18).** A turn whose `turnBase` has no features
  makes the part's features and parameters directly, as many calls as the turn takes. Each call is still checked and
  refused as usual; the always-approval kinds (assembly, mates, drawing, locked part) are still proposals. The next
  turn starts from that part, and the L2 rule applies there. The studio shows the same "Applied by the agent" toast;
  its Undo takes the whole first build back (the chat commits once per turn).
  - Tests:
    - the MCP test's default L2 builds a box and a hole on an empty part, and the next session's hole is
      `needs_proposal`;
    - the L2 test has a first build and a next turn refused;
    - conformance `a4/l2-values-or-proposal` gains an empty-part turn (box and hole applied, 3 nodes) and a
      following turn whose hole is `needs_proposal`;
    - the browser step builds an empty part through the chat, one Undo leaves no features, and it builds again.
- **What the studio shows.** A turn that changed the part's features or parameters shows "Applied by the agent: …"
  with an **Undo** button, which takes the turn back. The L2 tooltip, the turn note and the system prompt say the
  rule.
- **Evidence.**
  - Studio `proposals.test.ts`, the L2 test:
    - a hole's diameter twice in a turn applies;
    - the box's height after that is refused ("changes 2 features");
    - the box's height and depth together apply;
    - a width that breaks R1 is refused;
    - a new hole is refused ("adds 1 feature"), and so is a two-edit batch;
    - propose works, and L3 builds as before.
  - Conformance `conformance/a4/l2-values-or-proposal.json` holds the same rules in five turns.
  - The MCP test checks that the default L2 refuses a model's first box with `needs_proposal`; the scripted build runs
    at L4.
  - Browser flow, a new step through the real chat server and the real tool server (`test/fixtures/scripted-claude.mjs`
    stands in for the CLI and makes the calls):
    - a height edit applies, the toast's Undo restores it;
    - `apply_ops` with the height and a hole is refused at L2, then `propose` gives P1 (1 added, 1 changed, low risk);
      the part stays a sketch and an extrude.
  - Found and fixed on the way: the toast's Undo first ran a stale undo. It now runs the latest one.

## D42 — Facet faces (F0): mesh regions as typed arrays, polyline edges, exact mass; small meshes through the planar path until F2 (2026-10-18, R3.1)
Decided:
- **One union, checked by the compiler.** `BrepFace.surface` is `Surface | FacetPatch`.
  - A `FacetPatch` is `{kind: 'facets', id, positions: Float64Array, indices: Uint32Array, bounds}`: a region's
    own triangles, wound outward for a forward face.
  - Widening the type made `tsc` list the 106 places that read `controlPoints`/`degreeU`. Each now has a facet
    branch, or narrows through `nurbsOf(face, what)`, which throws a typed GEOMETRY "faceted (mesh) faces are
    not supported yet" that part-model maps to CAPABILITY.
  - Typed arrays never enter the document or features (they cannot be frozen or JSON-copied, f0-audit risks).
    They live only in results.
- **`facetBrepFromTriangles`.**
  - The mesh is welded on numeric cell hashes (no strings).
  - Degenerate triangles are dropped.
  - It must be closed, consistently wound and one piece; refusals as before (`MeshBrepError`), plus "more than one
    piece".
  - It is turned outward by signed volume.
  - **Regions** grow across edges whose normals turn by less than 30°.
    - When there are more than 1000, triangle normals are smoothed over neighbours (1, 2, 4, 8 rounds) and grown
      again.
    - If still too many, the smallest regions merge into the neighbour sharing the most edges.
    - A region that is the whole mesh is halved, so every face has a boundary.
    - Faces are the edge-connected pieces, numbered by first triangle and named `<id>.region<k>`: the same file
      gives the same names.
  - **Edges** are degree-1 polylines through the mesh's own vertices, between corners: vertices where the
    boundary is not one face pair passing through.
    - A closed boundary without a corner gets one at its lowest vertex.
    - An edge holds at most 64 points (the curve check's limit); a longer boundary gets a vertex there.
    - Coedges are forward on the face an edge was traced from and reversed across, and loops are cut at corners.
    - The longest loop is "outer"; on a facet face that is only a convention.
- **Checks.**
  - `checkBrep` validates a patch: finite values, indices in range, no triangle without area.
  - It compares a face's boundary vector area (all loops, exactly along the polylines) with its triangles'
    vector area. That is an exact identity for polyhedral surfaces and replaces the surface-normal test.
  - Strict mode checks that every polyline vertex is one of the patch's.
- **Kernel consumers.**
  - **Tessellation** emits a facet face's own triangles: area-weighted normals smooth within the face, turned
    over for reversed. A polyline edge is sampled at exactly its knots, so there are no cracks or T-junctions.
  - **Mass** is exact by tetrahedra over the triangles, about the body's centre, in the quadrature pass. A
    facet-only body reports "planar-exact".
  - **Area** is the exact triangle sum.
  - **Transform** maps the positions; an identity map (a rename) shares the arrays; a mirror flips the face's
    sense only.
  - **`faceGeometry`** returns a plane for an exactly flat region and "other" otherwise. It never throws, so
    sketches, mates, glue and sections keep working on flat mesh faces.
  - **Hidden lines** recognise mesh faces by kind as well as by the old name.
  - The **analytic Boolean** and the **general shell** refuse facets at entry.
  - **STEP** writes a facet body as the planar B-rep of its triangles (AP242 tessellated comes in R3.5) and reads
    back with the same volume.
- **Versioned node (D16).** The mesh node takes `representation: 'facets'`. The studio sets it on new imports.
  Nodes without it stay the planar per-flat-group solid, so old documents' `<id>.facetK` names resolve unchanged.
- **F0 fallback (owner, D3), one named path: `FACET_EXPLODE_TRIANGLES = 5000`, `explodeFacets` in part-model.**
  - Booleans, holes and splits on a facet body with at most 5000 triangles go through the planar per-triangle
    B-rep and the exact polyhedral Boolean. R2 timings: a polyhedral union with a box takes 0.94 s at 5k and
    3.2 s at 20k, so 5000 keeps it interactive.
  - Above that, the operation is refused with CAPABILITY: "Booleans on large meshes arrive with F1/F2 (this mesh
    has N triangles; up to 5000 go through the planar path)".
  - Fillets, chamfers and drafts on mesh faces are refused with CAPABILITY, because region edge names would not
    survive the planar path; shells are refused through the general shell.
  - The fallback is removed in the step that lands F2.
- **Studio.**
  - Imports are facet bodies.
  - Flat regions show as planes and curved ones as curved (no radius probe).
  - Region edges are drawn as creases, with no per-vertex normal search.
  - The import toast says regions and the 5000-triangle Boolean limit.
  - The 100k triangle cap stays until M1's binary storage (R3.3).

- **Follow-up (peer's adjustments under the delegation, same day).**
  - **A mesh in several pieces opens, one body per piece; it is no longer refused.** Printed kits, figures with
    separate eyes, and scans with floaters are common.
    - `facetBrepsFromTriangles` builds each closed, edge-connected piece, in file order, as its own B-rep:
      body `<id>_part<j>`, faces `<id>.part<j>.region<k>`. Each piece is turned outward on its own (a cavity's
      shell comes in as a solid; R3.4 tells them apart).
    - `facetPieces` counts the pieces and gives each one's triangles and volume.
    - The mesh node records `pieces` (as a STEP import records `solids`). The kernel feature takes `each`, so its
      outputs are `id/j` and the studio keys them `b<k>_part<j>`.
    - The import toast says how many pieces there are and names the tiny ones (under 1% of the largest one's
      volume) as likely stray bits. Removing floaters is R3.4's repair.
    - `facetBrepFromTriangles` (one piece expected) still refuses, saying how many pieces it found.
  - **Two limits instead of one.**
    - Previews: `FACET_PREVIEW_TRIANGLES = 5000`, about a second (R2: 0.94 s at 5k), so a preview stays live.
    - Committed evaluations: `FACET_EXPLODE_TRIANGLES`, first 20000 (R2: 3.2 s at 20k against 409 s before R2;
      that is what D3 meant by keeping Booleans on small meshes). D43 lowers it to 16000 after profiling.
    - The studio worker passes the preview limit (`evaluateCadPart(doc, cache, {facetExplodeTriangles})`).
      Between the two limits a preview is refused with "… not previewed (this mesh has N): apply to run it (up to
      20000)". Above 20000, every evaluation is refused with "Booleans on large meshes arrive with F1/F2".
    - In the browser, an 18k-triangle sphere drilled through takes 9.7 s.
  - **Long computations can be stopped.** After a second, a "Working… Cancel" bar shows at the top centre (not
    under the toasts). Cancel ends the worker and starts a new one (`EngineClient.restart`, caches empty); every
    waiting request is refused "Stopped", and the change that started it is taken back (undo).
  - **The typed-array path (part of R3.2, done here).**
    - A mesh feature may carry `Float64Array`/`Float32Array` positions and `Uint32Array` indices.
    - Admission no longer JSON-copies the document: mesh arrays are shared as they are, never frozen, checked
      once per array object, and keyed for reuse by a hash worked out once per array.
    - `save()` writes them as plain arrays.
    - The studio turns a node's arrays into typed arrays once per node array; the worker keeps nodes by identity
      (wireDoc), so an unchanged mesh is reused, not re-hashed.

Why:
- F0 is the base of the mesh-body roadmap (F1, F2, SubD, QEM). A face per triangle made a 200k mesh unusable.
- The kind-tagged union lets the compiler find every place that assumed a surface.
- The fallback keeps today's STL Booleans working, as the owner required.

Evidence:
- Follow-up:
  - Kernel facet tests 8/8. The new pieces test: a box and a floater give 2 bodies `k_part0/1` with per-piece
    names; in a part, outputs `m/0` and `m/1`; typed arrays are not copied, are saved as plain arrays, and the mesh
    is reused on re-evaluation.
  - The 6240-triangle hole is made committed and refused as a preview; 25 280 triangles are refused naming
    F1/F2.
  - Conformance: `r3/sphere-hole` (6240 triangles, committed, genus 1) replaces the refused case; 31/31 pass.
  - Studio 289/289, with a pieces test (`b0_part0/1`, `n0.part1.region*`, 7 mm³ each).
  - Browser flow 107/107.
    - A kit STL (a sphere and a floater) opens as 2 bodies with "1 of the pieces is tiny".
    - A part with a hole through an 18k sphere shows "Working… Cancel", and Cancel takes the open back to the
      kit.
    - The STEP step now waits for the bodies as well as the name (a race the new step exposed).
- Kernel `test/facet-brep.test.mjs` (7):
  - box: 6 regions, 12 edges, valid strict, volume 1000, area 700, planes;
  - sphere: halved into 2, volume and centroid exact;
  - cylinder: 3 regions, 2 closed rims of 25 points, tessellated edges exactly the vertices; 26 regions at 10°;
  - transforms: moved, mirrored, and renamed with shared arrays;
  - noisy sphere: capped at 50 regions, exact volume;
  - open, flipped and two-piece meshes refused;
  - part model: faceted versus planar names; hole exact; fillet refused; a 6240-triangle hole refused;
  - STEP round trip.
- Kernel suite 903/904; the one failure is the known environmental demo-spawn test.
- Conformance `conformance/r3` (5):
  - facet box, with STEP round trip;
  - facet frame: genus 1, 10 regions, volume 96, area 192;
  - facet box with a hole: 1000 − 20π;
  - fillet refused;
  - large Boolean refused.
- Studio 288/288, with a new import test (10 plane regions, 7000 mm³; the old planar node keeps `.facetK`). The
  browser STL step passes and the node says facets.
- `MESH_REP=facets pnpm bench:mesh`:

  | Fixture | Before (R1, per-triangle faces) | F0 facets |
  |---|---|---|
  | 200k | convert 10.5 s, display 3.8–85 s, 2.2–2.6 GB | convert 0.2 s, display 76 ms, exact mass 53 ms, RSS 282 MB |
  | noisy scan 200k | — | 449 regions, 0.26 s |
  | 1M | 84 s + 32 s, 6.4 GB | convert 1.3 s, display 0.28 s, mass 83 ms, RSS 845 MB |

- Bench within budget (16-hole plate 1.26 s of 3 s).

Next:
- R3.2: BVH point containment and the typed-array path.
- R3.3: M1 binary mesh blob, then lift the 100k cap.
- R3.4: M3 import repair.
- R3.5: AP242 tessellated STEP.

## D43 — Points against facet bodies through a BVH; the stitch and coplanar merge indexed; the committed mesh limit 16000 (2026-10-18, R3.2)
Decided:
- **`classifyPointInFacets(brep, point, tol?)`** returns inside, outside or on.
  - It is the parity of a ray's crossings with the body's triangles. The rays go through a BVH over all facet faces
    (median split on the longest centre extent, flat typed arrays), built once per B-rep (`facetBvh`, a WeakMap).
  - A ray that grazes an edge, a vertex or a triangle seen edge-on says nothing, and the next of eight fixed
    irrational directions is tried. Three clean rays vote: two agreeing settle it.
  - A point within the tolerance of a triangle (by plane distance and barycentric slack; default 1e-9 of the
    body's size) is "on".
  - A body with non-facet faces is refused (typed GEOMETRY).
  - The search allocates nothing per triangle or per ray; its stack grows only when needed.
  - It is the containment F1's facet Booleans will use. The studio's Point test keeps its display-mesh answer.
- **The 9.7 s hole (peer's request), profiled.**
  - A hole's tool is a cylinder, so the exploded mesh went through the analytic Boolean, not the polyhedral path
    R2 measured.
  - Two quadratic steps dominated, and both are now indexed. Semantics are unchanged, as the identical RB rows
    show.
    - The stitch tested every vertex against every curve (about 9k × 54k). A uniform grid over the vertices
      (about two to a cell) now gives each curve only the vertices in its box widened by the tolerance: a line's
      ends, an arc's circle, a traced curve's sampled box. That is exactly the set `onCurve` could accept. A
      curve spanning most of the body falls back to every vertex.
    - `mergePieces` grouped coplanar pieces with a linear search. Planes are now bucketed by quantized facing
      normal and offset; a piece checks its own and the neighbouring buckets (3⁴) and joins the earliest group it
      matches, as before.
    - `loopVectorArea` takes straight and polyline edges by their corners, which is exact, instead of 16 samples.
  - The kernel time for the 18k hole fell from 10.8 s to 4.1 s. In the studio's whole evaluation (Boolean, mass
    and display), as the worker runs it:

    | Mesh | Time |
    |---|---|
    | 12k | 3.6 s |
    | 15.9k | 4.8 s |
    | 18k | 5.1–5.4 s |
    | 20k | 6.1 s |

  - **`FACET_EXPLODE_TRIANGLES` is now 16000:** about 5 s at the worst, a hole. A polyhedral union with a box is
    faster.
  - The 5000-triangle preview limit and the Cancel bar stay.
  - Not contained: the analytic Boolean's cutting of a cylinder against thousands of planes (about 1.1 s) and the
    checks (about 1 s). These go with F1/F2, which replace the explode path.

Evidence:
- Kernel facet tests 9/9. The new classification test:
  - box: inside and outside; on a face, an edge and a corner; 1e-6 above the box is outside; points level with
    edges are told apart;
  - sphere: 2000 random points agree with the distance from the centre (outside a 0.2 mm band);
  - frame: the hole is outside, the wall inside;
  - a planar B-rep is refused.
- Kernel suite 910/911; the one failure is the known environmental test.
- RB rows are identical to before the change (the known graze TODOs only). All property tests are ok.
- Bench, classification:

  | Mesh | BVH build | 1000 points | Wrong |
  |---|---|---|---|
  | 199k triangles | 71 ms | 5.4 ms | 0 |
  | 998k triangles | 249 ms | 6.9 ms | 0 |

- Studio 289/289. The browser cancel step uses a 15.9k sphere, under the limit, and its Cancel still takes the open
  back.

Next: R3.3, M1 — a binary mesh blob in .bcad, then lift the 100k cap.

## D44 — M1: mesh arrays as SHA-256 blobs; the .bcad container; recovery blobs in IndexedDB; the mesh cap lifted to 2M (2026-10-18, R3.3)
Decided (container design per the peer, under the delegation):
- **Blobs.** A mesh node names its arrays: `blob: {positions, indices}`, the SHA-256 (WebCrypto, browser and Node)
  of each array's bytes.
  - The arrays live in a blob store (`engine/blobs.ts`): `Float64Array` positions, `Uint32Array` indices.
  - The document stays small whatever the mesh, so undo copies, the recovery copy, the worker wire and JSON
    comparisons stop carrying megabytes.
  - Identical arrays are one blob (nodes, undo steps, pieces).
  - The store keeps every blob of the session; nothing is evicted.
  - New imports are blobs. Inline nodes (`positions`/`indices`, files from before M1) still evaluate and open as
    before.
- **The .bcad container (`engine/container.ts`), our own, no dependencies.**
  - A document naming no blobs is written as plain JSON, as always.
  - One that names blobs is written as:
    - a header: `BCADPACK` · u32 version 1 · u32 chunk count;
    - chunks: u32 header bytes · u32 payload bytes · UTF-8 JSON header · payload, each padded to 8 bytes, so arrays
      map aligned;
    - chunk 0 is `{kind: 'document'}` with the JSON;
    - then `{kind: 'blob', sha256, dtype: 'f64' | 'u32', count}` with the raw little-endian bytes.
  - No base64 and no compression in the file.
  - Reading:
    - checks each blob's SHA-256 against its name ("does not match its hash: the file is damaged");
    - refuses a cut-short file, or one from a newer container version;
    - refuses a document naming blobs it does not hold.
  - Saving a document whose blob is not loaded is refused, not written incomplete.
- **Where blobs travel.**
  - Worker: `WireSender` sends each blob once, beside the nodes. A restarted worker gets them again.
  - Chat server: the turn's JSON carries the document's blobs as base64; the MCP process checks them and puts them
    in its store. The document still names them, so the chat's result keeps blob nodes.
  - Templates (they stand alone in localStorage): written back inline, and refused if a blob is missing.
- **Recovery.** The localStorage copy names the blobs, and the blobs go to IndexedDB (`studio.blobs`, keyed by hash)
  beside it. Restore loads them first; if they are gone it says so and does not restore a part it cannot build.
  Saving or discarding garbage-collects the IndexedDB blobs.
- **The cap.** `CadPartLimits.meshTriangles` is now 2,000,000 for facet meshes, lifted after the browser round trip
  below. Planar mesh solids (old nodes, a B-rep face per flat group) keep 100,000 as `planarMeshTriangles`. The
  Boolean limits of D43 (16000 committed, 5000 preview) are unchanged.

Why: a mesh's arrays were the document — 55 MB of JSON at 1M triangles, copied through every undo step, recovery
write and wire message — and the reason for the 100k cap.

Evidence:
- Studio 293/293. `test/container.test.ts`:
  - The fixture pair `test/fixtures/block-inline.bcad` (plain JSON, inline) and `block-container.bcad` (blobs) open
    as the same bodies, volumes and face names (7000 mm³).
  - inline → blobs → container → read gives the same summary; inline again (templates) gives the old file's part.
  - Two nodes with one mesh are deduplicated to 2 blobs.
  - A flipped byte is refused by hash; a ghost blob is refused on open and on save; version 9 is refused; a
    cut-short file is refused.
  - The wire sends blobs once; base64 round-trips and an altered blob is refused.
- Browser flow 108/108. The new step:
  - an STL opens as blobs;
  - unsaved, it is reloaded and restored from the IndexedDB blobs;
  - saved as `BCADPACK`, it reopens as the same 7000 mm³ body.
- Kernel 910/911; the one failure is the known environmental test. Lint clean.
- `test/bench-mesh-browser.mjs` (Chromium, headless WebGPU). Read is from file to the units dialog; open includes
  the blobs, evaluation and display.

  | Mesh | Read | Open | Save | File | Old inline JSON | Reopen |
  |---|---|---|---|---|---|---|
  | 200k | 0.18 s | 0.66 s | 0.06 s | 4.6 MB | 10.5 MB | 0.64 s |
  | 1M | 0.64 s | 3.5 s | 0.21 s | 22.9 MB | 55.3 MB | 3.3 s |

Next:
- R3.4: M3 import repair — weld, orient, own Liepa hole fill with fairing, degenerate and floater removal, with a
  diagnostics badge.
- R3.5: AP242 tessellated STEP.

## D45 — Chat sends each blob once per conversation; positions stored at their source precision (2026-10-18, R3.3b)
Decided (peer's follow-ups under the delegation):
- **Chat: blobs once per conversation.** The studio gives each conversation a blob session (a random id, renewed by
  New conversation) and remembers which hashes it has sent.
  - A turn names all of its document's blobs (`blobRefs`) and carries only the unsent ones (`blobs`, base64).
  - The chat server checks each blob's SHA-256 when it arrives (`node:crypto`; refused with 400 if it does not
    match), and keeps it on disk for the conversation (`blobs-<session>/<hash>.<dtype>`): the last four
    conversations, an hour unused at most.
  - The MCP process reads the kept files (`blobFiles` in the state file).
  - A turn naming blobs the server lacks (another conversation, a restarted server) is answered 409 with the
    missing hashes. The studio sends those once and retries.
- **Positions at their source precision.**
  - Blobs carry a `dtype` (`f64`, `f32`, `u32`).
  - Positions are stored as `f32` when every value is single precision: an STL's are, kept as `Math.fround` of the
    scaled value, with no 1e-6 rounding. Otherwise they are `f64`: an OBJ with any coordinate that does not round
    trip through f32.
  - The kernel widens on read (the mesh feature takes `Float32Array`; facet patches stay `Float64Array`), so
    geometry is as before.
  - Container chunks, IndexedDB, the wire and chat carry the dtype.
  - The import's welding key still rounds to 1e-6 mm.

Evidence:
- Studio 294/294.
  - The fixture pair is regenerated: `block-container.bcad` is 1264 bytes (1456 before), and opens to the same 7000
    mm³ and names as the inline file.
  - The chat test:
    - a first turn with blobs gives 200;
    - a second turn naming them only gives 200, both reading the kept f32 and u32 files;
    - another session gives 409 with both hashes;
    - a mismatched blob gives 400.
- Browser steps (STL, pieces, container, chat) pass. Lint clean.
- Chat with a 1M mesh, measured on a local server:

  | Turn | Body | Client encoding | Round trip |
  |---|---|---|---|
  | Before: every turn | 22.9 MB | 340 ms base64 | — |
  | Now: first turn | 22.9 MB | 340 ms base64 | 56 ms |
  | Now: later turns | 0 MB of blobs | none | 9 ms |

- Container sizes (`test/bench-mesh-browser.mjs`):

  | Mesh | File | Before (f64) | Old inline JSON | Open | Reopen |
  |---|---|---|---|---|---|
  | 200k | 3.4 MB | 4.6 MB | 10.5 MB | 0.68 s | 0.64 s |
  | 1M | 17.2 MB | 22.9 MB | 55.3 MB | 3.4 s | 3.2 s |

  The 1M file is positions f32 (6 MB) plus indices u32 (12 MB). The peer estimated about 15 MB.

## D46 — Mesh diagnosis and repair as explicit steps; fill patches as faces; open sheets said so; crossings refused (2026-10-18, R3.4a)
Decided (repair as a recorded step, per the peer under the delegation; this is the kernel part, the studio follows
in R3.4b):
- **`diagnoseMesh(positions, indices)`** changes nothing. It counts:
  - welded corners, degenerate and duplicate triangles;
  - edges of more than two triangles;
  - two-triangle edges run the same way;
  - holes (each with its edge count, perimeter and centre);
  - pieces with their volumes, and floaters (under 1% of the largest);
  - self-intersections.
  
  It also says whether the mesh is closed as it is.
- **`repairMesh(positions, indices, steps)`** takes explicit steps (`DEFAULT_REPAIR`: all on, floaters under 1%) and
  returns new arrays, a report of what each step did, and per triangle the fill patch it belongs to. The caller keeps
  the original; the studio stores the result as its own blob (R3.4b).
  - **weld:** numeric cell hashes (the facet builder's).
  - **degenerate:** a repeated corner, no area at the weld size, or the same three corners twice either way round.
  - **fins:** at each edge of more than two triangles, the pieces (through two-triangle edges) meeting there other
    than the largest, when open or enclosing no volume.
  - **orient:** breadth first across two-triangle edges, each neighbour turned to run the edge the other way; then
    each closed piece outward. Both kinds of turn are counted.
  - **fill:** our own Liepa fill.
    - A minimum-area triangulation by dynamic programming (O(n³), up to 120 corners); past that, an ear clipping in
      the loop's Newell plane.
    - Liepa's refinement: a triangle is split at its centroid when √2 × the distance to each corner exceeds both
      densities.
    - Relaxation by Delaunay flips (opposite angles past π), on an incrementally kept edge map and a work queue.
    - Umbrella fairing of the new vertices (30 rounds, the rim fixed).
    - A safety cap of 64 × the initial triangles + 20000.
    - Holes can be skipped by number. Reported: holes filled and left, fill triangles, the largest perimeter, the
      area added.
  - **floaters:** closed pieces under `minFraction` of the largest volume (reported with their volume), or kept
    (`floaters: false`).
  - After the steps, the report says whether the result is closed and manifold, and how many self-intersections
    and non-manifold edges remain.
- **Fill patches are faces of their own.** `facetBrepFromTriangles(…, {groups})`: regions do not cross a group's
  edge and are not merged across it, and a group k's faces are named `<prefix>.fill<k>.region<f>`. The studio can
  then show the guessed surface as what it is.
- **Open sheets are said so, never faked.** `{open: true}` (the mesh node's `open`) takes an open mesh as a `sheet`
  body: an open shell, boundary edges with one use, corners along an open boundary counted as if it had a twin. Then:
  - its mass refuses: "an open mesh (a sheet) encloses no volume";
  - Booleans refuse: "… need a closed solid: this mesh is open (a sheet)".
  
  Without `open`, an open mesh is refused as before.
- **Self-intersections are reported, not repaired.**
  - Found with a uniform grid over triangle boxes (a cell about twice a mean edge; each pair tested once, in the
    first cell the two share) and an exact-enough segment–triangle test (strict interior; shared corners skip).
  - The count and up to 64 positions are given.
  - A Boolean on a facet body that crosses itself (checked when the F0 path explodes it) is refused with GEOMETRY
    "… need a mesh that does not cross itself: this one does in N places (near x, y, z); repair does not fix that
    yet".
  - Repairing crossings (remeshing the intersection curves) is out of scope until F3 (facet × facet).

Evidence:
- Kernel `test/mesh-repair.test.mjs` 8/8:
  - clean box: nothing reported;
  - square hole in a flat top: 1 hole of 30 mm perimeter; filled flat to exactly 1000 mm³ with 50 mm² added; the
    patch is its own face `m.fill0.region*`; skipped, it is open and builds only as a sheet;
  - spherical cap hole: refined past its rim, closed, volume between the open mesh and the whole;
  - 3 flipped triangles and a fully inside-out mesh: counted, exact volume;
  - fin, degenerate and duplicates: 1 fin, 2 degenerate, 2 duplicates, closed, exact;
  - floaters: 3 of 1 mm³ each dropped (3 mm³), the 216 mm³ piece kept;
  - a box with a corner pushed through its bottom: crossings found and a hole refused;
  - open sheet: no mass, no hole.
- Studio `test/mesh-repair-corpus.test.ts` runs the M0 broken set on the 20k organic torus:
  - hole: 1, filled, volume within 1%;
  - flipped: 50, exact;
  - non-manifold: 1 fin, exact;
  - degenerate: 10;
  - shells: 4 pieces, 3 floaters, 24 mm³;
  - self-intersect: crossings found.
- Conformance `r3` 34/34, with three new cases (which RB runs too):
  - `mesh-filled`: the repaired box with its fill group, 1000 mm³ and 700 mm² exactly, watertight;
  - `mesh-crossing-hole-refused`;
  - `mesh-sheet-hole-refused`.
- Kernel suite 921/922; the one failure is the known environmental test. Studio 295/295.
- Bench, a sphere with a cap off:

  | Mesh | Diagnose | Repair | Fill added |
  |---|---|---|---|
  | 11k | 39 ms | 74 ms | +1812 triangles |
  | 196k | 0.42 s | 1.5 s | +45k triangles |
  | 991k (1000-edge hole) | 2.4 s | 9.2 s | +212k triangles |

  At first the relaxation made one swap per pass and the closing check copied the index array per edge (22.9 s at
  11k); both are fixed.

## D47 — The mesh repair gate: checked in the worker, repaired as a recorded step, badges for what was guessed (2026-10-18, R3.4b)
Decided (per the peer's R3.4 guidance, under the delegation):
- **Checked first, in the worker.** Opening an STL or OBJ, the worker diagnoses it (`engine.diagnose`) behind the
  "Working… checking the mesh" bar, which can be cancelled.
  - A clean mesh opens as before.
  - Anything a step would change (open, degenerate or duplicate triangles, floaters), or crossings to report, opens
    the repair gate instead.
- **The gate (`ui/MeshRepairPanel.tsx`).**
  - It shows what was found and the steps: degenerate and duplicates, fins, orient, fill, and floaters under 1%.
    All are on by default and each can be turned off.
  - Holes are listed by size, largest first (8 with ticks; the rest follow the fill tick). A coarser fill (half the
    rim's resolution, `fill.coarseness: 2`: about a quarter of the triangles) can be chosen.
  - **Check the repair** runs it in the worker. The bar names its stage (weld, fins, orient, fill k of n, floaters,
    check) and can be cancelled, leaving nothing changed.
  - The report comes before anything is applied: corners welded, triangles dropped, fins, triangles turned, holes
    filled with how many triangles and the area added, tiny pieces and their volume, and whether the mesh closes
    (or opens as a sheet).
  - "Open as it is" is offered only when the mesh is closed as it is.
- **The repair is a recorded, reversible step on the mesh node.**
  - The node keeps its import's `blob`. `repair: {steps, result: {positions, indices, fill}, report}` names the
    result's own blobs; `fill` is an `i32` blob giving each triangle's patch.
  - The kernel feature takes the result with its fill groups, so fill patches are faces of their own. If the mesh
    is still open, it is taken as a sheet (`open: true`).
  - Opening the repair again (its badge) diagnoses the import anew with the steps as they were. Applying replaces
    the record. "Remove the repair" is offered when the import is closed on its own; an open import would not build.
  - Undo takes any of these back. Crossings are kept on the node (`crossings: {count, at}`).
- **Badges on the mesh body** in the Browser:
  - "repaired · N mm² filled": its tooltip is the report; clicking it selects the filled faces in the viewport and
    opens the repair;
  - "open sheet" when the repair could not close it;
  - "crosses itself · N": clicking it marks the crossing places as points in the viewport.
- The open toast says a repaired mesh's filled area and pieces, a sheet's limits, crossings, and tiny pieces kept.
- **Kernel additions.** `fill.coarseness` scales each rim density, so refinement stops at longer edges.
  `repairMesh(…, progress)` names its stages. `MeshDiagnosis.selfIntersectionAt` gives up to 64 crossing places.

Evidence:
- Kernel 922/923; the one failure is the known environmental test. The new mesh-repair test checks:
  - coarseness 2 gives 15–45% of the default's fill triangles;
  - the stages come in order (weld, fins, orient, fill 1 of 1, floaters, check).
- Studio 296/296. The recorded repair on the M0 broken hole:
  - 5 blobs: the import plus the result;
  - the fill is its own face and the volume matches the repaired arrays;
  - the container round trip keeps it;
  - without the record the open import is refused, not faked closed.
- Browser flow 109/109. The new step:
  - a sphere with its cap off gives 1 hole, and no "Open as it is";
  - with the coarser fill checked, the report reads "1 hole filled with N triangles … Closed";
  - applied, the node keeps its blob and a repair with `coarseness: 2`;
  - its badge "repaired · 78 mm² filled" selects the filled cap (a 77.65 mm² planar face) and reopens the repair as
    it was.
  
  The kit step now passes through the gate (its floater is a finding) and opens as it is.
- Lint clean.

## D48 — AP242 tessellated STEP: mesh bodies written tessellated or as planar faces; tessellated files read as facet faces; mesh-only files through the repair gate (2026-10-18, R3.5)
Decided (per the peer's guidance under the delegation):
- **Export option `meshes`: 'auto' | 'tessellated' | 'planar'.**
  - **Tessellated (AP242, compact).** Each mesh body is written as one `COORDINATES_LIST` (its faces' corners, shared
    ones once). Each facet face becomes a `TRIANGULATED_FACE` carrying its own name, with corners by number into the
    list and triangles wound outward. The body is a `TESSELLATED_SOLID`; an open sheet is a `TESSELLATED_SHELL`.
    These sit in a `TESSELLATED_SHAPE_REPRESENTATION`. If the file also has B-rep solids, that representation is
    related to their advanced B-rep one by `SHAPE_REPRESENTATION_RELATIONSHIP`. The schema is then AP242, and AP214
    stays for files without meshes.
  - **Planar faces (compatible).** The triangles become planar B-rep faces, merged where flat; any reader takes them.
  - **Auto** (the default) writes planar up to `MESH_PLANAR_TRIANGLES = 5000` triangles a body and tessellated above.
    Planar costs about 1 kB a triangle and tessellated about 0.05 kB (measured: 194 MB against 9.4 MB at 200k), so
    5k triangles is about 5 MB as planar faces. Small meshes stay readable by older CAD, CAM and slicers, and large
    ones stay writable.
  - Planar faces are refused past `MESH_PLANAR_LIMIT = 250000` triangles a body: about 250 MB of text, near what one
    string can hold (1M overflows it). The refusal says to write tessellated.
  - Validation properties (volume, area, centroid, box) are written in both modes, for mesh bodies too.
  - **Studio:** Export STEP on a part with mesh bodies asks "Mesh bodies in the STEP file as…" (Auto, Tessellated, or
    Planar), explains the trade-off, and remembers the answer in this browser.
- **Import.** `TESSELLATED_SOLID` and `TESSELLATED_SHELL` with their `TRIANGULATED_FACE`s (coordinates lists shared
  or per face, `pnindex` or direct corners) come in as facet bodies.
  - Each triangulated face keeps to a face of its own, named as in the file. Repeated names are numbered; a group
    that splits gets `#n` (the facet builder's new `groupName`).
  - A mixed file (B-rep solids and tessellated bodies, the convergent case) comes in as both, in one B-rep.
  - A tessellated solid that does not close, or a tessellated shell, comes in as an open sheet. It is never closed
    by guessing.
  - Not yet: `COMPLEX_TRIANGULATED_FACE` and strips/fans (refused by name).
- **Mesh-only files through the gate.** `stepMeshes(text)` gives a file's meshes when it holds no B-rep solid (scan
  data, other systems' AP242 exports). On open, the studio reads them in the worker, scales them by the file's unit,
  and diagnoses them.
  - Closed and clean, the file imports as before (an import node, its faces' names kept).
  - Otherwise it opens the repair gate as an STL does, and becomes a mesh node with its repair (D47).
  - Pending (reversible default): a mixed file whose tessellated body is open imports that body as a sheet. Its
    repair from the gate would need the import split into a mesh node beside it, which is left for when that comes
    up.
- **A fix found on the way.** The STEP reader spread a shell's faces into one `push(...)`, which overflowed the stack
  past about 100k faces (a big planar mesh file). It now pushes them one at a time. The repair's floater pass had the
  same spread; fixed too.

Evidence:
- Kernel `test/step-tessellated.test.mjs` 4/4:
  - tessellated round trip: an AP242 schema, 3 triangulated faces, no advanced faces; read back valid with the same
    face names, volume, area and centroid to 1e-9; the validation-property volume agrees;
  - auto: planar for a small mesh, tessellated for 6240 triangles; planar more than 10× larger; both read back;
  - mixed plate and mesh ball: 2 bodies, the volume sum to 1e-6; `stepMeshes` gives null;
  - another system's open quad shell: a sheet with face `top`; `stepMeshes` gives its 2 triangles.
- Kernel suite 926/927; the one failure is the known environmental test. Studio 296/296.
- Browser flow 110/110. The new step:
  - Export STEP on the repaired cup asks; tessellated is AP242 with triangulated faces;
  - opened again, it is the same 4022 mm³ body;
  - a mesh-only STEP pyramid without a base goes through the repair gate (1 hole) and becomes a closed mesh node.
- Lint clean.
- Organic torus fixtures, Node:

  | Mesh | Tessellated | Planar |
  |---|---|---|
  | 200k | 9.4 MB; write 0.2 s, read 0.4 s; volume exact | 194 MB; write 9.6 s, read 10.2 s; 199,712 faces |
  | 1M | 49.9 MB; write 0.7 s, read 3.2 s; volume exact | past the string limit (now refused, with the reason) |

R3 is done: F0 facet faces (D42), point classification (D43), M1 container (D44–D45), M3 repair (D46–D47), AP242
tessellated STEP (D48). Next on the roadmap: R4, F1 (facet × plane split and section with an exact planar cap).

## D49 — STEP size caps: 32 MiB of B-rep, 64 MiB when the rest is tessellated meshes (2026-10-18, R3.5 follow-up)

The peer found that our own 1M-triangle tessellated export (49.9 MB) could not be opened again. The import feature
refused any STEP text past `CadPartLimits.stepBytes` (32 MiB), and the studio's Open STEP of a closed, clean mesh
file goes through that feature. Only an unclean mesh file went the other way, through the repair gate as a mesh
node, and that path had no cap at all.

Measured on the organic torus fixtures, exported tessellated, in Node 22. Peak RSS is sampled every 5 ms.

| File | importStep | Part import (+ names) | Studio gate in one process (stepMeshes → diagnose → part → mass) |
|---|---|---|---|
| 200k, 9.4 MB | 0.5 s, 283 MB | 0.5 s, 405 MB | 1.1 s, 408 MB |
| 1M, 49.9 MB | 3.2 s, 803 MB (base 207) | 3.3 s, 885 MB | 6.1 s, 1284 MB |
| 2M, 101.6 MB | 6.7 s, +316 MB over a 1.19 GB base | 7.0 s, 1825 MB | not run (est. about 2.5 GB) |

The 2M file was built in memory: the disk was full. Its base therefore includes the generator; its peak is the
number to read.

A tessellated file costs about 13× its text while read into a part. The 32 MiB note for B-rep files gives about 17×.

Decision (a reversible default; the owner's call is pending, see the README):
- **The rule.**
  - `CadPartLimits.stepTessellatedBytes = 64 MiB` caps the whole text.
  - What is not tessellated must still fit `stepBytes` (32 MiB).
  - So B-rep files keep their cap, and a mixed file may exceed 32 MiB only by its meshes.
- **How "tessellated" is measured.**
  - `stepTessellatedChars(text)` is a scan with no parse.
  - It counts the characters from each `COORDINATES_LIST(` or `TRIANGULATED_FACE(` (COMPLEX_ alike) to the next
    `;`.
  - A `;` inside a quoted name cuts the count short, never long.
  - Our files score 0.9997.
- **Where it applies.** `stepSizeProblem(text)` returns the reason or null. It is checked:
  - before the part import reads the file;
  - in the studio worker, before `stepMeshes` parses it.
  - The worker also skips that parse when the file has no tessellated record. Before this, a B-rep file was parsed
    twice on Open STEP.
- **What the studio shows.** The worker's refusal is shown directly: "Could not open this file: The STEP file is
  larger than 64 MiB; a mesh that large opens from a .bcad file …". The open part is unchanged.
- **The triangle cap applies to STEP too.** After a read, the facet triangles are counted against `meshTriangles`
  (2M). Before, STEP meshes came in with no triangle limit.
- **Why 64 MiB and not the suggested 128 MiB.**
  - The peer's bar was about 1–1.5 GB in the worker. The whole gate peaks at 1.28 GB at 49.9 MB, and scales about
    linearly.
  - At 64 MiB: about 1.1 GB for the part import, and about 1.65 GB for the gate in one process. In the browser, the
    gate is split across the main thread and the worker.
  - At 128 MiB: about 1.8 GB for the import alone, and about 3 GB for the gate.
  - 64 MiB holds our 1M export with 34% to spare, for writers whose numbers run longer.
  - Meshes from 1.3M up to the 2M triangle cap open from the .bcad container: 17 MB for 1M, binary arrays, 3.4 s in
    the browser (D44).

Not done: an import node keeps its STEP text in the document. It crosses to the worker once (nodes go by id), but it
is saved in the .bcad file as JSON text, and the chat sends it with the document. Recorded as a TODO: keep an import
node's text as a blob, like the mesh arrays.

Evidence:
- Kernel `test/step-tessellated.test.mjs` 5/5. The new test checks three cases:
  - a mesh file padded past 32 MiB inside its coordinates list reads, with the same volume;
  - the same padding outside the meshes is refused: "larger than 32 MiB outside its meshes (32.0 MiB)";
  - past 64 MiB it is refused, pointing to .bcad.
- Kernel suite 927/928; the one failure is the known environmental test. Studio 296/296. Type-check and lint clean.
- Browser flow, STEP and meshes step:
  - the cup padded to 33 MiB opens as an import body;
  - padded to 65 MiB, it shows the refusal, and the part is unchanged.
  - A full run before this step's extension had no other failure; the mesh steps were rerun after it.

**Owner decided 128 MiB (2026-10-18), with the B-rep portion at 32 MiB and the 2M triangle cap unchanged.** Re-measured
at that size with a 2M-triangle export (101.6 MB). Node figures are fresh processes reading the file:

| Path | 2M, 101.6 MB |
|---|---|
| importStep | 7.6 s, 1527 MB peak RSS (base 375 with the text loaded) |
| stepMeshes | 1.9 s, 1348 MB |
| Part import | 7.6 s, 1659 MB |
| Whole gate in one process | 14.4 s, 2380 MB |
| Studio in Chrome, Open STEP | opens in 11.2 s; renderer process peak 3057 MB (base 366) |
| The same for the 1M file | 5.0 s, 1912 MB |

- The Chrome row is a closed, clean mesh, so stepMeshes → diagnose → import, then display. The renderer process holds
  the page, its worker and the uploaded mesh.
- It works in practice; nothing failed. This machine has headroom; a 4 GB browser tab limit would be near at the cap.
- The refusal now reads "larger than 128 MiB; a mesh that large opens from a .bcad file".
- Tests:
  - kernel: 65 MiB opens, past 128 MiB refused;
  - browser flow: the cup padded to 33 MiB and to 65 MiB opens, to 129 MiB is refused, and the part stays.

## D50 — F1: a facet body split by a plane on its own triangles, each side closed by an exact planar cap; oblique splits of planar bodies fixed (2026-10-18, R4)

Before, a split of a mesh body went through F0's explode, to the planar per-triangle B-rep. It was refused past
16,000 triangles (5,000 in a preview), and so was the drawing's section A–A, which is built on the split.

Decision (`splitFacetBrep` in `facet-split.ts`, used by the part model's split for a body of mesh faces only):
- **Vertex sides.**
  - Each vertex's side is decided once, from its distance to the plane.
  - One tie rule: a vertex within the tie distance is on the plane. It is moved onto it and counted above.
  - The tie is twice the weld the sides are built with (1e-6 of the mesh's size). So a cut point is never within the
    weld of a vertex off the plane, and the rebuild cannot collapse a sliver.
  - A triangle wholly on the plane goes to the side it faces away from. A step's face at the cut stays with the
    material it bounds; otherwise it would leave a zero-thickness flange on the other side.
- **Cutting.**
  - Each crossed edge is cut once, cached by its vertex pair, so both triangles at the edge share the point.
  - Faces meet at shared corners, welded once at 1e-12 of the size first.
  - A cut triangle's piece on each side (3 or 4 corners, convex) is fanned.
- **The cap.**
  - It is built from that side's open edges with both ends on the plane, reversed, chained into loops. Where loops
    touch at a corner, the leftmost turn keeps material on the left.
  - Holes come from containment: each hole goes to the smallest material loop that holds it. A loop wound against its
    depth is refused as GEOMETRY ("the cut crosses itself").
  - Each material loop and its holes are triangulated with the kernel's polygon triangulation, from those very
    points. Nothing is added: the cap is the section, exactly planar.
- **Names.**
  - Faces keep their names; a face cut in two is a face on each side.
  - The cap is `<at>.cut.top` below and `<at>.cut.bottom` above, as the analytic split names the box's faces. More
    than one cap face on a side is numbered `#n`.
- **Sheets.** An open mesh (a sheet) splits into two sheets with no cap.
- **No limit.** No explode and no triangle limit. A preview runs the same split.

Found on the way and fixed (contained): an oblique split (a normal not along an axis) of a planar body always failed
"face … is not planar".
- Cause: the half-space tool was a box rotated to the normal, and its quads are not exactly coplanar in binary64. The
  exact polyhedral Boolean refuses that.
- Fix: the tool is now a tetrahedron per side. Its base triangle lies on the plane (inradius 2R about the target's
  centre) and its apex is 4R off it, so it holds everything within R. Both sides use the same three base corners, so
  they share one exact plane.
- Faces are named as before: `<at>.cut.top` / `.bottom`, and `<at>.cut.side<k>` (never on a result).
- The mitre split in the browser flow (normal 1, 1, 0) happened to pass before; a [1, 1, 1] split of a cube did not.

Evidence:
- Kernel `test/facet-split.test.mjs` 6/6:
  - cube splits across, through grid vertices, along Y and obliquely: volumes exact to 1e-9 (370/630, 500/500,
    284/716, 250/750); both sides valid; every cap point on the plane to 1e-12;
  - torus: an annulus cap across the midplane (genus 1, halves to 1e-9); two discs a side through the axis; a tilted
    cut that sums;
  - the stepped block at the step, and at the step + 1e-9 (the tie): 500 and 80, valid;
  - an open sheet: two sheets, no cap;
  - part model, 32,000-triangle torus: axis, flipped normal, oblique; the sum to 1e-9; a miss is SELECTION;
  - D50's fix: a cube split by x + y + z = 12 gives 284/716 with its cap names; the 4 mm slab's corner is 124/6; a
    holed cube split by (1, 0, 1) sums to 1000 − 40π.
- Conformance `conformance/r4/`: 5 cases.
  - facet cube across, where the volumes and centroids are known by hand;
  - facet cube oblique, checked against the exact polyhedral split of the upright cube, an independent path;
  - facet torus annulus;
  - a miss refused;
  - the upright cube's oblique split.
- Kernel suite 938/939; the one failure is the known environmental test.
- Studio 297/297, with a new drawing test: section A–A of a 30,000-triangle torus mesh, past the old limit, gives two
  rings at x ∈ [−25, −15] and [15, 25].
- Browser flow 111/111 in a full run. New step: a 30,000-triangle STL torus opens; the toast says "Splits and sections work at any size";
  Split previews and applies to 2 bodies, the negative half 4,930 of 9,860 mm³. The mitre split still passes.
- Lint and type-check clean.
- Organic torus fixtures, Node:

  | Mesh | Split at z = 0.3 | Volume sum |
  |---|---|---|
  | 200k | 0.3 s | to 3e-11 |
  | 1M | 2.0 s (building the mesh body itself takes 2.0 s) | to 3e-12 |

  Two cap loops; one body a side.

RB found that its STEP round-trip stage marked mesh bodies WRONG on topology. These were R3's `mesh-filled`, a
regression from R3.5 that the R3.5 run missed, and the new R4 cases.
- Cause: `auto` export writes a small mesh as planar faces, and each polyline edge's segments become edges of their
  own. Volume, area and centroid matched; only the counts changed.
- Fix: the stage now takes mesh bodies out tessellated (AP242, faces kept) and checks topology there. The planar
  fallback is held to volume, area and centroid only.
- Result: tessellated round trips keep every case's topology, with the volume exact. Full RB after: 932 rows, 0 NEW,
  the 7 known TODO.

Still with the planar path (explode, 16k): Booleans and holes against mesh bodies. That is F2, next on the facet
track.

## D51 — SD1: a SubD cage as its exact limit surface, bicubic B-spline faces built from the cage's topology (2026-10-18, R5)

Decision (`subdBrep` in `subd.ts`; the part model's `subd` feature; the studio's `subd` node and its "SubD torus"
command):
- **The cage.** Positions, quads counter-clockwise from outside, and optional infinitely sharp creases (pairs of
  vertex numbers). It is stored as the node's own data: no 64-surface limit and no inline surfaces, as `sew` has.
  The part limit is 100,000 vertices and faces.
- **What becomes exact.** Where every vertex is regular, the Catmull–Clark limit surface is exactly the uniform
  bicubic B-spline whose control net is the cage. Each quad takes its 4 × 4 net from its neighbours, placed in one
  frame.
- **Boundaries, creases and corners (OpenSubdiv rules, "edge and corner" boundary interpolation).**
  - Across a boundary or an infinitely sharp crease, the missing neighbours are mirrored phantoms, 2·P(edge) −
    P(inside). Along it, the limit is then the cubic B-spline of its vertices: the crease and boundary rule.
  - With both sides mirrored, a corner is interpolated: the corner rule. That applies to a boundary vertex of two
    edges, and to a vertex whose every edge is sharp.
- **Regular means:**
  - inside: valence 4, and either no sharp edge or two opposite ones (a crease line);
  - on a boundary: 3 edges, or 2 at a corner;
  - or every edge sharp.
- **Refused as CAPABILITY, naming SD2 (R7):** extraordinary vertices (valence ≠ 4), n-gons, darts (a crease ending
  inside the surface), and sharp edges not running straight through.
- **Refused as INPUT:** non-manifold or inconsistently wound cages, unknown vertices, and creases that are not cage
  edges.
- **Faces.**
  - Regular regions are packed into blocks: rows grown along u, then along v, up to 13 × 13 quads (16 × 16 poles, the
    surface limit).
  - A block never wraps onto itself, never crosses a sharp edge, and stops at a quad turned more than 90° from its
    seed's. So each face stays a graph over its plane, which is how the validator tells its side; a 32 × 12 torus
    packed by size alone made one face span 330° of the tube, and the validator misread it.
  - Each block's net is clamped by Boehm knot insertion (knots 0…K).
  - Faces are named `<id>.patch<k>`, after the block's seed quad.
- **Edges.** A face's boundary is cut into runs of cage edges that end at a corner of either face. Each run is made
  once, as the limit curve along it (the net's line averaged across, (1, 4, 1)/6, clamped), so neighbours share it
  exactly. Vertices are the cage vertices at run ends.
- **Body kind.** A solid when the cage is closed (a cage wound inward is turned outward), a sheet when it has a
  boundary.
- **Studio.**
  - "SubD torus" makes a regular nu × nv cage. Its radii are grown so the limit over the cage's vertices sits at the
    ring radius and, across the tube, the tube radius: within 3% of a true torus at 16 × 8.
  - The node holds the cage inline (JSON numbers).
  - The cage editor is SD3 (R8); the chat writes a SubD through the command for now.

Evidence:
- **Kernel `test/subd.test.mjs` 5/5.**
  - Tori 16 × 8, 32 × 12 and 30 × 30: one Catmull–Clark step, written apart in the test, gives the same volume and
    area to 1e-12. All valid, genus 1, poles ≤ 16 × 16.
  - A creased torus (two crease rings) and a bumpy open sheet agree with a Catmull–Clark step the same way. The crease
    ring's edges lie on z = 0, and the sheet passes through its four corners to 1e-12.
  - Exact by construction: a flat 4 × 3 grid has area 1200; an all-creased cube is 1000 mm³ and 600 mm², the same
    when wound inward.
  - Refusals: a plain cube (valence 3), a triangle and a dart are CAPABILITY; a bad vertex, a bad crease and a
    doubled face are INPUT.
  - Part model: patch names; the STEP round-trip volume to 1e-9; a cube cage is CAPABILITY; a split of the SubD
    torus through the analytic path sums to 1e-6.
- **Conformance `conformance/r5/`, 4 cases:**
  - the creased cube (1000 mm³, 600 mm², centroid (5, 5, 5), STEP round trip);
  - the 16 × 8 torus (STEP round trip);
  - the extraordinary cube refused;
  - the dart refused.
- **Suites and RB.** Kernel 947/948 (the known environmental test). RB on the conformance set: 232 rows, all OK.
  Studio 300/300 (new: the SubD torus command).
- **Browser flow 113/113.** New step: "SubD torus" from the palette gives 128 quads and 1 body, the volume within 3%
  of 2π²Rr². A split across X gives 2 bodies.
- **Numbers (Node), a 200 × 100 torus cage of 20,000 quads:**

  | Stage | Time |
  |---|---|
  | Build (128 faces) | 58 ms |
  | Validator | 10 ms |
  | Mass properties | 3.9 s |

  Mass is quadrature over every span: B0's per-span Gauss, 20k spans.
  - **Follow-up, done the same day (the peer asked for it before SD3).** The profile showed 2.26 s of the 3.9 s in
    `validateSurface`, called by `evaluateSurfaceD1` at every Gauss point, plus a constant-axis scan of every pole
    per call.
  - Whole-patch faces (any untrimmed NURBS face, SubD or not) now integrate batched:
    - each direction's basis values and first derivatives at the Gauss points are worked out once per span
      (Cox–de Boor);
    - the poles are kept homogeneous in one array;
    - the u sums are made once per Gauss point in u and reused along v;
    - no evaluator call, validation or allocation runs per point.
  - The Gauss order and the integrand are unchanged.
  - Result: a 20k-quad torus takes 3.9 s → 0.22 s, the volume the same to 3e-16. A 2,048-quad torus takes 35 ms.
  - Kernel 947/948, RB on the conformance set 232/232 OK, the property tests pass, and the SubD Catmull–Clark checks
    still agree to 1e-12.
- **Display, against the analytic (revolved) torus of the same size:**

  | Quality | SubD torus | Revolved torus |
  |---|---|---|
  | 8 | 3,442 triangles, worst turn 17.1° | 2,048, 12.5° |
  | 16 | 11,316, 8.9° | 8,192, 7.1° |

  In line with the analytic torus.

## D52 — F2: Booleans of a mesh body with an exact body, the mesh near the tool alone through the exact Boolean, the tool's faces kept exact (2026-10-18, R6)

Before, a Boolean or hole on a mesh body went through F0's explode: the whole mesh became the planar per-triangle
B-rep, and it was refused past 16,000 triangles.

Decision (`facetBoolean` in `facet-boolean.ts`; the part model's `boolean()` takes it whenever one side has mesh faces
and the other none — union and intersection either way round, difference with the mesh first):
- **Only the mesh near the tool takes part.**
  - The mesh is clipped, as a triangle soup, to a box round the tool by F1's split (`splitSoup`, refactored out of
    `splitFacetBrep`). The box is a tenth of the tool's smallest extent larger. Each step caps the part kept; the
    parts cut away stay triangles, with no body built.
  - That near part becomes planar faces (`brepFromTriangles` with groups) and goes through the exact analytic Boolean
    with the tool: planes, cylinders, spheres, cones and B-spline faces, as it handles today.
- **One soup again.**
  - The near result is tessellated (32 segments a quarter) and joined to the cut-away triangles, the caps dropped.
  - T-junctions along the cut lines are mended: the cuts run one after another, so a piece cut away early lacks the
    corners later cuts add on its line. They lie exactly on it, so each triangle is split there.
  - The soup becomes a facet body. Every face is grouped by its source through tokens, so mesh faces keep their
    names. Crease splitting is off, so a far face is never renamed.
- **The tool's faces get their exact surfaces back.**
  - The sense is chosen by a vote of the five largest triangles.
  - The rim, where an exact face meets the mesh, is a polyline whose corners lie on both. Its edges carry the
    chords' sagitta as their tolerance: L²κ/8 from three corners in a row, which needs no projection (a pole stalls
    one). A single-chord edge takes its midpoint's measured distance, at most half the chord.
- **Mixed bodies go on.** A body holding both kinds goes into further F2 Booleans and F1 splits through the same soup,
  its exact faces tessellated and given back.
- **Refusals.** A mesh that crosses itself is refused as before (D46), checked once per body; 1.06 s at 1M. A sheet is
  GEOMETRY. More than 16,000 triangles near the tool (5,000 in a preview) is CAPABILITY, saying how many.
- **Mesh × mesh stays on F0's planar path until F3.** D3's fallback was to be removed when F2 landed; it is kept for
  this case only. Removing it would take away small STL-with-STL Booleans that work today. The refusal now says "of
  two large meshes arrive with F3".
- **Mass of mixed bodies.** Facet faces used tetrahedra from the centre, exact faces the field F·N. Summed over a
  closed surface they agree; face by face they do not, so a mixed body's volume was off by percent. Beside exact
  faces, facet faces now take the same field, exact on each triangle (the degree-8 rule). All-facet bodies keep the
  tetrahedra.
- **STEP of a mixed body.** It goes out as a mesh body, tessellated (AP242), its exact faces sampled at 64 segments a
  quarter and named. `planar` is refused for it: a sampled face can hold slivers no planar reader takes. RB's round
  trip holds such bodies to 1e-3 and does not compare topology.
- **Found on the way and fixed:**
  - `weldVertices` looked only in a corner's own grid cell, so two corners a hair apart across a cell boundary stayed
    two. It now also looks in the neighbouring cells on the near side, and welds only within the weld distance.
  - `adjacency` used a Map over all half-edges. It now uses a per-vertex typed list, at 1M about twice as fast.

Not done, and why:
- **A robustness limit of the exact analytic Boolean on dense planar faces.**
  - On a 25,600-triangle torus, a cylinder of radius 2 centred on the y = 0 or x = 0 symmetry plane fails "not a
    manifold solid". So does a radius-2 hole at (0.3, 0.2) through a 25k sphere near its pole.
  - It is the analytic Boolean itself: called directly on the exploded torus, it fails the same way, while 0.37 mm
    off-centre it succeeds, and radius 1.5 passes everywhere tried.
  - The failures sit on the rim where it crosses mesh edges in the tool's symmetry plane. Two things were tried
    without effect and not kept: turning the cylinder's seam off the plane, and a tie rule moving mesh vertices off
    the tool's surfaces.
  - F2 refuses these as GEOMETRY with the Boolean's message. TODO (RB5): the analytic Boolean with thousands of small,
    nearly coplanar planar faces.
- **At 1M triangles,** 5 of 8 hole positions succeed (median 4.9 s); the other 3 fail as above. 200k: 8/8, median
  1.2 s. 20k: 8/8, median 0.41 s.

Evidence:
- **Kernel `test/facet-boolean.test.mjs` 4/4:**
  - facet cube with a through hole, blind hole, boss, sphere bite and sphere ∩: volumes to 1e-9 (the bite 7e-6, its
    planar mesh faces bounded by the sampled rim);
  - exact tool faces, mesh names kept; the rim tolerance is the sagitta for 32 segments a quarter;
  - part model on a 25,600-triangle torus: a hole, a second hole on the mixed result (4 exact walls), a split of it
    (sum to 1e-6), a union with a box; box − mesh is F3 CAPABILITY;
  - refusals (near count, sheet);
  - mixed STEP round trip within the sampling.
- **`facet-brep.test.mjs` updated:** holes on 6,240 and 25,280-triangle spheres, previewed and committed; mesh −
  mesh past 16k refused naming F3.
- **Conformance `conformance/r6/`, 4 cases:** facet cube hole (8000 − 180π mm³, centroid (10, 10, 10), genus 1),
  blind hole (8000 − 72π), boss (8000 + 45π), sphere intersection (36π), all to 1e-9. R3's fillet refusal now reads
  "is not supported yet".
- **Suites.** Kernel 955/956 (the known environmental test). RB on the conformance set: 256/256 OK. Studio 300/300.
- **Browser flow,** a new step: a 30,000-triangle ring with a hole opens from a part file in 640 ms, volume 9737 of
  9860 mm³. The stop-a-long-Boolean step now unites two meshes, still F0's path, since a hole is no longer slow.
  - A full run was 113/114. The new step read the properties panel before it changed, so it now waits for the ring;
    it was rerun with its neighbours.

## D53 — R6a.1–2: the involute spur gear's first stage — dimensions, the profile with a measured fit, the solid and bore (2026-10-18, issue #2167)

This follows owner issue [#2167](https://github.com/barocss/barocss/issues/2167) (GEAR-01/02) and its points as the
peer relayed them; they take precedence over the first gear brief.

Decision (`gear.ts`: `spurGearDimensions`, `spurGearProfile`, `spurGear`, `spurGearPairNominal`):
- **Scope of this stage.** External, parallel axes, straight teeth, α = 20°, x = 0. Everything else is refused with
  its code, never approximated:
  - another pressure angle: UNSUPPORTED_GEAR_KIND;
  - x ≠ 0: UNSUPPORTED_PROFILE_SHIFT;
  - an undercut tooth count, z < 2/sin²α ≈ 17.1: UNSUPPORTED_PROFILE_SHIFT, saying the shift that would avoid it,
    x = 1 − z/z_min;
  - more than 200 teeth: INVALID_INPUT;
  - any other root policy: INVALID_INPUT.
- **Formulas.** Textbook involute geometry, with KHK's technical reference cited in the issue as provenance; no
  standard text.
  - d = mz, db = d cos α, da = d + 2m, df = d − 2.5m.
  - s = πm/2 − Δs, where Δs is the gear's `toothThicknessReductionMM` at the reference circle.
  - The half thickness at radius r is ψ(r) = s/d + inv α − inv φ(r).
  - A tooth coming to a point below its tip, or teeth meeting at the root: SELF_INTERSECTION.
- **Flanks.**
  - Each flank is a cubic B-spline of C¹ Hermite pieces on the involute's roll parameter, X(t) = rb(cos t + t sin t),
    Y(t) = rb(sin t − t cos t).
  - It takes the fewest pieces meeting `profileToleranceMM` (default 1e-4·m), at most 5: a side face holds 16 poles.
  - The deviation is measured, as the distance along the circle to the involute at the same radius (a bound), and
    reported apart from any render chord. Past 5 pieces: PROFILE_BUDGET_EXCEEDED, never a looser tolerance.
  - The S0 check: 3 pieces give ≤ 2.6e-5·m and 5 give ≤ 3.7e-6·m, at z 18–200.
- **Root.** The involute is never carried below the base circle. Where the root circle lies under it (z < 42 here), a
  radial line joins them, then the root arc; above, the flank meets the root arc at a corner. Either way the report
  says `rootPolicy: 'schematic-radial'`, `manufacturingValidated: false` and gives the warning
  ROOT_TRANSITION_UNVALIDATED. Tool-generated roots come last (GEAR-05).
- **Solid.**
  - The profile is extruded through the face width by a B-rep built directly: side faces are the curves extruded; the
    end faces are planar with the profile and the bore as loops.
  - Faces: `<id>.flankL#k`, `.flankR#k`, `.tip#k`, `.root#k`, the radial joins `.rootL#k` / `.rootR#k`, `.face0` /
    `.face1`, `.bore#1/#2`.
  - The bore must leave `minimumRimMM` (default 1 m) below the root circle; else BORE_INTERSECTION, giving the
    largest allowed. That is a geometric margin, not a strength claim.
- **Pair, nominal values only.** `spurGearPairNominal`:
  - a = m(z1 + z2)/2 and the speed ratio −z1/z2;
  - the ideal transverse εα by the formula;
  - backlash Δs1 + Δs2 at that centre distance;
  - differing modules or angles: MATE_INCOMPATIBLE.
  - The real pair checks (phase, clearance over a rotation, the usable flank) are R6a.4.

Evidence — kernel `test/gear.test.mjs` 5/5:
- **The issue's fixture (m 2, z 20/40):**
  - d 40, db 37.5877048314 (1e-9), da 44, df 35;
  - a 60, ratio −0.5, εα 1.6351859636 (1e-9);
  - backlash 0.05 + 0.07 = 0.12;
  - MATE_INCOMPATIBLE for module 2.5.
- **Solids** m2 z20, m2 z40 with bore and reduction, m1 z60, m3 z18 with bore:
  - valid;
  - volume equal to the exact profile's area × b, the area by Green's theorem over the analytic involute densely
    sampled, apart from the generator, to within 2z·deviation·flank length·b (observed 4e-7 to 5e-6 relative);
  - names per tooth.
- **Tolerance:** 1e-2 takes fewer pieces than 1e-5; 1e-9 is PROFILE_BUDGET_EXCEEDED. The schematic root is reported.
- **Every refusal code,** with the undercut shift x = 0.298 for z 12 and the largest bore Ø31.
- **STEP round trip:** the same volume to 1e-6, the names kept.
- **Times:** 1–3 ms a gear (z 18–60).

Next: R6a.3 — the part feature (persisted with its generator version), the studio's Gear command, export, and
conformance fixtures from the issue's values.

## D54 — R6a.3: the spur gear as a part feature and a studio command, persisted with its generator version, its report in the body's panel (2026-10-18, issue #2167)

Decision:
- **Kernel feature `spur-gear`.**
  - Fields: module, teeth, faceWidth, bore, thicknessReduction, center, from, profileTolerance, pressureAngle,
    profileShift, and `generator: 'spur-gear@0'`. A generator version the kernel does not know is CAPABILITY.
  - Gear codes map to the part model's: INVALID_INPUT → INPUT; the UNSUPPORTED codes and PROFILE_BUDGET_EXCEEDED →
    CAPABILITY; SELF_INTERSECTION and BORE_INTERSECTION → GEOMETRY. The gear's own code stays in the message
    (`[UNSUPPORTED_PROFILE_SHIFT] …`).
  - The output carries the gear's report as `output.gear`: dimensions, the measured flank deviation and the
    diagnostics.
- **Studio `gear` node and command.**
  - The node holds the parameters and `generator`. The "Spur gear" command (module, teeth 18–200, face width, bore,
    position) has its own generated icon and chat command docs.
  - The feature editor edits module, teeth, face width, bore and "thinner by" (the thickness reduction).
  - The body's panel shows the report as notes: reference, tip, root and base diameters and the tooth thickness; the
    flank fit (deviation, pieces, the tolerance asked); and the warning "Schematic root: not the cutting tool's, not
    validated for manufacturing".
- **Identity.** A changed tooth count changes the topology: faces `.tip#k` and others come and go. References to them
  go through A1.3's re-match or refusal like any feature's; nothing is reassigned silently.
- **Export.** STEP keeps the B-spline flanks exact (the round trip in RB).

Evidence:
- **Conformance `conformance/r6a/`, 5 cases:**
  - the issue's z 20 gear and its z 40 mate with a bore, off-centre. Each volume is the exact profile's area (Green's
    theorem over the analytic involute, apart from the generator) × width, minus the bore, to 1e-5 (the flank fit);
    the centroid on the axis at mid-width; genus 0 / 1; base face names; STEP round trip.
  - refused: a profile shift (UNSUPPORTED_PROFILE_SHIFT), an undercut z 12 (naming x = 0.298), a bore into the rim
    (BORE_INTERSECTION).
- **RB seeds** in `robustness/corpus/parts/`: gear m2 z20; m3 z18 with a bore; m0.5 z200 with a bore; m2 z40 with a
  keyway cut (a Boolean through the B-spline flanks). Every stage OK: evaluate, validate, mass, tessellate, round
  trip.
- **Studio test** (primitives): the command's node; the volume equal to the exact profile less the bore, to 0.05 mm³;
  20 tips, 20 left flanks; the notes with the warning; edited to 30 teeth, 30 tips; z 12 refused naming x = 0.298.
  Studio 301/301.
- **Browser flow,** a new step: "spur gear" from the palette gives one body "Spur gear m2 z20". Its notes show
  "Reference Ø40, tip Ø44, root Ø35" and the schematic-root warning; the top view shows the 20 teeth and the bore.
- Kernel 965/966 (the known environmental test). Lint clean.

Next: R6a.4, the pair checks — compatibility, centre distance and phase, clearance and interference over the full
rotation period with refinement until it converges, the contact ratio from the usable flank, and a gear mate.

## D55 — R6a.4a: spur-gear pair checks — compatibility, working geometry, backlash, the usable contact ratio, and a sweep over the full tooth period (2026-10-18, issue #2167)

Decision (`checkSpurGearPair` in `gear.ts`):
- **Compatibility.** The same module and pressure angle; else MATE_INCOMPATIBLE. Base circles that overlap at the
  given centre distance are MATE_INCOMPATIBLE too.
- **Working geometry at the centre distance a′** (nominal a = m(z1 + z2)/2 by default):
  - α_w = acos(a cos α / a′); working pitch diameters 2a′z/(z1 + z2);
  - the circumferential backlash at the working pitch circle, p_w − s_w1 − s_w2, with s_w = 2r_w(s/d + inv α −
    inv α_w): at the nominal distance Δs1 + Δs2, negative when the teeth jam;
  - the tip clearances a′ − ra1 − rf2 and a′ − ra2 − rf1.
- **Contact ratio, two of them.** The ideal formula, and the one the usable flanks allow. The second keeps the part
  of the line of action where each gear's radius lies between the start of its involute flank, max(rb, rf), and its
  tip; below the ideal, a warning says so.
- **The sweep.**
  - Both gears' exact outlines go in: the analytic involute at 150 points a flank, not the fitted flanks, plus the
    arcs and radial joins.
  - Gear 2 is set with a tooth space facing gear 1, then turned by `relativePhaseDeg`. Gear 1 turns through one tooth
    period, since the configuration repeats every pitch, with gear 2 at −z1/z2.
  - The least clearance comes from 64 samples and from 128, refined by golden section. It is converged when the two
    agree; otherwise a warning says more samples are needed. A few frames are not taken as proof.
  - Where the outlines cross: interference (SELF_INTERSECTION), its depth the deepest point of one gear inside the
    other.
- **Performance.** The sweep compares only segments near the other gear, with bounding-box pruning and no closures in
  the loops: 0.5–0.7 s for a clean pair, 4–5 s when interfering.

Evidence — kernel `test/gear.test.mjs` 6/6. Every value is checked against a formula independent of the sweep:
- **Nominal 20/40:** a 60, α_w 20°, backlash 0, tip clearances 0.5 / 0.5, εα 1.6351859636 = the usable ratio; the
  sweep touches (|clearance| < 1e-5) over the whole period and converges.
- **Reductions 0.05 + 0.05:** backlash 0.1; the least clearance 0.0469846 = 0.1·cos 20°/2, half the normal backlash
  per side, to 1e-5.
- **a′ = 60.5:** α_w = acos(60 cos 20°/60.5) = 21.262849°; the clearance equals backlash·cos α_w/2 (0.1762392); the
  usable contact ratio falls (1.394862).
- **a′ = 59.8:** backlash −0.143255; interference found, its depth −0.0675316 = backlash·cos α_w/2 to 1e-4.
- **A phase error of 1°** with the 0.1 backlash is found as interference.
- Module 3 against 2: MATE_INCOMPATIBLE.

Next: R6a.4b — the gear mate in assemblies (ratio −z1/z2, centre distance and phase from the pair), A3 query
functions (`gear_center_distance`, `gear_backlash`, `gear_contact_ratio`, the interference sweep), and the studio's
rotation preview.
