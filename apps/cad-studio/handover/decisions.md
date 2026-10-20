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

## D56 — R6a.4b: meshing gears — a gear placed and turned by the one it meshes with, the pair's verdict in the panel, gear queries for requirements (2026-10-18, issue #2167)

Decision:
- **Kernel feature (`spur-gear`).**
  - `rotation` (degrees about its axis; tooth 1 on +X at 0).
  - `mesh: { gear, direction?, centerDistance?, phase? }` places a gear beside an earlier spur gear:
    - on that gear's face plane, at `centerDistance` along `direction` (the nominal m(z1 + z2)/2 by default);
    - turned so that a tooth space faces the other's tooth on the line of centres, plus `phase`;
    - following the other's turn by −z1/z2: rot2 = φ + π − π/z2 − (rot1 − φ)·z1/z2 + phase.
  - The other gear is referenced, not consumed: both stay outputs.
  - Another module is refused (INPUT, `[MATE_INCOMPATIBLE]`); a reference that is not a spur gear is REFERENCE.
  - Outputs carry `gearPlacement`: spec, centre, face plane, turn, and for a meshing gear the other's placement.
- **`checkPlacedSpurGears(g1, g2, options)`** takes the centre distance from the two centres and the relative phase
  from the two turns, modulo gear 2's pitch angle; a phase within 1e-9 of a pitch counts as 0, which also lets the
  cache hit. Faces that do not overlap along the axis are MATE_INCOMPATIBLE. The pair checks are D55's.
- **Studio.**
  - The gear node has `rotation?` and `mesh?: GearMesh` (the other gear by node index, renumbered with the history).
  - `usesOf(node)` — `parentsOf` plus the meshed gear — guards delete, move and dependents. The other gear cannot be
    deleted from under the follower or moved after it.
  - `parentsOf` is unchanged, so a body's own line stays its own: its look, its steps, Duplicate.
  - Suppressing the other gear takes the follower with it.
  - Command **Meshing gear** needs one spur gear selected (as made), with teeth (default 2 × z1), direction and bore;
    module, face width and thickness reduction come from the selected gear.
  - Edit fields: Rotation for a free gear; Direction, Centre distance and Phase for a meshing one.
- **The panel.**
  - A meshing gear's notes give the centre distance, ratio, backlash and contact ratio, then the verdict: "Clear over
    a full tooth period (checked in N ms)", or a warning that the teeth cross, with where and at which phase.
  - The verdict comes from `checkPlacedSpurGears` in verdict mode, which stops at the first crossing; the kernel
    caches it by both gears, centre distance and phase.
  - **Rotation preview:** editing the driver's Rotation turns the follower with it, re-checked each time.
- **A3 queries:** `gear_center_distance`, `gear_backlash`, `gear_contact_ratio` (verdict mode) and `gear_clearance`
  (the full sweep, minus the depth when the teeth cross). `a` and `b` are the gears' feature ids. A gear built on
  further, such as one with a hole added, is a body, not a gear, here: unknown, with why.

Evidence:
- **Kernel** `test/gear.test.mjs` 8/8. The new test:
  - z18/z18 with 0.05 + 0.05 reductions, the driver turned 7° and the follower at 30°: the exact Boolean intersection
    of the two solids is empty. This is independent of the sweep.
  - For driver turns 0, 7 and 13.25°, the follower stands at 36 mm along 30° (to 1e-12), the placed check gives
    phase 0 and is clear, and the follower's turn changes by −z1/z2 of the driver's.
  - Phase 10° (half a pitch) crosses; refusals for another module, a non-gear and faces apart.
- **Probe (z20/z40, intersection):** empty at phases of 0 and multiples of the pitch, 197 mm³ at half a pitch.
- **Conformance** r6a 7 cases (54 overall): `spur-mesh-pair` (driver turned 5°, follower along 90° with a bore:
  centroid [0, 60, 5], volumes as the single-gear fixtures, the follower genus 1) and `spur-mesh-module-refused`.
- **Studio** `primitives.test.ts` (command, notes, the driver turned and still clear, phase 4.5° crossing, delete and
  move guarded, suppression) and `spec.test.ts`:
  - with 0.1 + 0.1 reductions: centre distance 60, backlash 0.2 within 0.1–0.3, contact ratio ≥ 1.4, clearance
    ≥ 0.05 all pass;
  - an unknown gear is unknown;
  - half a pitch out, the clearance fails at below −1 mm, said as a crossing;
  - a malformed query is refused.
  Studio 303/303; browser flow: the Spur gear step adds Meshing gear (2 bodies, notes "centre distance 60 mm, ratio
  −20:40" and "Clear over a full tooth period (checked in 192 ms)").
- **Timings (m 2, z 20/40, 150 points a flank):**
  - verdict: clean 185–191 ms cold and 0 ms cached; interfering 0–1 ms (it stops at the first crossing);
  - report: clean 650 ms, interfering 4.2–4.5 s.

Limits, recorded:
- The mesh is between gears as generated. A gear moved, or built on, after it was made does not carry its follower.
  The assembly-level gear mate between instances goes to RM1, as a coupled joint (URDF `mimic`, MJCF equality)
  taking ratio, centre distance and phase from `checkPlacedSpurGears` (peer, 2026-10-18).
- The rotation preview is the edit field. The animated turn goes to RM2's joint-slider preview, with the pair
  turning together and the clearance verdict shown.
- Pair checks are per pair; trains are chains of pairs.

Next: R6a.5 — profile shift and rack, then helical.

## D57 — R6a.5a: profile shift — the shifted spur gear and the working centre distance of a shifted pair (2026-10-18, issue #2167)

Decision:
- `profileShiftCoefficient` x from −0.5 to 1. Outside that range: UNSUPPORTED_PROFILE_SHIFT, never clamped.
- The shifted gear is cut by the standard rack (addendum m, dedendum 1.25 m) moved out by x m:
  - ra = r + m(1 + x), rf = r − m(1.25 − x);
  - the reference tooth thickness m(π/2 + 2x tan α), less the thickness reduction.
- The undercut limit becomes z ≥ 2(1 − x)/sin²α. The refusal names the least x for the tooth count:
  1 − z sin²α/2.
- A pointed tip from a large shift on few teeth is SELF_INTERSECTION. The report carries `profileShift`.
- **No tip shortening.** The KHK-style addendum (1 + y − x_mate)m depends on the mate. A gear stays one part: its tip
  is the standard one. The pair checks report the tip clearances, and the sweep finds any tip interference.
  Pending, reversible: a pair-level tip-shortening option.
- **Centre distance of a pair without backlash.**
  - Unshifted: m(z1 + z2)/2.
  - Shifted: m(z1 + z2) cos α / (2 cos α_w), with inv α_w = inv α + 2 tan α (x1 + x2)/(z1 + z2) solved by Newton's
    method.
  - It is `spurGearCenterDistance`, the pair checks' and `spurGearPairNominal`'s default, and a meshing gear's
    default distance.
  - The ideal contact ratio now uses α_w.
- **Studio:**
  - "Profile shift x" on the Spur gear and Meshing gear commands (key `shift`) and in the edit fields;
  - the command's tooth minimum is now 6, the kernel's undercut refusal giving the least x;
  - the notes begin "Profile shift x …" when shifted.

Evidence:
- **KHK's worked example** (m 3, z 12 and 24, x 0.6 and 0.36):
  - a = 56.4999 and α_w = 26.0886° to 1e-4; df1 = 32.1 and df2 = 66.66 exactly; s1 = 3(π/2 + 1.2 tan 20°);
  - the formula's backlash is 0 there, and the exact-profile sweep touches (|clearance| < 1e-5) without crossing,
    converged — the geometry agrees with the inv α_w formula;
  - at 54 mm the shifted teeth jam;
  - the part model places the meshing gear at 56.4999.
- **Volumes** of shifted solids (z 12 at x 0.6, z 24 at x 0.36 with a bore and reduction, z 30 at x −0.3) equal the
  analytic shifted profile's area (Green's theorem) × the face width, within the measured flank deviation.
- **Refusals:** x 1.2 and −0.6 are out of range; 12 teeth at x 0.2 are undercut (below 13.7, x ≥ 0.298); 10 teeth at
  x 1 come to a point.
- **Conformance** 55: `r6a-spur-shifted-pair` is new, with volumes from the exact area within 6e-6; `spur-shift-refused`
  now uses x 1.3.
- **Studio:** the shifted pinion's notes; the meshing gear at x 0.36 at 56.4999 mm, clear. Kernel 972/973 (the known environmental test); studio 304/304.

Next: R6a.5b — the rack (a straight-toothed bar meshing with a spur gear) and its pair checks; then R6a.5c helical.

## D58 — R6a.5b: the rack — the basic rack on a bar, gear-and-rack checks, a rack meshing with a gear (2026-10-18, issue #2167)

Decision:
- **`spurRack(spec)`** (`gear-rack.ts`): the basic 20° rack.
  - Straight flanks; addendum m, dedendum 1.25 m; the tooth πm/2 on the pitch line, less its thickness reduction.
  - On a bar `heightMM` from the pitch line to the back. The back must be at least 2.25 m from the pitch line: the
    dedendum plus a rim of m, a geometric margin, not a strength check.
  - n teeth over n·πm, a half gap at each end. The faces are planes: `.flankL#k`, `.flankR#k`, `.tip#k`, `.root#k`
    (n + 1 of them), `.back`, `.end0`, `.end1`, `.face0`, `.face1`.
  - The root corner is schematic, as for gears. A pointed tooth and meeting roots are SELF_INTERSECTION.
- **Shared extrusion:** the gear's extrusion code became `extrudedProfile`, used by both the gear and the rack, with
  identical output.
- **`checkSpurGearRack(gear, rack, {centerDistanceMM, rackPhaseMM, mode})`** — the gear axis D from the rack's pitch
  line, by default r + x m:
  - **Backlash** p − s_rack − s_gear + 2(D − r) tan α, zero for a shifted gear at r + x m. The working pressure angle
    is α at any distance.
  - **Tip clearances:** D − ra + 1.25 m for the gear's tip, D − rf − m for the rack's.
  - **Contact ratio:** the ideal εα = [√(ra² − rb²) − r sin α + (m − x m − d)/sin α]/(π m cos α), and the usable one
    with the rack's part ending where the gear's usable flank starts.
  - **The sweep:** the gear's exact outline against the rack's straight one over a tooth period, the rack travelling
    r θ and taken as long as the mesh needs. Report and verdict modes and the cache work as in D55.
  - **Touching is not crossing:** a crossing no deeper than 1e-9 m is contact, 0. At zero backlash the straight rack
    flank passes through the involute's sample points to rounding.
- **`checkPlacedSpurRack(gear, rack)`:**
  - D and u come from the rack's frame; the phase is (−u − r θ) mod p, with θ the gear's turn from the direction.
  - Teeth facing away from the gear, or faces apart along the axis, are MATE_INCOMPATIBLE.
- **Part feature `spur-rack`.**
  - Standing alone: origin, angle and from.
  - With `mesh: {gear, direction (default −90°), centerDistance, phase (mm)}`: under the gear, its pitch line at D
    across the direction, its middle gap at the gear's tooth. The direction is counted from the nearest whole tooth
    angle — the same mesh, whole pitches along, so the rack's middle stands at the gear.
  - A meshing rack travels r per radian of the gear's turn, continuously.
  - The other gear is referenced, not consumed. Outputs carry `rack` and `rackPlacement`.
- **Studio.**
  - The `rack` node is guarded by `usesOf`; suppression carries through.
  - **Gear rack** command: on its own, with module, teeth, face width, height and position; with a spur gear selected,
    meshing with it, with teeth, height and direction (module and face width from the gear).
  - Edit fields: Angle when on its own; Direction and Slide when meshing.
  - Notes: length, pitch, tooth and tip; "Meshes with n0: pitch line D mm from its axis, πmz mm a turn, backlash,
    contact ratio", then the verdict with its time.
  - The A3 gear queries take a gear and a rack, either way round.

Evidence:
- **Kernel** `test/gear-rack.test.mjs` 3/3.
  - The rack's volume equals the closed form, bar plus trapezoids, to 1e-9, over three sizes; valid; names; STEP
    round trip.
  - **Checks** (m 2, z 20):
    - D 20: backlash 0, tips 0.5/0.5, touching over the period, not crossing;
    - εα = 1.768824 by the formula, equal to the usable ratio;
    - reductions 0.05 + 0.05: least clearance 0.1 cos 20°/2 to 1e-5;
    - D 20.3: backlash 2·0.3 tan 20° and the clearance backlash·cos α/2;
    - D 19.8: crossing, the depth equal to backlash·cos α/2 to 1e-4;
    - a 0.5 mm slide with 0.1 backlash crosses.
  - A shifted pinion (z 12, x 0.6) at 19.8: backlash 0, touching, and εα by the shifted formula.
  - **Placed** (z 18, D 18; turns 0, 7 and 13.25°):
    - the exact Boolean intersection of gear and rack is empty, independent of the sweep (also probed at 30°);
    - the rack travels 18·θ;
    - the placed check gives phase 0, clear;
    - a 1 mm slide crosses;
    - a rack turned away is refused.
- **Conformance** 57: `rack-m2-n10` (closed-form volume and centroid to 1e-9, STEP) and `rack-height-refused`.
- **Studio** 305/305:
  - a rack alone, its volume exact;
  - meshing with the selected gear: notes, the bar under the gear, the gear turned 10° and the rack 20·10° along,
    still clear;
  - a 1 mm slide is a warning;
  - gear queries on the pair.
  Browser flow: the Spur gear step adds a 10-tooth rack at 180° to the first gear; the panel reads "pitch line 20 mm…
  Clear over a full tooth period (checked in 11 ms)".
- **Kernel** 977/978 (the known environmental test).
- **Timings** (z 20, rack 30):
  - report: clean 37–55 ms, crossing 113–145 ms;
  - verdict: clean 9 ms, crossing 0–1 ms.

Next: R6a.5c — helical gears.

## D59 — R6a.5c: helical gears — normal module, helix angle and hand; the transverse involute turned along the helix (2026-10-18, issue #2167)

Decision, following the peer's conventions:
- **Inputs.** `normalModuleMM` m_n, `helixAngleDeg` β (above 0, at most 45°) and `hand`, named so a spur-style
  module is never misread.
  - `moduleMM` together with a helix angle is refused, naming `normalModuleMM`; a missing hand is refused.
  - `pressureAngleDeg` is the normal one, α_n = 20°.
  - Transverse values follow: m_t = m_n/cos β, tan α_t = tan α_n/cos β, d = z m_t; addendum and dedendum in m_n.
  - The tooth is m_t(π/2 + 2 x_n tan α_n) on the reference circle.
- **Undercut** by the virtual tooth number z_v = z/cos³β against 2(1 − x_n)/sin²α_n. The refusal names the least x.
- **Geometry.** The transverse involute profile turns by z tan β / r as it rises (lead 2πr/tan β; a right hand turns
  counter-clockwise going up +Z). A helix has no exact NURBS form, so the side faces are A(v)·C(u):
  - C is the fitted transverse curve; A(v) is a cubic Hermite fit of the rotation e^{iθ(v)}, exact at the piece ends.
  - The surface lies within the flank deviation plus `twistDeviationMM` at the tip circle (both reported) of the
    involute helicoid.
  - At most four cubic pieces to an axial segment. Longer twists split the faces along the axis (`#k.2`, …); the
    seams are exactly turned profile curves. Past 64 segments: PROFILE_BUDGET_EXCEEDED, never a looser fit.
  - The bore and end faces are unchanged. The report carries `helix` (normal and transverse module, α_t, β, hand,
    lead, twist, its fit, segments, pieces).
- **Pairs.**
  - Equal m_n and α_n, and equal β of opposite hands; anything else is MATE_INCOMPATIBLE, with why (same hand, other
    angle, spur with helical).
  - Centre distance m_t(z1 + z2)/2, or from inv α_wt = inv α_t + 2 tan α_n (x1 + x2)/(z1 + z2) when shifted.
  - The sweep runs in the transverse plane: every section meshes alike, turned along the helix.
  - Reported: εα (transverse, usable and ideal); εβ = b sin β/(π m_n) over the narrower face; εγ = usable εα + εβ.
  - `axialThrust` as words, with no load: a right-handed gear 1 driving counter-clockwise from +Z is pushed toward +Z,
    its mate toward −Z.
  - Placed pairs are compared at the same height (each section turned along its helix).
- **Racks.** The helical rack is not made in this stage: a helical gear with a rack is UNSUPPORTED_GEAR_KIND, and the
  studio command says why. Pending: the rack's hand convention against the reference, which was not retrieved.
- **Part feature `spur-gear`:** `normalModule`, `helixAngle` and `hand`. A meshing gear's hands and angles are checked
  before it is placed.
- **Studio.**
  - The gear node's `module` is the normal module when helical; the label reads "Normal module".
  - `helixAngle` and `hand` are fields on the Spur gear command and in the edit fields.
  - A meshing gear takes the other's angle with the opposite hand itself (`helixOf`), so a pair cannot be set
    inconsistently.
  - The history label reads "Helical gear mn… z…".
  - Notes: the helix line; "contact ratio εα + overlap εβ = εγ"; the axial thrust.

Evidence:
- **Kernel** `test/gear-helical.test.mjs` 4/4. The worked example is KHK's: m_n 3, β 30°, z 12 right-hand and 60
  left-hand.
  - Published values reproduced: m_t 3.4641, α_t 22.79588°, d 41.569 / 207.846, db1 38.322, da1 47.569, df1 34.069,
    a 124.7077.
  - εα checked by the independent form [z1(tan α_a1 − tan α_t) + z2(tan α_a2 − tan α_t)]/2π, and εβ by its formula.
  - The published εγ was not retrieved: a web search found no KHK table, so εγ is checked as the sum only. Pending
    against the KHK page.
  - The sweep touches at a (|c| < 1e-5), converged.
  - A shifted helical pair: inv α_wt and a_w by the formulas, touching.
- **Solids** (KHK z 12; z 25 at β 45° and 60 wide, two axial segments; z 40, β 15°, shifted and reduced):
  - valid; twist and lead by formula; the top edges the exactly turned profile;
  - the volume equals the analytic transverse area × b within (2ε + ε²) of the twist fit plus the flank slack. A
    probe gave 3–7e-6.
  - STEP round trip within 1e-6.
- **Placed helical meshing** (z 18/18, β 20°): sections of the B-rep's own side faces at five heights are checked
  for crossings, independent of the sweep and its formulas.
  - Meshed at turns 0/7° and directions 0/30°: none cross. A 3° phase crosses at every height. The placed verdict
    agrees.
  - The exact Boolean intersection fails here (non-manifold on the twisted B-spline faces, the analytic Boolean's
    RB5 limit). That is why the section check is used.
- **Refusals:** module with helix, no hand, β 50°, z_v undercut (10 teeth at 15°: virtual 11.10, x ≥ 0.351), a
  10 m face past 64 segments, same hand, other angle, spur with helical, helical with rack.
- **Conformance** 59: `helical-khk-pair` (a 124.7077; volumes from the exact transverse area within 2e-5; STEP) and
  `helical-same-hand-refused`.
- **Studio** 306/306: the helical command, notes, a meshing gear of the opposite hand at 57.4656 mm with "+ overlap
  0.653", thrust, and no rack. The browser flow adds a "Helical gear" step: the pair's notes, clear in 172 ms.
- **Kernel** 983/984 (the known environmental test).

Next: R6a.6, the tool-generated (trochoid) root — #2167's last item. Manufacturing validation needs physical evidence and stays pending. Then LIB1–LIB4.

## D60 — R6a.5c (cont.): the helical rack by geometry; the trochoid root moved to R12b; the twisted × twisted Boolean recorded for RB5 (2026-10-18, issue #2167; peer's decisions)

Decision:
- **The helical rack is defined by geometry, not by a naming rule.**
  - In the common pitch plane, the rack's tooth line coincides with the gear's tooth trace at the pitch cylinder.
  - It is the z → ∞ external gear of the pair. Its transverse section uses pitch π m_t, α_t and heights in m_n.
  - The section slides along the rack by tan β per mm up the face: a sheared extrusion, planar faces, exact.
  - **The hand label follows from the external-pair rule:** opposite to its gear. A left-hand rack (teeth toward +Y)
    slides +X going up and meshes with right-hand gears.
  - Meshing, the label is derived from the gear, never taken as an input; a contrary helix is refused,
    MATE_INCOMPATIBLE, naming the one required.
  - Standing alone, a rack takes `normalModuleMM`, `helixAngleDeg` and `hand`, as gears do (`moduleMM` with a helix is
    refused).
  - The report carries `helix` (β, hand, normal module, shear).
- **Gear-and-rack checks** take helical pairs: the same m_n, α_n and β with opposite hands, else MATE_INCOMPATIBLE (a
  same-hand rack, a straight rack with a helical gear). The sweep runs in the transverse plane; εβ = b sin β/(π m_n);
  εγ.
- **Placed racks** are compared at the same height: the gear's section turned along its helix, the rack's slid along
  its shear.
- **Studio.** Gear rack under a helical gear takes the module, β and hand from the gear (the opposite hand). Notes:
  "Helical rack β … left hand …: its teeth slide … mm along per mm up the face"; contact ratio "+ overlap".
- **R6a.6, the trochoid root, is skipped for now** and goes to R12b with internal, bevel and worm gears. The current
  gears flag their schematic root honestly with ROOT_TRANSITION_UNVALIDATED. Manufacturing validation stays pending,
  since it needs physical evidence.
- **RB5:**
  - Two crossing helical gears (twisted × twisted B-spline flanks): the analytic Boolean refuses their intersection
    as "not a manifold solid" — a WRONG TODO in `robustness/todo.json`, oracle case
    `corpus/oracle/gear-helical-pair-crossing-intersect.json`.
    - Its expected 24.1495 mm³ and centroid come from an independent scanline integration of the exact profiles,
      turned along their helices, at 60 heights. It is converged to 1e-5.
    - The same integrator on a spur pair 4.5° off gives 196.7188 mm³ against the exact Boolean's 196.7163.
  - A keyway, a slot across the teeth and a hole through a tooth of a helical gear (twisted × planar and cylindrical)
    pass every RB stage. They are corpus seeds now: `gear-helical-m2-z40-{keyway,slot,tooth-hole}.json`.
  - So the limit is narrower than D59 said: only two twisted faces meeting.

Evidence (`test/gear-helical.test.mjs`, the new fifth test):
- The rack: valid, all faces degree 1 × 1, shear tan 20° exactly; volume equals the closed-form sheared prism to 1e-9.
- With a right-hand gear: backlash 0, touching, εβ = 8 sin 20°/2π, εγ the sum. A right-hand rack, and a straight one
  with a helical gear, are MATE_INCOMPATIBLE.
- **In the part model, by sections of the solids' own faces at five heights, independent of the sweep:**
  - meshed at turns 0/7° and directions −90/30°: no crossings, and the hand derived is left;
  - slid 0.6 mm: crossings at every height;
  - the same placement with a right-hand rack: crossings above the face it starts on;
  - the placed verdict agrees;
  - a contrary helix given is refused.
- **Conformance** 60: `helical-rack-mesh` (rack volume closed form to 1e-9; gear from the transverse area; STEP).
- **RB:** exit 0. The three helical seeds are OK at every stage; the crossing pair is the recorded WRONG TODO.

Next: LIB1–LIB4, the library system.

## D61 — LIB1: part libraries as data — the format, a safe expression language, the loader and instantiation (2026-10-18)

Decision (`packages/barocss-cad/src/library.ts`; owner's library system, after R6a):
- **The manifest:** `{ format: 'barocss-cad-library', version: 1, id, name, libraryVersion (major.minor.patch),
  units: 'mm', license?, provenance?, parts }`. Limits: 500 parts, 200 parameters, 200 variants, 200 recipe
  features, 500-character expressions, depth 32.
- **A part:** `{ id, name, category?, parameters, variants?, recipe, outputs?, interfaces?, simplified?, tags? }`.
  - **Parameters:** `{ value: number | { expr }, unit?, min?, max?, integer?, source? | estimate: true }`.
    - A value given outright needs its source, or says it is an estimate; there is no third way.
    - Derived values are expressions over other parameters, ordered by their dependencies; a cycle is refused,
      naming it.
  - **Variants** are rows of the table: they set given parameters only, never derived ones.
  - **The recipe** is existing part-model features. Any value may be `{ expr }`; `when` keeps a feature only when it
    holds.
    - References (`sketch`, `target`, `tool`, `gear`) must name earlier features; face and edge names in `edges`,
      `faces` and `open` are renamed with them.
  - **Outputs** default to the last feature. An output left out by its `when` (an optional finish) is the body it
    would have changed, back along `target`. A left-out maker is refused.
  - **Interfaces:** `{ id, role, … }` with expressions, evaluated for LIB2.
- **The expression language** is parsed by our own recursive descent into plain records and evaluated by a switch.
  Nothing is ever run as code.
  - Numbers, parameter names, + − * / %, ^ (right-associative), unary − and !, comparisons, && || (short-circuit),
    c ? a : b, parentheses.
  - Functions: min, max (two or more), round, floor, ceil, abs, sqrt, sin, cos, tan, atan2 (degrees); `pi`.
  - Anything else is refused: unknown functions, strings, member access, a name that is not a parameter (own
    properties only: `toString` is not one), a non-finite result.
- **Loading checks everything before any use.** Typed refusals (`CadLibraryError`: FORMAT, VERSION, PARAMETER,
  EXPRESSION, REFERENCE, RECIPE) say where, e.g. `test-plates/plate:s.max[1]: reads height, which is not a
  parameter`.
- **`instantiateLibraryPart(lib, part, { variant?, params?, prefix? })`:**
  - Values come from the defaults, then the variant row, then the values given — given parameters only, within
    their limits, whole when `integer`.
  - Features are kept by `when` and their expressions replaced by numbers; ids and references are prefixed
    `<prefix>_`.
  - Returns the features, outputs, `origin { library, version, part, variant?, params }` for LIB3, the evaluated
    interfaces, and warnings:
    - every estimate used, unless the caller gave that value;
    - "simplified internals — not for structural calculation".
- **Placement of the data:** library data lives outside the kernel; built-in libraries come with the studio (LIB4).
  The FreeCAD extrusion library is a structural reference only, not copied.

Evidence: kernel `test/library.test.mjs` 3/3.
- **The language:** precedence, associativity, logic and short-circuit, functions in degrees, pi. Injection-shaped
  input (`constructor.constructor(...)`, `alert(1)`, strings) and malformed input are refused; so are unknown names,
  including `toString`, and division by zero.
- **A test library (a plate in two sizes):**
  - variant B gives 80 × 60 × 5 with a chamfer kept by `when`; prefixed ids, references and edge names; origin;
    warnings;
  - the features evaluate, the volume equal to the plate less the hole and the 0.5 mm chamfer to 1e-6;
  - defaults with t given: no estimate warning, the chamfer left out, the output falling back to the hole;
  - instantiation refusals: an unknown part or variant, a value out of range or not whole, a derived parameter set,
    an unknown parameter, a bad prefix.
- **Load refusals:** JSON, format, version, ids, a value without a source, `pi` as a name, a cycle, a variant setting
  a derived or unknown parameter, an expression reading a non-parameter (with its path), a forward reference, a
  duplicate id, an empty recipe, a malformed `when` and `{ expr }`, bad outputs, an interface expression.

Next: LIB2 — interfaces with roles, placement by snapping one onto a face or interface (real mates), and fit checks of
declared pairs; with the T-slot 20 series library as the first data.

## D62 — LIB2: interfaces, placement by interfaces, declared fits checked by building them; the T-slot 20 series as data (2026-10-18)

Decision:
- **An interface:** `{ id, role, accepts?, frame: { origin, z, x }, faces?, when? }` in the part's own coordinates,
  numbers or expressions.
  - `z` points out of the part (the mating face's outward normal); `x` runs along it. They must be perpendicular,
    which instantiation checks.
  - `faces` names, by key, the faces mates are made on: `plane` (flat, flush) and `axis` (round, on one axis).
  - `when` makes an interface present only with its feature, e.g. a slot left closed has no slot interface.
- **`placeByInterfaces(a, b, offset)`** (`library-fit.ts`) is exact: R takes b's (x, y, z) to (x_a, −y_a, −z_a), so
  the frames face each other, and b's origin goes to a's moved by `offset` in a's frame.
- **Declared fits** (`fits` in the manifest: two ends of part, variant, values and interface, plus an offset) are
  checked on load: the parts and interfaces exist, and the roles accept each other.
- **`checkLibraryFit`** builds both parts, places b, and measures their overlap with the exact Boolean intersection.
  It also checks contact: b pushed 0.01 mm further into a must overlap. Parts standing apart do not pass. ok when
  both hold.
- **Recipe references** to a step left out by its `when` resolve back along its `target`, as outputs do, so optional
  slot cuts chain.
- **Variant ids** may begin with a digit (2020).
- **Fixed in passing:** `booleanAnalytic` silently ran another operation's selection for an unknown operation name
  ('intersect'). It now refuses (INPUT).
- **Studio: `snapByInterfaces(doc, a, b, offset)`.**
  - b, an instance, is placed exactly through a's placement.
  - Real mates are added on the faces both interfaces name: coincident for `plane`, concentric for `axis`. The solver
    keeps b where it was placed; the remaining freedom (sliding along the slot) stays free.
  - Refused: roles that do not mate, the base part as b, a grounded b, an unknown interface.
- **The built-in "T-slot 20 series"** (`apps/cad-studio/src/library/builtin/tslot-20.json`, 0.1.0) is written for
  BaroCSS from the shape of a typical B-type slot-6 system. No supplier data was copied.
  - Every cross-section value is flagged an estimate, to verify against a datasheet. The license is "CC0-1.0,
    legal review before release".
  - **Profile** (20×20 with 1–4 open slots, 20×40 with six): 45°-tapered undercut slots, which leave diagonal webs,
    and a core bore. Simplified internals. Interfaces: each slot's lip underside, both ends, two faces.
  - **Slot nut M5:** trapezoidal, 0.2 mm clearance, tap-drill hole.
  - **End cap 20×20** and an **angle bracket** with clearance holes.
  - Fits: a nut in a 20×20 and in a 20×40 slot, a cap on the end, a bracket on the top face.

Evidence:
- **Kernel** `test/library.test.mjs` 4/4 (+1). A key in its pocket (0.1 mm clearance a side):
  - the placement exact, R a quarter turn about Z, the foot on the floor; overlap 0 with contact;
  - a 6.5 mm key overlaps by 6.25 × 4 = 25 mm³;
  - 1 mm along the pocket overlaps by 0.9 × 5.8 × 4;
  - lifted 1 mm: no overlap, no contact, not ok;
  - fit declarations refused on load: an unknown part, an unknown interface, roles that do not accept each other, a
    duplicate.
- **Studio** `test/library.test.ts`:
  - every T-slot part builds valid in each variant (slot interfaces 4, 1 and 6), its estimates said;
  - the four declared fits: overlap 0, contact, 20–80 ms each;
  - a nut snapped 30 mm along the top slot sits with its top at the lip underside (y 8.2, upright), with one
    coincident mate on `lib1_t1x.side1`/`lib1_n.side5`;
  - solved again, it stays; the rail moved up 100, the nut follows to 108.2;
  - refusals.

## D63 — LIB3: a library part as a node — its features kept with the document, regenerated from the library (2026-10-18)

Decision:
- **Node `library`:** `{ name, library: origin, prefix, features, outputs, interfaces, warnings }`.
  - The features are ordinary part-model features as the library made them, ids prefixed `lib<k>`, unique in the
    document. The node's own feature passes the output on under the node's id, so its body is keyed as any other.
  - The document opens and evaluates without the library.
- **Origin:** `params` holds the values the caller gave; `values` holds every value used. Regenerating
  (`regenerateLibraryNode`, when the library is there) keeps the given values and the variant, and takes everything
  else — the row, defaults, estimates — from the library as it is now, at its version.
- **Face names hold:** the same prefix and recipe give the same names, so mates and references survive. A changed
  recipe goes through A1.3's re-match like any edit.
- **Notes on the body:** "From <library> <version>: <part> (<variant>)", then the warnings (each estimate used,
  simplified internals).
- **Insertion:** into a part's own tree (`insertLibraryPart`), or as a new assembly instance holding the part
  (`libraryInstance`).

Evidence (`test/library.test.ts`):
- A 250 mm 20×20 profile: origin and name; the notes from the library, the wo estimate and the caveat.
- Saved, its library id changed to one not installed, and read back: the same volume and faces; not regenerated.
- A copy of the library at 0.2.0 with a 6.0 opening: regenerated at 0.2.0 with L 250 kept and wo 6.0. The volume
  gains exactly 4 slots × the section difference (43.58 → 42.85 mm²) × 250. The interface face names are unchanged.
- Studio 309/309.

## D64 — LIB4: the library panel, team and user libraries under the data rules, agent tools; the acceptance flow (2026-10-18)

Decision. The data rules are the peer's, from what community model sites teach (mixed formats, unclear licences):
- **Licence.** A team or user library without `license` still loads, but as "unlicensed — private use only". It is
  never shared. The panel and `list_library` show each library's licence.
- **Provenance:** LIB1's rule holds (every given value sourced or flagged an estimate). Each library's estimate count
  is shown.
- **The check before sharing** (`src/library/sharing.ts`, kernel only, so the studio and the chat server run the
  same one):
  - the library loads, every part builds valid in every variant, and its declared fits pass;
  - the result (ok, problems, time, kernel version, library and version, parts built, fits) is kept beside it;
  - `CAD_KERNEL_VERSION` is held equal to package.json's by a test.
- **No third-party models in libraries.** Recipes may not use `import`, `mesh` or `sew` (LIB1 refuses them, RECIPE). A
  downloaded STEP or STL stays an import in the user's own document.
- **Agent-written libraries:** `add_library` checks the library at once and keeps it in the document
  (`StudioDoc.libraries`, carried like every field) marked `authoredBy: 'agent'`, unconfirmed. It is shared only after
  a person confirms it. Adding one changes no model, so it applies at any autonomy level.
- **The team folder** is the chat server's `CAD_STUDIO_TEAM_LIBRARIES`.
  - `GET /api/chat/libraries` lists `<id>.json` with `<id>.check.json`.
  - `POST` writes both only when the server's own run of the check passes, the library is licensed, and an agent's
    library is confirmed. Otherwise 422 with why.
  - The agent's MCP process registers the same folder, so `insert_part` finds team libraries.
  - Without the chat server, the dev server answers the GET with an empty list instead of a proxy error.
- **User libraries** are added from a JSON file and kept in this browser (localStorage: a convenience; the files are
  the user's).
- **The panel** (toolbar "Library"): built-in, team and yours, each with licence, estimates, the agent mark with
  Confirm, and its parts with a variant choice. Insert puts the part into this part; Place makes it a new placed part.
  Yours can be shared with the team.
- **Agent tools:**
  - `list_library` (parts, variants, parameters with estimates, interfaces and roles, fits, licence);
  - `insert_part` (as a new placed part; estimates warned);
  - `snap_part` (by interfaces, real mates);
  - `add_library`.
  - Insertions and snaps change the assembly, so at every level the agent proposes them and the user accepts (D41).
- Estimate warnings say the value and that it is an estimate; the source stays with the library, where
  `list_library` gives it.

Evidence (`test/library-tools.test.ts`, `test/library.test.ts`):
- **Acceptance through the agent's own path:**
  - it lists the T-slot library (CC0, estimates, parts, variants, slot interfaces);
  - inserting directly is refused, `needs_approval`;
  - it proposes inserting a 200 mm rail and a nut and snapping the nut into the top slot 40 mm along (approval:
    assembly and mates), and the user accepts;
  - one coincident mate holds the nut, its top at the lip underside (y 8.2, its origin at 35);
  - a nut onto an end is refused, saying why;
  - saved and reopened: the same volumes and the mate.
- **The agent's spacer library:**
  - checked at once (2 variants built, 0 fits), licence CC0, 1 estimate, kept in the document as the agent's,
    unconfirmed; its part inserts;
  - not shared before a person confirms it, then shareable;
  - unlicensed: private use only, refused;
  - a library whose bore is wider than the tube fails its check;
  - a library with a STEP import is refused.
- **Team folder over HTTP:**
  - refused for unconfirmed, unlicensed and failing libraries (422);
  - accepted when confirmed, writing the library and its check (ok, kernel 0.0.0-experimental, version, 2 built,
    time);
  - listed back;
  - the agent's process registers the folder.
- The insertion and its properties: licence and estimates shown; a 20×20 profile inserted, "From tslot-20 0.1.0:
  profile (2020)" with its estimates and caveat; a nut placed as a part.
- Kernel library 4/4 (with the refused kinds and the version); studio 311/311; lint 0 errors.
- Browser flow: a new "Library" step, the T-slot profile on screen with its slots.

The library system's acceptance (README): the T-slot 20 series from data ✓; fits pass ✓; insert, save and reopen
without the library give the same bodies ✓; an agent lists, inserts and snaps a nut into a slot ✓.

Next: R6b, enclosure elements, built as library items where they can be (owner: "after it, R6b, much of R12c and FR
are built as library items").

## D65 — R6b.1: declared checks with context, "add to body" as one step, the screw boss as a library item (2026-10-18)

Decision (the peer approved the plan, with its refinements):
- **Checks in the library format:** `checks: [{ id, expr, level: 'recommended' | 'feasible', message, value? }]`.
  These are process rules as data:
  - a recommended rule that fails is a warning on the part, with its margin (`value`);
  - a feasible rule that fails refuses the instance (PARAMETER), naming the rule and its margin;
  - the instance reports every rule (`checks`: met, not met, or unknown).
- **Context inputs:** `context: { wall: { unit, description, from } }` — what the checks need from where the part goes.
  - Given at instantiation. Only checks read them; recipes cannot (the geometry does not depend on the target).
  - A check reading a context input that was not given is unknown, with why ("needs wall (…)"), never passed.
  - Context names may not shadow parameters, pi or functions.
- **Variant ids** may hold a dot (M2.5).
- **Add to body** (`addLibraryPartToBody`; agent tool `add_library_part`):
  - The part's `base` interface goes on a picked flat face at a point, the frames facing, then the part is united
    with the body.
  - It is one step: a `library` node with `placement` (kernel turns and a move, `<prefix>_placed`), `addTo` (the
    body, consumed as a Boolean's first) and `on` (the face's name and the point, for A1.3's re-match).
  - Suppressed, the body passes on as it was. Its look is the body's (it builds on it).
  - **The wall there:** given, or measured: the ray from the point inward through the body's mesh.
  - **Refused, with why — never added half on, never dropped:**
    - the footprint (the placed part's points on the face plane, each pushed 0.05 mm in) is not all inside the
      body: "k of n points of its footprint fall off it";
    - its base is off the face;
    - the union does not build;
    - a feasible rule fails.
- **A3:** `library_check { feature, check }` gives the rule's margin (or 1 or 0), unknown without its context or its
  library.
- **The built-in "Enclosure elements" library** (0.1.0, CC0, legal review before release). Its first part is a
  **screw boss** for a thread-forming screw.
  - Variants M2–M5 (pilot holes as estimates); OD = 2d + 0.4; free height; 0 or 4 triangular gussets (thickness an
    estimate) on vertical planes.
  - Rules against the wall:
    - boss wall within [0.6, 1.0] of it, recommended;
    - gusset ≤ 0.6 wall, recommended (sink), and ≤ the wall, feasible;
    - engagement ≥ 2d, recommended.
  - Interfaces `base` (its foot) and `screw` (the pilot's axis).
- **Next step: R6b.7.** The material and process profiles (injection, FDM, SLA) and their thresholds with source
  IDs come next, moved up to right after R6b.2.

Evidence:
- **Kernel** `library.test.mjs` 5/5. A rib's rules on a 2.5 mm wall are met (0.48); on 1.6, one warning (0.75); on
  1.0, refused (1.2); without a wall, both wall rules unknown and said, the height rule still checked. Bad context
  and check declarations are refused.
- **The bosses:** all ten (M2–M5 × gussets) valid. The M3 without gussets equals π·3.2²·8 − π·1.25²·7.4 to 1e-6 on
  the plate.
- **Studio** `test/enclosure.test.ts`:
  - on a 60 × 40 × 2.5 plate: the wall measured 2.5, no rule warned, one body, 10.5 high;
  - on 1.2: boss-wall-thick (1.625) and rib-sink (0.833) warned;
  - on 0.8: refused, rib-wall (1.25);
  - half off the edge: refused, saying how many footprint points fall off;
  - on the side face: lying along X to 68;
  - suppressed: the plate's volume;
  - no wall where the ray leaves nothing: unknown;
  - `add_library_part` by face name and point, with "not a flat face" refused;
  - `library_check` as requirements: rib-sink 0.8333 fails ≤ 0.6, engagement passes, an unknown rule is unknown.
- Studio 315/315; lint 0 errors.

## D66 — R6b.2: heat-set insert holes (cut from a body), PCB standoffs, and the hole-pattern alignment check (2026-10-18)

Decision:
- **Library `operation: 'add' | 'cut'`** (LIB format). A cut part added to a body is taken from it: a library node
  with `cut`, the kernel's difference, still one step.
  - A cut's footprint check is wider than a boss's: every point of the tool, brought onto the face and pushed a hair
    in, must fall inside the body, so its whole outline opens on the face.
- **Context measured where it goes:**
  - `depth`/`wall`: the body's thickness inward from the point. A hole part (one with `dh`) is measured at its rim,
    just outside its radius, so a pilot hole already on the axis does not cut the measure short (it read 7.4, the
    pilot's bottom, instead of 10.5);
  - `around`: the least material round the axis, eight rays across it, halfway down the part's depth `Lh`, from the
    hole's own radius out.
- **Insert hole** ("Enclosure elements" 0.2.0).
  - Variants M2–M5: hole Ø, depth and the insert's Ø, all estimates written for this library (no supplier's table).
  - The tool runs into the body along +z of its base frame. It has an `insert` axis interface for the screw.
  - Rules:
    - depth ≥ Lh + 0.4 (feasible: it would break through);
    - around − dh/2 ≥ 0.8 (feasible: material round the insert);
    - around ≥ the insert's Ø (recommended: a boss about twice its diameter across).
- **PCB standoff:** M2–M3; OD = 2d + 1.2; free height; pilot hole. Rules: its wall against the nominal wall, and
  engagement ≥ 1.5d. A `screw` interface (role `pcb-mount`) carries the seat plane and the screw axis.
- **Hole alignment** (`src/library/alignment.ts`; A3 `hole_alignment { board, features? }`):
  - the board's holes are the inner cylinders of its exact faces (an imported PCB STEP as a placed part, or the base
    part), moved into place;
  - the standoffs' screw axes come from their interfaces as placed;
  - each axis is compared with the nearest parallel hole, its offset being the distance between the axes; the
    largest offset is the measure;
  - a standoff with no parallel hole is unknown, said, and so is a missing board.

Evidence (`test/enclosure.test.ts` 6/6):
- **An M3 insert into the top of an M3 boss on a 2.5 mm plate:**
  - depth 10.5; around 3.2 (the boss's radius, at 45° clear of the gussets);
  - boss-size warned (0.696: an M3 boss is small for an insert);
  - the volume drops by exactly π(2² − 1.25²)·5, the hole beyond the pilot, to 1e-6.
- Into the bare plate: refused, breaks-through (−2.5). Its mouth over the edge: refused.
- **Four M2.5 standoffs** on a 70 × 60 × 2 floor under a 50 × 40 × 1.6 board, exported to STEP with four Ø3.2 holes,
  imported and placed on their tops:
  - `hole_alignment` 0 to 1e-9; passes ≤ 0.05;
  - one standoff 0.3 mm off: measured 0.3, fails, with the worst pair named;
  - a missing board: unknown.
- Studio 317/317; kernel library 5/5; lint 0 errors.

Next: R6b.7, the material library and process profiles (moved up, peer). Then R6b.3 snap-fits, whose strain checks
read them.

## D67 — R6b.7: the material library and process profiles, read by library checks (moved up before R6b.3, peer) (2026-10-18)

Decision:
- **`src/library/builtin/materials.json`** (barocss-materials 0.1.0, CC0, legal review before release): 13 materials.
  - The studio's eight, their densities unchanged, plus PC, PP, PETG, POM and a standard SLA resin.
  - Each has density, elastic modulus, yield, allowable strain (a snap-fit's), shrink, a wall range per process it
    suits, and its processes.
  - Every value names a source id: S-TYP, S-DENS, P-INJ, P-FDM, P-SLA, each a BaroCSS-written typical value or rule
    of thumb (no datasheet, catalogue or standard text). Every material is flagged an estimate.
- **Process profiles** (injection, FDM, SLA): thresholds with a value, unit, source id and description — ribRec,
  ribMax, bossWallMin, bossWallMax, minWallRec, minWall, draftRecDeg.
  - Moulding is strict on ribs (0.6 recommended, 1.0 at most). FDM allows a rib as thick as the wall (1.0 / 2.0) and
    needs no draft. SLA sits between.
- **`checkMaterials`:** every number finite (density, modulus and yield above 0), every field sourced by a known id,
  wall ranges ordered, every threshold's source known.
- The studio's material list (mass) now comes from this library.
- **`StudioDoc.process`** is the profile the part is made by, chosen in the Library panel ("Not chosen (rules
  unknown)" by default) and carried like every document field.
- **Library context reads them:** `from: ['material.<field>']` (also `material.wallMin`/`wallMax` for the process)
  and `['profile.<threshold>']`.
  - Material values come from the body's material only when set: an assumed (default) material is no value.
  - What cannot be resolved is said on the part as "context <name>: <why>" ("the body's material is not set", "no
    process is chosen"), and the checks reading it are unknown.
- **The enclosure library 0.3.0:** the boss and standoff rules take their thresholds from the process instead of
  fixed numbers.

Evidence (`test/enclosure.test.ts` 7/7):
- The data checks clean; the eight densities are as before; every material is sourced.
- **The same M3 boss on a 1.2 mm wall:**
  - moulding warns boss-wall-thick and rib-sink;
  - FDM warns neither;
  - no process: the rules unknown, "context ribRec: no process is chosen".
- **A test part reading `material.allowableStrain`:**
  - unknown while the body's material is assumed;
  - on ABS 0.025, met;
  - on PLA 0.015, warned.
- The earlier boss and insert tests run under injection, with the thresholds in their context.
- Studio 318/318. The browser Library step chooses FDM.

Next: R6b.3, the cantilever snap-fit (ε = 1.5·t·y/L² against the material's allowable strain, through this
library).

## D68 — R6b.3: the cantilever snap hook — tapered-beam strain derived and checked by integration, push-on and pull-off forces, the ledge it latches under, FDM print plane (2026-10-18)

Decision (with the peer's notes):
- **Snap hook** ("Enclosure elements" 0.4.0), added to a wall by its root:
  - a beam of length L, root thickness t, tip ratio r (1: uniform; down to 0.4) and width b;
  - a hook with undercut y and head height hh;
  - a retaining face at `ar` from the push-on direction (90: square), a lead face at α = atan(y/(hh − y/tan ar)).
- **The tapered beam is derived here, not taken from a table** (provenance in the parameter's description).
  - Euler–Bernoulli with a tip load, thickness falling linearly from t to r·t: y = 12 P L³ F(r)/(E b t³), where
    F(r) = ∫₀¹ s²/(r + (1 − r)s)³ ds = (−ln r + 2r − r²/2 − 3/2)/(1 − r)³, and 1/3 at r = 1.
  - Root strain ε = 6PL/(E b t²) = (1/(3F(r)))·1.5·t·y/L²: the uniform formula times the taper's factor.
- **Rules:**
  - feasible:
    - ε ≤ σy/E (it would yield);
    - μ tan α < 1 (a lead so steep it locks);
    - hh > the retaining face's rise + 0.1 (shape);
  - recommended:
    - ε ≤ the material's allowable strain;
    - FDM: the bend in the print plane — unknown until the orientation is known (AM2/AM4), warned when given out of
      it, not asked for other processes.
- **Reports** (a new library item: a quantity with its unit, unknown when its context is missing):
  - deflection force P;
  - push-on W = P(μ + tan α)/(1 − μ tan α);
  - pull-off by the same form with the retaining angle, −1 when it locks.
  - μ is the material library's (an estimate per material, `friction`, S-TYP) or given.
- **Snap ledge**, the catch, added to the mating wall: as deep as the undercut, as wide as the hook plus its
  clearance. It has a `ledge` interface; the hook's `hook` interface is its retaining face.
- **Declared fits** `hook-on-ledge` (straight and tapered): the hook latched under the ledge, moved off its wall by
  the clearance. The fit's own checks read both parts' values (`a_<p>`, `b_<p>`, a new fit item): the engagement
  |e − y| ≤ c, and the width.
- **Kernel library additions:**
  - `ln`, `exp`, `atan`;
  - `reports`;
  - a check is unknown only when its evaluation reaches a missing context input — a short-circuit past it decides
    (`isFdm == 0 || …`);
  - instances carry every value, derived ones too;
  - fit checks.
- **Materials 0.2.0:** `friction` per material (estimates) and the profiles' `isFdm`. A `print.*` context is unknown
  until AM2/AM4.

Evidence:
- **Kernel** `library.test.mjs` 6/6:
  - ln/exp/atan;
  - a report with its value, and unknown naming E;
  - a check decided past missing context, and unknown when it reaches it;
  - a fit check over both parts;
  - refusals.
- **Studio** `enclosure.test.ts` 11/11:
  - **Integration, independent:** the tapered strain and deflection force agree with Simpson integration of the
    beam's deflection (20 000 steps) to 1e-9 at r = 1, 0.8, 0.6 and 0.45;
  - the volume equals the closed form;
  - against the body's material: ABS met (0.625), PLA warned (1.0417), PLA with y 1.5 refused (yield 1.49), no
    material unknown;
  - forces equal the formula by hand: P = Ebt³y/4L³ = 6.445 N, push-on 8.594 N, square pull-off −1, 30° pull-off
    finite;
  - a locking lead and a short head are refused;
  - FDM: unknown, said; out of plane: warned;
  - no μ: forces unknown;
  - fits: overlap 0, contact, engaged, for straight and tapered hooks; a ledge 0.25 short fails its engagement rule.
- Studio 322/322; kernel 991/992 (the known environmental test); lint 0 errors.

Next: R6b.4, enclosure lip and groove and the split between halves.

## D69 — R6b.4: enclosure halves with lip and groove, their fit checked for interference and contact (2026-10-18)

Decision:
- **Rectangular enclosure halves as library parts** ("Enclosure elements" 0.5.0).
  - **Base:** open at the split `hs`, floor `w`, a lip of thickness lt and height lh round the inside of its rim.
  - **Lid:** height Hl, closed top, a groove lt + c wide and lh + c deep round the inside of its rim.
  - Both share L, W, w, lt, lh and c. Their `rim` interfaces (roles enclosure-rim and enclosure-lid-rim) snap the lid
    onto the base with one coincident mate.
- **Rules,** with thresholds from the process profile (materials 0.3.0 adds `fitClearance`: injection 0.1, FDM 0.2,
  SLA 0.1):
  - feasible: the base's rim beside the lip ≥ minWall; the lip ≥ minWall; the lid's wall beside the groove ≥ minWall;
    the lid deep enough for its groove and top;
  - recommended: the clearance ≥ the process's fitClearance.
- **The declared fit `lid-on-base`:** overlap and contact, plus the fit's own rules over both halves — the same box
  and wall, and the groove at least as wide and deep as the lip (side and top clearance as values).
- **Limit, recorded:** splitting an arbitrary user body into halves with a lip that follows its outline needs an
  offset of its section. It is pending (with R11 shell offsets) and is not done here.

Evidence (`test/enclosure.test.ts` 12/12):
- The volumes equal the closed forms exactly (17568 and 11375.168 mm³).
- The fit: overlap 0, contact, the rules met, a side clearance of 0.2.
- A lid with a 0.7 lip-band groove (0.9 wide for a 1.0 lip) overlaps by exactly the 0.1 ring × 2 (50.32 mm³) and
  fails its rule.
- Snapped in an assembly: the lid at z 20 with one coincident mate.
- A clearance of 0.15 is met for moulding and short for FDM.
- A 1.6 lip leaves a 0.4 rim: refused.
- Studio 323/323.

Next: R6b.5 vents and grilles, then R6b.6 the living hinge.

## D70 — R6b.5: vents and grilles — slots and staggered hexagons cut as deep as the wall (2026-10-18)

Decision ("Enclosure elements" 0.6.0):
- **Slot vent:** n slots, sl × sw, pitch p, centred on the point. One slot is cut and patterned along the row.
- **Hex grille:** nx × ny openings s across their flats, with webs wb, in staggered rows (pitch s + wb, rows
  (s + wb)·√3/2 apart). Odd rows are a second pattern, left out by `when` for a single row.
- **Depth:** a cut with a `cutDepth` parameter goes as deep as the wall measured at the point, plus 0.5 mm. It does
  not go through to what lies beyond, such as a box's far wall. Unmeasurable: refused, asking for cutDepth.
- **Rules:** web ≥ the process's minWall (feasible) and ≥ its minWallRec (recommended).
- **Reports:**
  - the open area;
  - the open ratio: n·sw/span for slots; s²/(s + wb)² over the lattice for hexagons;
  - the openings.

Evidence (`test/enclosure.test.ts` 13/13):
- On a 2 mm plate (cutDepth 2.5): the material taken equals exactly 6 × 12 × 1.5 × 2 for the slots, and 20 and 5
  hexagons × (√3/2)·16 × 2 for the grilles.
- Open ratios 9/19 and 16/5.2².
- Webs: 0.5 refused, 0.8 warned under moulding.
- In an enclosure base's side wall, only the near wall is cut.
- Studio tests pass.

## D71 — R6b.6: the living hinge; R6b closed (2026-10-18)

Decision:
- **Living hinge** ("Enclosure elements" 0.7.0), a cut across a plate: a groove of land Lh along the bend and span
  along its axis, as deep as leaves `th`.
  - The plate's thickness `wallT` is measured where it goes, as `cutDepth` is.
  - Surface strain folded through θ, the land bent to an arc: ε = th·θ/(2·Lh).
- **Rules:**
  - feasible: it thins the plate (th ≤ wallT − 0.2);
  - recommended:
    - the thickness within the material's living-hinge range;
    - ε within its living-hinge strain;
    - not printed in layers (FDM), or else mould it or use a pin hinge.
- **Materials 0.4.0:** polypropylene alone carries `livingHingeStrain`, `livingHingeTMin` and `livingHingeTMax`
  (estimates, S-TYP). For any other material the context says "<material> is not a living-hinge material" and the
  rules reading it are unknown.

Evidence (`test/enclosure.test.ts` 14/14):
- On a PP plate 2 thick: wallT measured as 2, the material taken equals exactly 1.5 × 40 × 1.7, no rule warned.
- ABS: unknown, said.
- FDM: warned.
- A 0.5 land: ε 0.942, warned (1.88 of PP's).
- A 0.8 hinge: thickness warned.
- A 1.9 hinge in a 2 plate: refused.
- Studio tests pass; lint 0 errors.

**R6b is closed:** R6b.1–R6b.7 (D65–D71), every element a library item with process- and material-driven rules,
built and checked from data.
- Pending:
  - the general split of an arbitrary body with a following lip (R11 offsets);
  - the print orientation for the FDM rules (AM2/AM4).

Next in the roadmap: AM1–AM5.

## D72 — AM1: process and printer profiles for 3D printing (2026-10-18)

Decision (the peer approved the AM1–AM5 plan; its notes are folded into each step):
- **Process profiles** (materials 0.5.0) now include SLS and MJF beside injection, FDM and SLA. Each printing
  (`additive`) profile carries the printing thresholds, each with a source id (P-FDM, P-SLA, P-SLS, P-MJF; BaroCSS
  rules of thumb, written):
  - minWallUnsupported;
  - maxOverhangDeg (90 for powder: it supports itself);
  - maxBridgeMM;
  - minHoleMM;
  - fitGap (parts printed together do not fuse);
  - escapeHoleMM and escapeHoles (powder and resin; none for FDM);
  - horizontalHoleMM (the largest horizontal hole that prints round unsupported; for AM3's sag rule).
- **Materials:**
  - `warpRisk` 0–1 per polymer (for AM3's warp warning);
  - PA12 suits SLS and MJF, with wall ranges.
- **Printer profiles:** five generic printers of their class, under names written here, not product datasheets
  (P-PRN): FDM 256³, FDM 220 × 220 × 250, desktop SLA, SLS 300³, MJF 380 × 284 × 380. Each has its process, build
  volume, layer, and nozzle or bed where they apply.
- **`checkMaterials`** also requires every printing threshold on every printing profile, and every printer on a
  printing process with a positive build volume and layer and a known source.
- **`StudioDoc.printer`** is chosen in the Library panel among the printers of the chosen process; changing the
  process drops a printer of another one.

Evidence:
- `test/printing.test.ts`: the data checks clean; every printing threshold is sourced; powder has no overhang limit
  and wants escape holes, FDM none; the printers and their volumes; a printer on a moulding process and a missing
  threshold are caught.
- Studio 326/326; lint 0 errors.

Next: AM2, the overhang map — exact normals for planar faces, display triangles only for curved ones (accurate to
the chord error).

## D73 — AM2: the overhang map (2026-10-18)

Decision (`src/print/overhang.ts`):
- **The rule:** against the build direction b (+Z by default), a surface needs support when −n·b > sin θ, with θ the
  printing process's `maxOverhangDeg` from the vertical: 45 for FDM, 30 for SLA, 90 for powder, which never needs
  support. Its angle from the vertical is asin(−n·b).
- **Bed faces** — facing straight down at the part's lowest point along b — rest on the bed. They are left out and
  reported apart.
- **Exactness (peer):**
  - a planar face is judged whole by its exact normal from the B-rep face table, its area the face's;
  - a curved face is judged triangle by triangle on the display mesh. The report says `approximate`: accurate only
    to the chord error.
- **A3 `overhang_area { body?, direction? }`:** the overhanging area. Unknown without a printing process (moulding is
  not printing; none chosen). The hint names the limit and says when curved faces made it approximate.
- **Viewport:** the Analyse button's third look, offered for a printing process, is the overhang map. Past the limit
  is red, deepening with the angle; the bed grey; the rest pale. It is a WGSL shader material beside zebra and
  curvature, its limit and bed height as parameters.
- Pending: the map follows +Z until AM4 chooses an orientation.

Evidence (`test/printing.test.ts` 3/3):
- A box on the bed: none, its 400 mm² bottom on the bed.
- A T: its arms' undersides, exactly 300 mm², 90°, exact.
- A slope 60° from the vertical counts its exact area against 45°; one at 30° does not.
- Built along −X: another bed and other overhangs.
- A cylinder lying along Y: the band within 45° of straight down, 5·π/2·20, matched within 3% by triangles, marked
  approximate.
- As requirements: FDM fails with 300; SLS passes with 0; moulding and no process are unknown.
- The browser flow shows the overhang look with FDM. Studio tests pass; lint 0 errors.

Next: AM3, printability rule checks.

## D74 — AM3: printability rules (2026-10-18)

Decision (`src/print/rules.ts`; with the peer's notes):
- **`printability(doc, bodies, evaluate, { direction? })`** reports each rule as pass, warn (recommended, not met),
  fail (feasible, not met), unknown (with why) or n/a, with value, limit, unit and the limit's source id.
  - The direction is given, else the document's `print.direction` (a new field, AM4 fills it).
  - Without a printing process every rule is unknown, said.
- **The rules:**
  - **wall:** the thinnest wall vs minWall (feasible) and minWallRec (recommended).
  - **hole:** the smallest inner cylinder from the exact face table vs minHoleMM (feasible: it closes up).
  - **horizontal-hole:** holes whose axes lie across the build direction, wider than `horizontalHoleMM` (FDM 6, SLA
    10), sag at their tops: a teardrop or support (recommended). Unknown without an orientation.
  - **gap:** bodies printed together — overlapping fails (they print as one); a clearance under `fitGap` warns (they
    may fuse). n/a for one body.
  - **cavity:** enclosed voids (the display mesh's surface pieces inside the outer one). For powder and resin,
    feasible: give `escapeHoles` holes of at least `escapeHoleMM`. For FDM, filled or infill: no drain needed.
  - **bed-fit:** the part's extents across the bed (either way round) and its height within the printer's build volume
    (feasible). Unknown without a printer.
  - **overhang:** AM2's area past the limit (recommended: supports).
  - **warp** (corner lift, the peer's form): warp = warpRisk × (longest footprint extent / Lref) × (bed contact /
    footprint box). A heuristic, sourced by the profile's new `warpLrefMM` (FDM 100, SLA 150, SLS/MJF 200); warned
    above 0.5. Unknown when a body's material is not set or has no warp risk.
  - **tip** (lifting or tipping): height / √(bed contact) against the profile's new `tipRatio` (FDM 4, SLA 6); n/a for
    powder (the part lies in powder). With nothing flat on the bed: a brim, a raft or another orientation.
- **A3 `print_rule { rule, direction? }`** gives a rule's value; unknown or n/a, said. **Agent tool
  `check_printability`** is read only.
- **Limits, said:** wall thickness, cavities and curved contact areas come from the display mesh (chord error). The
  cavity test is by boxes: a separate piece fully inside another's box would count. The warp form is a heuristic.

Evidence (`test/printing.test.ts` 5/5):
- An ABS plate 60 × 40 × 2 flat on FDM 256³: every rule passes; warp 0.8 × 0.6 × 1 = 0.48 (P-FDM).
- A 100 mm plate: 0.8, warned. A 300 mm plate: off the bed (300/256).
- No orientation: bed-fit, overhang, warp, tip and horizontal-hole unknown, said. Moulding: all unknown.
- A block with a Ø1 hole: fails the hole rule (Ø2). Its Ø8 hole along X: warned built up Z, passing built along X.
- A Ø4 × 40 pin: tip ≈ 40/√(4π) within 1% (its round foot's display area), warned.
- A closed box with a void: SLS fails ("traps powder: give it 2 escape holes of at least Ø5 mm"), tip n/a; FDM
  passes.
- Two blocks 0.1 apart: the gap warned; as a requirement ≥ 0.3, it fails with 0.1.
- Studio 330/330; lint 0 errors.

Next: AM4, the orientation search.

## D75 — AM4: print orientation search (2026-10-18)

Decision (`src/print/orient.ts`; with the peer's notes):
- **Candidates:** 64 fixed Fibonacci-sphere directions, then the large planar faces set down on the bed (their exact
  normals' opposites from the face table, faces ≥ 1% of the area, at most 32, by area then name), duplicates dropped.
- **Score, lower better, of normalised terms**, each reported per candidate:
  w_s·support / (area·diag) + w_o·overhang / area + w_h·height / diag − w_c·contact / area.
  - The weights sit in each printing profile (`orientWSupport` 2, `orientWOverhang` 1, `orientWHeight` 0.5,
    `orientWContact` 0.5), source id `P-ORI`: a BaroCSS heuristic, a default to adjust.
  - Overhang and bed contact are AM2's (exact planar normals; curved faces by triangles, said approximate).
  - Support volume only for the eight best by the cheaper terms: a ray straight down from each overhanging triangle
    through a bounding-volume tree of the display mesh (median split, typed arrays, an iterative slab test and
    Möller–Trumbore, no closures in the loop), to what is below it or the bed.
- **Deterministic:** by score, then the lower height, then the candidate's index. The top three are reported with
  their terms, the weights and the time.
- **`orientPart`** takes the largest body and the profile's limit and weights; refused (said) without a printing
  process. **Agent tool `orient_for_print { apply? }`** writes the best direction to `doc.print.direction` (−0
  cleaned); `apply: false` only scores.
- **The print plane for library checks:** `print.bendInPlane` (the snap hook's FDM rule) now resolves from
  `doc.print`: the part bends in the layers when its normal lies within 15° of the bed's plane.
- **Cavities (the peer's note on AM3):** counted by the B-rep's inner shells where the body has them; the display
  mesh's pieces only for facet bodies, the method said per body in the rule's `why`.
- **Limits, said:** support is a ray-sampled estimate from triangle centroids (not a slicer's support); the candidate
  set is fixed, not a continuous optimum.

Evidence (`test/printing.test.ts` 8/8):
- A T (stem 10 × 10 × 20, bar 40 × 10 × 5): best lies on its flat side — height 10, contact 400 mm², overhang 0,
  support 0. Upright its bar overhangs 300 mm²; upside down 0. The same answer twice; top three ordered, terms finite,
  the profile's weights.
- A 60 × 40 × 2 plate: flat (±Z).
- The ray tree against a brute force over every triangle: 200 rays, identical hits.
- 99 904 triangles, 64 candidates: 590–650 ms (limit 2 s).
- The snap hook on an FDM plate: printed up +Z it is warned (bending across the layers); up +X not.
- `orient_for_print`: dry run unchanged, applied direction equals the reported best, refused with no process.
- The hollow box's cavity counted by B-rep shells.
- Studio 333/333; lint 0 errors.

Next: AM5, 3MF export.

## D76 — AM5: 3MF export (2026-10-18)

Decision (`src/io/zip.ts`, `src/print/threemf.ts`, `src/print/export3mf.ts`; with the peer's notes):
- **Own package writer:**
  - The ZIP and CRC-32 are our own code. UTF-8 names; entries stored, or raw-deflated when that is smaller.
  - The deflate is the web-standard CompressionStream, 'deflate-raw' or zlib with its header and trailer stripped.
  - No ZIP64: past 4 GiB, or past 65 535 entries, it is refused.
  - The PNG encoder (`chat/views.ts`) now shares the same CRC-32 and deflate.
- **The model:** `[Content_Types].xml`, `_rels/.rels`, `3D/3dmodel.model`.
  - The model is in millimetres, with Title, Application and (when dated) CreationDate metadata.
  - Objects:
    - each visible body (and each shown instance's, already in place) is one object;
    - vertices are welded at bit-identical 32-bit points (the display mesh repeats them per face; the B-rep tessellation shares edge points, so welding closes it);
    - triangles that collapse are dropped and counted;
    - coordinates are written as the shortest decimal that reads back as the same float.
  - **Base materials:** one per (material, colour) — the material's label, the body's colour or the default grey.
  - **Face colours:**
    - by default, further base materials (core 3MF: every reader);
    - optionally, a Materials-extension colour group, and then `requiredextensions="m"`, because a reader that ignores the group would leave dangling references.
  - **Production extension:** UUIDs on every object, the build and every item. They are random by default; the caller may supply its own.
  - **Build items:** one per object.
    - With an AM4 print direction, every item is turned by the shortest rotation that brings the direction to +Z.
    - The lowest point is set at z 0, centred on the chosen printer's bed (else x and y are left as modelled).
    - The same transform goes on every item, so assemblies keep their layout.
  - Stats: objects, items, triangles, vertices in and out, dropped triangles, open and repeated directed edges, model XML bytes, package bytes, ms. Open or repeated edges are reported (and toasted), not refused.
- **Studio:** an Export 3MF button beside STL.
- **Refusals, said:** nothing visible, no item, an item naming a missing object, a transform that is not 12 finite numbers.

Evidence (`test/threemf.test.ts` 4/4; read back by an independent reader — Node's zlib for inflate and CRC-32, the test's own ZIP and XML scan — and by Python's zipfile (`testzip`) and ElementTree):
- 20 × 10 × 5 ABS box:
  - the three parts and their content types and relationship;
  - welded to 8 vertices and 12 triangles, no open or repeated edges;
  - volume read back exactly 1000 mm³;
  - base material ABS #CC3333;
  - 3 UUIDs;
  - the same inputs give the same bytes;
  - Python reads 8, 12, millimeter.
- Top face green: 2 triangles point at a second base material; as a colour group, `requiredextensions="m"` and 2 `pid="2" p1="0"`.
- One object built twice (a quarter turn and 50 mm along X): extents 40–50 × 0–20, volume 1000.
- Refusals as said.
- Standing on its end (+X up) on the 256 mm FDM bed: z from 0 to 20, centred at (128, 128), volume 1000.
- The rotation onto +Z: exact and orthonormal for six directions.
- 200 344 triangles: model XML 13.93 MB, 3MF 2.17 MB (15.5%), written in 377–420 ms. Coordinates read back as the same 32-bit floats. Closed.
- Studio 337/337; lint 0 errors.

Not done, said:
- No slicer on this machine (PrusaSlicer, Bambu, Orca, Cura absent): opening in a slicer is left to be checked by hand.
- No thumbnail is written yet.

Browser evidence (added at the peer's review):
- **Browser flow:** a new step clicks Export 3MF on a new box and captures the download.
  - It reads the download back independently: CRCs by zlib, entries inflated by zlib; Python's zipfile `testzip` and ElementTree read 1 object, 8 vertices, 12 triangles, 1 item, millimeter.
  - The volume read back is the box's from its sketch and height. There are 3 UUIDs.
  - The toast reads "3MF written: 1 body, 12 triangles … As modelled" and nothing open.
- **Full flow:** 118 steps; the first run had one failure, step 100 (F2 ring with a hole).
  - Cause: a race in the test. While the 30k-triangle ring evaluated, the body panel showed the previous part's body (a 32 × 32 × 16 box, 16,384 mm³) under the new document's name ("Mesh ring").
  - The engine gives 9,737 mm³ in Node, as D52 recorded.
  - The step now waits for the ring's own bounds (50 × …) before reading the volume; its volume check is unchanged.
  - Rerun after step 99: passes. The full flow was not rerun after the fix.
- The body panel paired the new document's names with the previous evaluation's bodies until the new one arrived. Fixed in D77.

Next: R7 (SD2).

## D77 — Stale evaluation results never shown under the new document (2026-10-18)

Found by the AM5 browser flow; fixed at the peer's review (contained defect, fixed now).

The fault: the studio kept the last evaluation's bodies while a new document evaluated (a 30k-triangle mesh takes
about a second). The body panel named them from the new document. A box's 16,384 mm³ showed as "Mesh ring".

Decision (`src/App.tsx`):
- **Each body list is tagged with the evaluated document it was computed for** (`bodiesFor`, by identity).
  - A command's preview bodies, set at once on Apply, are claimed by the document that commit produces. So the step back to old bodies stays avoided (D-preview) without a stale tag.
  - Fresh means `bodiesFor === evaluated`.
- **While stale:**
  - The outliner's count reads "evaluating…" (or "not up to date" after a failed evaluation).
  - The bodies are listed dimmed, not interactive, named from the document they were computed for.
  - A selected body's card says it is evaluating and shows no name or values.
  - The part summary (mass, centre, bounds) and a proposal's volume change are hidden.
  - The requirement checks do not run.
  - The chat's selection context is empty.
  - STL and 3MF export refuse with "still evaluating".
  - STEP, drawings and the chat evaluate the document themselves, and so were already current.
- The viewport keeps drawing the old bodies until the new ones land: that is geometry with its own face names, not paired with the new document.

Evidence:
- Browser flow step 100 is now a test of this:
  - a box is made; the ring file is opened, and the first outliner row is clicked at once;
  - a MutationObserver checks every DOM change until the ring is current.
- Against the previous `App.tsx` it fails with "props: Mesh ring with 16384 mm³" (several times). With the fix it passes, and the evaluating state was seen.
- Full browser flow 118/118; studio 337/337; lint 0 errors.

## D78 — R7 SD2: extraordinary vertices, n-gons and darts as G1 caps (2026-10-18)

Decision (`packages/barocss-cad/src/subd-sd2.ts`, `subd.ts`, `subd-report.ts`; studio "SubD box"):
- **When SD1 is left.** A cage regular everywhere (only quads; every vertex valence 4, or a straight crease, or an
  all-sharp corner, or a regular boundary) is SD1's, unchanged: the same faces and names.
  - Otherwise one Catmull–Clark step is taken (OpenSubdiv: sharp edges midpoint, crease vertices (a + 6v + b)/8, corners fixed, darts smooth).
  - A second step is taken when a quad would hold two irregular corners: an n-gon's face point beside an irregular vertex.
  - `steps: 2` asks for the second step anyway: caps a quarter of the area, nearer the limit, four times the faces.
  - Not a *local* step as the roadmap first said: refining only round the vertex leaves T-junctions. The global step keeps every regular region exact (B-spline refinement).
- **Exact where it can be.** A quad whose corners are all regular is SD1's exact bicubic B-spline, packed into faces as before.
- **Caps.** A quad at an irregular vertex is one face: a bicubic patch split once each way at τ = ¼ from the vertex, with double knots `0 0 0 0 ¼ ¼ 1 1 1 1` (2 × 2 Bézier pieces, C1 inside).
  - **Start:** the generalised B-spline-to-Bézier averages:
    - face points (4c + 2a + 2d + o)/9;
    - edge points the mean of the two faces' points, or (2v + a)/3 along a sharp edge;
    - corners at the exact limit position (smooth (n²v + 4Σe + Σd)/(n(n + 5)), crease (a + 4v + b)/6, corner v).
    - These reproduce SD1's B-spline wherever all four corners are regular.
  - **Held:**
    - the rows next to a regular neighbour (C1 with it, and with the limit there);
    - the irregular vertex at its limit position;
    - crease and boundary edges as their B-spline (G0 across them).
  - **G1 conditions** along every edge out of the vertex that is not sharp: ∂(left) + ∂(right) = α(t)·b′(t), with α = 2 cos θ (1 − t/τ)² on the part at the vertex and 0 beyond.
    - That part of the edge is kept quadratic (third difference 0), so α·b′ is cubic like the cross derivatives.
    - The condition, a polynomial of degree ≤ 4 on each part, is imposed at five points of each.
    - **θ:** 2π/n round a smooth vertex or a dart; π/k across k faces between a crease's two edges or at a boundary; φ/k at a corner.
    - A dart's sharp edge is shared (G0), not G1.
  - **Solved per vertex.** The conditions are made orthonormal (modified Gram–Schmidt, twice). A dependent condition must already hold within 1e-9 of the cage's size, else CAPABILITY.
  - **Fitted.** Within the conditions (null-space least squares), the cap is fitted to the limit surface itself.
    - Samples: a 9 × 9 grid per cap, refining its one-ring three times.
    - Each of four rounds moves every sample's parameters to its closest point on the cap just fitted, so the surface is fitted, not the limit's non-polynomial parametrisation.
    - A slight pull μ = 1e-6 to the start covers what the samples leave free.
- **Found and fixed while measuring: folded caps.**
  - The first form, α = 2 cos θ (1 − 2t) on the half at the vertex and 0 beyond, has a kink at the double knot where it is 0. A cap's cross derivatives are C1 along the edge there, so the kink forces the edge's derivative to 0 at the knot.
  - The caps collapsed and folded: |Su × Sv| ≈ 1e-15, normals 180° apart, tessellation never settled (RB TIMEOUT).
  - G1 along the edges and a small closest-point distance (0.031 mm) both passed. So the report now measures the caps' shape (below), and the tests tessellate every case.
  - With α C1 at τ: |Su × Sv| ≥ 0.15 of its median, normals turn ≤ 1.8°, and the cube's deviation fell to 0.0033 mm.
- **Measured and not taken:**
  - α nonzero on the far part (c (1 − s)², that part quadratic): no solution for one case; folds at τ = ¼.
  - α from the limit's own edge directions at a crease vertex (not evenly spread: 4 faces 59.7°, 30.3°, 30.3°, 59.7°): deviated more (half star of 4: 0.26 mm against 0.13 mm).
  - τ: the cube cage gives 0.0020 mm at τ = 0.2, 0.0033 at ¼, 0.0105 at ½. The half star of 5 gives 0.26, 0.16 and 0.21: ¼ is the compromise.
- **Names.** Refined quads are labelled by face and corner (`<face>_<corner>`, `<face>_<corner>_<corner>` after two steps). Caps are `<id>.cap<label>`; exact faces `<id>.patch<label>` (SD1 cages keep `<id>.patch<k>`).
- **Refused.**
  - INPUT: a vertex whose faces are not one fan (a bowtie), a face of fewer than three sides, and the earlier input refusals.
  - CAPABILITY: more than 32 edges at a vertex or sides on a face; a cap with no G1 solution.
- **Promised:** C2 away from irregular vertices; C1 between caps and exact faces; G1 at and round irregular vertices; G0 across creases; never G2.
- **The report** (`subdReport`):
  - Steps, irregular vertices, caps.
  - **G1:** along every edge that is not sharp, both faces' normals at 9 points by their own parameters (the largest angle) and the largest gap between them.
  - **Caps' shape**, on a 33 × 33 grid per cap: the smallest |Su × Sv| against its median, and the largest angle between neighbouring normals. A one-face crease sector's corner (a straight angle, as in the limit) is left out.
  - **Deviation:** limit samples on a 17 × 17 grid per cap, refining its one-ring four times. Given as the distance to the closest point on that cap, and at the same parameters.
  - **Exact quads**, measured the same way as a check of the measure (≈ 1e-14).
- **Studio:** "SubD box": a box cage of n quads along each side, its eight corners valence 3. The history label says faces when the cage has other polygons.

Evidence:
- **Kernel `test/subd.test.mjs` 10/10.** Every SD2 case is checked for: strictly valid; G1 ≤ 1.7e-6°; gaps ≤ 1e-12 mm; |Su × Sv| ≥ 0.05 of median; normals turn < 15°; it tessellates.
- Volumes are checked against an independent Catmull–Clark written in the test (any polygon, sharp rules, limit masks; levels 5 and 6 extrapolated).

  | Case | Steps | Deviation (mm) | Volume against the limit |
  |---|---|---|---|
  | Cube cage (24 caps) | 1 | 0.0033 | −4.5e-5 |
  | Tetrahedron | 2 | 0.0007 | |
  | Pentagonal prism | 2 | 0.0036 | |
  | Hexagonal prism | 2 | 0.0093 | |
  | Creased-top cube | 1 | 0.0034 | |
  | Dart torus (8 × 6) | 1 | 0.050 | |
  | Stars of 3, 5, 6 | 1 | 0.0001–0.012 | |
  | Half stars round a boundary vertex of 3, 4 faces | 1 | 0.066 / 0.140 | |

  - The cube's STEP round trip holds to 1e-9; the inward-wound cage gives the same body.
  - Refusals: bowtie, two-sided face, valence 33.
- **The weak spot:** boundary and crease vertices, at up to 0.7% of a 20 mm sheet with one step. With `steps: 2` the 4-face half star is 0.084 mm and the cube 0.0007 mm.
  - TODO: the limit's own characteristic map for crease sectors (eigen-analysis), so caps there follow the limit's uneven edges.
- **Conformance `conformance/r7/`, 7 cases:**
  - cube, creased top, tetrahedron, pentagonal prism, dart torus: volume, area and centroid against the independent oracle to 2e-3; STEP round trip;
  - refusals: valence and bowtie.
  - R5's two refusal cases (extraordinary vertices, darts) are kept as the record and marked `supersededBy: R7`; the harness skips such cases (README).
- **Speed (Node):** cube cage build 70–150 ms (24 caps, fit included); tessellation of every case under 0.11 s.
- Studio 338/338, primitives 12/12 (SubD box). Browser flow "SubD box":
  - default box 30 × 20 × 16, 3 quads a side: 60 faces, 24 of them caps, volume 8,638 mm³, inside its box;
  - in the kernel: deviation 0.0025 mm, |Su × Sv| ≥ 0.10 of median, turn ≤ 1.7°;
  - its display mesh: 2,588 triangles, watertight, smallest 0.019 mm².
  - "SubD torus" still passes.
- **Observed, not fixed:** the box's screenshot shows a short dotted dark stroke on its top face near a corner.
  - Its mesh is watertight with no sliver, and the cap there is G1, unfolded, within 0.0025 mm.
  - So it is in the viewport's drawing (likely ambient occlusion on a shallow ridge of triangles), not the geometry.
  - TODO: look at it with AO off and with zebra.
- Kernel 1001/1002 (the known environmental test); lint clean. RB over conformance and corpus: 1,102 rows, every R7 row OK, the WRONG/INVALID rows the known TODOs.
- RB now skips superseded cases too.

## D79 — SubD shading, dents, and cap deviation shown (2026-10-18)

Asked at the R7 review: verify the dark stroke on the SubD box (it was called "likely AO", unverified), and show users the caps' deviation.

**Standing rule (from R7):** every SubD test checks, besides G1 and deviation:
- the caps' shape: |Su × Sv| against its median, and the turn between neighbouring normals;
- tessellation.

Folded caps once passed G1 (1e-6°) and deviation (0.031 mm) both.

**The stroke: shading and tessellation, not geometry.**
- Looked at in the browser, before and after, close up on the box's corner:
  - **AO off:** the stroke went. That pointed at the depth-based AO, which samples the triangles' depth, not the normals.
  - **Zebra:** before, broken across faces with a glitch at the stroke; after, continuous.
  - **Cap highlight:** cap selected and drawn; nothing there.
- **Display normals compared with the exact surface normals at the same vertices.**
  - Each face averaged its own triangles' normals: up to 8° off on caps and 17° on exact faces.
  - Two faces meeting at a G1 edge got different normals at the same point: a shading seam at every face edge.
  - **Fix (`brep-tessellate.ts`):** a parametric face's vertex normal is now the surface's own (Su × Sv by its tessellator's differences, turned by the face's sense; a pole keeps the average): ≤ 1e-4° off.
- **The stroke itself: a dent.**
  - Triangles on an edge chord tilted from the surface: the chord lies below it by its sagitta, and the face's points are near it, with a 2.1 mm chord and a point 0.16 mm off.
  - Neighbouring faces' triangles then folded 51° concave where they met. On the 6-a-side box an old triangle was folded 180°.
  - **Fix:** after a pass, any edge chord whose triangle is tilted more than one step (π/2/segmentsPerQuarter) from its corners' surface normals gets its midpoint added to that edge. Both faces share it, so the mesh stays watertight. Every face is tessellated again, up to three rounds.

  | Box (quads a side) | Largest concave fold before | After |
  |---|---|---|
  | 3 | 51° | 18° |
  | 6 | 180° | 38° |

  - The browser render shows no stroke with AO on.
  - Tried and dropped: splitting tilted triangles inside a face (it never settled at boundary chords, and hung the 6-a-side box).
- **TODO:** the remaining folds of 14–38° are near-collinear slivers along boundaries, in the general B-spline face tessellator.
- **Cost:** 6-a-side box tessellation 374 ms (241 before); 3-a-side 159 ms.

**Cap deviation shown.**
- The kernel's subd output carries `subd: SubdSummary`: steps, irregular vertices, caps, the caps' largest distance from the limit surface, that at crease/corner/boundary vertices, and the size (refined cage's bounding diagonal).
- Each cap's distance is measured at build time on the limit sampled 17 × 17 by closest points, the same as `subdReport`: cube 0.0033 mm in both. Build cost: box 3 a side 259 ms (was 150).
- **Body notes:** "Caps: G1 at N irregular vertices (k caps, s Catmull–Clark steps); max deviation from the limit surface X mm (Y% of its size)".
- **Warning:** at crease, corner or boundary vertices past 0.2% of the size, naming the cause and the to-do. The limit's edges there are not evenly spread and the caps use even angles; the limit's own characteristic map is to do. The 4-face half star (0.14 mm, 0.63%) is warned; the SubD box (0.0025 mm, 0.0063%) is not.
- **A3:** `subd_deviation {body?, at?: all | crease}`, in mm, with the share of size in its hint; unknown for a cage regular everywhere (exact).

Evidence:
- Kernel `subd.test` 11/11. New:
  - vertex normals within 0.01° of the surface's;
  - folds < 25° (3 a side), < 45° (6 a side);
  - watertight.
- Studio primitives 13/13. New:
  - the box's note text;
  - the half star's warning;
  - `subd_deviation` failing a ≤ 0.05 mm requirement on the half star, passing on the box, unknown on the torus.
- Screenshots (before / after) kept in this session's scratchpad, not committed.
- **Caught by the suites:** splitting an edge of a facet face broke its exact mass (r6 facet cube ∩ sphere: 112.98 against 113.10 mm³). A facet face triangulates its own mesh points, not the edge samples, so facet faces' edges are never split now.
- **Suites:**
  - kernel 1002/1003 (the known environmental test);
  - conformance all;
  - RB 1,100 rows, nothing new — WRONG rows 7 → 5: two known oracle rows (grazing cylinder–box) now pass;
  - studio 339/339;
  - full browser flow 119/119;
  - lint clean.

## D80 — R8.1 SD3: the cage's topology and edits as pure functions (2026-10-18)

Decision (`packages/barocss-cad/src/subd-cage.ts`, exported from `@barocss/cad`). At the peer's note they live in the kernel, not the studio: the studio's editor, the agent tools (R8.2) and headless use share one implementation. Each function takes a cage `{positions, faces, creases?}` and gives a new one, or refuses with SubdError INPUT.
- **Topology:** half-edges, edges with their faces, each vertex's faces and neighbours.
- **Validation (for the overlay):**
  - non-manifold edges (three faces, or a side used twice the same way);
  - non-manifold vertices (faces not one fan, found by walking face to face);
  - poles (inside valence ≠ 4, boundary ≠ 3 or 2);
  - n-gons, boundary edges, darts, unused vertices.
  - Valid means no non-manifold edge or vertex and no unused vertex.
- **Selection:**
  - **Edge loop:** straight across each valence-4 vertex of four quads, stopping at a pole, a boundary or the start.
  - **Edge ring:** across each quad to its opposite edge, oriented alike, stopping at a non-quad, a boundary or the start.
  - A selection's vertices, from vertices, edges and faces.
- **Edits:**
  - **move;**
  - **extrude faces as one region:** the region's vertices are copied along its normal (the mean of its faces' Newell normals), with a side quad on every border edge, wound to meet both sides as twins;
  - **extrude boundary edges:** a quad out along a delta, shared along a chain;
  - **insert an edge loop** across a ring at t: each quad split in two; a face at a ring's open end takes the point and becomes an n-gon (R7 builds it); creases on ring edges stay creased on both halves;
  - **delete faces**, then **compact** (unused vertices dropped and renumbered; creases kept where their edges remain);
  - **fill a hole** with one face run against the boundary (an n-gon);
  - **bridge** two boundary loops or chains of equal length: quads meet both as twins, at the offset with the shortest bridge;
  - **weld** a group, or pairs within a tolerance (all at once): faces losing a side keep the rest, faces under 3 sides go, and it is refused if the result is not a manifold;
  - **creases** on and off.
- **Mirror:** one plane through the origin across X, Y or Z.
  - The half's vertices on the plane are shared and the rest copied with faces wound back; creases are copied. A face in the plane is refused.
  - `keepOnPlane` puts on-plane vertices back after a move.
  - The studio will keep the half and the axis on the node and send the kernel the full cage (R8.2).

Evidence (`test/subd-cage.test.mjs` 5/5). Every edit's result is a valid cage and a valid kernel body.
- Validation:
  - the cube: valid, 8 poles of valence 3;
  - a 3 × 2 sheet: 10 boundary edges;
  - a bowtie, a doubled face, an unused vertex and two darts flagged.
- Selection:
  - a torus loop closed at 8 edges; a ring round the tube of 6;
  - a grid row loop open to the boundary at 4; a grid ring of 4.
- Extrude and insert:
  - the cube's top extruded 5 mm: 10 faces, the copies at z 15, taller;
  - a sheet's boundary chain extruded;
  - an edge loop round the cube (10 faces) and across a torus (54);
  - a ring ending at a grid's boundary.
- Delete, fill, bridge, weld, crease:
  - the cube's top deleted (5 faces, 4 boundary edges) and filled: the cube's volume to 1e-12;
  - two open boxes bridged: one closed body, genus 0, 14 faces;
  - an edge's ends welded: 7 vertices;
  - two sheets welded by distance: 6 vertices;
  - every edge creased: 1000 mm³ exactly.
- Mirror:
  - a half box mirrored is the same body as the whole 2 × 1 × 1 box cage: volume to 1e-12, centroid on the plane;
  - a move kept on the plane;
  - a face in the plane refused.
- Refusals: mismatched bridge, an open fill, not an edge.

## D81 — R8.2a SD3: the studio cage editor, first part (2026-10-18; paused for PERF3)

Done (`src/subd/cageEdit.ts`, `useCageEditor.ts`, `ui/CagePanel.tsx`, `viewport/CageMarks.tsx`; kernel `subdPreviewMesh`, `halfCage`, `extrudeFaces` with `noWall`):
- **Session on a subd node** ("Edit cage" in the palette).
  - The cage, or its half with `mirror` on the node; the studio sends the kernel the full cage (`mirrorCage`).
  - Its own undo and redo (⌘Z inside the session).
  - Done writes the node once: one document undo step, the same timeline feature. Cancel drops it. Done is refused while the cage is not a manifold.
- **Picking and selection:**
  - vertex, edge and face modes (keys 1 2 3); Shift adds;
  - double-click an edge for its loop (Alt: its ring);
  - the cage is drawn over the body, each kind of mark as one SVG path.
- **Gizmo:** moves the selection; Shift held as the drag starts extrudes faces or boundary edges first; mirrored cages keep the plane's vertices on it and put no wall in the plane.
- **Operations** (panel and keys): extrude (E), insert loop (L), loop and ring, bridge (B), fill (F), weld (W), weld near, crease (C) and smooth edges, delete (⌫), mirror across X, Y or Z (refused if a face crosses the plane), mirror off.
- **Box / Smooth** (Tab). While dragging, a quick limit preview: the kernel's uniform Catmull–Clark at levels 1–3, chosen so the preview stays under about 20 000 triangles. After each step, the exact body: one kernel build per step, never per pointer move.
- **Validation overlay:** red non-manifold, ringed poles, tinted n-gons, open edges, plus the counts in the panel.
- Measured in Chrome (WebGPU), dragging a top face:

  | Cage | Per pointer move | Frame time | Preview |
  |---|---|---|---|
  | 6-a-side box (216 faces) | 26 ms | 16.7 ms (p95 16.7) | 5 ms |
  | ~2k-face box (1 944 faces) | 48 ms | 16.7 ms (p95 16.8) | 10 ms |

  - Each pointer move includes Playwright's own round trip.
  - Before two fixes the ~2k cage took 114 ms per move (p95 117): the overlay was redrawn as 3 900 elements, and the validation was recomputed on every move (now the session's, since a move keeps the topology).
  - A render loop was caught in the same run: the preview time was set every render.
- Evidence:
  - `test/cageEdit.test.ts` 4/4: picking; drag; extrude on drag; undo and redo; loop; insert loop; crease; delete and fill; mirror (exact); preview levels.
  - Kernel `subd-cage` 5/5 (halfCage, mirror round trip exact).
  - Studio 343/343.
  - A scripted Chrome run: SubD box → Edit cage → top face picked → Shift-drag up 4.1 mm (54 → 58 faces) → Done (one node, cage 58) → ⌘Z (54).

Still to do in R8.2 (after PERF3):
- agent tools (`subd_select`, `subd_extrude`, `subd_insert_loop`, `subd_bridge`, `subd_fill`, `subd_weld`, `subd_crease`, `subd_move`; under D41, proposals at L2 for topology);
- a browser-flow step;
- the cap cache by one-ring hash, so a drag rebuilds only nearby caps (PERF3 A4).

## D82 — PERF3: second performance review (2026-10-18; owner: before R8.2)

The owner asked for it ("PERF3 성능 개선을 R8.2 앞에 넣어서 엔진 리뷰 세션에 전달해줘"). It came from a read-only review of f4648d8e6 by four agents (kernel, app, GPU, benches). Each finding is confirmed in code before it is changed, and measured before and after.
- **Baseline** (`pnpm bench`, Node 22, Apple M-series):

  | Bench | Time |
  |---|---|
  | 16-hole plate, cold | 1 397 ms |
  | filleted box: tessellate / mass | 37.6 / 449 ms |
  | 20-feature chain, unchanged | 0.13 ms |
  | stepped body × 12 | 694 ms |
  | 120-hole drawing | 1 283 ms |
  | pole drag | 4.1 ms |

### A1 — requirement checks after every edit
- **Confirmed and measured:** eight requirements on the 16-hole plate printed on FDM took **4 075 ms** after every edit, on the main thread.
  - `faceTableOf` evaluated the whole part (≈ 1 s) on every call. It ran once for `overhang_area` and again inside every `printability()`, which every `print_rule` also re-ran in full.
  - `wallThickness` ≈ 25 ms each time; facts ≈ 0.
- **Fix:**
  - The worker and in-process evaluations hand back the face table built from the B-rep they already have (`faceTableFrom`, a few ms). The client registers it on the main thread (`rememberFaceTable`, by the part's content).
  - `faceTableOf` reads that cache before it would evaluate; `tableOf` is now the same function.
  - One printability report per evaluation (its bodies array), process, printer, direction and looks.
  - Wall thickness kept per mesh.
- **After: 22 ms** (×185). The new bench `check_spec: 8 requirements after an edit` has a budget of 50 ms.
- Studio 343/343.

### A2 — two draws per state change
- **Confirmed:**
  - GpuRenderer's mesh setters call the viewer's `requestRender`, which schedules its own animation frame and draws.
  - The viewport then asks for its frame, and its `render()` draws again in the same frame. The viewer's `render()` cancels only a draw still pending, and by then the viewer's had already run.
- **Fix:** a viewer option `onRequestRender` (`@barocss/gpu`): host-driven frames.
  - The viewer hands its requests to the host. GpuRenderer routes them to the viewport's request (`setRequestHost`), which draws once per animation frame.
  - Viewers without the option schedule their own frames as before.
- **Bench (`bench:browser`):** now counts submits by animation frame (timestamp shared by every callback of one frame), and has two new scenarios: a face clicked from idle, and the selection cleared. Every scenario's budget is one submit per frame.

  | Scenario | Before | After |
  |---|---|---|
  | hover, 60 moves | 34 submits, 2 per frame | 17, 1 |
  | face clicked | 2 in one frame | 1 per frame |
  | Escape | 2 in one frame | 1 |
  | orbit, 60 steps | 61, 2 in one frame | 60, 1 |

- GPU package 70/70.

### A3 — an agent's turn evaluates the same parts again
- **Confirmed (new `test/evalCount.test.ts`):**
  - Five holes in one `apply_ops`, on a block with four filleted corners and two hard requirements that pass, cost **9** evaluations: one per op, plus one per fillet for the reference check at the batch end. Those four are prefixes that did not change: the fillets' own batch had evaluated them.
  - The same five holes as a proposal cost **5**, and accepting it **5 more**: the same ops on the same part.
  - Server: the MCP's `changed` flag stays set for the rest of the turn, so the chat server re-sent the whole part after every tool result, read-only ones too.
  - Client: the chat panel evaluated every state it received, and none was dropped. Each was parsed from JSON, so every node was a new object, which the worker wire re-sent and the evaluator's chain did not reuse.
- **Fix:**
  - `rememberedEvaluate` (`engine/evalMemo.ts`): evaluations kept by what they read (`evaluatedPart`: nodes, parameters, outputs, instances), the last 16. Refusals and superseded runs are not kept. Every ops run (apply_ops, propose, accept, rebase) and every reference check or signature refresh goes through it.
  - `StateFile.version`: the MCP bumps it on each change, and the chat server sends a state only when it rose. A state file without it is sent as before.
  - The panel's previews go through `latestPump` (`chat/pump.ts`): one evaluation at a time, and a state that arrives meanwhile replaces the one waiting, so a burst costs at most two evaluations. `reshareNodes` gives each received state the node objects of the one before wherever they are equal, so the wire and the chain see only what changed.
- **After:**

  | Flow | Evaluations before | After |
  |---|---|---|
  | five-hole `apply_ops` | 9 | 5 (one per op is the floor: a later op names faces of the body the one before left) |
  | propose | 5 | 5 |
  | accept | 5 | 0 |

  - In Node the batch went from 120 ms to 107 ms; evaluation is 101 of the 104 ms left.
  - In the studio each evaluation saved is a worker round trip that posts meshes.
- **Measured, not done:**
  - Deferring the guard, facts and description to the batch end would save about 3 ms of that 104.
  - Caching `checkSpec` by model hash: after A1 a check is about 1 ms on this part and 22 ms on the 16-hole plate, and a proposal runs two of them.
- Studio 348/348 (343 before): new tests for evaluation counts (2), the pump and resharing (2), and the server's version rule (1).
- **The memo's key (peer's review of dfae081e1):** whole-part JSON on every lookup cost too much on large parts.

  | Part | Whole JSON per lookup |
  |---|---|
  | 5 MB STEP import | 12 ms |
  | 30 MB STEP import | 69 ms |
  | 200k-triangle inline mesh | 53 ms |
  | 2k-face cage | 0.6 ms |
  | 20 plain nodes | ≈ 0 ms |

  A batch looks up about one part per op and per reference, so this brought back the whole-document JSON that PERF2 had removed.
  - **Now `evaluationKey`:**
    - each node's text is kept per node object;
    - texts over 64 KB stand in as an exact id from a map of the last 8 texts (content-compared, never reused);
    - number arrays over 4 096 entries stand in as their length plus two 32-bit FNV-1a hashes of their doubles, kept per array.
  - **After:**

    | Part | Same nodes | Nodes made again | Read again from JSON |
    |---|---|---|---|
    | 30 MB import | 0.00 ms | 0.01 ms | 4.0 ms |
    | 200k-triangle mesh | 0.00 ms | | 4.2 ms |
    | 2k cage | | | 0.47 ms |

  - `test/evalMemo.test.ts`: equal parts share a key whatever their objects; a changed character, number or parameter changes it; timings.
  - Studio 351/351.

### A4 — SubD builds
- **Confirmed (profile):** the G1 caps were 97% of a build. Of that:
  - `limitGrid` 42%. Each face's one-ring was refined three times for the fit's samples and again four times for the deviation's, and `polyMesh` (a `Map` of every half-edge, a throw per rim vertex of a one-ring, `Array.from` on typed arrays) was most of it.
  - Closest-point solves 40%. Every evaluation allocated, and every solve ended with a line search that tried all 20 halvings after the step had stopped moving (u, v): 1.37 M trials for 70 k solves on the bump cage.
  - The fit 12%, which walked each sample's dense row once per free direction.
- **Fix (`subd-sd2.ts`):**
  - `limitGrids`: one refinement chain gives both levels.
  - `polyMesh`: half-edges indexed by their start vertex instead of a `Map`; a rim vertex of a lenient mesh is a corner without a throw.
  - `gridAt`: scratch buffers, the same sums in the same order.
  - `fitWithin`: walks only a row's nonzero entries, ascending.
  - **Caps kept by their vertex's 2-ring** (`keptCapsAt`, the last 512). They are worked out on a copy of the 2-ring with its faces in the cage's order: every fan starts and runs as in the cage, so the caps are the same to the bit (checked against the caps before the change on three cages). The copy's content is the key, so an edit outside a vertex's 2-ring reuses its caps, and a build never depends on what was built before.
- **Bit for bit**, every change above except one leaves the caps as they were. The exception: a solve now stops when a step moves (u, v) by less than 1e-13 instead of halving it 20 times. On the three cages this moves poles by at most 2.3e-8 mm and deviations by at most 6.6e-10 mm (1.4e-7 relative). The G1 conditions hold exactly whatever the sample parameters, and the caps' own deviation from the limit is hundredths of a millimetre. Without the stop the builds below are about 25% slower.
- **After** (old and new built alternately under the same load):

  | Build | Before | After |
  |---|---|---|
  | box cage (6 quads), cold | 149 ms | 66 ms |
  | ~2k-face cage (box of 18 a side), cold | 190 ms | 103 ms |
  | 6-a-side box with 4 extruded bumps (24 irregular vertices), cold | 945 ms | 438 ms |
  | ~2k-face cage, one vertex moved | 183 ms | 24 ms (the caps reused; the rest is the cage's quads) |
  | bump cage, one vertex moved | 945 ms | 4 ms |

  The SubD box's tessellation is 27 ms, unchanged; that is A5.
- **Not done:** refining a vertex's whole 2-ring once for all of its faces, instead of each face's one-ring. It would change the sums' order (a different mesh numbers the fans differently), so the caps would differ in the last bits, and the cache already removes the cost for edits.
- **Tests:**
  - Kernel `subd.test.mjs` 12/12. The new test: the same cage again gives the same caps; a vertex moved outside every irregular vertex's 2-ring leaves them all; one inside a corner's changes that corner's three caps only.
  - Kernel suite 1011/1012; the one failure is the known environmental Node-version test.
  - RB: nothing new; the TODO rows are the known open items.
  - Studio 351/351.
- **Benches (`pnpm bench`, budgets about 2× the values above):**

  | Bench | Time | Budget |
  |---|---|---|
  | `subd: box cage build (cold)` | 64 ms | 150 ms |
  | `subd: 6-a-side box, 4 bumps (cold)` | 457 ms | 900 ms |
  | `subd: ~2k-face cage, one vertex moved` | 22 ms | 60 ms |
  | `tessellate: SubD box` | 22 ms | 60 ms |

### A5 — tessellation's D79 split rounds
- **Confirmed:** each of up to three rounds re-tessellated every face.
  - It also re-evaluated every edge's samples, rebuilt the segment index over every edge (facet edges too, then skipped at lookup), and rebuilt `segments` for mass every round.
  - `emit` summed the per-position normals (`byPos`) even where every point had an exact one.
  - In `surfaceTriangles`' Delaunay flips, `across` copied a `Set` to an array per call, `flat3(t)` was worked out for each of a triangle's three edges, and `len2` (two `Math.hypot`) twice for one value.
- **Fix (`brep-tessellate.ts`):**
  - Each face's mesh is kept from round to round and joined in the faces' order at the end. After a round, only the faces with a split edge in their loops are tessellated again. A face's mesh reads its own loops' samples only, so the others stand.
  - Only split edges are sampled again, and the segment index (without facet edges) is updated for those.
  - `segments` are filled once, at the end.
  - `byPos` is worked out only when some point has no exact normal.
  - In the flips, the same values are worked out once.
  - The loops' topology check runs once, before anything walks the loops (it ran per round).
- **The mesh is the same to the bit:** positions, normals, indices, faces, edge samples, `segments` and `parameters`, on ten cases (SubD box, ~2k-face body, bump body, filleted box, patterned holes; 4 and 8 segments a quarter).
- **After (best of 4, 8 a quarter):**

  | Body | Before | After |
  |---|---|---|
  | SubD body of the ~2k-face cage (414 faces, 23k triangles) | 2 050 ms | 1 025 ms |
  | bump body | 394 ms | 191 ms |
  | SubD box | 26 ms | 26 ms (its faces all split) |

- **Left:** the flips run full passes over all triangles (up to 50). A worklist would visit far fewer, but on cocircular points (grid-like domains) it can choose other diagonals, so the mesh would change; noted for C16.
- **Tests:**
  - Kernel 1012/1013 (the known Node-version test).
  - RB: nothing new.
  - Studio 351/351.
  - Bench `tessellate: SubD body of a ~2k-face cage`: 1 007 ms, budget 2 000 ms.

### A6 — copies and hashes on every change
- **Confirmed:**
  - `referencesOf` deep-copied the whole document (`structuredClone`), including an imported STEP text: 7.4 ms with a 30 MB import. Every node became a new object, so the worker wire and the evaluation memo saw them all as new.
  - `markedReferences`, run on every change, only reads.
  - `modelHash` (JSON plus FNV over nodes, parameters and bodies: 98 ms with a 30 MB import) ran on every change for `hashNow`, again in every `checkSpec`, and in proposals.
- **Fix:**
  - `referencesOf` copies only what its setters change (`writable`): a referencing feature and its list, mate sides, dimension points and body looks. The rest is shared.
  - `referencesOf(doc, true)` is a read-only walk, used by `markedReferences`.
  - `modelHash` keeps its value: it is persisted in proposal bases and history. It is kept per `doc.nodes` array with the same parameters and bodies objects, so one walk serves an edit.
  - `hashNow` is worked out only while a proposal is open.
- **Test:** `test/referencesCopy.test.ts`:
  - the setters on a deep-frozen document change only the copy, and untouched nodes stay the same objects;
  - the read-only walk returns the document itself;
  - `modelHash` matches the whole walk's value.
- Studio 353/353.

### D18 — budgets about twice the latest values
- **Why:** the old budgets were a few times the 2026-10-17 values, set before A1–A6; most rows had grown 2.5–40× room, so a lost cache could double a cost and still pass.
- **Node (`pnpm bench`, best of the runs, three runs of the whole suite):**

  | Bench | Latest | Budget before | Budget now |
  |---|---|---|---|
  | `evaluate: 16-hole plate (cold)` | 1 359–1 368 ms | 3 000 | 2 800 |
  | `tessellate: 12-edge filleted box` | 33–36 ms | 120 | 70 |
  | `mass: 12-edge filleted box` | 385–388 ms | 900 | 800 |
  | `evaluate: 20-feature chain, unchanged` | 0.24–0.28 ms | 10 | 1 (a 1 ms floor below a millisecond) |
  | `evaluate: stepped body patterned × 12` | 645–690 ms | 1 500 | 1 400 |
  | `drawing: 120-hole plate, 4 views (cold)` | 1 253–1 299 ms | 4 000 | 2 600 |
  | `direct: pole-drag step (warped sheet)` | 4.2–4.3 ms | 20 | 10 |

  The A1/A4/A5 rows already had about 2× budgets and keep them.
- **Browser (`bench:browser`, two runs):**

  | Scenario | Latest | Budget before | Budget now |
  |---|---|---|---|
  | hover, 60 moves | 17 submits, 0.25–0.30 ms a frame | 60, 8 ms | 34, 2 ms |
  | face clicked | 1–2 submits, 0.2–0.3 ms | 2, 8 ms | 2, 2 ms |
  | Escape | 1, 0.2–0.3 ms | 2, 8 ms | 2, 2 ms |
  | orbit, 60 steps | 60, 0.33 ms | 90, 12 ms | 64, 2 ms |

  Frame CPU has a 2 ms floor (headless scheduling noise); the orbit is one submit per step, so its budget is a few submits over 60, not twice. One submit per frame stays the budget everywhere.
- All 13 Node rows and all 4 browser rows pass on the new budgets.

### D19 — the missing benches
- **Added to `pnpm bench`** (`test/bench/node-bench.ts`), each at about twice the value measured (three runs of the suite):

  | Bench | What it runs | Time | Budget |
  |---|---|---|---|
  | `mass: 16-hole plate` | the output's `massProperties(2700)` (the body card's numbers), quadrature over the curved holes | 294–323 ms | 650 |
  | `mass: SubD torus, 2,048 quads` | the `subd-torus` command at its maximum, 64 × 32, the same call | 31–33 ms | 70 |
  | `gear: verdict, clear pair (m2, 20/40)` | `checkSpurGearPair(…, { mode: 'verdict' })`, as `evaluateDoc`'s mesh notes run it | 215–217 ms | 450 |
  | `gear: report, interfering pair (a 59.8)` | the same in `report` mode (the `gear_clearance` query) at a centre distance where the teeth cross | 5 766–5 866 ms | 11 500 |
  | `library: tslot-20 fits (all)` | `checkFits`: every declared fit built, placed and its overlap measured (LIB2) | 116–123 ms | 250 |
  | `step: tessellated read, 200k triangles` | `stepMeshes` on a 200k-triangle tessellated STEP (the worker's read) | 150–159 ms | 300 |
  | `facet: F1 split, 200k triangles` | `splitFacetBrep` at z = 1 of a 400 × 250 torus | 181–186 ms | 380 |
  | `facet: F2 hole, 20k triangles` | `facetBoolean` difference of a Ø4 cylinder through a 100 × 100 torus | 522–601 ms | 1 100 |
  | `print: orientation search, 100k triangles` | `searchOrientation` on the AM4 test's 100k facet body | 508–592 ms | 1 200 |
  | `print: printability, 16-hole plate` | `printability` on the FDM-printed plate after an edit | 20–22 ms | 45 |
  | `print: 3MF of 200k triangles` | `write3mf` of the AM5 test's 200k bump sphere (weld, XML, deflate, ZIP) | 350–397 ms | 800 |

- **Caches kept out of the times:** `evaluateDoc` keeps masses per B-rep, the pair check its last 64 answers by its arguments, the facet Boolean its crossings and the facet BVH per B-rep, and the wall thickness is kept per mesh. So every run gets its own B-rep, bodies or arguments (a face width the 2D sweep does not read, for the gears).
- **Already there:** the SubD box build and tessellation and the ~2k-cage drag (A4), and the agent-turn evaluation count (`test/evalCount.test.ts`, A3).
- **Seen, for later items:** the interfering pair's report is the slowest row by far: 5.9 s against 0.5 ms for its verdict (which stops at the first crossing) and 0.66 s for a clear pair's report. It goes with C16's gear sweep item. The 2,048-quad torus here is the SubD one; B9 (mesh-body mass) adds a mesh torus when it changes that path.
- All 27 Node rows pass; type-check clean; lint 0 errors.

### Items still open, as the peer listed them (copied here from the previous account's transcript)
- **B7** hover rewrites the whole colour buffer.
- **B8** picking paths without the BVH.
- **B9** mesh-body mass and area through tessellation → facet integrals plus a WeakMap.
- **B10** F2 rebuild costs.
- **B11** mesh repair adjacency.
- **B12** worker reply payload: unchanged bodies by id, volume-only and signature-only requests, one snapshot slot per purpose.
- **B13** memory: uv, undo sharing, blob eviction, recovery writes, transferable mesh posts.
- **C14** outline cost. **C15** App re-renders during drags.
- **C16** smaller items: STEP parser sticky regexes; gear sweep cache key; SubD topology recheck, `opposite()`, JSON reuse key, fit allocations and closures; library memo; render_views; per-frame allocations; D25/D22 costs; the Delaunay flips' full passes (A5).
- **C17** nested functions (about 20 sites).
- **D20** RB bookkeeping: trend.jsonl rows for D50/D78/D79 and later; refresh todo.json (two graze rows now pass); keep the open items visible (1 nm graze wrong body, helical × helical refused, F2 at 1M positions).

### B7 — a hover rewrote the whole colour buffer
- **Confirmed:** every change of hover or selection repainted the body from scratch. `paint` made a new `Float32Array` of every vertex's colour with two `Map` lookups a vertex. `setColors` then converted every vertex to linear bytes (three `Math.pow` a vertex) and sent the whole buffer to the GPU. On the 120-hole plate (15 864 vertices, 126 faces) that is **0.44 ms and 62 KiB a hover**; on a 100k-triangle facet body, 1.37 ms and 196 KiB.
- **Fix:**
  - `@barocss/gpu`: `Geometry.fillColors(first, count, color)` sets one colour on a vertex range and sends only that range (`writeBuffer` with an offset). It is built on `fillVertexColors`, which writes the bytes `vertexColors` would. `vertexColors` now converts a run of one colour once instead of every vertex (the same bytes; tested against the formula).
  - Studio, `viewport/facePaint.ts`:
    - `faceRuns` keeps each face's vertices as runs, worked out once per body.
    - `paintFaces` takes a key of the colours (base, theme, body and face colours). With the same key as last time, it writes only the faces whose state changed, one `fillColors` per run. A new key, or changes covering more than half the vertices, gives one whole write.
  - `GpuRenderer.paint` goes through it.
- **After:**

  | Body | Before, per hover | After, per hover |
  |---|---|---|
  | 120-hole plate | 0.44 ms, 62 KiB sent | 0.009 ms, 0.8 KiB |
  | 100k-triangle facet body (2 faces) | 1.37 ms, 196 KiB | 0.98 ms (one face is most of the body: a whole write, cheaper by the conversion) |

  - New bench `viewport: 10 hovers repainted, 120-hole plate`: 0.05 ms, budget 1 ms (the whole repaint took 4.4 ms for the ten).
- **Tests:**
  - `test/facePaint.test.ts`: runs; after each of eight hover and selection steps the bytes equal a whole repaint's, and the vertices written are exactly the changed faces'; a new key paints the whole body once, and so does selecting most of it.
  - gpu `viewer-core`: a filled range gives the same bytes as a whole conversion.
  - Studio 356/356; GPU 70/70.
- **Browser** (WebGPU, `bench:browser` and a pixel check): hover, a second face, moving off to the background, select and Escape show the same pixels as at HEAD. Submits are unchanged (hover 17, 1 per frame).
- **Defect found while checking it, fixed (same commit series):** moving the pointer from a face straight onto a panel or the toolbar left the face lit. The canvas had no pointer-leave handler, so the last hover stayed until the pointer came back. Now `onPointerLeave` clears the hover, except during a drag. The pixel check passes: a face, then the toolbar, gives the base colour. HEAD showed the same stale hover.
- **Lint:** the changed files are clean. `tests/viewer-core.test.mjs:128` has an older `no-regex-spaces` error from a test this change does not touch.

### B8 — picking paths without the BVH
- **Confirmed:**
  - Face picks (`raycast`, `pick`) already go through the triangle BVH, from 1 024 triangles up.
  - The edge pick that runs with them on every hover (`pickLine`) walked every segment of every edge mesh. Each segment allocated: two clip arrays, `map` copies when clipped, two closures. On the 120-hole plate (7 692 segments) that is **0.267 ms a pick**.
  - The vertex snap (`vertexAt`) projects the hovered body's merged edge ends only (hundreds). It is left as it is.
- **Fix (`@barocss/gpu`, `viewer/geometry.ts`):**
  - `nearestSegment(g, M, x, y, cw, ch, radius, earlier)`:
    - The same arithmetic, in the same order, as the walk, with no allocation (module-level scratch).
    - From 256 segments, a hierarchy of segment boxes, built once per geometry by the triangle BVH's builder (now for either topology).
    - A node is passed over when its eight corners are all in front of the eye and their screen rectangle is farther than the best so far, with a hair of slack for rounding.
    - Ties go to the lowest segment, and a mesh only as near as an earlier one loses, as in the walk.
  - `pickLine` keeps its whole-mesh rectangle test and calls it.
- **Same answers:**
  - gpu test: segment, distance and parameter equal to the walk (copied into the test as the reference). It covers 3 eyes × 2 geometries × 400 points, over 1 000 hits. Every fourth point is on a grid vertex where segments tie exactly, and some segments cross the eye's plane. A mesh as near as an earlier one is never chosen.
  - On the plate, 300 of 300 points are the same.
- **After:**
  - The plate's edge pick: 0.267 → 0.014 ms (×19).
  - Bench `viewport: 100 edge picks, 120-hole plate`: 0.3 ms, budget 1 ms (the walk took about 27 ms).
  - GPU 72/72.
- **Left for C17:** `rayTriangles` still makes its `test` closure per call.
- (B7 and B8 together: the browser flow, 119/119, on the tree with both and the hover fix.)

### B9 — mesh bodies' mass and area
- **Confirmed (cold, a fresh B-rep each call):**

  | Mesh body | Mass, before | Area, before | How |
  |---|---|---|---|
  | 200k-triangle facet body | 16.9 ms | 5.7 ms | mass through a tessellation of every facet face; area by quadrature, already exact |
  | 40k-triangle planar body (how an STL opens: a planar face per triangle when nothing is flat) | 355 ms | 651 ms | mass through a tessellation; area by Green quadrature, 48 points an edge |
  | 4k-triangle planar body | 36.7 ms | 58.8 ms | the same |

  - The F1 split's check (`volumeOfSolid`, part-model) works out the same volumes three times, with the quadrature off.
- **Fix (`solid-mass.ts`):**
  - `polyhedralIntegrals(brep)` covers a body whose every face is a facet patch, or a planar face bounded by straight edges.
    - Its ten volume integrals and area are exact and need no tessellation: tetrahedra from the body's centre over each facet triangle (`facetIntegrals`) and over a fan of each planar loop.
    - A fan's signed triangles cover the loop's region, holes and concave outlines too. The loops turn about the outward normal, so a face's area along it is positive; otherwise the function refuses (null) and the old path runs.
    - Kept per B-rep in a WeakMap; a B-rep is a value.
  - `brepMassProperties` and `brepSurfaceArea` try it first. The method stays `planar-exact`.
  - Bodies with any curved face, or any curved edge on a planar face, take the old paths unchanged.
- **After (cold):**

  | Mesh body | Mass | Area | Again |
  |---|---|---|---|
  | 200k facets | 6.0 ms | 5.9 ms | 0.01 ms |
  | 40k planar | 70 ms (half of it the id maps, once per B-rep) | 73 ms | |
  | 4k planar | 4.5 ms | 4.5 ms | |

  - Part model, 200k mesh with a split: 364 → 345 ms.
- **Values:**
  - On the toruses, volume equal to every printed digit, area within 2e-15 relative.
  - Kernel test `mass-polyhedral.test.mjs` against tetrahedra over the input triangles (an independent sum in the test): volume 1e-12, centroid 1e-11 mm, inertia 1e-11, area 1e-12.
  - A block with a square hole through it, as its closed form (volume, area, centroid).
  - An L prism equal to the prismatic closed form, inertia within 1e-12.
  - A cylinder keeps `quadrature`.
  - Conformance `perf3/`: a square frame of 32 triangles, planar (10 faces, two with a hole) and as facets: 168 mm³, 280 mm², centroid (5, 5, 1), to 1e-12.
- **Checks:**
  - Kernel 1012/1013 (the known Node-version test); conformance 67/67.
  - RB: no NEW row, the TODO rows the known ones.
  - Studio 356/356.
  - Benches `mass: 200k-triangle facet body (cold)` 6.25 ms (budget 15) and `mass and area: 40k-triangle planar mesh (cold)` 76 ms (budget 160).

### B10 — F2 rebuild costs
- **Confirmed** (the F2 hole bench: a Ø4 hole through a torus mesh), stage by stage, 20k / 180k triangles:

  | Stage | 20k | 180k |
  |---|---|---|
  | soup | 6 | 34 |
  | self-crossing check | 30–40 | 130 |
  | box split | 15 | 66 |
  | near part as planar faces | 29 | 104 |
  | **exact Boolean** | **420–540** | **1 300–1 400** |
  | the soup again, T-junctions, facet faces, names | about 60 | about 280 |

  - The exact Boolean dominates, and grows with the triangles near the tool: 357 at 20k, 1 107 at 80k, 2 249 at 180k.
  - Inside it at 20k:
    - face-pair cuts: 145 ms over 288 pairs;
    - pieces: 120 ms;
    - merging coplanar pieces: 115 ms (459 → 120);
    - stitching: 55 ms.
  - Two causes, both confirmed:
    - **Cuts:** each probe curve (the plane's ellipse on the cylinder, say) was searched on both faces before their overlap was taken. On the cylinder that is a 256-step seam scan and a boundary crossing, even where the curve misses the planar face entirely, which is most pairs.
    - **Caps:** the box split's cut points are interpolated, so they land a few ulps off the cap plane. `brepFromTriangles` joins only exactly coplanar triangles, so the caps' 1 025 triangles reached the Boolean as 156 faces (3 009 as 284 at 180k). Every one was a piece to classify, merge back by a region union, and stitch.
- **Fix:**
  - `cutPair` (`analytic-boolean.ts`): each probe on the first face; where it misses, the second face's search is skipped. The overlap of nothing is nothing, so the cuts are the same.
  - `splitSoup` (`facet-split.ts`): on a plane square to an axis (every F2 box plane, and an F1 split along x, y or z), a cut point's coordinate along that axis is the plane's exactly, and the other two are interpolated as before. The caps are then exactly flat: 4 cap faces instead of 156 (20k) or 284 (180k). An oblique plane is unchanged.
- **After:**

  | Case | Before | After |
  |---|---|---|
  | `facetBoolean`, 20k | 586 ms | 460 ms |
  | `facetBoolean`, 80k | 1 192 ms | 872 ms |
  | `facetBoolean`, 180k | 1 900 ms (stages) | 1 530 ms |
  | Inside the Boolean at 20k: cuts | 145 | 80 |
  | Inside the Boolean at 20k: merging | 115 | 57 |
  | Benches `facet: F2 hole, 20k triangles` | 522–601 ms | 424 ms (budget 1 100 → 900) |

  - New bench `facet: F2 hole, 80k triangles`: 827 ms (budget 1 800).
  - The volumes are equal to every printed digit: 14 044.918930113969 and 14 058.897223463451 before and after.
- **Tests:**
  - Kernel: `facet-split.test.mjs` adds a test that a split square to x, y or z puts the section loops and both caps' corners on the plane to the bit, and that the volumes add up. It fails on the code before.
  - Kernel 1014/1015 (the known Node-version test); conformance 67/67; RB no NEW row.
  - Studio 356/356.
- **Not done, measured:**
  - The rest is the exact Boolean's work per near face (pieces, regions on the cylinder's arrangement, merging the mesh's coplanar quads back, stitching) and the rebuild of the whole facet body (about 280 ms at 180k).
  - Narrowing the near region (a prism round the tool instead of a box), carrying the self-crossing check over to an F2 result, or rebuilding only the near faces would each change what the Boolean sees or builds. They go with F3.
- **Also seen:** at 400 × 250 (200k), the same hole is refused, typed, as "not a manifold solid (… the inputs touch along an edge or at a vertex)". This is the known F2-at-fine-meshes item, unchanged by this step.

### B11 — mesh repair adjacency
- **Confirmed (200k-triangle STL-like soup, 190 holes, turned patches):**
  - diagnose and repair together took 1 241 ms. Of that:
    - the final check, 300 ms;
    - orient, 136–183 ms;
    - fins and floaters, about 90 ms each;
    - diagnose, 370 ms.
  - The profile:
    - **`edgeSides`** built a `Map` of arrays, one per edge, keyed lo·nv + hi. It was built five times in a repair (fins, orient, holes, floaters, check) and once in diagnose: 433 ms across them.
    - **`selfIntersections`** (in diagnose and in the check): a `Map` of arrays for its grid cells. Its narrow phase ran six segment-through-triangle tests for every pair of nearby triangles that share no corner: 420 ms in `segmentThrough`.
- **Fix (`mesh-repair.ts`):**
  - **`edgeSides`** now uses typed arrays. Half-edges are bucketed by their lower vertex, each matched to the first one with the same upper vertex in its bucket. The edges are numbered in the order of their first half-edge, which is the order the map gave, with each edge's half-edges ascending. Every consumer walks the groups the way it walked the map.
  - **`selfIntersections`:**
    - The cells are typed runs: entries sorted by cell with two stable 16-bit counting passes, each cell taken at its first entry. These are the same pairs in the same order, so the first 64 crossing points are the same too.
    - A pair is passed over when one triangle lies clear on one side of the other's plane: every corner farther than a millionth of the two boxes' size, the same side. Then no edge of either passes through the other, so the strict test cannot count it. A millionth is far beyond the test's own 1e-9 and rounding.
- **The same results:** `diagnoseMesh` and `repairMesh` outputs were hashed whole, old code against new, and are identical:
  - every bench fixture (organic 2k–200k, scan 200k, the six broken ones);
  - the 200k soup;
  - two tori through each other, with 2 614 crossings.
- **Defect found while measuring, fixed:** `report.flipped` counted every turn of either pass. When the orient pass starts from a triangle inside a turned patch, it turns all the others, and the outward pass turns them all back. On the 200k soup, about 5 300 triangles were wrong and the report said "393 667 triangles turned"; the panel shows that number. Now a triangle counts once, if it ends the other way round from how it came and is kept. New test: three turned triangles, the first among them; the code before reported 109.
- **After:**

  | | Before | After |
  |---|---|---|
  | organic-200k, diagnose + repair | 1 255 ms | 677 ms |
  | scan-200k | 1 442 ms | 830 ms |
  | 200k soup | 1 241 ms | 829 ms |
  | two crossing tori | 48 ms | 29 ms |

  - Bench `mesh: diagnose and repair, 200k soup`: 639 ms, budget 1 300.
- **Checks:**
  - Kernel 1016/1017 (the known Node-version test); `mesh-repair.test.mjs` 10/10.
  - Conformance 67/67; RB no NEW row.
  - Studio 356/356, with the mesh repair corpus.

### B12 — the worker's replies
- **Confirmed:**
  - **Every mesh, every reply.** Every evaluation reply carried every body's display mesh: six typed arrays copied out of the kept tessellation (`meshOf`), then transferred. That held even when the body was the same B-rep as in the last reply: a 200k-triangle mesh body beside a plate being edited was 5.31 MiB copied and sent per edit.
  - **The face-table key.** That edit also cost the worker 33 ms, of which 30 ms was `rememberFaceTable`'s key: `faceKey` was `JSON.stringify([nodes, parameters])`, which writes out the mesh node's 200k-triangle arrays on every evaluation. It runs in the worker and on the main thread (and in faceClient).
  - **One `part` snapshot for everything.** The worker's single `part` snapshot (`lastPart`) was shared by:
    - requirement checks,
    - reference checks,
    - an agent's proposals and the chat previews,
    - file reads,
    - clash probes,
    - placed instances.

    Each one in between threw away what the others had reused.
  - **Clash probes.** They evaluated each overlapping pair's intersection with full meshes, and read only its volume.
- **Fix:**
  - **`engine/meshWire.ts`:** `MeshSender` in the worker and `MeshReceiver` on the client.
    - Each kind of request is a slot: `evaluate`, `preview`, `section`, `placed`, `part:<purpose>`.
    - A body whose kept mesh was in that slot's last reply goes back as its token alone, with no copy and nothing sent. A new mesh is a copy with a token, its buffers transferred. One mesh twice in a reply is sent once.
    - Both sides keep exactly the slot's last reply, in the order posted. Stale replies are unpacked too, and a refusal empties the slot.
    - A token the client does not hold is an error result ("Evaluation lost"), never a guess. `restart` clears both sides.
    - The worker hands out the kept meshes as they are (`shareMeshes(true)`, only there). `placeBody` copies before it moves one. The main thread was checked to write into no received mesh array.
  - **`faceKey`** is the evaluation memo's per-node key (`contentKey`): each node's text kept per node object, long arrays by length and digest.
  - **Snapshot slots per purpose:** `evaluatePart(…, slot)` with `PartSlot` = `part`, `check`, `refs`, `agent`, `read`, `probe`. `evaluatePlaced` has its own.
  - **App callers:** checks `check`, references `refs`, proposals and chat `agent`, mesh and STEP reads `read`.
  - **Clash probes** use the new `volumes` request: volumes only, no mesh made or sent.
- **After (the worker's side of one edit beside the 200k mesh):** 33 ms and 5.31 MiB → **2 ms and 0 MiB**. Only the edited plate's mesh goes, a few KiB.
  - Bench `worker: an edit beside a 200k mesh body`: 1.9 ms, budget 5 ms; it fails if the unchanged mesh is sent.
- **Browser flow:** 119/119 with the worker path (WebGPU).
- **Tests:** `test/meshWire.test.ts` (3):
  - the protocol: tokens, slots apart, the last reply only, a refusal, a receiver out of step;
  - the worker's path in-process, packed and unpacked, against a plain evaluation, array for array. The same part again sends nothing; a larger hole sends only the plate.
  - volumes equal to the full evaluation's, and slots taking turns.
- Studio 359/359.
- **Not done:** signature-only replies for the reference checks. The evaluation memo (`kept`) is shared by every evaluate function, so a reply without meshes could be handed to a caller that reads them (a requirement's wall thickness). Unchanged prefix meshes now go back as tokens anyway.

### B13 — memory: what an edit writes out and copies
- **Confirmed and changed:**
  - **Recovery writes.** 800 ms after every change, `writeRecovery` wrote the whole document out as one JSON for local storage. A document with an inline mesh (older files, before blobs) or an imported STEP text is written out in full every time. A 200k-triangle inline mesh is 8.8 M characters and 36 ms per edit, and a copy that size never fits local storage (about 5 MiB): it failed after the cost, every edit.
    - Now `recoveryText` keeps each node's JSON per node object and joins them. The text is exactly the old text (tested), and a copy past `RECOVERY_LIMIT` is not tried.
    - As before, a copy that cannot be written leaves the stored one as it was.
    - After an edit beside the 200k mesh: 36 ms → 0.76 ms with no limit, and nothing when over it.
  - **Undo sharing.** Renaming or removing a parameter deep-copied every node through JSON (`renameParameter`). Every node became a new object, so undo held two full copies (a mesh's or a STEP file's data included), and the worker's wire and the evaluation memo saw the whole part as changed. `parameterUses` wrote out every node per parameter on every render of the panel.
    - The rename is now copy-on-write: only the nodes along the way to a reference are copied.
    - The count is a read-only walk.
    - Both are tested against the old functions: the same result, untouched nodes the same objects.
  - **Mesh posts.** A STEP file's meshes were gathered into number lists before the worker's check. Posting those clones element by element, and twice the memory of typed arrays. They are now typed arrays, posted as bytes.
  - **Opening an STL.** `meshInMM`, the weld to mm, made three arrays and a text key a corner, with closures inside the loop: 165 ms for 200k triangles.
    - Now the rounded coordinates are hashed into buckets and compared exactly: the same vertices in the same order, the size as before (a NaN corner makes it NaN, as `Math.min` did).
    - Tested against the old weld (repeated and near corners, −0, NaN, single precision, three units).
    - 165 → 27 ms.
- **Benches:**

  | Bench | Time | Budget |
  |---|---|---|
  | `mesh: open a 200k-triangle STL (weld to mm)` | 27 ms | 60 |
  | `recovery: an edit beside a 200k inline mesh` | 0.76 ms | 2 |

- **Tests:** `test/memory.test.ts` (3). Studio 362/362; browser flow 119/119.
- **Follow-up (the coordinator's review of d7d766635): no stale recovery copy.** When a copy was not written (too large, or the browser refused it), the copy from before stayed. After a reload it would be offered back as the latest unsaved work, although it was older than the last edits. This predates B13, but B13 made the skip deliberate.
  - **Decision: clear it.** Marking it stale would offer work known to be out of date.
  - `writeRecovery` now returns `'ok' | 'too-large' | 'refused'` and removes the older copy when it does not write.
  - The studio says so once per document with a toast, again only after a copy has been written in between:
    - too large: "Crash recovery is off for this document";
    - refused: "No recovery copy".
  - `test/recovery.test.ts`, with a storage of its own (quota or refusal): a small copy, then an over-limit edit, leaves nothing to restore; a refused write the same.
- **Measured, not changed:**
  - **uv:** every body's geometry has texture coordinates, 8 bytes a vertex, even without a colour map. The viewer's pipelines read the attribute, so leaving it out needs a second vertex layout in `@barocss/gpu`. For a 200k-triangle body that is under 1 MiB. Left.
  - **Blob eviction:** the blob store keeps every mesh blob of the session, in the studio and in the worker (by design, D45/M1). Evicting safely needs every holder known: the document, undo and redo, proposals, a repair waiting, the chat's states, and the worker's wire, whose sender believes the worker still has what it sent once. That is a design change. Recorded as a TODO in README §0 with that list.

### C14 — the selection outline
- **Confirmed** (`bench:browser`, a new scenario: the plate picked whole from the outliner, then orbited 60 steps):

  | DPR | Without the outline | With it | Its cost |
  |---|---|---|---|
  | 1 | 3.4–4.2 ms GPU a frame | 4.7–5.0 ms | 0.8–1.3 ms |
  | 2 | 5.3–5.9 ms | 8.0–8.9 ms | 2.1–3.6 ms |

  - Two parts:
    - the mask pass draws every opaque mesh again (to hide what is behind);
    - the output pass searched a (2r + 1)² square of the mask for **every pixel of the screen**: r = 3 at DPR 1 and 5 at DPR 2, so 121 texture reads a pixel over 5 M pixels.
- **Fix (`@barocss/gpu`):** the output block carries `outlineRect`, the outlined meshes' screen box (`screenRect` of their world boxes) widened by the outline's reach and two pixels. The shader searches only inside it.
  - Outside, no mask pixel is within reach, so the search found nothing there before either: the result is the same.
  - A box with a corner behind the eye leaves the rectangle unbounded, as before.
- **After:**

  | DPR | Outline's cost |
  |---|---|
  | 1 | 0.6–0.8 ms |
  | 2 | 0.9–1.1 ms (the rest is the mask pass) |

  - The canvas with the outline is pixel-identical to HEAD's at DPR 1 and 2 (screenshots compared).
- **Tests:**
  - gpu `viewer-core`: the rectangle holds every projected point of the box; a corner behind the eye gives none; the block's last four floats.
  - GPU 73/73; browser flow 119/119.
- **Left:** the mask pass's redraw of the opaque meshes. Testing against the main pass's depth instead needs the mask multisampled like it (with MSAA on), which would change the outline's edge.

### C15 — App re-renders during drags: measured, no change
- **Measured:** a feature handle dragged 60 steps over 2 s (the starter plate's hole centre). Main-thread time from CDP `Performance.getMetrics`, plus a CPU profile.

  | Build | Script | Of it |
  |---|---|---|
  | Dev server | 968 ms (16 ms a move) | 781 ms self in React's development `jsxDEV` (element owner stacks); `App` 704 ms inclusive, its toolbar buttons 295 ms |
  | Production build, two runs | 86–106 ms (about 1.6 ms a move) | `App` 15 ms over the whole drag (0.25 ms a move); `Viewport` 15 ms; the frame's draw 17 ms; layout 35 ms; one `focus()` of 21 ms when the drag opens the feature's HUD (once) |

- **Decision: no code change.** In production the re-renders are a quarter of a millisecond a move, inside a 16.7 ms frame. Memoising App's toolbar and panels would put stale closures at risk for no measurable gain. The dev-server number is React's development build, which users do not run. Note that the browser flow and `bench:browser` run on the dev server, so frame CPU there reads high for this reason.
- **The script:** `test/tools/cdp-drag.mjs`. Run it from `apps/cad-studio`:
  `VITE_URL=$(node --input-type=module -e "console.log(import.meta.resolve('vite'))") PW_DIR=… node test/tools/cdp-drag.mjs "$PWD" <out-dir>`
  `PROD=<dir>` builds and previews production, and `NOMIN=1` keeps names.

### C16 — small items
**Gears: the interfering report, and the sweep's key**
- **Confirmed (profile):** a pair check in report mode on a pair whose teeth cross took 5.8 s (m2, 20/40 at a = 59.8). `depthInside` and its `pointSegment` were 14 of 18 s across five cases, for three reasons:
  - the pair loop in `profileClearance` went on measuring every remaining pair after a crossing, although the answer is then only the depth;
  - `depthInside` measured each point twice, since consecutive segments share an end;
  - each point's nearest-segment search started from nothing, so few boxes were passed over.
  - Also, the cache key held the face widths, which the 2D sweep does not read, so changing a gear's thickness ran the whole sweep again.
- **Fix (`gear.ts`):**
  - The pair loop stops at the first crossing (report mode).
  - A point equal to the one just measured is skipped.
  - Each search starts from the previous point's nearest segment and keeps the first of the nearest in order, as the walk from the first segment did. The boxes are passed over only when strictly farther.
  - The cache key leaves the widths out. They are validated first, as the check does, and the axial and total contact ratios are worked out again for the widths asked.
- **The same results:** five cases (report interfering at 59.8, 59.5, 59.95; report clear; verdict clear) hashed whole, before and after: identical.
- **After:**

  | Bench | Before | After | Budget |
  |---|---|---|---|
  | `gear: report, interfering pair (a 59.8)` | 5.8 s | 1.17 s | 11.5 s → 2.4 s |
  | `gear: verdict, clear pair` | 215 ms | 146 ms | 450 → 300 |

  - The benches now vary the phase by a billionth of a degree a run (the face width is no longer in the key).
- **Test** (kernel `gear.test.mjs`): another width gives the same sweep with its own ratios (equal to the nominal formula's), kept (under 5 ms); a width out of range is still refused when the pair is kept. Gear tests 10/10; conformance 67/67; studio 362/362.

**SubD: the caps' key, the topology built twice, `opposite()`** (found by a read-only review agent, confirmed and measured here)
- **The caps' key held the size.** `keptCapsAt`'s key began with `scale`, the whole refined cage's extent. Any edit that moved the cage's highest or lowest point changed every key, so every cap was built again. On the ~2k-face cage, raising a top vertex took 109–162 ms against 22–38 ms for an inner one.
  - The size is read only by the G1 rows' tolerance check (`orthonormalRows`). The poles and deviations do not depend on it.
  - The key now leaves it out. Each dependent condition's miss and norm are kept with the caps, in the order they were met, and checked again at the size asked: the same refusal, at the same condition, with the same message.
- **The SD2 topology was built twice.** `buildSubd` made `polyMesh` of the refined quads and then `topology()` of the same quads, which rebuilt half-edges, twins and sharp edges with a `Map`. The mesh's own (start 4k, twin, sharp, P, F) are the same, and it has made every check, so `topoOf(mesh)` reads them. The SD1 path does the same from the fan mesh and still runs `checkVertices` (kept rather than argued away).
- **`opposite()`** scanned every face per crease vertex. It is now counted per vertex in `checkVertices`' own pass. `topology()` is gone.
- **The same results:** builds hashed whole, old code against new, identical.
  - SD2: ~2k-face cage cold, three top-raised and three inner moves, the bump cage, the bump cage ×3 (another scale), the SubD box.
  - SD1: the 64 × 32 torus, the torus with 64 crease edges, the torus wound inward.
- **After:**

  | Build | Before | After |
  |---|---|---|
  | ~2k cage, top raised | 109–162 ms | 35–69 ms |
  | Bench `subd: ~2k-face cage, its top raised (new extent)` (new) | | 19.8 ms (budget 60) |
  | ~2k cage, one inner vertex moved | | 19.3 ms (it was 24) |
  | SD1 torus pair | 25 ms | 21 ms |

- **Tests:**
  - Kernel `subd.test.mjs`: the top's centre raised (a new extent) reuses every cap, under half a cold build. It fails on the code before (89 against 175 ms).
  - Kernel 1018/1019 (the known Node-version test); conformance 67/67.

**Kernel: the quadrature run twice, an import's text in every key, the STEP tokens**
- **Mass and area.** `brepSurfaceArea` ran the same two-pass quadrature (`quadrature(brep, 8)`) as `brepMassProperties`, and a STEP export's validation properties ask for both. `quadrature` is now kept per B-rep and step in a WeakMap.

  | | Before | After |
  |---|---|---|
  | 16-hole plate, mass and area | 779 ms | 468 ms |
  | 16-hole plate, STEP export | 732 ms | 512 ms |
  | fillet box, mass and area | 853 ms | 478 ms |
  | fillet box, STEP export | 890 ms | 552 ms |

  Values and the exported text are identical (hashed).
- **An import's text in the reuse key.** The part model's per-feature key (`resolvedDefinition`) wrote an imported STEP text out whole, on every evaluation: 27 ms an edit beside a 10.4 MB import (about 80 ms at 30 MB). Texts over 64 KB now stand as an exact id from a map of the last 8 texts. A Map compares the text by content, so an id is never shared; a text fallen out of the map only misses. After: 1 ms.
- **STEP tokens.** `parseData` matched each token with a `^` expression on a fresh `slice` of the rest of the text, tested white space with `/\s/` a character, and built strings a character at a time. Now:
  - sticky expressions at the reader's place;
  - white space by its code (`/\s/` only past ASCII);
  - strings by `indexOf`;
  - the comment pass skipped when there is no comment.

  | Read | Before | After |
  |---|---|---|
  | tessellated 10.4 MB, `stepMeshes` | 175 ms | 141 ms |
  | tessellated 10.4 MB, `importStep` | 355 ms | 307 ms |
  | planar 13.6 MB, `stepMeshes` | 240 ms | 178 ms |
  | planar 13.6 MB, `importStep` | 713 ms | 657 ms |

  `importStep` and `stepMeshes` outputs are identical (hashed) on a B-rep plate, an odd text (comments, a doubled quote, a non-breaking space), a planar mesh and a tessellated one.
- **Tests:** kernel `perf3-c16.test.mjs` (3): mass and area share one run with the same values; an edit beside a long import reuses it, and another text is read anew; odd tokens and an unterminated string. Kernel 1018/1019 before these; conformance 67/67; RB no NEW.

**Studio: the cage editor's frames, render_views, library fits**
- **Cage overlay (`CageMarks`).** Every frame rebuilt eight Sets of string keys from the selection and the validation, which change with the overlay, not from frame to frame. Every frame also wrote each vertex's coordinates out about four times. Now:
  - the edges' kinds, the vertices' kinds and sizes, and the tinted faces are prepared once per overlay (WeakMap);
  - a frame projects, writes each vertex's text once, and joins the same paths.

  The rendered element tree is identical (60 frames on the 2k-face cage, two modes, a selection, a crease, the poles: JSON hashed). 3.61 → 1.48 ms a frame.
- **Cage validation.** `validationOf` validated the whole cage (4.4 ms on 2k faces) on every frame of an extrusion's drag, and again for Done. It reads only faces, creases and the vertex count, and an extrusion's topology does not change while it is dragged. It now keeps the last result and reuses it when the full cage's faces, creases and vertex count are equal, compared face by face. Test (`cageEdit.test.ts`): five drag steps share one validation, equal to a fresh one, under half its time; another topology is validated anew.
- **render_views.**
  - Each face's name is split out once, not at every pixel it covers.
  - The four hidden-line projections are kept for the last B-reps: a highlight-only call reuses them, since the highlight changes only the fill.
  - The cache key is the evaluation memo's per-node key, not the whole document's JSON (a STEP import's text included).

  Outputs are byte-identical (16-hole plate: first, two highlights, a section). A highlight call takes 215–263 → 83–106 ms. The section path is left: its probe evaluation (with mass) is most of it, and evaluating it as a preview would change mesh limits.
- **Library fits.** Each fit end was built cold, though the T-slot library builds its profile three times. Ends are now kept per library (WeakMap; a library is a value once loaded) by part, variant, values, interface and prefix; a failed build is not kept. Results are identical. A first run barely changes (215 → 209 ms: the overlap Booleans dominate). A repeated check (the share check, `add_library`) goes 131 → 74 ms on tslot-20 and 27 → 12 ms on the enclosure.
- **Per-frame allocations** in the viewer and renderer: measured by the review agent at microseconds a frame (`packFrame` 1.6 µs, the key Map and sort for 50 meshes 6.3 µs). Hoisting them is GC hygiene with no measurable gain; left. The site list is in `handover/notes/c16-review-findings.md`.
- **Not done:**
  - **Cold SubD cap fits.** `limitGrids`' meshes per level, `closestOnGrid`'s layout, `formAt`'s copies: 38 + 14 + 7 ms per cold build. Each is a restructuring of numeric code to keep bit-identical; with C17's nested functions, or later.
  - **Delaunay flips.** A worklist would change cocircular diagonals (A5): left.
- Studio 364/364; kernel library tests 6/6; browser flow 119/119.

### C17 — functions made inside hot paths
Sites from the review agent's list (`handover/notes/c16-review-findings.md`), each hoisted to module level or written out, with the same arithmetic in the same order.

| Where | How often | Change |
|---|---|---|
| `rayTriangles` (gpu `geometry.ts`) | per pick, per mesh | its `test` closure is a module function with module-level ray state (as `nearestSegment`); the bounds no longer spread into an array |
| `vertexNormals` (gpu `geometry.ts`) | per triangle | `at`, `sub`, `cross` and the `[a, b, c]` array written out |
| `frustumPlanes` (gpu `bounds.ts`) | per frame | `row`, five `map`s and a `forEach` → `plane()` in place |
| `requestRender` (gpu `viewer.ts`) | per request | `run` → one bound field |
| `visibleMeshes` (gpu `viewer.ts`) | per frame | the key Map and the two comparators → a kept map and module comparators |
| `lights()` / `bounds()` (studio `gpuRenderer.ts`) | per frame | `toward` and `grow` at module level |
| `vertexAt` (studio `Viewport.tsx`) | per pointer move | no `[e.a, e.b]` array an edge |
| `bodyMesh` (studio `engine/mesh.ts`) | per evaluated body | `pair`/`near` hoisted; the mate looked for among the display edges of the same two faces (the first that fits, as before; it was an O(E²) `find`); `facesOfEdge` and the groups by `push`, not a spread copy each; a face map for `brep.faces.find`; segments pushed without spreads |
| `netOf` (kernel `subd.ts`) | per quad of a build | `pt`, `mirror`, the corner table and the `[1, 2]` loops at module level |
| `twoIrregular` (kernel `subd.ts`) | per face | a loop, no `filter` array |

- **The same results:**
  - `vertexNormals` and 4 000 rays hashed (40k and 200 triangles);
  - `bodyMesh` hashed on five bodies (smooth 40k planar mesh, low-poly mesh, a sharp 12k mesh with 6 000 display edges, the SubD ~2k body, the 120-hole plate);
  - the SubD builds' hashes unchanged.
- **Measured where it shows:**
  - `bodyMesh` on the sharp 12k mesh: 270 → 161 ms (tessellation 100 ms of it);
  - the smooth 40k planar mesh: 543 → 502 ms;
  - 2 000 rays at 40k: 28.0 → 25.7 ms.
  - The per-frame sites are microseconds; the change is the rule.
- **The AM4 wall-clock test** (`printing.test.ts`, 100k triangles oriented) had a 2 s bound and failed once under parallel load (about 0.6 s alone). It now has a 6 s bound with a comment; the measure is the bench row `print: orientation search, 100k triangles` (budget 1.2 s). The README TODO is removed.
- **Left:** the cap fit's numeric helpers (`fanOf`, `refine`, `limitGrids`, `capsAt`'s `formAt`/`gridOf`/`polesOf`) and `cageTopology`'s template keys, listed in `handover/notes/c16-review-findings.md`. These are per vertex or face of a cold SubD build, where keeping the caps bit-identical needs care. They go with a cold-build pass, as do the viewer's per-frame object allocations (GC only).
- GPU 73/73; studio 364/364; kernel SubD 18/18; browser flow 119/119; `bench:browser` within budget.

### D20 — RB bookkeeping
- **Trend.** The last trend row was `b7a924fa7` (2026-10-17, 156 cases). The steps since (R4 F1 D50 through R8.1 and PERF3) were not recorded as they landed. A row for HEAD `8f49f6d5d` now covers them all, keyed by the dataset's hash (`b9bce8f88c06e704`):

  | Cases | OK | REFUSED | INVALID | WRONG | CRASH / TIMEOUT | New | TODO | Improvement |
  |---|---|---|---|---|---|---|---|---|
  | 205 | 1 099 | 5 | 3 | 5 | 0 | 0 | 8 | 0 |

  The steps in between are not rebuilt one by one: that needs each commit's own build.
- **Properties:** `properties.jsonl` row for the same commit (seed 20261018, 200 runs a property). Every property passes; two runs refused (the uniform scale, the cylinder-box oracles).
- **todo.json:** refreshed by checking, not by editing. All eight rows still fail as recorded, and the run lists no improvement:
  - the 1 nm graze, a wrong body: four rows on `x45-in0_000001`, `x45-in0_00001`;
  - three graze intersects refused as non-manifold where the oracle has a body: `x52_389-in0_01`, `x27_564-in0_001`, and `y1-in0_01` tessellate;
  - helical × helical refused.

  The peer's note that two graze rows pass no longer holds, so the file stands as it is. F2 at 1M positions (3 of 8 holes) is not an RB row; it stays in README §0's open TODOs.
- **PERF3 is done:** A1–A6, D18, D19, B7–B13, C14–C17, D20.

## D83 — R8.2b SD3: the agent's SubD cage tools (2026-10-18)

The rest of R8.2 after PERF3: the cage editor's operations for the agent, and a browser-flow step through the chat.
- **Tools** (`src/chat/cageTools.ts`; in `TOOLS`, so in the MCP server and the chat server's allowed list):

  | Tool | Does | Kind |
  |---|---|---|
  | `subd_cage` | counts, creases, mirror plane, bounds, validation (poles, n-gons, open edges, non-manifold) | read only |
  | `subd_select` | faces by outward `normal` (within `within_deg`, default 30) and/or a `box` on their centres; vertices in a `box`; the `loop` or `ring` through an `edge`; the `boundary` (open edges) | read only, up to `limit` (200) items with centres and normals, the rest counted |
  | `subd_move` | `vertices`, or those of `edges` or `faces`, by `delta` | value edit |
  | `subd_extrude` | `faces` as one region (walled) by `offset`, or `distance` along their mean normal; or open `edges` by `offset` | topology; the new faces or edges named in the result |
  | `subd_insert_loop` | the loop across `edge`'s ring, at its middle | topology |
  | `subd_bridge` | two open loops of equal length in `edges` | topology |
  | `subd_fill` | the hole round open `edges` | topology |
  | `subd_weld` | `vertices` into one, or those within `tolerance` | topology |
  | `subd_crease` | `edges` (or the sides of `faces`) sharp, or smooth with `on: false` | beyond values |
  | `subd_delete` | `faces` | topology |

  All of them act on a subd feature by `index`.
- **The same steps as the editor:** each tool is a cage session step (`cageEdit.ts`: `commitDrag`, `runOp`), so a mirrored node behaves as it does in the editor.
  - Indices are the cage's as the node keeps it: the half, on the + side of the plane.
  - The plane's vertices stay on it, and no wall is put in the plane.
- **Refusals:** a result that is not a manifold is refused, as the editor's Done refuses it. So is an index or edge not in the cage, nothing to move, or a step that changes nothing. Each refusal is typed and says why; the part stays unchanged.
- **Autonomy (D41, the owner's L2 = (b)):**
  - A move is a value edit of the feature and applies directly. `valuesOnly` now reads a `cage` with the same faces and creases, and as many positions, as values. `positions` stays structural elsewhere (mesh nodes).
  - Every other change touches what the cage is made of, so at L2 it is refused with `needs_proposal` and proposed. A proposal of cage ops replays them (they are batchable in `apply_ops` and `propose`).
- **System prompt:** a paragraph on making smooth organic shapes from `subd-box` or `subd-torus` with these tools.
- **Tests (`test/cageTools.test.ts`, 5):**
  - the tools listed; read-only queries (4 top faces of a 2-a-side box; one in a box);
  - extrude by distance (28 faces, the volume up, the top raised), a loop inserted, a crease on and off, a face's vertices moved (faces unchanged);
  - delete → boundary query → fill (closed again), an edge's ends welded, refusals;
  - a mirrored cage (indices of the half, an extrusion keeping the plane's vertices on it, the body whole);
  - L2: a move applies, an extrusion is refused with `needs_proposal` and proposed (the part unchanged).
  - Every result's kernel body passes `checkBrep`, and its cage is valid.
  - `chat.test.ts`' tool list includes the ten.
  - Studio 369/369; browser flow 120/120.
- **Browser flow:** a step through the real chat server and tool server, with the scripted stand-in for the CLI (no model):
  1. a SubD box built on an empty part (the first build, applied);
  2. a cage vertex moved: applied with "Applied by the agent";
  3. a face extruded: refused at L2, proposed, P1 accepted in the studio's panel; the cage has 28 faces and the body is one solid.
- **Pending decision (reversible default):** the hand-over listed "the browser-flow step" under R8.2, and the original R8 plan made R8.3 "the browser flow: a SubD box edited end to end (extrude, loop, crease, mirror, undo), with screenshots". Taken here as follows:
  - the R8.2 step is the agent's tools through the chat (above);
  - R8.3 is the person's end-to-end edit in the cage editor;
  - R8.3 also covers the plan's other item, reusing `direct.ts`' pole gizmo driven by cage data, if it fits.

## D84 — R8.3 SD3: the cage editor end to end, and the owner's pipe clamp (2026-10-18)

R8.3 as D83's default took it (the person's end-to-end cage edit in the browser flow), with an acceptance part the owner added on 2026-10-18 through the coordinating session ("그렇게 해줘"): a SubD-modelled pipe clamp, from a reference image now at `handover/notes/acceptance/subd-pipe-clamp.png`.
- **The part** (as the image shows it):
  - a thick-walled tube, open at both ends, its rims rounded by holding loops;
  - a flat lug rising from the tube's wall, its plane holding the tube's axis;
  - a round hole through the lug, its axis square to the tube's;
  - the lug's top an arc round the hole, a small square step at one end, the lug blended into the tube with no hard edge.
  - The coordinating session's message said the lug's plane is square to the tube's axis and the hole's axis parallel to it. The image shows it the other way: the lug runs along the tube, and the hole looks across it. The image is followed; the other reading is a different cage (the lug from a ring of rim faces) and can be added on request.
  - Axis along Z (the studio's tube and the SubD primitives stand on Z); the lug points along +X.
- **What was added for it:**
  - **`subd-tube`** primitive (`primitives.ts` `tubeCage`; palette and `run_command`): outer and inner radius, length, quads round (6–64) and along (1–24). Every vertex valence 4, so the limit is exact B-spline faces. Its first column is centred on +X, so a lug extruded from it is square to X. The radii are grown by the ring's limit factor, as the torus' are.
  - **`subd_insert_loop`'s `t`**: the fraction along the edge from its first vertex (default 0.5); `runOp`'s insert-loop takes it too. A holding loop is a loop near an edge.
  - **`subd_select` `boundary` with a `box`**: the open edges with both ends in it, for one hole among several.
  - **A hole's rim by double-click** (`openRun` in `cageEdit.ts`): a double-click on an open edge selects the whole rim round the hole (Shift: added), to fill or bridge. Before, the loop of an open edge stopped at its ends.
  - **The cage editor ends its session when the part changes under it** (a new part, a file opened, the agent's edit): nothing written, a toast says so. Found by the browser flow: a new part while a cage was open crashed the panel (`featureLabel` of a node that was gone), and Done would have written over the change.
  - **A drag of nothing is no step** (`commitDrag`): a Shift-press on the gizmo with no movement extruded the picked faces by 0 (copies on the faces they came from, which the kernel refuses: 8 new poles and no body). Found when a Shift-click to add a face landed on the gizmo's arrow. The E key still extrudes in place for the gizmo to drag.
  - **Esc no longer throws steps away:** with nothing picked it left the session as Cancel does, dropping every step unasked (a second Esc did it). Now it leaves only when there is nothing to lose, and otherwise says that Done keeps the steps and Cancel drops them.
  - `__studioCage` (dev only) returns the session's selection, cage, creases, mirror and undo depth, for the browser flow.
- **Built by the agent's cage tools** (`test/subdClamp.test.ts`), as an agent would: each pick found by `subd_select` (faces by normal and box, vertices by box, open edges by box) or read off the cage, each change one tool call. 43 calls, kept as `test/fixtures/subd-pipe-clamp.calls.json`:
  1. `run_command subd-tube` r 20, ri 17, h 40, 24 round, 7 along;
  2. eight holding loops at the rims, 0.6 mm from each corner: on each wall near each end, and on each rim near both corners;
  3. the lug: the five outer faces of column 0 in rows 1–5 extruded out along +X three times (4, 5.71, 5.71 mm), then four of them once more (5.71 mm): the first row stops a level short, which is the step;
  4. the hole: the 2 × 2 side faces at levels 2–3 of rows 3–4 deleted on both sides; the old rims moved onto a circle of 5.2 mm; each rim's open edges pulled 0.6 mm into the lug (a short funnel, the mouth's holding ring) and the new edges moved onto the hole's circle of 4.2 mm; the two mouths bridged;
  5. holding loops in the hole near both mouths, and along both faces of the lug (their ring runs on round the tube's column 0);
  6. the lug's top moved onto an arc of radius 11.4 mm round the hole's centre, its right end down the side, its left end a little down to the step.
  - Every call's result is a body the kernel builds; the tool refuses one that is not. The first recipe pulled the rims out by 0 to drag afterwards, as the editor's gizmo does; that leaves coincident vertices, which the kernel refuses ("a singular surface or a degenerate loop cannot be tessellated"). The funnel replaced it.
  - The same calls through the editor's own session steps (`commitDrag`, `runOp`: what the editor runs for a person's picks and drags) give the same cage, number for number.
  - 43 calls take 60 s in the unit test: each evaluates the part (1–2 s for the clamp, its tessellation most of it).
- **The result** (kernel conformance case `conformance/r8/subd-pipe-clamp.json`, its cage the one the agent's calls make):

  | Measure | Value | Bound |
  |---|---|---|
  | Body | one solid, 1 shell, genus 2; 424 faces (exact patches and 88 caps); 20 irregular vertices, one Catmull–Clark step | |
  | G1 between faces along smooth edges | 1.9e-6° | 1e-5° |
  | Seams | 2.2e-14 mm | 1e-12 mm |
  | Caps' largest distance from the limit | 0.0120 mm (rms 0.0006; 0.0145% of the 83 mm size) | 0.02 mm |
  | Smallest \|Su × Sv\| against its cap's median | 0.068 | > 0.05 |
  | Largest turn between neighbouring normals in a cap | 3.3° | < 15° |
  | Volume | 16 476.176 mm³; the independent oracle 16 476.177 (5e-8) | relTol 1e-4 |
  | Area | 11 019.525 mm²; oracle 11 019.522 (3.4e-7) | relTol 1e-4 |
  | Centroid | [4.41189, 0, 19.99865] mm; oracle within 3e-6 mm | absTol 1e-3 mm |
  | Tessellation (8 a quarter) | 56 060 triangles, watertight, 1.06 s | |
  | STEP | 1.8 MB, written and read in 4.3 s; volume and area equal to rounding; strict check valid | relTol 1e-9 |

  - The oracle is the independent Catmull–Clark in `test/subd.test.mjs` (its limit-mesh volume, now also area and centroid: `limitMeasures`), refined 4 and 5 times and extrapolated; 3 and 4 times differs by 6e-8.
  - **Known open item, not loosened (D79, A5):** the tessellation has concave folds up to **88.6°** (69.7° at 12 a quarter) between sliver triangles about 0.01 mm high, inside exact B-spline patches along the rims' tight holding loops. It is the general B-spline face tessellator's D79 to-do, not a fold of the surface and not at a cap's boundary: the caps' normals turn 3.3° at most. The kernel test holds it below 89° (no worse) and the case's `notes` records it. The studio's render shows no mark there.
  - The conformance runner reads a new optional `expect.subd`: the standing SubD promises as bounds on the named feature's cage (`conformance/README.md`).
- **Tests:**
  - Kernel `subd.test` (D84): every SD2 promise on the clamp; 1 shell, genus 2; volume the oracle's to 1e-6; folds < 89°. Conformance r8 1/1.
  - Studio `subdClamp.test.ts` (2): the build through the tools (the calls and the cage as kept; `UPDATE_CLAMP=1` writes both again), and through the editor's steps.
  - `primitives.test`: the SubD tube (regular, no caps, genus 1, between its radii and length, column 0 centred on +X, refused inside out).
  - `cageEdit.test`: a hole's rim by double-click (in order, closed; a second rim added; bridged: genus 1).
- **Browser flow:**
  - **R8.3, by hand on a SubD box** (4 a side): a top face picked and Shift-dragged up the gizmo's Z arrow (extruded, 100 faces); a front edge picked, L (a loop round the box, 116), C (the new loop creased, 16 edges); Mirror X (the + half, the body the half and its image); ⌘Z in the session (whole again, the loop and creases kept); Done (one node edit); the document's ⌘Z (the box as it was) and ⇧⌘Z. Screenshots after each.
  - **D84, by the agent through the real chat and tool servers** (the scripted CLI stand-in): the tube built on the empty part (applied), then the other 42 calls as one proposal at L2, accepted in the studio: one body, its cage the conformance case's exactly, its volume shown (16 476 mm³); STEP exported and opened again: one solid, the same volume. 100 s through the chat.
  - **D84, by hand in the cage editor**: a SubD tube from the palette with its sizes typed; a holding loop at the top rim (L); the lug's five faces picked (Right view), Shift-dragged out twice, the lowest taken out of the pick (Shift-click), the rest out twice more; in an orthographic front view the hole's four faces on the front deleted, then the same places take the four behind them, deleted too (in perspective the faces behind are drawn a little aside, and a click there took a front face beside the hole); the two rims double-clicked (the second with Shift) in an iso view and bridged (B); Done: one body, the cage valid and closed, the kernel's body one shell of genus 2. By hand the hole stays square (rounded by the limit) and the rims have one holding loop: the agent's path places every vertex, a person's drags are coarser; the topology is the same kind.
- **Suites:**
  - kernel 1022/1028: 4 skipped as before; the known environmental `actual native Split source…`; and the B9 wall-clock test (40k planar mass in 417 ms against its 400 ms bound) while the studio suite ran beside it — 75 ms alone, where it passes. Load-sensitive as AM4 was.
  - conformance all, the clamp's case 9.5 s; RB over 206 cases: nothing new, the 8 known TODOs, the clamp's case through every stage;
  - studio 374/374;
  - bench all within budget, the new row `subd: the pipe clamp (cold)` 299 ms (budget 600);
  - lint (0 errors) and type-check clean;
  - browser flow: full run 123/123 (the three new steps; the clamp through the chat 95 s).
- **The pole gizmo item (D83; R8's plan: "the pole gizmo from `direct.ts` driven by cage data, not source-text edits"):** nothing left to do. The cage editor's gizmo is the viewport's `TransformGizmo`, the one `direct.ts`' poles use, and it edits the cage's data itself (a session step), never source text.
- Picks in the flow click a face halfway to its lower-left corner and in an order that keeps each next face below or left of the gizmo's middle: its arrows point up and right from there. The view is framed by its button (F is Fill while a cage is edited).
- **Follow-up seen, not in this step:** the Selection panel's "Surface area" is the tessellation's (11 007 mm² for the clamp, 0.11% under the exact 11 019.5); the exact area is the kernel's.

## D85 — R9 (M4): our own QEM decimation, attribute-aware, with a measured error (2026-10-18)

The roadmap's line: "our own QEM decimation, attribute-aware, with a reported error". There was no spec beyond it, so this record sets what each word means here.
- **Kernel `decimateMesh`** (`src/mesh-decimate.ts`; own TypeScript, typed arrays, no dependency):
  - Edge collapse under the quadric error metric (Garland & Heckbert 1997). Plane quadrics are unweighted, so a collapse's cost is a sum of squared distances (mm²); its square root bounds the distance to every plane it gathered.
  - Placement: the quadric's minimum when its 3 × 3 part is well conditioned and within two edge lengths of the edge, else the better of the ends and the middle.
  - Each vertex's cheapest collapse sits in an indexed min-heap (ties by vertex number: the result is deterministic).
  - After a collapse: the merged vertex is priced again; a neighbour whose cheapest collapse involved the merged pair is refreshed; any other neighbour is offered its collapse with the merged vertex if cheaper. A price gone stale is re-queued at pop time, not made.
- **"Attribute-aware": what the mesh says is kept.** Meshes here carry no normals, UVs or colours (STL, OBJ positions, facet patches). What they do carry:
  - open boundaries;
  - per-triangle groups: a repair's fill patches, and in the `decimate` feature each source face (region);
  - creases (a dihedral past `featureDegrees`; default 40° for the kernel call; the feature's default is none, its regions carry the creases).
  - Those are feature lines:
    - a feature vertex slides only along its line (both ends on lines, the edge itself a feature), placed on the edge segment (the quadric's least along it), so a line keeps to where it ran;
    - a vertex off the lines collapses onto a feature vertex (placed there);
    - corners and ends never move: three or more feature edges, one, or two turning past the angle (a sheet's corner, a patch's);
    - penalty planes (weight 100) through each open or creased feature edge, square to its triangles;
    - a group seam where the surface is smooth (under 20°) gets no penalty. It still only slides along itself, but straightens as cheaply as the surface lets it. Found in the browser: a torus' halving seam (D42) stayed a jagged band of small triangles.
  - Every triangle keeps its winding and its group.
- **Never a fold or a broken manifold:**
  - the link condition: the neighbours common to both ends equal the shared triangles;
  - two valence-3 vertices sharing two triangles are refused (a tetrahedron's edge);
  - no triangle may turn more than 75° in one collapse or flatten;
  - no triangle may face away from the surface its corners stand for. Each vertex carries the area-weighted normal sum of the original triangles it replaces, merged as it merges.
    - The first try compared a triangle with its own starting normal. On a noisy sphere that let folds through near jagged feature lines: a starting triangle can be tilted 60°.
  - Refusals are counted in the report.
- **"Reported error": measured, not estimated.** `meshDistance` (`src/mesh-distance.ts`) takes each sample of one mesh (vertices and triangle centres) to the nearest point of the other's surface. It uses a hierarchy of its triangles (median splits along the longest axis, leaves of up to 4) and a branch-and-bound search, nearer child first.
  - The report gives the distance both ways, the Hausdorff (the larger), the RMS and the sample count. These are samples, not a bound: a surface point between samples may be further.
  - It also gives the counts, why it stopped (`target`, `error`: the quadric bound reached, `exhausted`: nothing left it may collapse), the largest quadric bound made, the refusals and the time.
- **Part feature `decimate`** `{ target, triangles? | ratio? | maxError?, featureAngle? }`:
  - Only on a mesh body (facet faces), refused otherwise (`CAPABILITY`). Its triangles are gathered wound outward and welded; each face is a group.
  - The result goes through `facetBrepFromTriangles` with `groups` and `groupName`, each face named as its source face with `creaseDegrees` 180. The faces keep their names, so A1 references and selectors keep resolving across a decimation.
  - The output carries `decimate` (the report).
- **Studio:**
  - a `decimate` node (`{ parent, ratio?, triangles?, maxError?, featureAngle? }`); the label "Simplify mesh to 25%";
  - a "Simplify mesh" command (modify; a mesh body selected), with fields Keep % (25), Max error (0: none) and Crease angle (0: regions only);
  - its icon: a block whose top is fine triangles near and two coarse ones, in the accent, far;
  - the edit fields Keep %, Max error and Crease angle (so `edit_feature`, and at autonomy L2 a value edit); `features.ts` spec;
  - the report as the body's notes: "Simplified: 10,000 → 1,000 triangles (stopped at the asked count)", "Measured distance from the original: at most … (… to it, … back; RMS …, over … points)", and the refused collapses;
  - `run_command decimate` (bodies, keep, maxError, crease).
- **Numbers** (Node 22, Apple M-series; decimation without the measurement, then the measurement both ways):

  | Mesh | Triangles | Decimate | Measured Hausdorff (RMS) | Measure |
  |---|---|---|---|---|
  | icosphere r 10 | 20 480 → 2 048 | 85 ms | 0.029 mm | 2 × 25 ms |
  | icosphere r 10 | 327 680 → 32 768 | 1.2 s | 0.0022 mm | 2 × 0.3 s |
  | organic torus 200k (bench fixture) | 199 712 → 19 970 | 0.84 s | 0.072 mm (0.012) | 0.46 s |
  | organic torus 1M | 999 698 → 99 968 | 4.8 s | 0.014 mm (0.002) | 1.6 s |
  | scan sphere 200k (jittered; creases off) | 201 612 → 20 160 | 1.46 s | 0.29 mm (0.062) | 0.6 s |
  | gridded box 1 200 | → 12 | 18 ms | 2.5e-15 mm | |

  - meshoptimizer's 1M → 100k in 0.4 s (noted in §4) stays a reference; we are about twelve times slower in TypeScript with the feature, fold and manifold checks. Profiled after three rounds (feature scans in one pass, a cached feature degree, kept unit normals, partial re-pricing, no allocation in the loops): 2.3 s → 1.2 s on the 328k sphere. Most of what is left is pricing and the feature scans.
  - On a noisy scan the 40° crease angle reads noise as creases and stops early (the 200k scan sphere at 94k, "exhausted"). The feature therefore takes its creases from its regions.
- **Tests:**
  - kernel `mesh-decimate.test` 7/7: the gridded box to its 12 (corners exact, volume 1000); the sphere to 10% and 2% (closed, wound, within 0.05 and 0.25 mm, the report's distances equal to `meshDistance`'s, deterministic); a noisy sphere (as a scan every triangle facing out; with creases nothing past 95°); a group patch kept (square and area); an open sheet (flat: two triangles; wavy: its boundary on the square); the error bound; the feature (names kept, refusals);
  - conformance `r9/decimate-grid-box` (exact) and `r9/decimate-sphere` (within 0.4 mm both ways, volume 3%, area 1%), with a new optional `expect.outputs[].decimate` (`trianglesAtMost`, `hausdorffMMAtMost`);
  - studio `decimate.test` 3/3: the command (offered for a mesh body only), names and volume, notes, label, saved and read back; `run_command`; `edit_feature` Keep at L2;
  - bench rows `mesh: decimate 200k organic to 10%` (budget 1 700 ms) and `mesh: distance both ways, 200k and its 10%` (1 000 ms);
  - browser flow `R9 Simplify mesh`: a 10 000-triangle lumpy torus STL opened, simplified to 10% from the palette, the notes in its panel, undone.
- **Suites:**
  - kernel 1032/1037: 4 skipped (`modeling-offset`'s trapped cases, run only with `CAD_MODEL_OFFSET_ADMISSION_TRAP=1`) and the known environmental `actual native Split source…`;
  - conformance all, with `r9/` 2/2; RB: nothing new, the 8 known TODOs, both `r9/` cases through every stage;
  - studio 377/377 (`chat.test`'s schema test gives `decimate` a mesh body, as `gear-mesh` a gear);
  - bench all within budget (decimate 845 ms, distance 368 ms);
  - lint (0 errors) and type-check clean;
  - browser flow: full run 124/124.
- **Pending decision (reversible default):** the meaning of "attribute-aware" above (boundaries, groups and regions, creases; no UV or normal attributes, since none are read). Taken for meshes as they come in today; when OBJ normals or UVs are read, they join the quadric as attribute terms.

## D86 — R10a: stable sketch-entity side names (2026-10-18)

D31's plan, taken up as R10a, with the coordinating session's research note (`handover/notes/research-sketch-solver-2026-10-18.md` §3 S2) as design input: stable ids for a sketch's lines, arcs and circles; constraints carried by them; a versioned node so saved documents keep resolving.
- **Kernel: `sideTags` on the sketch feature** `{ outer, regions?, holes? }`:
  - one tag for each side of the outer loop (a rectangle's 4, a circle's 1, a polygon's points, a loop's segments), of each region loop and of each hole loop;
  - a tag is letters, digits, `_` or `-` (1 to 32), so it never meets the name parsers' `.`, `|`, `+`; tags are unique in the sketch;
  - refused with `INPUT` when it is the wrong count, a tag twice, or not a tag.
  - With tags, every wall a body makes of the sketch is `<feature>.side[<tag>]`, whatever loop it is in. The prefix `region<r>.`/`hole<h>.` falls away, since tags are unique.
  - **Every side-naming generator honours them** (D31's five, plus the shell's section ring):
    - upright extrude (`prismaticFromProfile`: outer, regions and holes);
    - drafted extrude;
    - revolve (a full-turn circle: its halves and parts all `side[t]#k`);
    - loft: each side by the source segment of the first section it runs from, and several from one segment (arcs split into ≤ 90° spans, pieces halved to match counts) numbered `#k`;
    - sweep: each straight and bend piece, `.s<k>.side[t]`;
    - the revolved and swept shell's `sectionRing`: the names it opens faces by.
    - Each maps the built loop back to the authored segment, a clockwise loop being reversed (`side-names.ts` `sideName`).
  - Without tags nothing changes: `side<k>`, `region<r>.side<k>`, `hole<h>.side<k>` (D16: documents written before keep their names).
- **Studio: sides with ids** (`src/sketch/entityIds.ts`):
  - Every sketcher shape carries `ids`, one a side, of the form `e<k>`, unique in the sketch. A rectangle's and a slot's run in the shape's own corner order, a circle has one, and a polygon has one a point (point i's is segment i's). A polygon's attached circles carry `circleIds`.
  - `withIds` gives missing ids after the highest, deterministically. `profileOf` writes them on the node as `sideTags`, matched to the node's loops by their segments' ends (a polygon saved as a rectangle runs from its lowest corner, whichever corner it was drawn from).
  - **Edits keep them:**
    - Split (K): the piece's first part keeps its id, the new point's piece gets a new one, and every other id stays.
    - The outline's constraints and dimensions are carried through by the ids (`carryPolygon`: lengths, radii, tangents, equal radii, concentric, H/V, rules), where before every one was dropped. The split piece's own length or radius goes.
    - Round corner: both edges keep theirs, and the arc gets a new one.
    - Trim, extend and join: ids inherited by where each piece starts.
    - Offset: new shapes, new ids.
  - **Reopen:** a node with `sideTags` gives its shapes back their ids. A node from before (no tags) gives its shapes new ids in the order its sides were numbered, and remembers which positional name each id takes over (`side2` → `side[e3]`).
  - On Finish, the features built straight on it (extrude, revolve) have their references renamed once, exactly. That covers later features' edge and face names, looks' face colours and mates, as a string or an object key, alone, in `a|b` or in `a+b`, with any `#k`.
    - Only ids the sketch still has are renamed; a side removed in the edit goes to the re-match (D28) as before.
    - Loft and sweep pieces (positional pieces, not segments) also go to the re-match as before.
- **Versioning (D16 pattern):** a sketch node with `sideTags` is the new form; without, the old.
  - Sketches written by commands (primitives, fasteners, profiles, the library, the agent's `add_features`) stay as they were: their walls are `side<k>` until the sketch is edited in the sketcher, which gives it ids and renames as above.
  - So no existing document, test or library file changes its names: the box command's `n1.side0|n1.top` is still that.
  - `sideTags` is structural for autonomy (D41): changing it renames.
- **Names consumers:**
  - selectors' role family (`role: "side"` matches `side3` and `side[e3]`);
  - the mate panel's label ("Side face e3");
  - Draft's all-sides check;
  - the agent's tool docs (`side[e3]`, "stay as the sketch is edited");
  - `features.ts` accepts `sideTags` on a sketch.
- **S2, what was taken and what was not:**
  - Taken: stable ids for edges (lines, arcs) and circles; constraints carried by those ids through every renumbering edit; the versioned node.
    - The constraints are still stored by position in the outline, in the same order as its ids. That is the solver's input as before. An id-keyed store would change every rule's form (S1's native residuals would rewrite them anyway).
  - Not taken: multi-entity sketches with loops derived from the graph. Today a sketch is one outline plus circles and separate shapes; nothing in R10a needed more.
  - S1 and S3–S6 (native residuals, decomposition, sparse algebra, drag, diagnosis): none was needed.
- **Tests:**
  - kernel `side-tags.test` 2/2: every generator; a clockwise loop by its authored order; holes; a revolved circle; a vertex inserted keeps the others; a fillet on a tagged edge; untagged unchanged; the refusals.
  - conformance `r10a/` 3/3: a tagged prism with a hole; the same with a vertex inserted (every name kept, `side[x]` added); a tagged revolve with its section out of order. Closed-form volumes and centroids.
  - studio `sketchIds.test` 4/4:
    - ids and tags;
    - a vertex inserted by the sketcher's split: the fillet needs no re-match, and a kept length carried;
    - a rectangle drawn from its top-right corner; a rounded corner; a trim;
    - a sketch from before reopened and renamed (fillet edge, face colour), then reopened again with its ids.
  - `constraints.test` and `plane.test` expect the ids and tags now.
  - browser flow `R10a`: a quad drawn by hand, extruded, a corner filleted by its name; reopened, an edge split with K; Finish keeps the fillet's edge, nothing re-matched, the other four walls' names kept.
- **Suites:**
  - kernel 1037/1042: 4 skipped (env-gated) and the known environmental Split test;
  - conformance all, `r10a/` 3/3; RB nothing new;
  - studio 381/381; bench all within budget; lint (0 errors) and type-check clean;
  - browser flow 125/125. The full run's three chat steps first failed with EADDRINUSE: another tool's vite dev server held the flow's default chat port 52091. Rerun with `CAD_STUDIO_CHAT_PORT=52191`, they pass (README §0, How to run).
- **Pending decisions (reversible defaults):**
  - Command-made sketches stay positional until edited in the sketcher.
  - The ids read `e<k>`.
  - Constraints are stored by index alongside the ids.

## D87 — R10 S0: feasibility of general fillets (2026-10-19)

The roadmap's feasibility checkpoint before R10, with the coordinating session's research note (`handover/notes/research-r10-r11-fillet-shell-2026-10-18.md`) as design input. The question: does the research note's R10.1 hold on the method fillets use today (`edge-finish.ts`: a rolling-ball tool, the region between the two faces and the fillet surface grown a little into the air or the body, one analytic Boolean), or does it need the contact-trimming the note gives R10.2?

The method's risk is the Boolean meeting a tool tangent to a curved face: along a line for a cylinder, along a circle for a cone. The note lists it ("tangential contact is the marcher's worst case") and the intersections' notes say grazing cylinders are refused.

- **Probed with the tools built by hand** (`packages/barocss-cad/test/r10-s0.test.mjs`, kept as evidence; closed-form volumes):

  | Class (R10.1) | Case | Tool | Result |
  |---|---|---|---|
  | (a) translational, concave | a rod (R 5, axis along X at the plate's top) on a plate: the junction along its ruling | the 2D fillet region (line, circle, fillet arc) extruded along X, unioned | valid; added volume = (triangle C–T1–F − fillet sector − rod sector) × 40 to 1e-13, r 1, 2, 3; 16–39 ms |
  | (a) translational, convex | a groove (the rod cut away), its rim | the same, below the top, subtracted | valid; to 2e-12 |
  | (b) coaxial, convex | a cylinder under a cone (one axis), the rim circle | the meridian fillet region revolved, subtracted | valid; removed volume = 2π × (kite − 45° sector)'s first moment to 1e-9 |

  - Tangent contact with a cylinder along a ruling, and with a cone along a circle, goes through the analytic Boolean exactly. The refused grazing is the crossing of two cylinders' surfaces, not a tool face tangent to a body face, which the plane/plane fillets have always relied on.
- **Today** (the same file, which R10.1 turns over in plain sight):
  - the rod's junction is refused: "straight edges can be finished between two planes only";
  - the cone rim is refused: "only edges between planes and cylinders can be finished yet";
  - **`faceReach` confirmed as a defect.** A block whose top bows in on its far side (10 mm deep at its ends, 7.93 at the middle) takes a fillet of 8.5 mm. It is admitted, because `faceReach` is the farthest control point (10). The result is a valid solid but no quarter round: the round runs off the top into the bowed wall.
- **Verdict: R10.1 as the research note gives it, on today's method.** No new trimming machinery is needed for it.
  - **(a) translational:** a straight edge along d between faces extruded along d (planes ∥ d, cylinders with axis ∥ d). Solve the 2D fillet in the cross-section (line/line, line/circle, circle/circle; convex or concave), extrude the region along the edge, with today's runs past the ends and tangent chains.
  - **(b) coaxial:** an edge between surfaces of revolution about one axis (plane ⊥ axis, cylinder, cone, sphere, torus). Solve in the meridian plane and revolve, as `arcTool` does for plane/cylinder.
  - **Typed refusals:** `TANGENT_FACES`, `RADIUS_EXCEEDS_FACE` (the true reach) and `NOT_ANALYTIC_PAIR` (→ R10.2).
  - **`faceReach`:** a true reach replaces it: the face's least extent across the edge along its length.
  - **Fixtures:** each class's volume in closed form (as here); name stability across a radius change; RB4's fillet properties extended.
  - R10.2 (marched spines, contact trimming), R10.3 (vertex blends), R10.4 (overflow) and R10.5 (variable radius) stay as the note orders them.
- **Not decided here:** whether the pipe-clamp lug's B-rep version (the note's §5) is R10.1's acceptance part. It needs R10.1(a) for the blend and R10.3 for the lug's own corners; taken as a later fixture, not R10.1's.

## D88 — R10.1: translational and coaxial fillets in closed form, typed refusals, the true face reach (2026-10-19)

R10.1 as D87's verdict and the research note (`handover/notes/research-r10-r11-fillet-shell-2026-10-18.md`) give it, on the method fillets already use (a rolling-ball tool, one analytic Boolean). Fillets only; chamfers of the new pairs are refused for now.

- **The section solver** (`packages/barocss-cad/src/fillet-section.ts`, new): a fillet's cross-section where both faces are lines or circles in the section.
  - The ball's centre is where the two curves, offset by r towards the corner, meet: line/line, line/circle and circle/circle, exactly. Of the meetings, the nearest whose contacts lie ahead of the edge on both faces.
  - The contacts are the centre's feet on the curves.
  - The tool: the region between the faces and the fillet arc, grown by g outside the corner along the faces' own outward offsets (exact lines and concentric arcs, so the growth stays on the faces' far side however they curve). g shrinks where a circle would shrink past half its radius.
  - The profile's last segment is the fillet arc, tagged `f`; the tool's faces are named from the tags (`<id>.face` and `<id>.tool`), not by a marker.
- **(a) Translational** (`translationalTool`): a straight edge between planes along it and cylinders whose axis runs along it. Solved in the section square to the edge and extruded, with the runs past the ends of a straight tool. New pairs: plane × cylinder along a ruling (a rod on a plate, a groove's rim, a D shaft's flat) and parallel cylinder × cylinder.
- **(b) Coaxial** (`coaxialTool`): a circular edge between surfaces of revolution about the circle's axis (planes square to it, cylinders, and cones, spheres and tori through `revolutionOf`). Solved in the meridian and revolved, as `arcTool` does. New pairs include cylinder × cone, cone × plane, plane × cone (concave), cylinder × sphere, and any coaxial pair of these.
  - A face of revolution's outward side comes from the parametric normal at its patch's middle.
  - A curved edge's tangent chain now also crosses a seam between halves of its faces when the normals there agree. A revolve's rim halves share no face, so before this one half was filleted alone. One half selected now rounds the whole circle, as one closed tool.
  - Only the profile turns, so the axis check is the profile's least ρ, an arc's leftmost point included, not the ball's.
- **Unchanged paths:** plane/plane edges (`straightTool`, `cornerProfile`) and plane × square cylinder (`arcTool`) keep their geometry and names. The corner blends, mitres and chain logic are as before.
- **Typed refusals:** `B-rep: <SELECTION|PARAMETER|CAPABILITY>: [<code>] …`, mapped to the part error as before. The studio's `engine/errors.ts` gives each a hint.
  - `TANGENT_FACES` (SELECTION): faces meeting tangentially, e.g. a round's own tangent edge.
  - `RADIUS_EXCEEDS_FACE` (PARAMETER): a contact past a face's true reach. Also the plane/plane wall check and the wedge chamfer, whose wording "too large for walls" is kept.
  - `RADIUS_EXCEEDS_CURVATURE` (PARAMETER): a ball that does not fit inside a face's circle (r ≥ ρ), or no ball touching both faces.
  - `NOT_ANALYTIC_PAIR` (CAPABILITY): neither translational nor coaxial; general fillets are R10.2.
- **The true reach** replaces `faceReach`'s farthest control point, an upper bound (the defect D87 confirmed). It is the face's least extent across the edge over the edge's length, in the face's own measure: a line's distance along w, a circle's angle.
  - **Which boundary edges count:** those beside the edge (along it within its length, or its sweep), except:
    - those touching the edge's ends;
    - those lying where the edge ends (the body ends there, not the face);
    - for a finish that removes material, another loop's convex edges (a hole's rim: the cut runs into the void, as part-model's "brep-core step 7" chamfer beside a hole requires).
  - A boss's foot limits it; for a finish that adds material, every boundary does.
  - Across a smooth edge (a seam between halves of one surface), the neighbour's boundaries count instead. Without this the property below found 42 in 200 grooves falsely refused at a cylinder's seam 17.8° from the rim.
  - **Precision:** sampled 64 times an edge, then refined to rounding (crossings by bisection, minima by golden section).
  - It now applies to the convex plane/plane check, the wedge chamfer, `arcTool` (both senses) and both new tools.
  - The bowed block's 8.5 mm fillet is refused at a reach of 7.928932 (15 − √50).
- **Evidence:**
  - `test/r10-1.test.mjs` (4 tests). Every volume is the region between the corner and the fillet arc, worked out by hand and integrated exactly (Green's theorem over lines and arcs; Pappus):
    - **Translational:** rod on plate r 1–3, D shaft r 0.5 and 1.5, two parallel rods r 0.5–2, all to 1e-9 relative. The fillet surface is within 1e-12 of the cylinder about the ball's centre line.
    - **Coaxial:** cylinder × cone, cone × plane and plane × cone (foot) to 1e-10 of the part (torus quadrature); the fillet surface is within 1e-12 of the torus about the ball's centre circle.
    - **Cylinder × sphere:** the surface is exact to 1e-12, the volume to 1e-7 of the part (6e-8 measured: quadrature over the sphere face trimmed by the torus).
    - **Refusals:** each typed code, the reach exactly met (r 37.5 on a 15 mm top) and just passed (r 40).
    - **Names:** every face and edge name is unchanged across r 1–7.5; a sketch-tagged rod keeps `ce.side[w]`.
  - `test/r10-s0.test.mjs`'s "today" test now records then and now: both S0 refusals filleted, and the 8.5 mm defect refused by name.
  - **Conformance `conformance/r10/`** (6 cases):
    - translational rod on plate (volume and centroid closed form, STEP round trip);
    - coaxial cone rim (volume closed form; centroid by this kernel, x and y 0 by symmetry);
    - one refusal for each typed code.
  - **RB4 properties** (`scripts/rb/property.mjs`):
    - "translational fillets": a random rod or groove (radius 2–8, axis −0.8ρ to 0.8ρ about the top, r 0.2–3) against the closed-form section, 200/200 at the fixed seed and three random seeds;
    - "coaxial fillets": a random wall-and-cone body against Pappus, to the result's mass method.
  - **Studio:** errors.ts hints; a flow step opens a rod-on-plate file, fillets the junction in the studio (volume = the closed form to the panel's 1 mm³), and has the other junction's 40 mm refused as too large.
- **Found and kept as known, not fixed here** (`robustness/properties-todo.json`):
  - **The analytic Boolean** fails on some coaxial cone-rim tools: 9 in 200 at the fixed seed, 8 at another. It leaves a sliver of the body's seam edge (the seam opposite the edge's start, from the corner to the contact on the cone): "not a manifold solid". The smallest is R 9, h 10, a cone of about 45°, r 1.
    - D87's hand-built tool fails identically, so the defect is the Boolean's with a tool tangent to a cone, not R10.1's.
    - Rotating the tool's seam by ±1e-12 or ±1e-9 changes nothing (structural, not rounding). A generic seam angle makes it far worse (192 in 200).
    - The coaxial line/arc tangency test in `profileCrossings` was ruled out: disc against tol² looked suspect, but a distance test changed nothing and was not kept.
    - The other 191 in 200 are exact.
    - The property is a TODO, so the harness stops at its first failure there. Its coverage meanwhile comes from `r10-1.test.mjs` and the conformance cases.
    - **Next:** R10.2's contact pcurves, or a Boolean repair of seam slivers.
  - **Mass:** where quadrature's finer pass (q 16) cannot place a mesh point on such a torus, the result's mass falls back to the tessellation (5 in 200 there). It is reported honestly as `tessellated`, up to 4.4e-4 of the part off at the default chords in those seen (the removed 13.20 mm³ against 11.33); the coarse pass alone is exact there. A quadrature robustness item.
- **Not done:** chamfers of the new pairs (refused with CAPABILITY); the pipe-clamp lug's B-rep version (needs R10.3 too, D87); variable radius, vertex blends and overflow (R10.2–R10.5).

## D89 — R10.2a: the rolling-ball fillet of closed chains between any two faces (2026-10-19)

R10.2 split in two, as the research note's R10.2 is large. **R10.2a** (this): closed chains, any faces. **R10.2b** (next): open chains (their ends).
- **Method:** the tool + analytic Boolean method of R10.1, with a lofted NURBS tool. The note warned against a NURBS-tool Boolean; the risk it names (marching tangential contact) is met by telling the Boolean where the tool touches (below), not by contact-pcurve surgery.
- **The ball** (`packages/barocss-cad/src/rolling-ball.ts`):
  - At stations along the chain, the ball of radius r touching both faces is solved: centre c = S_A + σ_A·r·n_A = S_B + σ_B·r·n_B, in the plane through the station square to the chain. That is four equations in the contacts' (u, v), solved by damped Newton from the last station, with finite-difference normals.
  - Derivatives are central inside the domain and second-order one-sided at its edges: one-sided O(h) normals at a seam left a 2.8e-6 mm residual.
  - The solved balls' |c − p| − r is 1e-10 to 1e-9 mm.
  - Each station's section lies in the ball's plane through both contacts: the contacts, the faces' tangent lines grown g = r/2 outside the corner, their corner, and the fillet arc (rational quadratic).
- **The loft:**
  - **Along the chain:** a C² cubic B-spline through the stations, solved by collocation, with end tangents from five-point stencils (one-sided at a stretch's ends, so O(h⁴): stencils across a stretch's ends made it O(h²)). Up to 13 spans a patch within the 16-pole limit.
  - The arc's middle row is interpolated in homogeneous coordinates.
  - Five faces a patch: the fillet `<id>.face`; the walls at both contacts and the grown corner `<id>.tool`.
- **The breaks:** the tool's patches break where a contact crosses from one face to the next (a seam between halves), found by bisection to rounding. A tool contact edge crossing a body seam inside a patch broke the Boolean: the cone and rod case.
  - Stations are spaced evenly in length within each stretch.
  - A stretch's first station is seeded by a fresh inversion: the last stretch's (u, v) belong to the face across the seam.
- **Refinement:** the station count starts from max(64, length / (r/4)). It grows as the h⁴ rate predicts, until the lofted contacts lie within a quarter of the Boolean's tolerance (2.5e-7 mm at this scale) of their faces. Past 4096 stations it is refused, `APPROX_TOLERANCE_NOT_MET`.
- **The Boolean** (`analytic-boolean.ts`): a new option `contactFaces`, the tool's faces that meet the body only along their own edges lying on it (the fillet and the two contact walls). For such a pair (and an edge of it on the other's surface), those edges become the cuts and nothing is marched.
  - Without it the march along the wall's edge and the edge-on-surface cut overlapped. With the option kept on `exactly()`'s arc refit, neighbouring pieces' ends moved 1.5e-6 apart and the face was not split. The result failed erratically with the station count: the boss passed at 240 and 300 stations and failed at 248–264.
  - Each rolling-ball tool is applied in its own Boolean, before the other tools.
- **Where it applies:** a closed component of the selected edges' tangent chain containing an edge no closed form finishes (R10.1's `NOT_ANALYTIC_PAIR` cases) gets one ring tool for the whole loop.
  - The sides' faces are sorted by shared faces, then by normals at the loop's vertices; convexity comes from the first edge.
  - `finishBrepEdges(…, { general: true })` forces the path on loops that have a closed form, for testing.
  - The output carries `fillet: FilletReport[]`: stations, patches, `contactMM`, `normalDeg` (fillet against face normals at the contacts), `sectionMM` (lofted against true sections between stations), `ballMM`.
- **Refusals:**
  - An open chain of general edges: `[NOT_ANALYTIC_PAIR] … open general chains arrive with R10.2b`.
  - A contact off all the side faces: `[CONTACT_LEAVES_FACE]` (rolling over is R10.4).
  - `[APPROX_TOLERANCE_NOT_MET]`.
  - Chamfers between general faces: CAPABILITY.
- **Evidence** (`test/r10-2.test.mjs`, 5 tests):
  - **Against the closed forms**, the general path forced: boss foot (concave) and hole rim (convex) to 1.7e-7 of the fillet's volume; cone rim to 2.8e-6. That is the loft's ~2e-7 mm section deviation over the fillet's area.
  - **Pipe tee (radius 10 and 5, r 2) and crossing rods (5 and 3, r 1):**
    - valid, the loop from one edge;
    - contacts 0.7–1.4e-7 mm off their faces;
    - G1 to 2e-5–7e-5°;
    - sections 1–2.2e-7 mm off the true ones;
    - volume within 1e-6 of a loft through twice the stations.
  - **Names:** every face but the fillet's keeps its name across r 1 and 2. The fillet's faces are `f.face#k`, one a patch; their count follows the refinement, so the fillet's own face names are not stable across a radius change.
  - **Conformance:**
    - `r10/general-tee` and `r10/general-crossing-rods` (this kernel's volume to 1e-7 of the part, about 1e-4 of the fillet; STEP round trip);
    - `r10/refuse-open-general-chain` (an oblique groove's rim) and `r10/refuse-contact-leaves-face` (a branch too short for r 3);
    - `r10/refuse-not-analytic-pair` superseded: the crossing rods now build. R10.1's test uses the oblique groove instead.
  - **Studio:** errors.ts hints; a flow step opens a pipe-tee file and fillets the junction in the UI (+15.71 mm³, as the conformance case).
- **The coordinator's probe, the pipe clamp's lug as a B-rep** (in `r10-2.test.mjs`): a tube along X with a lug standing on it, broad faces along the axis, narrow ends square to it, the hole square to the broad faces.
  - The broad faces meet the tube in **rulings** (translational, R10.1) and the narrow ends in **arcs** (plane × square cylinder). The note's wording holds for this orientation.
  - R10.1 fillets each of the four edges alone. The loop in one feature is refused at its four inside corners ("inside corner of their face"): there the ball rolls round the lug's convex vertical edge, a mixed corner, R10.3. It is kept as a conformance case once R10.3 builds it.
- **Cost (known):** a general fillet takes 3–5 s for one loop (tee, boss, crossing rods) and 11 s for the cone and rod (30 patches). The studio's evaluation took 9 s for the tee.
  - The Boolean takes most of it: the march, the curved arrangement of the many cut pieces, and stitching.
  - Candidates: fewer patches (a higher-order loft), and the Boolean's arrangement of many short cuts.
- **Not done:** open chains (R10.2b); variable radius, vertex blends, overflow (R10.3–R10.5); general chamfers.
- **Names across a radius edit (settled in R10.2b, the coordinator's question; tests in `apps/cad-studio/test/filletNames.test.ts`):** the kernel's fillet faces stay `f.face#k`, one a patch, and they are not made independent of the patch count.
  - **Face references resolve.** The studio shows a fillet's patches as one face by its base name (`n5.face`), and a document refers to that name (a colour, a shell opening, a mate face, a drawing's face). On the pipe tee, a colour on the fillet keeps its key across r 2 → 1 with nothing re-matched.
  - **Ring edges:** a closed fillet meets both faces tangentially, so the studio shows no edge along it; there is nothing to reference.
  - **Edges of an open fillet** (R10.2b, its end edges on a crease): a reference is one piece's name, `…#k`. On a radius edit, the D28 prior-document match finds the edge again by its signature. It resolves, marked re-matched until confirmed (one change, tested on the oblique groove, r 1 → 0.7).
    - That needed two studio fixes. First, candidates with identical signatures (the pieces of one shown edge) count as one in `matchSignature`. Second, a display-edge piece shorter than the weld distance joins as a point, so it no longer collapses the edge.
  - **Why not one name per contact chain:** the 16-pole limit forces several faces along one chain. The base pair of faces is not unique either (a pattern of holes gives the same pair many times). A stable-parameter index would still renumber when a break moves. No saved name changed, so no D16 version step.

## D90 — R10.2b: open chains of general edges, R10.1's oblique ends, contact cuts once (2026-10-19)

The rolling-ball fillet (D89) for an **open** tangent chain: its ends, plus three fixes found on the way.
- **Chains** (`edge-finish.ts`):
  - Selected edges join into a chain by tangent continuation only, no longer by any shared vertex.
  - A chain's smooth continuations (a seam into the same surface) are excluded from the end tests (`smoothAt`).
  - A branching chain is refused (CAPABILITY "its chain branches").
- **An end**, for each end of the chain, looking at the faces there other than the two sides (faces parallel to the edge ignored, coplanar pieces merged):
  - **Run past:** the body ends past a convex end. The station march continues beyond the edge's end, a step at a time, until the section clears the end face's plane. Past the end the true junction is marched: an r = 0 station solve over all face pairs, with Hermite stations between the samples. The Boolean trims the tool where the body ends.
    - The faces it marches on are extended: a full-turn analytic cylinder for a cylinder face (`runSheet`, its seam opposite the face's middle), else the surface extended linearly ×2 in its non-periodic directions (`extendedSurface`).
  - **Clip:** a concave end where the body ends, or a convex one at a wall. The tool runs on and is cut by that end face's plane, a half-space Boolean.
  - **Refused (CAPABILITY):**
    - an end square on a face (its last section in that face's plane), since the cap would lie in the face; the coplanar cut gave a wrong 374 mm² region;
    - an end at a curved face or at more than one face (R10.3);
    - an end meeting another finished edge (a vertex blend, R10.3).
  - The tool's open path ends exactly at the edge's end point; it fell 1e-12 short before. Breaks closer than 1e-6 of the length merge, and path-joint breaks within 2h of another break are dropped (no slivers).
  - A sliver body after the Boolean (the round running off the top before the rim ends, the groove on a plate from 0 to 40) is refused `[CONTACT_LEAVES_FACE] … cuts a piece free` (overflow is R10.4).
- **R10.1's oblique ends (a fix):** R10.1's closed-form tools (planes, translational pairs) stopped square at the edge's ends, so at an oblique end face the fillet was 0.6–1.5 % too large. Seen with a rib turned 10° and 25° on a plate, and a rod lying across one at 10°.
  - Now a tool at a single oblique planar end face runs past and is clipped by that plane, as above.
  - No earlier conformance case had an oblique end; their values are unchanged.
- **Contact cuts once (a fix, found on the tee):** each tool contact edge cut every body face it touched, once per touching pair. Coincident duplicate cuts split each patch edge into up to 64 pieces: the pipe tee had 3109 edges.
  - Contact cuts are now made once per source curve (`contactCuts`).
  - A cut that is a piece of an input edge stays that curve: the exact piece by knot insertion (`curve-segment.ts`, Boehm in homogeneous coordinates, exact to 4e-15), its knots normalised to [0, 1], instead of fitted Hermite pieces.
  - The tee now has 82 edges and takes 1.8 s, down from 3–5 s; the volume is unchanged (15.709223).
  - The Boolean's `contactWith` keeps a tool's contact faces to the side faces by base name.
- **Evidence** (`packages/barocss-cad/test/r10-2b.test.mjs`, 4 tests):
  - **Against closed forms, the general path forced:**
    - a groove along a plate (convex, run past both ends) to 6e-12;
    - a rod lying across the plate at 10° (concave, clipped by both oblique ends) to 5.7e-7;
    - contacts ≤ 2.5e-7 mm, G1 < 1e-3°.
  - **An oblique groove** (a rod of 4 tilted 10° about Y cut from a plate from 8 to 32, rims ellipse arcs, r 1): both rims build, one body, valid. It took 0.5 s, 7 patches, 109 stations, contacts 6e-8 mm, sections 2.4e-7 mm. On a plate from 0 to 40 it is refused CONTACT_LEAVES_FACE.
  - **R10.1's rib** at 0°, 10° and 25°: (1 − π/4) r² · 40 / cos θ a foot, to 2e-7. The rod at 10° by R10.1: to 2e-6.
  - **Refusals:** a square end (forced); an end meeting another finished edge.
  - **Conformance (`conformance/r10/`):**
    - `general-oblique-groove`: this kernel's volume. Its mass is by tessellation, since quadrature's finer pass declines here (the D88 item); the value is at 64 segments a quarter (128 the same), tolerance 5e-5 of the part (the default 32 is 2.7e-5 off), STEP round trip 5e-5.
    - `translational-rod-across-oblique` (closed form, 2.3e-10) and `plane-rib-oblique-ends` (closed form, 6e-11).
    - `refuse-overflow-end`.
    - `refuse-open-general-chain` superseded.
  - **Studio:** errors.ts hints for the three new refusals (and the general-fillet scope text). A flow step opens an oblique-groove file and fillets one rim in the UI (8983 mm³, as the conformance case). Names: D89's last bullet.
- **Known:**
  - At a run-past end, where the end plane meets the tangent contacts, the result can keep a tiny edge (4e-4 mm on the groove; 1e-4 to 3e-5 mm seen while building).
  - A filleted oblique groove's mass is by tessellation (above).
  - General fillets still take seconds where there are many patches.
  - Square ends, ends at curved or several faces, vertex blends and overflow are refused: R10.3–R10.4.
- **Not done:** R10.3 (vertex blends, mixed corners such as the pipe clamp's lug loop, the ends refused here), R10.4 (overflow), R10.5; general chamfers.

## D91 — Mass by quadrature on trimmed patches: the D88/D90 tessellation fallbacks fixed (2026-10-19)

The coordinator asked whether R10.3 changes how general-fillet mass stands: quadrature declined on some trimmed patches and the mass fell back to tessellation (D88's coaxial torus item; D90's oblique groove). Two causes, both fixed, in the order found:
- **A derivative's stencil off the domain** (`brep-mass-quadrature.ts`): each Gauss point's surface derivative is a central difference u ± h. A trimmed patch's mesh reaches its domain edge (a lofted fillet's contact row is that edge), and there u − h left the knot domain. The evaluator threw, so the whole quadrature returned null.
  - Now the stencil's centre moves a step inside (`stencilU`/`stencilV`) when u is within a step of an edge. The derivative moves by at most a step's curvature, 1e-6 of the face's span, on a band one step wide.
  - Points outside the domain (a surface evaluated round its seam) are left alone.
- **Zero-area slivers along an iso-line trim** (`brep-tessellate.ts`): a revolved face cut at a circle has its boundary on a parameter line. Inverted point by point, it wobbles about that line: by rounding, and by 1e-8 where a Boolean's fitted pieces stand for the trim.
  - Ear-clipping then stacked zero-area triangles on both sides of the line. In space these are chords across the face's opening: 494 triangles on one cone band where 53 suffice.
  - The quadrature's area check then saw 10–30 % more flat area than surface area and declined.
  - Now runs of three or more boundary points the same to 1e-7 of the span in one coordinate are set to one value (`snapIsoRuns`), for the triangulation only. Afterwards the boundary's own (u, v) are put back: the triangles are still a triangulation of the ring as inverted, so their signed areas sum to its area, and the quadrature's domain is the face's, not the snap's.
  - A first version kept the snapped values. It moved the R10 S0 coaxial case by 2.8e-9 (over its 1e-9) and was not kept.
  - The Lawson flips' pass cap rose from 50 to 50 + the triangle count: a flat triangle always flips once its neighbour across has.
- **Result:**
  - 200 random coaxial cone-rim fillets (the D88 property's generator, its seed): with the stencil fixed but not yet the slivers, 180 by quadrature, 7 tessellated, 13 refused. With both fixed, 187 by quadrature, 0 tessellated, 13 refused (the Boolean TODO, unchanged). D88 counted 5 in 200 on its own run.
  - The oblique groove (D90) is now by quadrature too. Forced through the general path on the groove at 0° and the rod at 10°, quadrature matches the closed forms to 2.5e-12 and 3.5e-7 of the fillet. Tessellation at 64 segments was 0.36 % and 0.79 % off.
  - The fallback had also hidden a defect in tessellated fillet volumes: the chords miss part of a fillet. `r10/general-oblique-groove`'s value was the tessellation's, 9.3e-6 of the part high. It is now quadrature's, 8983.14946924587, at relTol 1e-7, STEP 1e-7 and centroid 1e-5, its oracle saying so.
- **Pole points (`brep-tessellate.ts`, found with D92):** a boundary point at a surface's pole now takes the boundary's own point, the vertex's, instead of the surface's evaluation of its pole, one rounding apart. The faces round a horn torus's apex cracked there.
- **Evidence:**
  - the kernel suite;
  - `rb:props` (mass by quadrature against finer tessellations, the coaxial and translational properties);
  - the coaxial count above;
  - `r10/general-oblique-groove`.

## D92 — R10.3a: the rolling ball round an edge at a corner (2026-10-19)

R10.3 is split, as R10.2 was:
- **R10.3a (this):** where the ball rolls round an unfinished edge at an inside corner, plus mitres of a rolling-ball chain with another finished edge at a convex corner.
- **R10.3b:** corners of three or more finished edges (vertex blends: sphere-patch corners, setbacks).
- **R10.3c:** R10.2b's remaining end refusals (square ends, ends at curved or several faces).

- **The case:** two finished edges meet at a vertex at an inside corner of the face they share (S), and the edge k between their other faces is not finished. Before, this was refused ("inside corner of their face"), for example a box boss's whole foot or the pipe clamp's lug loop. If k turns the other way to the fillet (convex for a concave fillet, concave for a convex one), the ball leaves the first face at k, rolls round k touching S and k, and goes on along the next face.
  - The fillet surface there is a canal surface about k. Where S is a plane square to k, it is a horn torus quarter: the contacts on k are one point, its apex.
  - `cornerJoin` (`edge-finish.ts`) joins such edges into one chain. Excluded: tangent continuations, smooth k (a seam between halves of one surface), corners not clearly inside, and convexities that do not match.
- **The solve** (`rolling-ball.ts`, `solveCorner`): the ball on S at distance r from k, its foot square to k, at the fraction θ of the turn from the first face's normal to the second's (slerp in the plane square to k). Newton in (u, v, t), with the faces' normals at the foot held, then updated.
  - The turn's last ball is stepped to in eighths: Newton from across the turn did not find it.
- **The chain in spans** (`cornerFillet`): edge spans (stations square to the chain, on the span's own faces only; a station plane can meet a parallel face of the side as well, a lug's far end) alternate with corner spans (stations by θ).
  - An edge span ends where its station plane passes through the corner's first ball's centre (bisection), and the next starts at its last ball's.
  - Tangents inside a span are central differences. Within a step of a corner they are second-order one-sided: a first-order difference tilted the station plane by 3.4e-6 rad, moved the contact 2.8e-6 mm off k, and the Boolean then could not split the lug's end face.
  - Open chains are supported: their ends run past or are clipped as in R10.2b, using `marchPast`/`pastAt` taken out of `ringFillet`.
- **The tool beside a corner:** a contact's growth into the material (the wall) normally goes square into its face. Beside a corner that lies along the other face (a 90° wedge), which was near-coincident and broke the Boolean.
  - Within 2r of a corner the growth turns smoothly (C¹) to halfway between the wedge's bisector and that face's inward normal. Round the corner it turns on to halfway towards the next face's, so the grown points sweep an arc even where the feet are one point.
  - A loft patch whose contact row is one point has no edge there (`loftTool`): its two faces meet that row in one vertex, a pole.
  - Contacts at a corner's first or last foot, to rounding, are set to that foot.
- **The analytic Boolean:** a contact face's edge lying wholly off a planar face (a section edge in the plane of the lug's end face, beside it) is not cut into that face. Planes only: on a curved face a contact's (u, v) can fall a period over, off the region as drawn, and filtering there broke R10.2's cone rim and the groove.
- **Refinement:** the loft now also refines until the fillet lies within 4 × tolMM of the true sections, not only its contacts within tolMM of their faces. On planes the contacts are exact at any count, and the corner sections then set the count.
  - `sectionMM` now measures the fillet face only (its contacts and arc middle). The tool's inner faces, which the Boolean drops, bend more where they turn into a wedge and say nothing of the fillet.
  - R10.2's rings already met the new bound, so their counts are unchanged.
- **Mitres** (`edge-finish.ts`): an open rolling-ball chain whose end meets one other finished edge sharing a face at a convex corner of it, the same way round, runs past until its section clears that edge's own face. That edge's tool runs past too (R10.1's mitre), and the Boolean makes the mitre.
  - Planes only for now (the end edge's faces and the other's own face). An oblique groove's rim meeting the plate's end gave the Boolean a sliver and stays refused.
- **Refusals:** CAPABILITY `[VERTEX_BLEND_UNSUPPORTED]` for:
  - a joint of the chain that neither continues it tangentially nor rolls round a corner (a third finished edge there: the boss's foot with one upright edge, R10.3b);
  - a ball meeting k past the corner (a setback);
  - corners at the ends of an edge leaving none of it.
  - Chamfers round a corner stay as they were.
- **Evidence** (`packages/barocss-cad/test/r10-3a.test.mjs`, 4 tests):
  - **Box boss's foot** (20 × 12 boss on a plate, all four edges, r 1, 2, 4): (1 − π/4) r² × 64 + 4 × (π/2) r³ (5/6 − π/4) (Pappus about the upright edge) to 1.4e-9; contacts exact on the planes; sections 5e-8 mm.
  - **L-plate's top** (convex):
    - its two inner edges round the inner upright edge, (1 − π/4) r² × 40 + the quarter turn, to 1e-8;
    - all six edges (the five outer corners mitred, two convex fillets overlapping by r³ (5/3 − π/2)) to 2e-8, held at 5e-8.
  - **The pipe clamp's lug loop** (r 2; also built at r 1 and 3): valid, one body; contacts 1.1e-8 mm, G1 2e-6°, sections 3.2e-8 mm; volume within 1e-6 of a loft through twice the stations. 3 s.
    - Each edge alone (R10.1) adds more than the loop: the arcs' square ends overhang the corners.
  - **Refusal:** the three-edge corner.
  - The R10.2 lug probe and part-model's L-plate refusal now build.
  - **Conformance (`conformance/r10/`):**
    - `corner-lug-loop` (the coordinator's case, this kernel's value with its oracle);
    - `corner-box-boss-foot` (closed form, 2e-8);
    - `corner-l-plate-top` (closed form, 5e-8);
    - `refuse-vertex-blend`.
  - **Studio:** errors.ts hints; a flow step opens a box-boss file, picks its four foot edges and fillets them (+57.35 mm³, the closed form).
- **Mass (the coordinator's question):** every R10.3a case is by quadrature. R10.3a needed no new mass method: D91 removed both fallback causes, and the corner patches (poles included) integrate like any trimmed patch.
- **Known:**
  - Chamfers round inside corners still stop square.
  - Mitres with curved faces are refused.
  - The lug loop takes about 3 s; the box boss 3.5 s (1356 stations, set by the corner sections).
- **Not done:** R10.3b (vertex blends), R10.3c (R10.2b's end refusals), R10.4 (overflow), R10.5; general chamfers.

## D93 — R10.3b: corners of three finished edges — concave sphere corners, mixed corners in two passes (2026-10-19)

R10.3b: corners where three finished edges meet.
- Three planes all convex (a box's corner) already had the ball's eighth (D22).
- **All concave** (a pocket's corner) now has it too. The ball is in the air, r out from each plane: `solve3` with +r, and the same corner tool (the cone from the ball's centre bounded by the planes through it square to the edges, less the ball), added rather than removed.
  - Added, the cone reaches well past the vertex and would add material outside a wall thinner than its reach. So it is kept within g = r/2 of the air side of each face (three half-space cuts), and applied after the edge tools.
- **The two ways round** (a boss's upright edge meeting its two foot edges; an L-plate's inner upright edge meeting its two top edges) are blended in two passes in one feature: the odd one out first, then the others.
  - The boss's uprights are rounded down to the plate. The foot then runs tangentially round each round (a torus quarter, R10.1's plane–cylinder tool, or the rolling ball where other corners need it).
  - The second pass finds its edges by their faces' names: the first pass shortens them, or cuts them in pieces, and the new edges round its round continue them tangentially.
  - Refused (CAPABILITY `[VERTEX_BLEND_UNSUPPORTED]`): more than three finished edges at a mixed corner; an edge that is odd one out at one corner and not at another.
  - Corners of three edges the same way round between faces other than planes keep their R10.1 behaviour (mitres): not yet the ball touching three curved faces.
- **Evidence** (`packages/barocss-cad/test/r10-3b.test.mjs`, 3 tests; closed forms by Pappus about each round's axis):
  - **Pocket corner** (30 × 20 pocket, 10 deep, floor and uprights, r 2): A = (1 − π/4) r² along each edge less r at each corner, plus 4 × (1 − π/6) r³. The result is 2.1e-4 of the fillet high (5.8e-7 of the part), the corner patch's quadrature (below).
  - **Box boss's foot with its four uprights:** A (64 − 8r) + 4 (π/2)(r A + M) − 4 A × 15 (M = r³ (5/6 − π/4)), to 1e-13. The same as the two fillets one after the other, to 1e-9.
  - **Box boss's foot with one upright** (one corner the two ways round, three rolling round their uprights, R10.3a): to 1e-10.
  - **L-plate's top with its inner upright edge:** −A × 10 + A (160 − 2r) − 5 r³ (5/3 − π/2) + (π/2)(r A + M), to 2e-10.
  - **R10.3a's refusal** (the foot and one upright) now builds: `r10/refuse-vertex-blend` is superseded.
  - **Conformance:**
    - `r10/corner-pocket` (closed form, relTol 1e-6 of the part, its oracle naming the quadrature);
    - `r10/corner-boss-uprights-and-foot` (2e-8);
    - `r10/corner-l-plate-top-and-inner-upright` (5e-8).
  - **Studio:** the VERTEX_BLEND hint reworded (up to three can meet). A flow step opens a box-boss file, picks its foot and four uprights (8 edges) and fillets them (+2.90 mm³, the closed form).
- **Mass at a ball's corner (found here, recorded as a TODO):** the corner patch is a piece of a revolved ball with its pole at the corner's apex, inside the patch. There the quadrature over the trimmed domain does not converge cleanly: on the pocket corner, q 8, 16, 32 and 64 give 1.3e-4, −3.3e-5, 3.4e-6 and −1.3e-4 of the fillet. The convex box corner (D22) is the same, which is why its test holds 5e-5 of the part.
  - Turning the ball so that its poles and seam lie off the patch makes the patch integrate exactly (one convex corner to 1.7e-10). But the analytic Boolean's march along the ball's tangent circles with the edge tools then failed on some boxes ("a straight edge on a cylinder runs across its axis direction"), so it was not kept.
  - A pole now counts in the quadrature only where the face's domain reaches it, a no-op for these patches.
  - Next: exact integration of a ball patch, or the march along tangent circles.
- **Not done:** the ball touching three curved faces; corners of four or more finished edges; R10.3c (R10.2b's refused ends); R10.4–R10.5.

## D94 — R10.3c: closed-form fillets cut at a cylinder at their ends; the general ends R10.2b refused stay refused (2026-10-19)

R10.3c took R10.2b's refused ends: square on a plane, at a curved face, at several faces. One part builds; the rest stays refused, with the reasons measured.
- **R10.1's closed-form tools at a cylinder across the edge** (a rod's feet on a round plate, ending at its rim). As D90 did for an oblique plane, the tool runs past (1 / max(|w|, 0.25)) and is cut by that cylinder (`clipTool`, `EndClip`).
  - Before, they stopped square at the vertex. The fillet's section then stuck out past the curving rim: 1.7 % over at r 1, 3.9 % at r 2, 6.5 % at r 3 on the rod across a disc.
  - The cut is made near that end only: `tool − ((the half-space beyond a plane 4r in from the end) ∩ or − the cylinder)`. A whole-tool cut by the cylinder trimmed the tool's other end too.
  - The cut cylinder's faces split where the body's faces on that cylinder meet (their seams, `seamsOf`).
- **Fallbacks, so nothing builds worse than before:**
  - Where the tool's end would lie across a seam of the body's faces on that cylinder, it stops square as before. Laid across a seam, the analytic Boolean lost a face there. The span is the section's reach into each face and the material behind it about the axis.
  - Where the whole finish still fails with a cylinder cut, it is made again with those ends square (`squareAtCylinders`).
  - A rod across a disc at 30° with r 3 fails in HEAD too (an older defect, not this step's).
- **Evidence** (`packages/barocss-cad/test/r10-3c.test.mjs`, 2 tests):
  - **Rod across a round plate** (R 20) at 0°, 45°, 60°, 90° and 25°, r 1–2: against the two feet's ∫ of the section across the disc's chord 2 √(R² − y²), to 1e-6 (this kernel 1.5e-8–6.7e-7: the rim's cuts are fitted curves).
  - At 10°, where one foot's ends lie across the rim's seams: valid, those ends square (within 2 % over).
  - **Refusal:** a tilted rod's foot (a general chain) ending at the rim.
  - **Conformance:** `r10/translational-rod-across-disc` (45°, quadrature of the section, 1e-7) and `r10/refuse-general-end-at-cylinder`.
  - **Studio:** a flow step opens a rod-on-disc file and fillets both feet in the UI (+12.04 mm³; it was +12.24 square).
  - **Flow harness:** the R10.2–R10.3 steps pick their edges by name, polled until the opened file's bodies are shown (just after it opens, the last part's still are). They read the body's volume through `bodyVolume()` (a click on its row can take it out of the selection). Run in a different order, two of them had failed on that timing.
- **Tried and refused, as before (the analytic Boolean is the blocker in each):**
  - **A general (rolling-ball) fillet ending square on a plane.** With the refusal lifted, the rod lying straight across a plate (forced) built only for one foot at r ≤ 1; the other foot and r ≥ 1.5 failed ("not a manifold solid" along the end section). The section lies in the end face's plane, partly on the end face and partly along the side face's continuation.
  - **A general fillet ending at a cylinder:** the lofted tool cut by a cylinder fails ("an arc on a cylinder is not a cross-section circle", "not a manifold solid") on the tilted rod on a disc, even near the end only.
  - **Ends at more than one face.**
  - Next for all three: the Boolean's handling of a tool face coinciding with, or lying along, a body face (coplanar sections, coincident cylinders across a seam). That is a Boolean robustness step, not a fillet step.

## D95 — R10.4a: overflow over smooth edges — the ball rolls on over a round already made (2026-10-19)

R10.4 (overflow) is split. **R10.4a (this):** a contact running off its face across a smooth edge onto a tangent face. **R10.4b:** rolling onto a sharp edge (a cliff edge), not started.
- **The rolling ball** (`rolling-ball.ts`, `growSides`): where no station solves on the sides' faces, the faces beyond smooth edges of the last contacts' faces (or, at the chain's start, of any side face) join that side, and the station is solved again (up to three rings).
  - A smooth edge here is one whose two faces share their normal at its middle.
  - The ring's result now names its final sides, so the Boolean's contact faces include them.
- **R10.1's closed forms:** the true reach (D88) went on across every smooth edge, so a closed-form section could reach past one onto another surface.
  - Example: a boss with its top edge rounded, its foot filleted larger than the wall below the round. The section then lay on the wall's cylinder carried on, not on the round. The result was valid but 7.8 % too much at r 5 (311.6 mm³ against 289.0).
  - Now the reach goes on only across a smooth edge between faces on one surface (halves of a cylinder, a split plane; `sameSurfaceAcross`).
  - Past a smooth edge onto another surface, the closed form throws `Overflow`. The finish is made again with that chain by the rolling ball (`generalEdges`; whole circles too, not grouped into one closed tool). The reports of a failed attempt are dropped.
  - Where the ball cannot follow either: CONTACT_LEAVES_FACE.
- **Evidence** (`packages/barocss-cad/test/r10-4a.test.mjs`): a boss (R 8, 6 high) on a plate, its top edge rounded 2.
  - The foot filleted at r 4.5, 5 and 6 (contacts above the wall's 4 mm, on the round) matches Pappus (the meridian region between plate, wall, round and ball, by Green over fine polylines) to 9e-8, as a feature and forced through the rolling ball.
  - At r 3 (contact on the wall) R10.1's closed form stays, to 1e-9.
  - **Conformance:** `r10/overflow-boss-rounded-top` (r 5, 1e-7).
  - **Studio:** a flow step opens the boss file, rounds its top 2, then fillets the foot 5 in the UI (+289.0 mm³).
- **Not done:** R10.4b (rolling onto a sharp edge, the cliff edge: CONTACT_LEAVES_FACE as before); closed-form straight edges between planes whose face runs smoothly onto a round (their reach check, `planeReach`, still walks across); R10.5.

## D96 — R10.4b: overflow onto a sharp edge — the ball rolls on along the edge (a cliff) (2026-10-19)

- **The case:** where a rolling-ball fillet's contact would run off its face across a sharp (not smooth) edge of it, the ball rolls on touching the other side's face and that edge. The fillet meets the edge along a curve on it, and the face beyond is untouched (NX's "roll onto edges"). It goes on until the ball can touch a face again: that face, or the one beyond the edge.
  - Example: a tee whose branch stands 12 high, its junction filleted 3, refused at R10.2a. The ball touches the branch up to 13, so near y = 0 it rolls along the branch's top rim.
- **The span machinery** (`cornerFillet`, now any chain of spans): edge spans, corner spans (R10.3a) and cliff spans.
  - A chain with no corner that the plain ring cannot finish (a station off its faces after `growSides`) is sent here.
  - Each edge span is walked (`cliffsIn`). Where a station fails, the ball on the last faces is solved unchecked on their surfaces carried on (`extendedSurface`: past a face's end its own patch stops). The side whose contact runs off its face says which face; its nearest edge (not one of the chain's own) is the cliff's edge.
  - The ball is solved touching the other face and that edge, its centre in the station's plane (`solveCliff`). It must lie in the wedge outside the edge's two faces (`withinWedge`).
  - The span is cut where the face ball's contact reaches the edge and where the edge ball leaves the wedge (bisection). Cliff spans are cut again where the other contact crosses a seam of its side, or the foot runs off the end of its edge onto the one going on from there (a rim's halves): `nextCfg`. At a shared vertex the new span starts with the old one's last ball, on the new faces' terms.
  - A ring wholly on a cliff starts off the chain's vertices.
  - The neighbours of an edge span (corner or cliff) now give its seeds and the targets of its growth blend, not span indices.
  - Cliff stations are sections with the edge's side on the edge, grown along the wedge's bisector (as R10.3a's corners).
- **R10.1 unchanged:** a closed-form fillet larger than its face, the face ending at a sharp edge (a boss's foot larger than the boss), still refuses RADIUS_EXCEEDS_FACE. Only the rolling ball rolls onto edges.
- **Evidence** (`packages/barocss-cad/test/r10-4b.test.mjs`, 2 tests):
  - **A boss's foot larger than the boss** (R 8, 4 high, forced through the rolling ball, r 4.5, 5, 6): the ball touches the plate and the sharp top rim all round. Against Pappus (the meridian region between plate, wall, rim point and the ball's arc) to 7e-8.
  - **The short-branch tee:**
    - valid, one body;
    - contacts 4.8e-8 mm, G1 3.7e-5°, sections 8.7e-8 mm;
    - fillet edges on the rim (b.top);
    - volume within 1e-6 of a loft through twice the stations;
    - 2.5 s.
  - **Conformance:** `r10/cliff-tee-short-branch` (this kernel's value, relTol 1e-7); `r10/refuse-contact-leaves-face` superseded.
  - **Studio:** a flow step opens the short-branch tee and fillets its junction 3 in the UI (+32.34 mm³).
- **Not done:**
  - a cliff running to an open chain's end;
  - cliffs within R10.1's closed forms (they refuse);
  - a cliff whose ball would then roll onto the face beyond the edge across another edge of it;
  - R10.5 (variable radius).
- **Sequencing (the coordinator's check, 2026-10-19):** R10.4a and R10.4b did not need the analytic Boolean's coincident and along-face robustness.
  - R10.4a's sides grow onto tangent faces whose contacts are ordinary edge-on-surface cuts.
  - R10.4b's cliffs meet the body along its edge, as R10.3a's corners do. The wedge growth keeps the tool's faces off the body's.
  - That robustness is now the common blocker behind four items: the coaxial cone-rim seam sliver (D88), general fillets ending square or at cylinders or several faces (D94), and the pole-off ball turn (D93). So it comes next, as **R10.B**, before R10.5.


## D97 — the plane–plane reach past a round (the coordinator's planeReach fix) (2026-10-19)

- **The defect** (same class as D95's, found by the coordinator): a closed-form finish of a straight edge between two planes checked its reach only when convex. A concave one was not checked at all.
  - So a concave fillet or chamfer whose face runs onto a round already made built valid but wrong: its section lay on the riser carried on past the round.
  - Reproduced on HEAD (`f1f4e00cb`): a step with oblique ends, its riser 10 high with its top rounded 4 (6 mm of flat riser). The foot filleted 7 built 422.30 mm³ against the closed form's 408.86 (3.3 % over); filleted 12, 1853.45 against 839.83 (121 % over). Chamfered 8, 2046 against a square form of 1280 (the true form is refused).
  - The convex check already counted smooth edges onto another surface since D95, but refused where the ball could roll on.
- **The fix** (`edge-finish.ts`, the straight plane–plane check; `part-model.ts`, `wedgeChamfer`):
  - Both convex and concave finishes are checked. For a concave (adding) finish every boundary of the face bounds it, as `trueReach` already did for added material.
  - Where the binding limit is a smooth edge onto another surface, a fillet throws `Overflow`: the rolling ball takes it (R10.4a's retry). A chamfer has no rolling ball and is refused RADIUS_EXCEEDS_FACE (the wedge chamfer too: `faceReach` takes `removes`).
- **A second hole, in the rolling ball's own check** (`rolling-ball.ts`): within reach (2r) of an end run past, no contact was checked at all, so a contact could run off its face sideways.
  - On an open chain shorter than 4r, that was the whole chain. The step's foot at r 12 went through the rolling ball and still built 121 % over.
  - Now only a contact lying beyond such an end, by more than rounding, goes unchecked (`contactOk`, `Check`, `pastEnds`). A contact in the end's plane is checked: there it would be off its face across the side, not across the end.
  - (Carrying the contact back along the chain to the end and checking it there was tried. It fails the oblique groove's ends, R10.2b, where the rim curves within that distance.)
- **The analytic Boolean** cannot close most radii of the overflowing concave foot: the tool's end cap is coplanar with the body's end faces. A retry that fails there is refused as CAPABILITY [CONTACT_LEAVES_FACE] ("…leaves the analytic Boolean a result it cannot close…"), not left untyped. The square-ended step's foot is refused as before (its end square on a face, D90).
- **Evidence** (`packages/barocss-cad/test/r10-reach.test.mjs`, 3 tests; the first and third fail on HEAD):
  - **Concave:** the oblique step's foot at r 7 and 12 matches the closed form (the polygon between the ball's floor contact, the riser and its contact on the round, less the round's and the ball's circular segments, × 40) to 1e-7 (2.4e-8 at r 12). The report is in bounds.
  - **Convex:** a block with oblique ends, its bottom edge rounded 8, its top edge filleted 2.5, 3 and 4 (2 mm of flat wall). The ball rolls round onto the round from inside; matches the closed form to 1e-7 (4e-8 to 7e-8). Refused RADIUS_EXCEEDS_FACE on HEAD.
  - **Refusals, none built wrong:**
    - the concave chamfer 8 (RADIUS_EXCEEDS_FACE, walls of 6 and 15 mm);
    - the oblique step's fillet 8 (the Boolean, CAPABILITY);
    - the square step's fillet 8 (end square).
    - Within the flat riser, fillet 5 and chamfer 5 keep the closed form.
  - **Conformance:** `r10/overflow-step-concave-fillet` (r 12, the closed form, relTol 1e-7; STEP round trip); `r10/refuse-concave-chamfer-past-round`.
  - **Studio:** a flow step opens the oblique step, rounds the riser's top 4, then fillets its foot 12 in the UI (+839.83 mm³).
- **Found, not fixed (a different defect, reported):** the concave wedge chamfer stops square at its ends. At oblique ends it adds material past the end face: the oblique step's foot chamfered 5 adds 532.33 mm³ against 500, 6.5 % over. The convex one is grown past both ends and trimmed, so it is right. The fix is R10.2b's end clip for the wedge.
- **Not done:** R10.B (the Boolean behind the refused radii) → R10.5.

## D98 — the wedge chamfer's ends (found at D97) (2026-10-19)

- **The defect** (found at D97, fixed on the coordinator's word before R10.B): the wedge chamfer (a straight edge between two planes, `wedgeChamfer`) ended its prism square to the edge.
  - A filling (concave) wedge stopped square at both ends. At an oblique end face it added material past the body's end on one side and left a gap on the other.
  - A cutting (convex) wedge ran d past both ends. Where the body ends that is trimmed away, but at a wall it notched the wall.
  - On HEAD (`f2015c295`), a step's foot chamfered 2 and 5 with ends at 10° was 2.6 % and 6.5 % over; at 25°, 6.8 % and 17 % over. With the riser's top rounded, the result at 5 was also invalid.
  - A rib's top edge chamfered 2 where it meets a wall was 30 % over square (28 % with the wall turned 10°). Its concave foot was 0.27 % under at the turned wall.
- **The fix** (`part-model.ts`):
  - `endPlaneOf` finds the plane of the faces meeting the edge at each end, other than its own two. That is one face, or several in one plane (a step's two blocks' ends), planar and not along the edge, with its normal out of the body. Otherwise it returns null, and the end stays as before.
  - The wedge's corners at that end are carried along the edge onto the plane, so its cap lies in it.
  - A cutting wedge still runs d past an end where the body ends (the end face's normal points away along the edge). Only a wall stops it.
  - A wedge with a cap in an end plane goes to the analytic Boolean even on a planar body: the polyhedral one fails on the coplanar cap (non-manifold at 10° and 25°, invalid at 25° d 2).
- **Evidence** (`packages/barocss-cad/test/r10-wedge-ends.test.mjs`, 2 tests, both failing on HEAD):
  - **The step's foot:** ends at 0°, 10° and 25°, the riser's top rounded or not, chamfered 2 and 5: d²/2 × 40 to 1e-12, all valid.
  - **The rib into a wall** (square, and turned 10°): the top edge stops at the wall and the foot fills to it. Each matches the prism's section × its length at the section's centroid to 1e-12.
  - `r10-reach.test.mjs` now checks the oblique step's chamfer 5 too (to 1e-9).
  - **Conformance:** `r10/wedge-chamfer-oblique-ends` (25°, d 5) and `r10/wedge-chamfer-into-wall` (10°, d 2). Both are closed forms, relTol 1e-9, with a STEP round trip.
  - **Studio:** a flow step opens the 25° step and chamfers its foot 5 in the UI (+500 mm³; +585.5 before).
- **Not done:**
  - an end at several faces not in one plane, or at a curved face (square as before);
  - wedge chamfers of more than one edge meeting at a corner (unchanged).
  - Next: R10.B, then R10.5.

## D99 — R10.B: the analytic Boolean with tool faces coinciding with or lying along body faces (2026-10-19)

R10.B took the five items blocked on the analytic Boolean, each with a fixture that was refused or failed before. Four build; one stays refused, with the reason measured.

- **The coplanar end caps (D97):** the rolling ball's tool, capped in an end face's plane, is united with a body whose end face lies in that plane. Most radii failed. Three causes, each fixed where it arose:
  - **The tool's patch break** where a contact leaves its face across an end run past was found on the face's sampled outline in (u, v). It lay up to 1.6e-5 off the end plane. The clip plane then passed a hair beside the tool's vertex, cutting a 1e-4 corner off one patch: too short for the march, so the loop of cuts stayed open. Now the break is bisected onto the plane itself (`breakOnEnd`, rolling-ball.ts).
  - **A marched cut's ends** were found where its tabulated (u, v) curve crosses a face's outline, to about 1e-5. The cut of the neighbouring patch ended elsewhere along the shared edge. Now, where one face is a plane, each end is moved onto the exact point where a boundary edge of either face crosses the other surface (`snapEnds`, `edgeCrossing`; within 300 tol, the rest of the curve carried along linearly).
    - An edge lying on that surface crosses it nowhere and is skipped.
    - Only plane pairs: on tool–tool pairs (an L-plate's mitred tools) snapping one cut's end left a neighbour's apart.
  - **The same curve twice** on a plane face: the coplanar face's boundary copied in, and the same tool edge lying in the plane copied by the march's along-path. Equal to the bit, the arrangement cut the two at every sample where they "crossed" (128 pieces) and lost its cycles.
    - Now a curve cut lying along a longer one end to end is dropped.
    - On a plane, so is a same-length copy, keeping the most exact (an exact curve, then one with its own 3D curve, then the earlier).
    - Not on curved faces: there the copies of a cone's cross-section circle are kept, as they were (dropping one moved a revolved body's volume by 2e-9).
- **The arrangement's order at a tangent vertex** (curved-arrangement.ts), the second blocker for both caps and square ends. A fillet's arc leaves its contact along the line it is tangent to, to within the vertex tolerance (eps / r, about 1e-7 rad), not to 1e-12. So the curvature tie-break never applied, and the arc was read on the wrong side of the line.
  - Now directions within 1e-4 are ordered by the chord at δ = 10³ eps (angle + κδ/2).
  - Angles are read from the middle of the widest gap between a vertex's directions, not from −π: an arc leaving along −x at −π + 1.35e-12 had jumped to the other end of the order.
- **General fillets ending square on a face** (D90, D94): built since this step. The end's refusal is lifted. Where the Boolean still cannot close it, it is refused with the same message as before, now saying so (`squareRefusal`).
- **The coaxial cone-rim TODO (D88):** a band of the cone, between the corner and the tool's tangent contact circle, was classified out on one half and in on the other. The first ray grazed the tool, and the patch's grid triangles missed the graze.
  - Now two rays that agree decide. Where they disagree, the majority of all six does.
  - The property's 200 runs: 200 pass (187 and 13 failing before). `robustness/properties-todo.json` is empty.
- **The corner ball's pole (D93):** the ball is turned so its poles and seam lie off the corner patch (its axis square to the direction towards the corner, its seam opposite it). The quadrature now converges.
  - Rounded boxes match Steiner's formula to 1.1e-7 (1.2e-5–2.5e-5 before, over 120 random boxes).
  - The pocket's corners match to 8e-7 of the fillet (3e-4 before).
  - At D93 the Boolean failed on some boxes with this turn; with the changes above it does not, on 120 random boxes.
  - **Found on the way:** one random box failed in HEAD too, as "unexpected kernel failure: Parameter is outside the knot domain". A ray test's Newton step became NaN and evaluated the patch there. A non-finite step now makes that ray degenerate, and another is cast.
- **Evidence** (`packages/barocss-cad/test/r10-b.test.mjs`, 4 tests, each failing on HEAD):
  - **The step's foot past its round:** r 6.5–15 with 10° ends, and r 6.5–14 with square ends. Each matches D97's closed form × 40 to 1e-7 (2e-8–6e-8; square ends 1e-12).
  - **The rod lying straight across a plate** (forced general, both feet, r 0.25–3): the R10.1 section × 40 to 1e-9. The one foot that still fails (r 2) is refused, typed.
  - **D88's counterexamples:** Pappus to 1e-9 of the part.
  - **Five rounded boxes and the NaN box:** Steiner's formula to 3e-7.
  - `r10-3b` now holds the pocket to 2e-6 of the fillet (3e-4 before).
  - `r10-2b`'s square-end refusal and D97's oblique fillet-8 refusal are removed: both build now.
  - **Conformance:** `r10/overflow-step-square-ends` (closed form, 1e-7), `r10/coaxial-cone-rim-tangent` (Pappus, 1e-9), `r10/rounded-box-corner-balls` (Steiner, 3e-7).
  - **Studio:** a flow step opens a square-ended step, rounds the riser's top 4 and fillets its foot 8 in the UI (+503.14 mm³; refused before).
- **Still refused (measured):** a general fillet ending at a cylinder (the tilted rod's foot at a round plate's rim). It was tried again, the tool run past the rim's tangent plane and cut by the cylinder near its end, as R10.3c's are.
  - With a circle on the rim that is not a cross-section mapped as a general curve (it was refused "an arc on a cylinder is not a cross-section circle"), the cylinder cut of the lofted tool closes. In the union, though, the rod's face keeps the rim's cut of the rod as a slit: it no longer meets the clipped contact (all four feet, r 1). Both changes were reverted with the attempt.
  - Ends at more than one face were not tried. Both keep their refusals.
- **Tried and not kept:**
  - snapping cut ends to a nearby vertex (it moved the cap off its plane);
  - joining loose cut ends across a corner (not needed once the break lies on the plane);
  - dropping sliver pieces;
  - snapping on cylinder pairs (no help for the rim, above).
- **Next:** R10.5 (variable radius).

## D100 — R10.5a: variable-radius fillets (2026-10-19)

R10.5 is split. **R10.5a (this):** the radius varying along the chain. **R10.5b:** conic and G2 sections.
- **The contract** (`part-model.ts`, versioned as D16 asks: an optional field, old documents unchanged): a fillet gives `radius` (one radius) or `radii` (2–16 points `{ at: [x, y, z], radius }`), not both.
  - Each point must lie on one of the chains filleted (within 1e-6 of the model's size), else SELECTION.
  - Along each chain the radius is a shape-preserving (Fritsch–Carlson) cubic Hermite through its points by arc length, so it never overshoots the values given. Two points give a linear radius.
  - On a closed chain it is periodic: the slopes round the loop come from neighbours on either side, and a repeated knot keeps one slope.
  - On an open chain, past its outer points it goes on at its end slope (C¹), never below half the least radius. It must stay positive to the chain's ends, else PARAMETER. A chain carrying only one of the points takes that radius, constant.
  - A variable-radius body is not recorded for shell (its hollow would need the radius offset along the chain).
- **The section** (`rolling-ball.ts`): at each station, as before, the ball centred in the plane square to the chain touching both faces, now of radius r(s). Its section is the arc of that ball between the contacts.
  - On planes along the edge (and round a circle between coaxial faces) that is the circle of radius r(s) in the plane square to the chain. So the volume is ∫ A(r(s)) ds, or round a circle the meridian section's first moment integrated over θ.
  - The surface is tangent to both faces along its contacts: there the arc meets the face square to its normal, and the contact runs on the face.
  - The tool's patches also break at the profile's inner points, where its second derivative jumps (inside a patch the loft would converge more slowly), unless within two steps of another break.
- **Plumbing:**
  - Every chain with `radii` is the rolling ball's (`general`). No closed form, no three-edge corner ball, no two-pass mixed corners.
  - A chain that rolls round an edge at a corner, or onto a cliff, is refused (CAPABILITY).
  - The open chain's end logic now takes several faces in one plane (a step's two blocks' ends) as one end plane. That also lifts a refusal ("meets more than one face") for constant radii there.
- **Two fixes found here:**
  - **Breaks at Boolean-trimmed ends.** R10.B's break on an end plane (`breakOnEnd`) is now used only where the tool is cut at that end by its plane (`clipped`). Where the Boolean trims the run past (a convex end where the body ends), a tool vertex in the body's end face is a touch at a point, and one groove case failed there.
  - **Quadrature on tiny faces.** A face of less than 1e-6 of the body's size squared that fails one of the quadrature's checks is now taken by its flat triangles (`flatInto`), not the whole body by tessellation. A 1.8e-4 mm² sliver at a trimmed end had moved the body's mass method from quadrature to tessellation: 8 % of the fillet, 3e-5 of the part.
- **Evidence** (`packages/barocss-cad/test/r10-5.test.mjs`, 5 tests):
  - **A box's top edge** (convex, square planes):
    - 1→3, 3→1 and 0.5→4 match (1 − π/4) L (r0² + r0 r1 + r1²)/3 to 1e-9 (1e-11).
    - Three points (1, 2, 4 at x 0, 10, 40) match (1 − π/4) ∫ r² ds of a monotone cubic written apart in the test.
    - Contacts, sections and G1 are in bounds.
  - **A concave step foot**, 1→4: to 1e-9.
  - **A boss's foot round its circle** at 1, 2, 1, 2 (and 0.5, 3): ∫ of the meridian section's first moment to 1e-7 (1.3e-8–2.6e-8).
  - **An oblique groove's rim** (curved faces), 0.6→1.2:
    - valid and G1, the report in bounds, its volume between the constant fillets at 0.6 and 1.2;
    - within 1e-7 of the part of a loft through twice the stations.
    - **Not tighter:** at some station counts (200 here) a sliver of the run past at the trimmed end becomes a two-vertex face and the result loses 1e-4 mm³ (2e-5 of the fillet, 1e-8 of the part). At the default count, and at 300, 600 and 1200, the results agree to 2e-7 of the fillet.
  - **Refusals:**
    - a point off the edges (SELECTION);
    - `radius` and `radii` both, or one point (INPUT);
    - the box boss's foot, which rolls round its corners (CAPABILITY).
  - **Conformance:** `r10/variable-radius-linear` (1e-9) and `r10/variable-radius-boss-foot` (1e-8). Both are closed forms with a STEP round trip.
  - **Studio:** the Fillet HUD has an End radius (0: the same). With it, the radius varies from the picked chain's end nearer the first edge's start to its other end; the picked edges must form one open chain. The history reads "Fillet R1→3", and the edit panel has Start and End radius.
    - The agent's tool schema documents `endRadius` for the command and `radii` for add_features. A run_command result now echoes `endRadius: 0` among the values, and its summary test moved with it.
    - A flow step opens a box and fillets its top edge 1→3 in the UI (−37.20 mm³).
- **Found, not fixed (follow-ups):**
  - The trimmed-end sliver above: a Boolean end case, not this step's.
  - ~~Within one process, the same fillet at the same fixed station count gave different results depending on what ran before (seen at 342 stations).~~ A misdiagnosis: the runs compared were at 342 and 350 stations. There is no order dependence (D101); the station-count sensitivity is the trimmed-end sliver above.
- **Next:** R10.5b (conic / G2 sections), then R11.

## D101 — determinism: no state outlives an evaluation (the "order dependence" of D100 was a misdiagnosis) (2026-10-19)

- **The report (D100):** the same variable-radius fillet at the same fixed station count seemed to give different results depending on what the process had run before ("seen at 342").
  - Reproduced as asked (A, then B, then A, compared to the bit), it does not occur.
  - The two runs compared were at different counts: the test's "twice the stations" was 2 × 175 = 350, and the script it was checked against ran 342.
  - At 350 (and 200) the groove's run past leaves a two-vertex sliver at its trimmed end and loses 1e-4 mm³. At 342, 300, 400 and 600 it does not.
  - Each count gives one result, to the bit, in any order: 200 and 350 always 8983.117241379, 342 always 8983.117143146.
  - The station-count sensitivity is real, and it is D100's follow-up (the Boolean's trimmed-end sliver). It is not state.
- **Checked, all to the bit** (vertex coordinates hashed, face counts, volumes):
  - every conformance case (109) and every RB corpus part (131), each evaluated in order, in reverse and again, in one process: 0 differ;
  - the D97/R10.B step foot at 12 radii, in one process and each alone: identical (the R10.B-time observation that r 11 built only in a sequence can no longer be reproduced; the code it ran on is gone);
  - the variable-radius groove at 200, 342 and 350 interleaved with other models.
- **Module-level state reviewed** (`src/*.ts`). None of it can change a result:
  - **Per-object WeakMaps** (keyed by B-reps, faces, curves, segments, surfaces, libraries, parameters): `contactCuts`, `sampled` (analytic-boolean, curved-arrangement), `areas`, `denseSampled`, `ruledFrames`, `quadratures`, `polyhedral`, `faceGeometries`, `meshes`, `built` (facet BVH), `crossings`, `builds`, `checkedArrays`, `arrayHashes` and modeling's four. They hold derived values of immutable inputs.
  - **Keyed LRUs:**
    - the spur-gear pair and rack checks, keyed by both specs (widths left out and the width-dependent ratios redone, as documented);
    - SubD's `keptCaps`, keyed by the local cage's exact positions, faces and creases, with the size-dependent conditions re-checked per call;
    - part-model's long-text ids, a memo key only (a miss, never a wrong reuse);
    - the evaluation cache, which is per document and handed on by `withDocument`.
  - **Scratch buffers** fully written before read: `faceScratch`, mesh-decimate's `place`, facet BVH's `stack`, SubD's evaluation vectors.
  - **Test hooks:** `fixedStations` (`setRingStations`), the traces, `facetLimit`, `observationTolerance`, all reset by their tests.
- **Kept:** `packages/barocss-cad/test/determinism.test.mjs`. Eight models are evaluated in order, in reverse and again, and must match to the bit: the groove at 200, 342 and its default count, R10.B's capped step foot, a rounded box, the mitred L-plate top, the cone rim and a gear pair.
- **Not covered:** the browser worker against Node. The kernel is the same code in both, but no test runs one model in both and compares them.
- **Next:** R10.5b. The trimmed-end sliver (D100) remains a follow-up.

## D102 — no sliver at a trimmed end: a tool's patch edge moved off the end face; strict checks flag lenses (2026-10-19)

- **The defect** (D100's follow-up, seen since D101 as a station-count sensitivity): where a rolling-ball tool runs past an end the Boolean trims (a convex end where the body ends), a break of the tool's patches near that end gave its patch edge, a section of the tool, straddling the end face's plane.
  - Where the chain meets the end face nearly square (the oblique groove's rims at the plate's end, 10° off), that section dips a hair inside the face. The Boolean's cut leaves a lens of the patch beyond: a face of two edges between two vertices, 1e-3 mm wide.
  - It depended on where the breaks fell. The variable-radius groove had it at 175 (its default count), 200 and 350 stations, 1e-4 mm³ off.
  - The constant r 1 groove had it on one of its two mirror-image rims: the rims came out 2.8e-3 mm³ apart (3e-7 of the part, 4e-4 of the fillet).
  - Both were silent: valid, strict checks clean.
- **The fix** (`rolling-ball.ts`, `breakBeyond`): near an end the Boolean trims, a break whose section straddles that end's plane is moved on, a quarter step at a time, until its section lies wholly beyond the plane. This applies to the contact-crossing breaks and the run-past break at the chain's end.
  - Not where the section lies in the plane to rounding: a square end's section is the end face's edge exactly, and that break stays, as its curvature jump needs.
  - Not at ends the tool is clipped at (D99's `breakOnEnd` puts those breaks in the plane).
  - (Dropping those breaks instead was tried. It broke the plate-0-to-40 groove's typed refusal, which became an untyped Boolean failure.)
- **The check** (`brep-check-geometry.ts`, strict): a face is a sliver if it has one loop of two edges between the same two vertices, the edges lie within 1e-2 of their chord of each other, and one of them is a seam to a tangent face (normals within 1e-4 rad at its middle). That is a piece of one smooth surface split a hair beside the face that cut it.
  - It flags every lens above on HEAD's tool (the seam there: 1.2e-6 rad).
  - The first version, without the tangency condition, flagged real geometry too. RB found 9 new failures: cylinders grazing a box by 1e-4 make lenses as thin (1.75e-3 of the chord), and so does one STEP round trip. Their faces meet at 1.75e-2 rad or more. That version's RB rows went in with the fix commit (87d772843: 9 new); the corrected check is recorded in the next rows.
  - Two-edge faces in general (a lens between two arcs, a disc's one-edge loop) are not flagged.
- **Evidence** (`test/r10-5.test.mjs`, new test, failing on HEAD):
  - the variable-radius groove at 150, 175, 200, 250, 300, 350 and 400 stations: strict-valid, the same body faces, the same volume to 1e-9 (8983.1172428 at every count);
  - the groove's two rims filleted 1: strict-valid, equal to 1e-11 of the part (2e-12).
  - `r10-5`'s curved-faces test is back to 1e-6 of the fillet against twice the stations.
  - The volume the counts now agree on is the one HEAD's lens counts had (to 1.5e-6 mm³), not the one its lens-free counts had (1e-4 apart). That it is the right one rests on the agreement across seven counts and on the rims' mirror symmetry above. Why HEAD's lens-free counts differed was not traced.
  - Every kernel test and conformance case is unchanged; the forced straight groove, which has square ends, stays at 1e-11 of its closed form.
- **The fillet face count still follows the station count** (the loft's pieces of at most 13 spans, D89): that is by design. The body's own faces and the topology class do not change with it.

## D103 — R10.5b: conic and G2 fillet sections (2026-10-19)

- **The contract** (optional field; no version change, D16): a fillet takes `section`:
  - `{ kind: 'circular' }` (the default: the rolling ball's arc, unchanged);
  - `{ kind: 'conic', rho }`, rho in (0, 1);
  - `{ kind: 'g2', tension? }`, tension in (0, 1), 0.5 when left out.
  - A conic or G2 section is the rolling ball's (R10.2a): every chain goes to the general path, as a variable radius does (D100). The closed forms of R10.1, the phased corners and the corner balls are skipped. It combines with `radii`.
- **The sections** (`rolling-ball.ts`, `sectionOf`): at each station the ball's contacts T1 and T2 stay as for the circle, and so does Q, the intersection of the faces' tangents in the station's plane.
  - **Conic:** the rational quadratic T1, Q, T2 with weight ρ/(1 − ρ). The circle is ρ = w/(1 + w), with w = cos(θ/2). 0.5 is a parabola; smaller is flatter, larger fuller.
  - **G2:** a quartic with poles T1, P1, P2, P3, T2 and weights 1.
    - P1 and P3 lie a fraction `tension` of the way from T1 and T2 to Q, so the section is tangent at the contacts.
    - P2 is placed so that the section's curvature across each contact equals the face's normal curvature in that direction: (P2 − T)·n = 4/3 κ |P1 − T|² at both ends, two conditions in the station's plane.
    - κ is read by central differences of the face's own surface (`normalCurvature`, a step of 2e-3 mm along the section's direction projected on the face). On planes κ = 0 and P2 = Q.
    - Matching the curvature in that one direction is enough for G2 across the contact: along the contact, the fillet and the face share the curve.
  - **The tool:** the fillet face is degree 4 across (G2) or rational quadratic (conic), cubic along as before. Its section edges match. The fillet face's outward test is now against the ball's centre, not the corner centroid: a full conic (ρ 0.7) or a G2 section crosses the old reference, and that gave a "2 uses" edge.
- **Refused:** rho or tension outside (0, 1), or an unknown kind (INPUT at the part, PARAMETER at the kernel). A section shape on a chamfer is refused PARAMETER. A conic or G2 fillet where the ball rolls round an edge at a corner (R10.3a) is CAPABILITY: the corner patch is a canal surface of the circle. No history is recorded for shelling past it, as with a variable radius.
- **Two defects in the curved arrangement, found by G2's second-order contact** (`curved-arrangement.ts`). Neither shows with circular sections.
  - **Half-edge order at a vertex:** a G2 section leaving a vertex along a planar face's edge agrees with it in angle and in curvature. The κδ/2 tie-break (D99) could not order them, so a groove's end faces lost their regions. Now `tangentOrder` compares the chords to points a quarter of the shorter one's length out (they cannot cross before their next vertices), then falls back to κδ/2.
  - **Spurious crossings at a touch:** where such a section ends on a line (its contact), it stays within eps of the line for a while (distance ~ s³). Newton, slow at the triple root, stopped anywhere in there and reported a crossing 1e-4 mm from the contact.
    - It made slivers: on a step's foot at the end plane, two corner faces 1.2e-4 wide. The volumes were off 1e-6 to 1e-4 relative, depending on where the stations fell.
    - Now `touchOfEnd` drops a point when s ran within eps of t from one of its ends lying on t (t's end or a point inside it), and leaves t further on, away from t's ends.
    - An overlap is kept: two copies of one curve, as the coaxial revolved tools have, run along each other to an end. The first version, without the "leaves t" condition, dropped those points too and broke two coaxial Pappus tests (R10.1, R10 S0) by 1e-10 of the part.
- **Evidence** (`test/r10-5b.test.mjs`, 5 tests; the feature is new, so all fail on HEAD):
  - **A box's top edge and a step's foot, r 3** (convex and concave planes): ρ at the circle's value, 0.3, 0.5 and 0.7, and G2 at tension 0.3, 0.5 and 0.8. Each is checked against the region between the corner and the exact curve × 40, to 1e-9. The circle's ρ matches the circular fillet's (1 − π/4) r² L to 1e-9.
    - Without the arrangement fix, the step's G2 is off 1.3e-6.
    - Measured at L 20, 40 and 80 and tension 0.3 and 0.5, every case is within 2e-10 of the reference, which is itself a 200 000-chord integral.
  - **With a varying radius** (1 → 3 along the box edge): parabola and G2, against the integrated closed forms to 1e-10 (3.6e-12 measured).
  - **G2 on a curved face:** a groove's rim (a plate and a cylinder of R 4), filleted r 1. Across each contact the fillet's own surface curves as the face does, to 1e-5: 1/4 at the cylinder, 0 at the plate. This is read by one-sided differences with Richardson extrapolation. The circular fillet reads 1/r there (G1 only).
  - **Round a boss's foot** (a closed loop), G2 and ρ 0.6, by Pappus:
    - At the default station count (252), the volume is within the loft's own reported deviation (`sectionMM`, 1.8e-7 mm) × the fillet's area. That is 3.5e-7 of the fillet (G2).
    - At 1024 stations it is within 1e-8 (4.7e-9 measured).
    - This is the loft's discretisation, the same as for the circle: a conic at the circle's ρ, through the loft, is 1.7e-7 off the circular fillet's closed form there. The error converges with the station count (252 → 512 → 1024: 3.5e-7 → 1.8e-8 → 4.7e-9).
    - **Stated honestly:** closed loops round curved paths are as accurate as the loft's reported deviation, not to 1e-9.
  - **Refusals** as listed above.
  - **The full kernel suite:** 1114 pass, and the one known environment failure (native Split source).
- **Conformance:** `r10/conic-parabola-box-edge` and `r10/g2-step-foot`, both closed forms to 1e-9 with a STEP round trip.
  - Parabola: its segment is 2/3 of the control triangle, so 12000 − r² L / 6 = 11940.
  - G2 at tension 0.5: the region is r²/10, so 18000 + r² L / 10 = 18036.
- **Studio:** the Fillet HUD has a Section choice (Circular, Conic, Curvature (G2)), with Rho and Tension shown for the one chosen. The history reads "Fillet R3 conic ρ0.5" or "… G2", and the edit panel has Rho or Tension.
  - The tool schema documents `section` for add_features, and shape, rho and tension for run_command. A run_command result now echoes `shape` among the values, and its summary test moved with it.
  - The chat checker (`checkNode`) accepts `section`, and also `radii`: D100 documented `radii` for add_features but the checker refused it as an unknown field, so that is fixed here.
  - A flow step opens a box and fillets its top edge r 3 with a conic section of rho 0.5 in the UI (−60 mm³).
- **Not done:**
  - A G2 or conic corner (the ball round an edge at a corner) is refused, not built.
  - Variable rho or tension along the chain.
  - G2 continuity at the chain's ends, which are square or clipped as before.
- **Next:** R11 (general shell and offset), as §0 lists it.

## D104 — the tessellation's flat-flip cycle: a SubD bench 7 s → 0.7 s (2026-10-19)

- **The report** (the outer lane, through the coordinator, on the D102 tip `4055ec1d9`): the studio bench "tessellate: SubD body of a ~2k-face cage" ran 7.04 s and 7.05 s against its 2 s budget. PERF3 A5 (D82) had it at about 1 s. Reproduced at `cc1e16fee`: 7.0 s, the same in three runs.
- **Bisect, by profile and history:** 44 % of the time was in `flipAll` (`brep-tessellate.ts`), 70 % with its helpers.
  - Since PERF3 A5, one commit touched that file: `889ce7bec` (D91/D92). It raised the Lawson flips' pass cap from 50 to 50 + the triangle count.
  - Counted per call on this body: 48 of 504 `flipAll` calls ran exactly to the cap, 1 644 passes at most.
  - Every flip in those passes was a flat triangle flipping into flat triangles: about 91 000 of them.
  - **The cause:** a flat triangle (three points on one line) is flipped "whenever it can be". Among points on one line (a SubD face's long straight boundary, sampled finely), flat triangles flip into flat triangles for ever. Under the old cap that cycle cost 50 passes a face; under D91's cap it cost about n² per face.
- **The fix:** a flat triangle is flipped only if the flip leaves fewer flat triangles (of t and its neighbour) than before.
  - The D91 cap stays: D91 needed more than 50 passes on real faces, and those flips are not flat cycles.
  - No tolerance changed.
- **Evidence:**
  - The bench body's mesh is the same to the bit: the positions, normals and indices hash equal. The cycle ended where it began.
  - The bench is 659 ms (budget 2 000 ms); the other 36 benches in the run were within budget.
  - `test/tessellate-flips.test.mjs` (new) tessellates the same 18-quads-a-side box cage, built inline. It asserts under 3.5 s and every welded mesh edge used twice.
    - It fails on HEAD (6 855 ms) and takes 0.7–1.7 s with the fix (1.7 s under the full suite's concurrency).
    - It is a wall-clock bound, so it has headroom: 7 s against under 1.
  - Kernel 1118/1123 (only the env-only Split test fails); studio 384/384; full flow 138/138.
- **Next:** R11 (unchanged); this was a fix at the R10 boundary.

## D105 — R11 S0: feasibility of general shell and offset (2026-10-19)

The roadmap's feasibility checkpoint before R11, with the research note's R11.1–R11.3 (`handover/notes/research-r10-r11-fillet-shell-2026-10-18.md`) as design input. The questions: does today's method — the wall as the union of a slab per face, each face's region grown by the wall within its own surface and reaching 1.37t out (`general-shell.ts`), the shell the body within it — hold on the faces it takes now, and can it take B-spline and mesh faces? Evidence: `packages/barocss-cad/test/r11-s0.test.mjs` (kept), against closed forms and Steiner's formula; hand-built slabs and fitted offsets, no product code changed.

- **Today, as it stands:**
  - Exact where it is exact: a hollow sphere (the revolve route) is 4/3 π (R³ − (R − t)³) to 1e-9.
  - Refused by name: a SubD body (freeform faces); the filleted pipe tee (its branch, a cylinder trimmed by the junction's saddle, before its fillet face); a box edge with a conic fillet (D103 records no shell history; its end faces are bounded by the conic); a mesh body (facets).
  - `thicken` folds silently: a quarter cylinder R 10 thickened 12 towards its axis is a valid solid whose inner sheet has crossed the axis (radius 2 on the far side). Nothing checks t·κ ≥ 1.
- **Two silent over-thick walls found** (bodies that reach `generalShell`: unions and other non-upright bodies; upright, revolved and swept bodies have their own exact routes):
  - **A slab grown across a smooth edge into a concave face.** A rod R 5 on a plate with both junctions filleted 2 (R10.1, closed form): a prism along X, so its hollow is the section eroded (A − Pt + 4t², the section having no reflex corner and ∫κ ds = 0) times L − 2t. Today's shell is 6.9e-4 over at t 0.5, 2.65e-3 at 1, 6.4e-3 at 1.5 and 7.9 % at 2.5, valid. The plate's top, grown t past its tangent edge, sits under the concave fillet deeper than t; so does the rod's slab grown round past its contact.
    - Built by hand, today's grown slabs reproduce the error to 1e-9 of the shell: the growth is the cause.
    - Not grown across the four tangent edges, the slabs meet there in one plane (the normal at the contact): coincident side walls, which the analytic Boolean takes. The shell is then exact to 1e-12 (seen 1e-14) at t 0.5 and 1.
  - **A cylinder slab past a concave junction.** A rod r 1 half sunk in a plate, a wall of 2: the rod is all wall, so the hollow is the plate's eroded box. Today's shell is 3.4 % over.
    - The rod slab's inner radius is clamped to 1e-3 r, so its angular growth t / (1e-3 r) closes it into a full ring of radius r + 1.37t, which reaches 1.74 below the plate's top.
    - By hand (the rod's slab the half disc above the plate, not grown; the plate's top grown across the sharp junction): exact to 1e-12.
    - A rod r 5 at t 1 is 1.1 % over even the sharp (intersection) join's wall, the thicker of the two joins: the rod slab's outer band, carried past the junction by its angular growth t / (r − t), lies inside the plate. A hand-built version with the outer band not grown there was not completed: hand slabs with coincident heights made the Boolean fail. R11.1 proves that case in code.
- **R11.2's offsets as faces on the body's own topology.** A closed body whose faces all meet smoothly (a SubD body) needs no slab: its cavity is its faces offset, with no Boolean.
  - Built here: every face's surface offset and fitted (cubic; its knots refined; each interior knot once more), every edge and vertex offset along a face's normal, and the cavity built with `buildBrep` on the body's own loops, edges and vertices.
  - `sewSolid` does not apply: SubD faces meet at T-junctions, 4–8 edges a loop.
  - The oracle is Steiner's formula, V(−t) = V − At + Mt² − (2πχ/3)t³, with A, M = ∫H dA and ∫K dA taken by quadrature from the body's own curvature (χ 2.000000 and 0.000000). The exact offset's own divergence integral agrees with it to 1e-8.
  - The SubD cube (24 caps, C1 knots), t 0.5: a valid B-rep; fit deviation 9e-6 mm; the enclosed volume 9e-7 off Steiner.
  - The SubD torus 8 × 6, t 1: valid; deviation 7.6e-5 mm; 4.5e-6 off Steiner.
  - **Findings for R11.2:**
    - (a) An offset is one order less continuous at each knot. Fitted without the extra knot, the cube cap's C1 knot leaves 5e-3 → 3e-4 mm; with it, 3e-5 at four pieces a span.
    - (b) The kernel caps a surface at 16 × 16 control points. A torus face of 13 spans cannot be refined at all; the 16 × 8 torus cage's faces fit only to 1e-1 mm. Offset faces must be split, or the cap raised (a contract question for R11.2).
    - (c) The error gathers beside a cap's extraordinary corner. Graded refinement is needed there, not uniform.
    - (d) The kernel's mass quadrature does not take these fitted faces as whole patches, because their edges lie within the fit's tolerance of the patch boundaries, not on them. Its mass of the cube's cavity is 7.7e-5 off the faces' own integral. The offset faces' edges should be their exact boundaries (with the neighbour within tolerance), or the whole-patch test should take tolerant edges.
  - **Folding:** t·κmax ≥ 1 on the convex side predicts the turn-over. On the SubD cube 1/κmax = 1.509 mm: the offset map's Jacobian against the face's is positive at t 1.5 (at the curvature's peak, and nowhere turned on an 8 × 8 grid a span) and negative at 1.6 at the peak. `OFFSET_FOLDS` can come from `local-curvature.ts`, as the note proposes.
    - *Corrected at D110:* those samples were interior points only. The tightest curvature lies on a cap's side beside its extraordinary corner, 1.480 mm. The cube folds from t 1.480, not 1.509.
- **Verdict — R11 in three stages, the note's order, with these changes:**
  - **R11.1 — fix the slabs of the faces taken now, then extend them.**
    - Grow a slab's region only across sharp edges. Across a smooth edge, the slabs share the normal plane as a coincident wall (probed exact).
    - Grow its outer band (the part reaching outside) only across convex edges.
    - No clamp: a convex cylinder, sphere or torus thinner than the wall gets a slab with no inner band (a sector to the axis).
    - Closed-form fixtures: the prism oracle (any union that is a prism along an axis: eroded section × (L − 2t)); the hollow sphere; a torus and a hole thinner than the wall; walls thinner than 2t; a fillet below the wall, sharp inside.
    - Typed refusals where a slab cannot be made.
    - The history route for variable-radius fillets: r(s) − t on the same spine is exact. Conic and G2 sections have no exact offset and go to R11.2.
  - **R11.2 — offset sheets on the body's topology.**
    - (a) A closed body whose faces meet smoothly: the cavity directly, with the fit's deviation reported and kept within the stated accuracy, splitting faces past the 16-pole cap, knots +1 at each interior knot, graded near poles. Typed refusals: `OFFSET_FOLDS(face, u, v, minRadius)` at t·κmax ≥ 1; walls closer than 2t (the cavity meets itself); tolerances never loosened.
    - (b) Bodies with sharp edges and freeform or otherwise trimmed faces (the tee's saddle-trimmed cylinders, the conic fillet's ends): a slab per smooth region, made of its inner and outer offset sheets and walls at its sharp boundary, grown there by extending the surfaces, then through the analytic Boolean as now.
  - **R11.3 — mesh bodies:** an offset mesh as the cavity, with the wall it achieves reported, and refusals for inverted triangles (folds) and self-intersection (mesh repair's grid). `thicken`'s fold-over becomes the same refusal. Not probed here; a mini-probe at its step.
- **Not decided here:** splitting offset faces or raising the kernel's 16-control-point cap (finding b); which join (sharp or arc) a concave edge gets in the hollow — sharp, as today and as upright shells do, unless the owner asks.
- Checks: no product code changed. Kernel 1134/1139 (only the env-only "actual native Split source…" fails; r11-s0 5/5, 20 s); lint clean; studio, flow and RB not rerun (no source change), as at D87.

## D106 — R11.1a: the general shell's slabs stop at smooth edges and at concave edges beside curved faces, whose corners are filled apart (2026-10-19)

The coordinator accepted D105 and asked for fixes (A) and (B) first, each with a test that fails on HEAD. `general-shell.ts` now classifies every edge between two slabbed faces and grows each slab per side.

- **Edge kinds.** Each edge between two faces with slabs is smooth, convex or concave.
  - The test uses the two faces' outward normals at the edge's middle and the first face's loop direction T. Loops run counter-clockwise about the outward normal, so (nA × nB)·T > 0 means convex. This was checked on a box, an L-body, a rod on a plate and a groove.
  - An edge is smooth when the normals agree to 1e-6 rad.
  - Edges next to an opened face are left out, so they grow as before and the hollow still runs out through the opening.
- **Growth per side** (`stopsAt`):
  - Across a **convex** edge, and a **concave edge between two planes**, the slab grows by the wall, as before.
  - Across a **smooth** edge the slab stops. The two slabs meet in the normal plane there, as coincident walls; S0 probed that this is exact.
  - Across a **concave edge beside a curved face** the slab stops, and the corner is filled apart (below).
- **How stopping is done, per face kind:**
  - Planes: the strip beyond each such side is taken off the grown region, and the face's own region is added back.
  - Cylinders: each side of the (angle, height) rectangle has its own flag.
  - Surfaces of revolution: each end of the meridian strip, and each end of the turn, has its own flag.
- **Corner fills (fix B).** At a concave edge beside a curved face, the corner is solved in 2D: in the plane across a straight edge whose two faces run along it, or in the meridian of a circular edge whose two faces turn about its axis.
  - The region near the edge's point E must lie beyond both faces' normals at E and within the wall of both faces' offsets: on the near side of a line's offset, outside a convex circle's, inside a concave one's. This is the sharp join of the offsets.
  - Its size is set by where the offsets meet. Where a convex circle's offset is gone, or does not reach the other offset, the region runs to the circle's centre.
  - The 2D regions of one straight run (the same direction and extent) are joined and extruded once. Those of one axis whose circles are whole (an edge, or its pieces) are joined and turned once. No two fills then overlap along a face: overlapping fills had left 1.1e-4 at t 3 on the torus ring.
  - Edges that are neither case are refused typed (`CAPABILITY`), as are walls whose offsets do not meet.
- **No clamp:** a convex cylinder no wider than the wall gets a slab that reaches its axis. Its angular growth is t / max(inner radius, r/4), capped at π/2. Before, the inner radius was clamped to 1e-3 r and the slab closed into a ring.
- **The reach of a concave face's slab** towards its centre is 1.29t, unlike the 1.37t of other faces. A concave round's slab then never meets a plane slab's outer face tangentially. At 1.37t both reached exactly 10 + 1.37t, which made an untyped Boolean failure at t 0.5 on the filleted rod.
- **Evidence, against closed forms.** Each case was wrong on HEAD (804ee65ef); `test/r11-1.test.mjs` is new; every result passes the strict check.

  | Case | Oracle | HEAD | Now |
  |---|---|---|---|
  | Rod R 5 on a plate, both junctions filleted 2, t 0.5–2.5 | the prism's eroded section, A − Pt + 4t² | 6.9e-4 – 7.9 % over | 1e-14 |
  | Rod half sunk in a plate, r 5/3/2/1 at t 0.5–2 | sharp join: the plate box eroded plus the rod's offset disc above the plate's offset | 1.1–7.8 % over | ≤ 4e-15 |
  | The same, rod shorter than the plate (x 10–30) | the same | | exact; its junctions end at the caps' chords, concave edges of two planes grown as before |
  | Torus ring R0 15, r 4 half sunk in a round plate, t 0.5–3.5 | Pappus | 0.5–18 % over; untyped Boolean failures from t 2.5 | ≤ 2.3e-12 |

  - Where the rod's or ring's offset disc no longer meets the plate's hollow, the result has a second cavity, and the tests count it.
  - S0's "today" tests (`r11-s0`) now read as then and now: the shell is exact, and the hand-built grown slabs still show the old error.
  - Conformance `r11/shell-filleted-rod-on-plate`, `shell-rod-on-plate-sharp-join`, `shell-torus-ring-in-disc` (closed-form volumes, STEP round trip).
  - A flow step: the rod on the plate shelled 1, its volume the closed form.
- **Not fixed here (R11.1b, next).** Concave edges between two planes still grow by t. That is exact only at right angles.
  - D105's prism oracle shows it: a 225° inside corner is 2.5e-3 over at t 1 and 5e-3 at t 2; a 315° one is 5e-4 over at t 1. These are bodies of planes only, wrong on HEAD as well.
  - Filling those corners too (as above) makes both exact (1e-15), but it fails on a concave vertex: a box with its corner notched, where three concave edges meet. The pieces touch along the vertex's vertical edge and the analytic Boolean refuses.
  - HEAD under-fills that vertex (−1.2e-5 at t 1, −5.1e-5 at t 2, against the cube-erosion closed form) and fails, untyped, at t 3.
  - R11.1b fills concave vertices where all edges are concave (the region within the wall of every face there), then fills plane–plane corners.
- **Found, not decided (for the owner):**
  - The upright route erodes each section in 2D, so its vertical concave edges get an arc join. An L-section extruded 20 and shelled 2 is 6610.27 mm³ (with a t²(1 − π/4) round).
  - The general route gives the same body 6624 mm³ (sharp join).
  - Ledges are sharp in both. Kept as is; say which join a concave edge should get, and the other route follows.
- Checks: lint and type-check clean; kernel 1140/1145 (only the env-only Split test fails); conformance 108/108; studio 413/413; full flow 143/143 (new step: the rod on the plate shelled). RB rows in the next commit.

## D107 — R11.1b: concave plane–plane edges at any angle and vertices of concave edges; the join as one switch (2026-10-20)

The coordinator accepted D106 and asked for vertex fills first, then concave plane–plane corners off a right angle. The owner has not yet decided the join, so the join kind is one switch, not baked in.

- **Concave edges between two planes.** A plane's slab grows across such an edge by t·tan(θ/2), where θ is the angle between the two normals.
  - That is as far as the two offsets reach before they meet. The band beyond the edge (depth 0 to t) then lies within both walls, for θ ≤ 90°.
  - At a right angle the growth is the wall exactly (snapped), as before.
  - For θ > 90°, a band of either plane, however wide, misses the far corner of the offsets' meeting. Those edges are filled apart, as R11.1a fills edges beside curved faces.
- **Vertices.** Where two growing sides of a plane region turn away from each other at a concave edge between lines, the bands are joined by a mitre instead of a round: the corner of the two grown lines, or a bevel past 10× the growth.
  - Under the sharp join, the planes' growth then meets at a vertex of concave edges with no extra piece.
  - First tried: fills along every concave edge plus a vertex fill (near the vertex, within the wall of every face's offset there).
    - Pieces touched only along the vertex's edge, so the analytic Boolean refused the result. With the fills placed first, the volume was exact.
    - Coplanar fill faces then left a slit edge in a hollow face, which failed the strict check. Not kept.
  - Every other region is grown as before, to the bit: when each side grows by t or not at all and no corner needs a mitre, the region is still the round dilation less the strips.
  - The fills still go after the slabs, as in R11.1a. Putting them first changed which intermediate unions meet, and a ray test degenerated on the r 1, t 0.5 rod.
- **The join switch:** `generalShell(…, join: ShellJoin = 'sharp')`.
  - Under `'arc'`, every concave edge stops and is filled with the disc of the wall about E, beyond both normals: every point within the wall of the boundary, and no other.
  - A vertex where concave edges meet is refused typed under `'arc'`: the ball there meets its edges' rounds tangentially along their end circles, and the Boolean fails, even with the ball clipped to the region beyond every edge.
  - Part documents still get the sharp join. The switch is internal until the owner decides, and a document setting would be a versioned shell node (D16).
- **Evidence** (`test/r11-1b.test.mjs`, new; each case fails on HEAD 519606e7e; every result passes the strict check):

  | Case | Oracle | HEAD | Now |
  |---|---|---|---|
  | Prism, 225° inside corner, t 1–2 | sharp-join inset of the section × (L − 2t) | 2.5e-3 – 5.0e-3 over | exact |
  | Prism, 315° inside corner, t 1–2 | the same | 5.2e-4 – 1.05e-3 over | ≤ 5e-15 |
  | Prism, 270° inside corner | the same | exact | unchanged |
  | Box with a notched corner (three concave edges), t 1–4 | cube erosion, (A − 2t)(B − 2t)(C − 2t) − (A − a)(B − b)(C − c) | −1.2e-5 to −2.4e-4: under-filled, a wall thinner than t at the vertex | exact |
  | L-prism, arc join | the upright route's value (6610.265 at t 2) | not run | 1e-12 |
  | Rod on a plate, arc join | sharp shell less 2 × (kite − quarter disc) × 38, t 1 | not run | 1e-12 |

  - The kite in the rod row is the polygon E, E − t·n, the offsets' meeting point, E − t·n′ less its circular segment.
  - Conformance `r11/shell-inside-corner-225`, `shell-notched-corner`; a flow step (the notched box, 9 024 mm³).
- **Not fixed (TODO, Boolean robustness):** the notched box at t 2.9–3.1 fails, untyped ("not a manifold solid"), as on HEAD. Three slabs' bounding planes meet along one short edge there (x = A − t, y = b + t, z from c + 1.37t to C − t). t 2.5 and t 3.5 build exactly.
- **Next:** R11.1 is done apart from that TODO. The note's remaining R11.1 items are typed refusals for slabs that cannot be made, and the history route for variable-radius fillets (r(s) − t on the same spine). Then R11.2.
- Checks: lint and type-check clean; kernel 1145/1150 (only the env-only Split test fails); conformance 110/110; studio 429/429; full flow 146/146 (new step: the notched box shelled 2; also the first full flow on the R14.5 merge 519606e7e, every R14 and drawing step passing). RB rows in the next commit.

## D108 — R11.1c: the rest of R11.1 — the wall's union retried, typed refusals, shells past a variable-radius fillet (2026-10-20)

The coordinator asked to finish R11.1 before R11.2: the typed refusals and the variable-radius history route, and the notched box's untyped failure at t 2.9–3.1, which counts as a defect.

- **The notched box at t 2.9–3.1.** The wall's union fails in one order only.
  - Bisected to four slabs: the end face's, the top's, the notch floor's and one notch wall's. No pair or triple of them fails.
  - Of the 24 orders of those four, the 6 that add the wall's slab last, after the other three, fail. So do the in-order union of all nine and a retry that defers the failing slab to the end.
  - The union of the other three leaves a convex edge of the end slab 0.89 mm long, between the floor slab's outer face and the top slab's inner face. The wall's slab swallows that edge whole, and the analytic Boolean reports an edge with one use.
  - The root, in the analytic Boolean, is not traced; it is a TODO, with that repro.
  - **Fix:** `joined()` unions the slabs in order. Only where the analytic Boolean fails a step does it retry the same union by halves, then in the reverse order. Union is associative, so the result is the same solid; only the intermediate meetings differ. Every case that built before is bit-identical, since the in-order union is tried first.
  - The sweep t 2.5–5, in steps down to 0.05 across 2.9–3.1, is exact to 7e-16 against the cube erosion. Conformance `r11/shell-notched-corner-t3`.
- **Typed refusals.** `generalShell` turns every failure into a typed refusal (`CAPABILITY`):
  - Refusals by name (`CAPABILITY: shell: …`) pass through.
  - Any other failure (a profile builder's error, or an analytic Boolean that cannot close the result) becomes `[SHELL_NOT_CLOSED] a wall of t mm cannot be closed on this body: <cause>`.
  - A union that fails in every order tried becomes `[SHELL_WALL_UNION]`. No test reaches either one now; the wrapper is there so that none can leave untyped.
  - **`[WALL_NEAR_RADIUS]`:** a convex round face (a cylinder, or a sphere or torus meridian) whose radius the wall all but reaches is refused. Its offset would be a core under 0.01 mm across, below the kernel's least arc; HEAD built a rod r 2 at t 1.995 with a 0.005 mm core.
  - r − t is snapped to 0 within the model tolerance, so a wall of exactly the radius is all wall. The rod's recognised radius is 2 + 4.4e-16; at first that read as just short. t 2 and t 1.99 are the closed forms.
- **The variable-radius history route.** A body with a variable-radius fillet now keeps its shell history: `Finish.radii`, with conic and G2 still excluded. Its hollow is rounded on the same spine with radius r(s) − t.
  - For a straight chain (its edges on one line) with a linear law (two radii), the hollow chain's ends take the outer law's value less the wall. The ball's planes are the same along a straight line, so this is exact.
  - The wall at or past the radius all along leaves the hollow's edge sharp.
  - Refused by name (`[SHELL_VARIABLE_RADIUS]`):
    - the radius falling to the wall partway (the hollow's round would run out there);
    - three or more radii (Fritsch–Carlson end slopes depend on the outer knots, so the hollow chain's law is not the outer one less t);
    - a curved chain (its arc length differs from the outer one's).
  - Closed form, the box edge rounded 2 → 4 (and 3 → 5), open below and closed: (1 − π/4)∫r² for the round, (1 − π/4)∫(r − t)² over the hollow's edge. Exact to 1.6e-14.
  - Conformance `r11/shell-variable-radius-box-edge`; a flow step.
- Evidence: `test/r11-1c.test.mjs` (new). Each case fails on HEAD 44399c726: untyped there; built there with its core; or refused by "no shell history" there.
- **R11.1 is done.** The note's R11.1 also listed a fillet radius below the wall giving a sharp inner corner, which already holds on the history route (`part-model.test`: a fillet of 1 under a wall of 2 leaves the hollow sharp). Next: **R11.2**, offset sheets (D105's verdict).
- Checks: lint and type-check clean; kernel 1150/1155 (only the env-only Split test fails); conformance 112/112; studio 429/429; full flow 147/147 (new step: the box edge rounded 2 → 4, shelled). RB rows in the next commit.

## D109 — the step-116 flake: a flow step read the previous step's body, not a wrong body (2026-10-20)

The outer lane reported step 116, "R10.3c a rod across a round plate", failing once in four full flows on unchanged kernel code: 39603 → 14594 where +12.04 was expected, at a load average of about 8. The coordinator asked to suspect the studio's evaluation path first, then anything time-based in the kernel, and to reproduce under load.

- **Cause: the flow's wait, not the studio or the kernel.**
  - **The body was right.** The failing run's screenshot (`notes/flaky-step116-flow12.png`, in the outer lane's worktree) shows the filleted rod on its disc at 14594 mm³. The kernel gives the unfilleted body 14582.04, and the fillet adds 12.04.
  - **"Before" was the previous step's body.** 39603 is R10.3b's filleted box boss: 60·60·10 + 20·12·15 + 2.9 = 39602.9, read off the panel.
  - **Why.** R10.3b's document ends with 6 nodes and 1 body, and R10.3c waited only for "6 nodes and 1 body" after choosing its file. When the file is read slowly (a loaded machine), that wait passes on the old document, and the body's panel shows the old body.
- **Ruled out:**
  - The studio's evaluation already guards against stale results. A cancelled or superseded evaluation never applies (`live`), and `bodiesFor` records which document the shown bodies belong to (`fresh`).
  - The kernel has no deadline or time budget; only decimation reports its milliseconds.
  - The studio's one time-based path, stopping a slow computation, is a button the user presses.
- **Fix:**
  - `App.tsx` (development builds only) sets `window.__studioFresh = fresh && !busy`. It is set in the same commit that changes the document, since `evaluated` derives from it in the same render.
  - The flow's `openModel(file, nodes)` waits for a document other than the last one, with that node count, whose bodies are fresh. The 16 file-loading steps that waited on a node count use it, as does the R14.5 flange (the outer lane's step, the same latent race).
  - The other count waits follow "New part" and a command, from 0 nodes, so they cannot match the last document. They are left as they are.
- **Stress test:** a flow step opens two files of one node count back to back, six times (a 40 × 30 × 10 plate and a 50 × 5 × 4 bar), and checks each volume read is its own.

  | Wait | Failed runs (8 each) | Load average |
  |---|---|---|
  | Old (node count only) | 2 | 60–210, under a kernel suite in a loop and the other lane's runs |
  | `openModel` | 0 | the same |

  - Reproducing the original R10.3b → R10.3c pair alone took more than 6 rounds without a failure, at loads up to 30.
- No kernel change; nothing in R10.3c's geometry was wrong.
- Checks: studio 429/429, type-check clean; full flow 148/148 (new step: the back-to-back opens). Kernel unchanged (1150/1155 at D108), so RB not rerun.

## D110 — R11.2a: a smooth closed freeform body shelled as its offset cavity (2026-10-20)

D105's verdict for R11.2: a closed body whose faces meet smoothly needs no slab, since its cavity is its faces offset. This step builds that cavity for SubD bodies. The open decision from D105 (finding b) is taken: offset faces are split into cells, and the kernel's 16-pole cap stays a fixed contract.

- **Route** (`offset-cavity.ts`, new): `smoothClosedBody` takes a body with one closed shell, every face an untrimmed NURBS patch (one outer loop on its natural boundary), and every edge between two faces smooth (normals within 1e-6 rad).
  - `shellPart` takes this route when `generalShell` refuses freeform faces and the body qualifies. The shell is `withCavities(body, cavity)`, with no Boolean.
  - Opening a face of such a body is refused by name (R11.2b).
- **The cavity's faces.** Each face's exact offset, p − t·n with n from the first derivatives, is interpolated at the Greville points of a cubic spline space.
  - The space has the face's own knots, each interior one once more, since an offset is one order less continuous there (D105's finding a). Each span is cut into r pieces.
  - The face is split into a grid of cells: spans grouped so a cell starts under the cap. Each cell raises r while it fits the cap, until within the target, 1e-6 of the body's size.
  - Where the cap comes first, the grid is cut through the middle of every cell that missed, both ways, and fitted again (at most 64 × 64). Cuts gather where the error does, beside an extraordinary corner. A cell that cannot reach the target is refused (`[APPROX_TOLERANCE_NOT_MET]`).
  - Deviation is measured at the quarters and middles between the interpolation points.
- **The cavity's topology is the body's.**
  - Each body edge is cut where a grid line of either face meets it; the cuts snap to the edge's own knots within rounding, and the same cut seen from two faces is kept once. A first version left a 1e-16 span (0.25 against 0.2500000000000001), which made the fit singular.
  - Each piece's offset is fitted in its face's side parameter, with no projection a point. The first version projected each point from scratch, about 450 evaluations a point, and never finished the edges of a torus.
  - Grid edges inside a face are the cells' own boundary curves.
  - Vertices are registered by their position on the body (1e-7 of its size).
  - Each cell's loop runs counter-clockwise about the outward normal, through the pieces along its sides or the grid edges.
  - Every entity's tolerance is twice the measured deviation.
- **Refusals by name:**
  - `[OFFSET_FOLDS]` where t·κ ≥ 1. Each knot span is sampled on a 9 × 9 grid with its edges, nudged off C1 knots where the second derivatives are not defined. From the six largest samples overall, a hill climb (golden section in u, then v, the step halving) finds the local largest.
    - This corrects D105: the cube's tightest radius is 1.480 mm, on a cap's side beside its extraordinary corner, not 1.509 inside.
    - With interior samples only, t 1.49 folded unrefused.
  - `[WALL_TOO_THIN]` where an offset point comes nearer than the wall to the body. Candidates are triangles of the body's tessellation within the wall, on a grid of the wall's size. The deciding distance is a Newton projection onto that face's surface, an upper bound of the true one, so the refusal is never false.
  - `[APPROX_TOLERANCE_NOT_MET]`.
- **Speed.** The kernel's evaluators check the surface at every call, and second derivatives copy it: 80 % of the time.
  - The route has its own evaluator per face: rational point and first and second derivatives (Piegl & Tiller A2.3, the quotient rule), the surface checked once. It is the kernel's to 2.4e-14 on SubD and rational revolved faces (a test).
  - Curvature now comes from the fundamental forms.
  - The cube at t 0.5: 4.9 s → 0.9 s. The 16 × 8 torus: 0.5 s.
- **Supporting changes (kernel core):**
  - `buildBrep` takes an optional per-vertex and per-edge `toleranceMM`, and `withCavities` keeps each entity's. Before, it rebuilt everything at the default and lost a tolerant cavity's.
  - The mass quadrature's whole-patch test accepts an edge within its own tolerance (D105's finding d: the cube's cavity was 7.7e-5 off; now the same to rounding, as `r11-s0` reads).
  - STEP: the writer's distance accuracy is the bodies' largest entity tolerance where that exceeds 1e-6. The reader takes a distance accuracy above 1e-6 as its entities' tolerance, at most 1e-5 of the model's size. Exact bodies are unchanged both ways. A SubD shell's STEP round trip keeps its volume to 1e-9; it failed before.
- **Evidence** (`test/r11-2a.test.mjs`, new; the shells were refused on HEAD 52f800a48; every result strictly valid, mass by quadrature):

  | Body (χ) | Wall | Cells | Deviation | Volume against Steiner |
  |---|---|---|---|---|
  | SubD cube (2) | 0.5 | 216 | 8.6e-6 mm (target 9.2e-6) | −8.5e-7 |
  | SubD cube (2) | 1 | 216 | 9e-6 mm | −7.3e-7 |
  | SubD cube (2) | 1.47, next to its fold | 216 | | within the bound |
  | Torus 8 × 6 (0) | 1 | 35 | 2.3e-5 mm (target 2.5e-5) | −2.1e-6 |
  | Torus 8 × 6 (0) | 2 | 92 | 2.1e-5 mm | −2.1e-6 |
  | Torus 16 × 8 (0), faces of 13 spans, past the cap | 1 | 114 | 2.0e-5 mm | −1.5e-6 |
  | Torus 16 × 8 (0) | 2 | 114 | 2.4e-5 mm | −2.1e-6 |
  | Membrane in a rim (2) | 0.2–0.5 | | | 2.4e-6 – 7e-6 of the shell |

  - The oracle is Steiner's formula: the hollow encloses V − At + Mt² − (2πχ/3)t³. A, M = ∫H dA and ∫K dA are by quadrature of the limit surface, and χ comes out 2.000000 and 0.000000. The bound checked is area × target.
  - Refused by name: the cube at 1.49 (`OFFSET_FOLDS`, radius 1.48015); the membrane at 0.6 (`WALL_TOO_THIN`, top and bottom membranes 0.5x mm apart); an opened face (R11.2b).
  - Conformance `r11/shell-subd-cube`, `shell-subd-torus-16x8` (Steiner's volume, the tolerance from the accuracy contract, STEP round trip 1e-9), `refuse-shell-subd-folds`, `refuse-shell-wall-too-thin`.
  - A flow step: the SubD cube shelled 0.5 from a file.
- **Not done:** opened faces (R11.2b). Bodies with sharp edges and freeform faces (region slabs) are R11.2b and R11.2c. Creased SubD bodies have sharp edges and are not on this route.
- Checks: lint and type-check clean; kernel 1157/1162 (only the env-only Split test fails; r11-s0's two S0 records read then and now); conformance with the 4 new cases; studio 453/453; full flow 151/151 on 52f800a48 plus this step (every R14 and A5 step passing). RB rows in the next commit.

## D111 — R11.2b: a smooth closed freeform body shelled with faces opened (2026-10-20)

D110 refused a shell that opens faces of a smooth freeform body. A shell's wall is the union of its kept faces' normal bands. So opening a face only takes its band away, and this step builds the opened shell from D110's cavity with no Boolean.

- **Route** (`offsetShell` in `offset-cavity.ts`; `shellPart` takes it when `open` is not empty). The shell's faces:
  - the kept faces as they are, with their names;
  - their offset: D110's cells, fitted the same way, turned inside out and named `<shell>.in.<face>.c<i>_<j>`;
  - along each edge between a kept face and an opened one, the wall's end: the band from the edge to its offset, ruled along the kept face's normal, named `<shell>.rim.<edge>#k`.
  - Only the kept faces are offset, fold-checked and fitted. A face that folds can be opened.
- **The wall's ends.** The offset's cells cut the opening's edges, so each band joins one cell side.
  - Each rim edge is split at those cuts into exact pieces of its curve. Each knot is inserted to full multiplicity (Boehm, on homogeneous points) and the middle segment kept, to 2.7e-15 on a rational cubic.
  - Each piece has its own band: cubic along the edge (the face's side knots each once more, refined until both rows are within the target, at most 16 poles), linear across.
  - Without the pieces, a band along a whole cap edge needed more than 16 poles.
  - Radial edges are straight lines from each rim vertex (cut vertices included) to its offset.
  - Each band runs out of the kept face towards the opening. Its sense comes from the kept face's coedge.
  - The kept faces' loops run through the pieces. Rim entities take the cavity's tolerance, twice the measured deviation.
- **Refusals by name:**
  - `[OPENING_AT_A_VERTEX]`: the opening touches itself at a vertex, where kept and opened faces alternate more than once round it. The wall's ends would share one radial there, four uses of one edge. For example, two diagonal caps of the cube's top. Before the check, this gave a non-manifold result.
  - `[WALL_TOO_THIN] … runs out through the opened face …`: a kept face's offset crosses an opened face (its signed distance outside the opened face's outward normal).
    - The opened face is no wall. The wall may come nearer to it than t (what lies between runs out through the opening), but not cross it.
    - The first version skipped opened faces in the thin check and would have let a wall poke out of the body.
    - The membrane in a rim, its top opened: t 0.6 and 1.0 are made (refused closed at 0.6); t 1.1 is refused 0.0525 mm past the top.
  - `every face is opened`.
  - Faces that are not on the body are refused by `shellPart` as before (`SELECTION`).
  - A kept face still folds by name (`[OFFSET_FOLDS]`).
- **Evidence** (`test/r11-2b.test.mjs`, new; every case refused on HEAD 05679aff2 with "not supported yet (R11.2b)"; every result strictly valid, one shell, mass by quadrature):

  | Body, opened | Wall | Cells | Wall's ends | Deviation (target) | Volume against the bands | Time |
  |---|---|---|---|---|---|---|
  | SubD cube, its top (4 caps) | 0.5 | 180 | 24 | 8.6e-6 (9.2e-6) mm | 1.9e-6 | 0.9 s |
  | SubD cube, one cap | 1 | 207 | 12 | 9.0e-6 (9.2e-6) mm | 5.9e-7 | 1.4 s |
  | SubD cube, top and bottom (a tube) | 0.5 | 144 | 48 | 8.6e-6 (9.2e-6) mm | 1.9e-6 | 0.7 s |
  | Torus 8 × 6, one patch | 1 | 31 | 7 | 2.3e-5 (2.5e-5) mm | 3.5e-6 | 0.4 s |
  | Membrane in a rim, its top (24 faces) | 0.6 | 119 | 38 | 5.9e-5 (6.0e-5) mm | 1.1e-5 | 1.5 s |

  - The oracle: each kept face's normal band is ∫∫ (t − Ht² + Kt³/3) dA (H > 0 convex), by 8 × 8 Gauss–Legendre on halves of the limit surface's knot spans. The bands of a smooth body meet only along the normals at their common edges, so the shell is their sum. The bound checked is kept area × target.
  - Every kept face keeps its name; no opened face appears.
  - Refused by name: the diagonal caps, every face, the membrane's top at 1.1, a kept cap at 1.49.
  - Conformance `r11/shell-subd-cube-open-top`, `shell-subd-torus-open-patch` (the bands' volume, the tolerance from the accuracy contract, STEP round trip 1e-9), `refuse-shell-opening-at-a-vertex`.
  - A flow step: the SubD cube shelled 0.5 from a file, its top opened (85.04 mm³).
  - `r11-2a`'s opened-face refusal is removed (noted in place).
- **Not done:** bodies with sharp edges and freeform faces (region slabs) are R11.2c. Creased SubD bodies have sharp edges and are not on this route. A wall's end is square to its kept face; there is no option for an end square to the opened face.
- Checks: lint and type-check clean (kernel and studio); kernel 1162/1167 (4 skipped; only the env-only Split test fails); conformance 119/119 with the 3 new cases; studio 474/474; full flow 154/154 on 05679aff2 plus this change, the new step included (every R14 and A5 step passing; the file has 154 steps, against the 155 the coordinator counted after the merge). RB rows in the next commit.

## D112 — R11.2c-1: trimmed planes and cylinders in the offset route; a filleted pipe tee shelled with its ends opened (2026-10-20)

R11.2c is D105's verdict (b): bodies with sharp edges and freeform or trimmed faces. It is split in two:
- **R11.2c-1 (this step):** the offset route's faces. Planes and cylinders however trimmed join it, beside fitted patches. That covers bodies whose kept faces form one smooth region once the opening takes the sharp edges away: a pipe fitting with its ends open.
- **R11.2c-2 (next):** sharp edges between kept faces, by region slabs through the analytic Boolean (the closed tee, the conic-filleted box).

R11.2c-1 builds what R11.2c-2's region slabs need too: the inner and outer sheets of trimmed analytic faces.

- **Route** (`offset-cavity.ts`). A kept face is taken in one of two ways:
  - an untrimmed patch whose edges all run along its domain's sides (fitted cells, as D110);
  - else an **exact face**: a plane or a circular cylinder (`faceGeometry`) with any loops.
  - An exact face's offset is an affine map of its own NURBS surface and edges, so it is exact and keeps its trims. A plane moves along its normal; a cylinder scales about its axis, a convex one to r − t and a hole to r + t.
  - An edge with a patch on it is fitted from the patch's side, as before. An edge of exact faces only is the face's map of it, cut so no piece has more than 16 poles (a band goes on each).
  - A rim band along an exact face is the ruled surface between the piece and its map, so it is exact.
  - Faces keep all their loops: the main pipe's half has its hole.
- **The gate** (`smoothOffsetBody(body, open)`): one closed body; every kept face a patch or an exact face; every edge between two kept faces smooth.
  - The pipe tee's rolling-ball fillet meets its cylinders within 1.5e-5 rad (at the edges' middles). The route's smooth threshold is now 1e-4 rad (0.006°).
  - The offsets part by t times the kink along such an edge. That gap (the largest kink, sampled along each edge at its ends, quarters and middle) is counted in the deviation, so the tolerances cover it.
  - `shellPart` takes the route when `generalShell` refuses a face's kind or trim (freeform, a curve-trimmed cylinder, a plane bounded by a free curve) and the gate passes. Every other refusal of the slab route stands, `[WALL_NEAR_RADIUS]` among them.
- **Checks for exact faces:**
  - `[OFFSET_FOLDS]` where a convex cylinder is no wider than the wall.
  - The thin-wall check samples each exact face's tessellation points, mapped. A distance to an exact face is the one to its foot on the surface (along the normal), taken only where the foot lies on that triangle. Elsewhere another triangle's foot decides, so a trim does not count as a wall.
- **Three latent bugs found by the tee:**
  - **The cell fit's span search** (`spanOf`, D110) never ended when the first Greville point, (a + a + a)/3, rounded below a. One fillet patch's last cell hung the route. It now returns the first span there.
  - **The tessellator's boundary check** took a small cell's edges for off its surface beyond 1e-5 of the cell's own size. The tee's fillet cells are 1–2 mm, so that is 3e-5 mm, while their edges are tolerant to 1.2e-4 mm (1e-6 of the 60 mm body, twice). It now accepts an edge within its own tolerance, as `checkBrep` does (kernel core, `brep-tessellate.ts`).
  - **The tessellator's mean of a run of one parameter** (`snapIsoRuns`) could round one ulp past the domain's end ("Parameter is outside the knot domain" at 16 a quarter). It is now kept within the run's own values (kernel core).
- **Evidence** (`test/r11-2c1.test.mjs`, new; refused on HEAD bc468b3e9 "a cylinder trimmed by a curve other than its rulings and circles"; every result strictly valid, one shell, mass by quadrature):

  | Pipe tee (R along X, r up Z, fillet), ends opened | Wall | Faces (hollow, rim) | Deviation (target) | Volume against the bands | Time |
  |---|---|---|---|---|---|
  | R 10, r 5, fillet 2 | 0.5 | 333 (297, 8) | 5.9e-5 (6.0e-5) mm | −1.6e-6 | 1.5 s |
  | R 10, r 5, fillet 2 | 1 | 333 (297, 8) | 5.9e-5 mm | −1.6e-6 | 1.8 s |
  | R 10, r 5, fillet 2 | 2 | 333 (297, 8) | 5.9e-5 mm | −1.6e-6 | 2.2 s |
  | R 10, r 6, fillet 1.5 | 1 | 343 (309, 8) | 6.0e-5 mm | −1.5e-6 | 1.8 s |

  - The oracle: each kept face's normal band ∫∫ (t − Ht² + Kt³/3) dA.
    - A cylinder's band is A·(t − t²/2r), with its area r ∮ −h dθ over its own edges (Green's theorem on the cylinder; the main pipe's two halves give 3635.32 of 3769.91 mm², the junction's hole taken).
    - A fillet patch's band is by quadrature of its curvature. The bound checked is kept area × target.
  - The shells tessellate at 8 and 16 a quarter.
  - Refused by name:
    - the wall at 4.1, past the fillet's convex radius of 4.048 mm where it turns round the branch (`[OFFSET_FOLDS]`, a fillet patch);
    - an end kept, which leaves a sharp edge between kept faces: the slab route's refusal stands until R11.2c-2.
  - Conformance `r11/shell-pipe-tee-open-ends` (the bands' volume, the tolerance from the accuracy contract, STEP round trip 1e-9) and `refuse-shell-pipe-tee-fillet-folds`.
  - A flow step: the tee from a file, shelled 1 with its ends opened (3955 mm³).
  - R11.2a/b and S0 unchanged: their tests pass as they were.
- **Not done:**
  - Sharp edges between kept faces: R11.2c-2's region slabs (the closed tee, the conic-filleted box).
  - Trimmed freeform patches, and exact faces other than planes and cylinders (cones, spheres, tori trimmed).
  - The exact faces' thin-wall path has no case of its own that refuses: none of the tees comes near it.
- Checks: lint and type-check clean (kernel and studio); kernel 1166/1171 (4 skipped; only the env-only Split test fails); conformance 121/121 with the 2 new cases; studio 482/482; full flow 156/156 on bc468b3e9 plus this change, the new step included (every outer-lane step passing). RB rows in the next commit.

## D113 — R11.2c-2: shells of bodies whose smooth regions meet bounding planes at sharp edges (2026-10-20)

D105's verdict (b), finished: bodies with sharp edges and freeform or trimmed faces. The targets were the closed pipe tee and the conic-filleted box; both were refused on HEAD: a cylinder trimmed by a curve, and a plane bounded by a curve that is not a line or an arc.

- **Route** (`region-shell.ts`, new). The wall is the union of a slab per piece of the boundary, and the shell is the body within it (the slab route's way, D105–D108). Two kinds of slab need no growth across an edge.
  - **A bounding plane's band.** A plane bounds the body when every point of the body lies on its inner side (its tessellation's points, within 1e-6 of the size).
    - Its band runs from the wall inside to 1.37 walls out and is unbounded along the plane: a square 4 sizes across, each band's a little apart so no far faces coincide.
    - Inside the body, a point within the wall of such a plane is within the wall of the boundary, because the segment to the plane leaves the body. So the band needs neither the face's outline nor any growth: a plane bounded by a conic or a trimmed curve is as any other.
    - The faces of one plane joined by flat edges form one band.
  - **A smooth region's slab** (`regionSlab`, offset-cavity.ts):
    - the region (faces joined by edges within 1e-4 rad) offset in by the wall (the inner sheet, turned inside out) and out by its reach;
    - closed along every edge of the region by bands ruled along its normals.
    - The reach is 1.37 walls, or half the tightest concave radius where that is less: the outer sheet must not fold.
    - The two sheets share one grid of cells a face (each refitted on the other's until neither cuts it further), so the bands pair their pieces.
  - At a sharp edge between a region and a bounding plane, the region's end lies inside the plane's band: its normal there lies in the plane at a right angle, and near it otherwise. So the slabs, the body and each other meet transversally, and every face of the union inside the body is the hollow's.
  - **Closed:** the union's voids are the hollow, so the shell is the body with them as cavities (`withCavities`): no Boolean with the body. The closed tee takes 7.9 s instead of 22 s.
  - **Opened, beside a region:**
    - The body is first extended through the opened face: a prism on it, two walls deep, glued on (`glueAtSharedFace`). The slabs are the extended body's, so the region's run out past the opening.
    - The shell is the original body within them (one analytic Boolean).
    - A face opened beside bounding planes only needs nothing.
- **Planes and cylinders are now always exact faces in the offset route** (they were patches when untrimmed, D112). An untrimmed half cylinder fitted as cells was 1.6e-5 off on a capped cylinder; exact, it is 4e-15. The opened tee of D112 improves from −1.6e-6 to −2.6e-7. R11.2a/b are unchanged: their SubD faces are neither.
- **Kernel core fixes found by the region slabs' cells** (domains such as [12/13, 1], where a sum of steps rounds past the end):
  - The analytic Boolean's curve table evaluated a face at its parameters scaled and back, which could lie past the domain: now clamped.
  - Its 25 × 25 sample grid's last row, and its arc-length estimate's last step, could round past the domain: now the end itself.
  - The tessellator's grids (`spaced`): the same.
  - **The analytic Boolean's result tolerance** was its own 1e-5 whatever its inputs. A fitted region slab's pieces lost their 1.2e-4, and the tessellator then refused them. It is now the inputs' largest entity tolerance where that is more, as `withCavities` keeps them (D110).
- **Refusals by name:**
  - `[SHELL_REGIONS_SHARP]`: two smooth regions meeting at a sharp edge (an unfilleted tee's cylinders at their concave saddle).
  - `[SHELL_PLANE_NOT_BOUNDING]`: a plane the body crosses (a step, a pocket) at a sharp edge beside a region.
  - `[SHELL_OPENING_NOT_PLANAR]`: an opened curved face beside a region.
  - `[SHELL_FACE_KIND]`: a face of another kind beside a sharp edge.
  - `[SHELL_NOT_CLOSED]` for any other failure, with its reason.
- **Evidence** (`test/r11-2c2.test.mjs`, new; every case refused on HEAD c885e6c0e; every result strictly valid, mass by quadrature):

  | Body | Wall, opened | Faces | Volume against the closed form | Time |
  |---|---|---|---|---|
  | Box 40 × 30 × 20, an edge conic-filleted (ρ 0.5, 3) | 1 closed | 51 | −9.1e-9 | 1.5 s |
  | the same | 2 closed | 135 | +9.9e-9 | 2.9 s |
  | the same | 1, bottom | 50 | −1.2e-8 | 2.0 s |
  | the same | 2, bottom | 134 | +1.3e-8 | 4.6 s |
  | Pipe tee R 10 / r 5, filleted 2 (D112) | 1 closed | 328 | −2.3e-7 | 7.9 s |
  | the same | 2 closed | 328 | −2.0e-7 | 8.9 s |
  | the same | 1, branch end | 327 | −2.3e-7 | 19.7 s |

  - The box is a prism along X, so its hollow is its section eroded over 40 − 2t. The section's turning is three right angles and the conic's quarter turn, so it erodes to A − Pt + (3 + π/4)t². With the bottom open it is A − (P − 30)t + (1 + π/4)t².
    - A and P come from the end face's own edges, by Green's theorem and arc length; A agrees with the body's volume / 40 to 1e-9.
  - The closed tee's wall is the faces' normal bands (D112's), plus each kept cap's disc πr²t, less each cap's overlap with its pipe, the square ring 2π(r − t/2)t².
  - The closed tee tessellates at 8 and 16 a quarter.
  - Refused by name: the unfilleted tee, a pocket in the conic box's floor, an opened fillet face.
  - Conformance `r11/shell-conic-box-closed`, `shell-conic-box-open-bottom`, `shell-pipe-tee-closed` (STEP round trip 1e-9) and `refuse-shell-regions-sharp`.
  - A flow step: the conic box from a file, shelled 2 with its bottom opened (7096 mm³).
  - R11 S0's two refusals (the filleted tee, the conic box) and R11.2c-1's kept-end refusal now shell; their tests say then and now. A box with a lofted boss (part-model's shell test) is refused by name for the box's top the boss crosses (`[SHELL_PLANE_NOT_BOUNDING]`) instead of for its freeform faces.
- **Not done** (each refused by name):
  - concave sharp edges between regions, or between a region and a plane the body crosses (a boss on a curved face, a pocket);
  - openings that are curved faces beside a region;
  - trimmed freeform patches, and exact faces other than planes and cylinders.
  - The opened case's one Boolean takes about 20 s on the tee (327 faces).
  - R11.3 (mesh offsets) is next.
- Checks: lint and type-check clean (kernel and studio); kernel 1173/1178 (4 skipped; only the env-only Split test fails); conformance 125/125 with the 4 new cases; studio 505/505; full flow 160/160 on c885e6c0e plus this change, the new step included (every outer-lane step passing). A first full run made beside the kernel suite timed out six drawing and A5 steps (5–30 s waits) and logged one page error. Those steps all passed on their own, and the run alone was clean. RB rows in the next commit.

## D114 — R11.3: a mesh body's shell, and thicken's fold refused by name (2026-10-20)

D105's R11.3: mesh bodies get an offset mesh as their cavity, with the wall it achieves reported. Folds and self-intersections are refused, and `thicken`'s unchecked fold-over (S0) is refused by name. This step ends R11.

- **Route** (`mesh-offset.ts`, new; `shellOf` takes a body of facet faces first):
  - The mesh's triangles, welded (`facetTriangles`), must be closed and wound one way.
  - Each vertex moves to the least-squares point of its triangles' planes moved in by the wall, each weighted by the triangle's angle at the vertex. The solve is Σ w n nᵀ d = −t Σ w n, through the 3 × 3 matrix's eigenvectors (Jacobi), leaving out directions it spans less than 1e-4 of its largest.
  - So where up to three planes meet it is their sharp join exactly: a box's corner, a mitre on an edge, a flat point along its normal. Round a smooth vertex the wall lies within the spread of its normals.
  - The cavity is the same triangles at the moved points (a facet B-rep, its faces named `<shell>.in.<face>`), added as a void (`withCavities`). The mass is polyhedral, exact.
  - **The wall it achieves**, measured: the least and largest distance from the offset (its vertices and triangles' centres) to the mesh's surface, through D85's distance tree (`meshDistanceRange`, new). It is on the output as `shell: { wallMM, wallMinMM, wallMaxMM, triangles }`.
- **Refusals by name:**
  - `[OFFSET_FOLDS]`, a triangle turned over: an offset triangle facing against its own. The wall is deeper than the mesh curves there, or than half its thickness (a U-prism's 2 mm slot floor at 1.5).
  - `[OFFSET_FOLDS]`, turned inside out: the offset's signed volume is not positive. Each triangle still faces its own way, so only the whole tells; for example a ball shelled past its radius.
  - `[WALL_TOO_THIN]`: the inner surface meets itself or the mesh. The mesh and its offset are taken together and crossing pairs found through mesh repair's grid (`selfIntersections`). Example: a pocket's floor 2 above the bottom at 1.5. No triangle joins the two there, so none turns over: the offsets just cross.
  - `[MESH_WALL_THIN]`: the wall achieved is more than 1 % thinner than asked, a mesh too coarse for its offset.
  - `[SHELL_MESH_NOT_CLOSED]`.
  - Opening a face of a mesh body, and a mesh sheet, are refused ("not supported yet"; a sheet: "thicken it instead").
- **thicken** (`thicken-solid.ts`):
  - Refused where the offset turns over towards the side it curves to, `[OFFSET_FOLDS]`: the shell's check (D110), each knot span sampled with its edges and climbed, against the side or sides thickened into. Surfaces of degree above 3 are sampled on a 64 × 64 grid of principal curvatures.
  - The quarter cylinder R 10 thickened 12 towards its axis (S0's fold) is refused, its radius 10 against 12; so is 21 both ways (10.5 a side). 9 towards it, 12 away and 19 both ways are made, within 2e-3 of their volumes (the sampled mesh).
- **STEP, for hollow mesh bodies** (kernel core, `step.ts`, `step-import.ts`). HEAD wrote a facet body's faces as planar faces in one shell, so a hollow one's two shells became one, and reading it back refused it as "not connected". Now:
  - each shell is written apart and the voids are put back (`withCavities`);
  - a tessellated solid that reads in pieces takes the largest as its outside and the pieces inside it as its voids (others are refused as before);
  - a hollow 1280-triangle mesh round-trips both ways to 1e-9, and a 20 480-triangle one the same.
- **Evidence** (`test/r11-3.test.mjs`, new; every case refused, or the fold made, on HEAD 3f2bf159b; every result strictly valid, two shells):

  | Mesh body | Wall | Volume against the closed form | Wall achieved |
  |---|---|---|---|
  | Octahedron \|x\| + \|y\| + \|z\| ≤ 10 | 1, 3 | exact (rounding): (4/3)(a³ − (a − √3t)³) | t to rounding |
  | Box 40 × 30 × 20 (12 triangles) | 2 | exact: 24000 − 36·26·16 | 2 |
  | U-prism (a slot down to 2 above its floor), tessellated | 0.5, 0.9 | exact: its section inset with the slot grown, (40 − 2t)(20 − 2t) − (10 + 2t)·18, over 30 − 2t | t |
  | Box with a blind pocket, tessellated | 0.9 | exact: the box inset less the pocket grown | 0.9 … 1.1 (the pocket's inside corners, sharply joined) |
  | Icosphere R 10, 1280 triangles | 1, 5 | (no closed form) | within 5e-4 of t |
  | Icosphere, 80 triangles | 3 | | 2.981 … 3.007 |
  | Icosahedron | 3 | | t |

  - Refused by name: the U at 1.5 (a fold), the icosphere at 11 (inside out), the pocketed box at 1.5 (crossing), an opened mesh face, thicken at 12 and at 21 both ways.
  - Conformance `r11/shell-mesh-octahedron`, `shell-mesh-pocketed-box` (exact, STEP round trip 1e-9), `refuse-shell-mesh-wall-too-thin`, `refuse-thicken-folds`.
  - A flow step: the octahedron mesh from a file, shelled 3 (1185.5 mm³).
  - R11 S0's mesh refusal and its unchecked thicken fold now say then and now.
- **Not done:** opened faces on mesh bodies; round (arc) joins at a mesh's concave edges (the sharp join, as the slab route's default); the mesh's offset is a vertex move, so a mesh coarser than its curvature is refused (`MESH_WALL_THIN`) rather than refined; thicken's sheets are still a sampled grid.
- Checks: lint and type-check clean (kernel and studio); kernel 1182/1187 (4 skipped; only the env-only Split test fails); conformance 129/129 with the 4 new cases; studio 519/519; full flow 164/164 on 3f2bf159b plus this change, run on its own, the new step included (every outer-lane step passing). RB rows in the next commit.

## D115 — R12 S0: feasibility of sheet metal (2026-10-20)

The roadmap's feasibility checkpoint before R12 (§4 item 12: base flange from a sketch, edge flange, bend with radius and K-factor, reliefs, flat pattern, its DXF, bend table data in the part). There is no research note; this record is the design input. The questions:
- Does today's kernel build a sheet's pieces exactly?
- Can a sheet's B-rep be unfolded, and against which oracles?
- What is kernel work, and what is app work?

Evidence: `packages/barocss-cad/test/r12-s0.test.mjs` (kept), against closed forms and the kernel's own volume. The probe unfolder lives in the test. No product code changed.

**The standard model** (the definitions only; no data values):
- A sheet has thickness T. A bend is a cylinder piece of inner radius R turned θ.
- Its neutral layer lies at R + K·T. The K-factor is defined by the bend allowance BA = θ(R + K·T), the developed length of the bend.
- Outside setback OSSB = (R + T)·tan(θ/2). Bend deduction BD = 2·OSSB − BA (θ < 180°).
- Flat length = Σ legs + Σ BA, or the outside dimensions to the virtual sharps less Σ BD.
- Real values of K (and of BA/BD tables) come from a shop's bend tests. Data rules below.

**Today, as it stands:**
- **Construction is exact.**
  - **A contour flange.** An L-bracket's section (lines and two arcs, R and R + T) as one `loop` sketch, extruded: volume W(aT + bT + θT(R + T/2)) to 1e-16, area to 3.5e-14, valid.
  - **An edge flange.** The flange's section (bend and leg) extruded along the edge and united onto a plate: every angle 30°–175°, up and down, full or part width; valid, volume to ≤ 1.7e-12 (asserted 1e-11).
  - **A rectangular relief** at each end of a part-width flange, by difference: exact.
  - **A tray**: a plate, four 90° flanges a gap g short of each corner, a hole in the plate and one in a flange. Valid, 2.8e-12, 42 faces, 60–120 ms.
  - `sweep` (straight runs and bends up to 180°, `toward` ±x/±y; `sweepBrep`) is a second route for contour flanges.
  - `thicken` is not a route: its sheet is a sampled grid (faceted).
- **Missing sheet semantics.** Faces are named after the sections' sides and split by the Booleans: an L-bracket's bends are `e.side3` and `e.side7`; a tray's flange side is `fe3.side3#1` … `#4`. Thickness, K and the bends are recorded nowhere.
- **A silent wrong sheet.** Flanges leaning in (turned past 90°) cross their neighbours near the corners. The union takes the overlap once and returns a valid solid, under its pieces' sum by 0.88 % (120°), 1.8 % (150°), and 0.32 % at a 5 mm gap. No sheet folds into it, and nothing says so.
- **No gap at a corner is fine.** The neighbouring bends' ends meet only along the plate's corner edge, a reflex edge of a valid solid (90° and 60°, exact). In the flat, the tabs touch at the plate's corner.

**Unfolding the B-rep (the probe):**
- **The method.**
  - Fix a planar face. Its skin is the faces joined to it across smooth edges (normals agreeing to 1e-9). The thickness's side faces meet it at sharp edges.
  - Planes move rigidly into the fixed face's plane.
  - A bend (a cylinder by `faceGeometry`) develops by angle × its neutral radius: ρ − T + K·T when its normal points away from its axis (the skin is the outer side), else ρ + K·T.
  - Each new face's frame comes from the tangent line it shares with the face before.
  - The flat's outline is the skin's edges not shared by two skin faces. Its area comes from Green's theorem on their developed images.
- **Oracles**, all independent of the unfolder:
  - **The area identity**, flat area = V/T + (K − ½)·T·Σθw. At K = ½ the neutral layer is the middle, so the flat is the volume over T. V is the kernel's mass quadrature.
  - **The textbook reach**: a flange's far edge lies h + θ(R + K·T) beyond the plate's edge.
  - **Agreement**: each edge between skin faces lands at one place from both sides. Either skin, fixed, gives the same flat.
- **Results:**
  - Internal edges coincide to ≤ 7e-15.
  - The area identity holds to ≤ 4.7e-12 (asserted 1e-11) for K 0.5, 0.44 and 0.33. It holds on the tray with holes, at no gap, at 30°–175° up and down, and from either skin.
  - It also holds after a **STEP round trip**: the imported body (no names, no history) unfolds to the same flat, its fixed face found by its plane.
  - The reach holds to 4e-15.
  - The outline's images are lines and circles to 3.7e-14: planar edges move rigidly, and a bend's end arcs develop straight.
  - The tray unfolds in 25–30 ms.
- **The DXF writer (R11b) needs nothing new** (O1 said so). The tray's flat as 28 LINEs and 4 ARCs on layers OUTLINE and BEND_UP (a DASHED line type) through `writeDxf`.
  - ezdxf 1.4.5's audit (`scripts/dxf-oracle.py`, by hand, L1): no errors, no fixes.
  - The 28 lines include collinear pieces where the Booleans split the plate's edges; the flat merges them.
- **So the flat comes from the B-rep itself, given T and K.** It works for any sheet whose cuts are normal to it, made by any feature, and for imported sheets. The sheet features need only carry the rules and name the bends.

**Kernel versus app:**
- **Kernel:**
  - the sheet features and their B-rep with role names;
  - the rules and a bend list on the output (`sheet`: T, K or table, each bend's faces, axis, R, θ, up/down, BA);
  - the flat pattern (outline loops, bend lines, bend notes), and the flat's DXF document for `writeDxf`;
  - bend-table lookup;
  - typed refusals.
- **App (studio):**
  - commands, HUDs and node kinds;
  - picking a flange's edge;
  - a flat-pattern view and "Export flat DXF";
  - the agent's sheet tools.
- **The outer lane (R14, drawings):** a flat on a drawing sheet and a drawing's bend table, from the kernel's flat and bend data.

**Verdict — R12 in five stages, this order:**
- **R12.1 — sheet rules, base flange, contour flange.**
  - **New kinds:**
    - a base flange from a closed sketch (a plate T thick, either side of its plane);
    - a contour flange from an open path of lines in a sketch plane: a bend of radius R at every corner, the material on a chosen side, extruded a width.
  - **The rules on the feature:**
    - T, R and K are explicit.
    - The kernel has no hidden default (a data value, below).
    - R is overridable per bend later.
  - **Faces named by role**, e.g. `<id>.bend<k>.inner/outer`, the skins, the legs, sides by the sketch's tags (D86). They are new kinds, so no migration.
  - **The output's `sheet` report.**
  - **Oracles:** closed-form volume and area, and BA.
  - **Refusals** by name:
    - a path crossing itself;
    - a bend that does not fit between its legs (a leg shorter than its setbacks);
    - θ at 0 or 180°;
    - T or R not positive.
  - **Studio:** node, command, chat spec, a flow step.
- **R12.2 — the flat pattern and its DXF.**
  - **The unfolder** as probed, in product code with hoisted functions.
  - **The flat:**
    - outline loops, collinear pieces merged, lines, arcs and circles;
    - bend lines: the centre and both tangent lines;
    - bend notes (up/down, θ, R, K, BA).
  - **The sheet report** carries through a `difference` whose target is a sheet, so holes and cuts normal to a flat face reach the flat.
  - **A body with no sheet report** (an import, a plain extrusion) unfolds when T and K are given with it. T is checked against the body's own skins, not trusted.
  - **Refusals** by name:
    - `NOT_A_SHEET`: a face of neither skin nor side, or the opposite skin not at T;
    - `NON_NORMAL_CUT`: a side face not square to the skin;
    - `BEND_NOT_CYLINDRICAL`;
    - `FLAT_OVERLAPS`: the developed outline crosses itself;
    - an image neither line nor arc, such as a cut across a bend, refused until a later step.
  - **Oracles:**
    - the area identity, with a cut bend's θw taken as its inner face's area over R (the kernel's face area);
    - the textbook lengths;
    - a refold: developed vertices mapped back lie on the body to 1e-9;
    - either skin;
    - a STEP round trip.
  - **DXF** through `writeDxf`:
    - layers OUTLINE, BEND_UP, BEND_DOWN and BEND_NOTES;
    - expected DXF files and ezdxf readings committed as `conformance/r12/` data, as R11b did.
  - **Studio:** a flat-pattern view, "Export flat DXF", a flow step.
  - **Why second:** the unfolder is the oracle-heavy core, and every later stage then checks its own flat.
- **R12.3 — edge flanges, reliefs and corners.**
  - **(a) Edge flange.** On a straight edge of a skin face (by name or selector), with:
    - an angle in (0°, 180°);
    - a length to the outer or inner virtual sharp, or to the tangent;
    - a position: material inside, material outside, or bend outside;
    - a part width by offsets from the edge's ends;
    - its own radius;
    - end reliefs for a part width: rectangular, obround or none, with width and depth.
  - It is built as a section piece united on (exact, probed).
  - **Refusals:**
    - `FLANGES_COLLIDE`: the union's volume under its pieces' sum, the S0 case;
    - an edge that is not a straight edge of a skin;
    - a flange or relief that does not fit.
  - **Oracles:** the closed-form volume, the flange face at OSSB, the flat length A + B − BD.
  - **(b) Corners of neighbouring flanges:** a corner gap, and corner reliefs (square, round) through both bend zones. Closed corners are not in R12.
- **R12.4 — bend tables.**
  - **A table in the part:** rows (T, R, θ) → K, BA or BD, each row with a source id or `estimate: true`.
  - **Lookup:** an exact row, or linear inside the table's grid; outside it, refused by name.
  - **Conversions** between K, BA and BD in closed form.
  - **The report and the flat** name the row used.
  - **Data:** see below.
- **R12.5 — acceptance.**
  - The RB9 ladder's rungs 5 and 10: a sheet-metal L-bracket and a sheet-metal PCB enclosure (base, four flanges, corner reliefs, mounting holes).
  - Both are built by the agent through the real chat with the sheet tools.
  - Their flats are exported to DXF and audited.
  - RB rows; the R12 → FR hand-over.

**Every stage:** a D-record, tests failing on the previous HEAD where a defect is fixed, `conformance/r12/` fixtures, a flow step, RB rows, a checkpoint.

**Data and defaults:**
- **No K, BA or BD values are built in** unless a named public source with a record is found (R12.4). Reading public pages for that needs the owner's OK through the coordinator; it is asked at R12.4. Otherwise values are flagged estimates, and a shop's own table is entered as data in the part.
- **The studio's prefill for a new sheet is a reversible default, flagged an estimate wherever shown:**
  - T 1.5 mm;
  - R = T;
  - K 0.5: the mid-plane, no material data. Real air bends usually lie lower, so a flat at K 0.5 is long.
- **Relief defaults** (width T, depth T past the bend zone) are estimates, flagged likewise.

**Not in R12** (listed for the owner to place):
- hems, jogs, sketched bends, miter and lofted flanges;
- closed corners, louvres and forming tools;
- cuts across a bend made in the flat (unfold, cut, refold);
- converting a solid or shell to sheet metal;
- sheet DFM rules (minimum flange, hole-to-bend distance, minimum radius per material), as a process profile with warn and error levels and sourced values, like AM/IM/CNC.

**Checks:** no product code changed. Kernel 1186/1191 (4 skipped; only the env-only "actual native Split source…" fails; r12-s0 4/4, 1.5 s). Lint clean. Studio, flow and RB were not rerun, as at D87/D105 (no source change).

## D116 — R12.1: sheet rules, the base flange and the contour flange (2026-10-20)

R12's first stage as D115 froze it: sheet-metal features that carry their rules, name their faces by role and report their bends, with typed refusals.

**Kernel** (`sheet-metal.ts`, `part-model.ts`):
- **Two feature kinds.**
  - `sheet-base`: a plate from a closed sketch, one outer loop with holes allowed, T thick from its plane (`reverse`: against its normal). It is the upright route, so its mass is exact. Its faces are an extrude's: `top`, `bottom`, the sides by the sketch's tags.
  - `sheet-contour`: an open `path` of 2–64 points in a plane (default XY), extruded `width` along the plane's normal.
    - The path is one skin of the sheet, the material T thick to its `side` (left or right, looking along it).
    - At each corner, a bend: the path's skin there has radius R + T where the material lies inside the turn (the path is the outer skin, its corner the outer virtual sharp), else R. The other skin is the concentric offset, so the inner radius is R either way.
    - The section (lines and arcs) is extruded on the upright route: exact mass, valid B-rep, any plane.
- **The rules on every sheet feature**, none defaulted: `thickness` T, `bendRadius` R and `kFactor` K. K must lie from 0 to 1 (the neutral layer within the sheet).
- **Faces by role.** `.leg<i>.a` (the path's skin) and `.leg<i>.b`; `.bend<k>.inner` / `.outer` (k the corner's point); `.start` / `.end` (the thickness at the path's ends); `.front` (in the plane) and `.back`.
  - `prismaticFromProfile` takes whole names for the walls and caps (`names`) for this. It is a new optional input; every other caller is unchanged.
- **The output's `sheet` report:** T, R, K and each bend with:
  - its name and its two faces;
  - R and θ;
  - its axis (in the part's frame);
  - BA = θ(R + K·T), OSSB = (R + T)·tan(θ/2) and BD = 2·OSSB − BA (`bendAllowance`, `outsideSetback`, `bendDeduction`, exported).
- **Refusals** by name:
  - `[BEND_ANGLE]` (PARAMETER): a path point in line with its neighbours (no silent merge); a turn of 180° (a hem, not in R12).
  - `[BEND_DOES_NOT_FIT]` (PARAMETER): a leg shorter than its corners' setbacks along it, the numbers given; coincident points.
  - `[SHEET_CROSSES_ITSELF]` (GEOMETRY): the section meets or touches itself, with where and which faces.
    - The test is closed-form (line–line, line–circle, circle–circle, arcs by angle) over every pair of segments that are not neighbours. It is not sampled.
    - A path coming back to touch its start is refused; a millimetre short, it builds.
  - The rules: K outside 0–1 and T or R not positive (PARAMETER); side and path (INPUT); a base sketch with regions (CAPABILITY).
- **The sheet report is on the feature's own output only.** Carrying it through later features (a `difference` cutting holes) is R12.2, with the flat.

**Oracles:** textbook relations written in the tests, not the kernel's construction.
- **The middle line.** Each leg is measured to a corner of the path. At a corner where the path is the outer skin, the leg loses 2(R + T)·tan(θ/2) and gains θ(R + T/2) (the bend deduction at K = ½). Where the path is the inner skin, it loses 2R·tan(θ/2) and gains the same arc. The volume is T × the middle line × the width.
- **Results:**
  - An L at 30°–170°, either side (the path the outer or the inner skin): to 1e-12.
  - A hat with both kinds of corner, a zed, a channel either way, the channel on the XZ plane: to 1e-12. The channel's STEP round trip holds to 1e-9.
  - The bend faces are cylinders of radius R and R + T, coaxial with the reported axis, to 1e-12.
  - BA, OSSB and BD agree with their definitions to 1e-12.
  - A base plate 80 × 50 with a Ø10 hole: volume, centroid (±T/2 either way) and area exact.

**Studio:**
- **Nodes** `sheet-base` and `sheet-contour`, mapped one to one. They are new kinds, so no migration; `KINDS` takes them.
- **Two commands:**
  - **Sheet plate** (from a finished sketch, up or down).
  - **Sheet profile**: an L at any bend angle, a U, a Z or a hat, standing on the XZ plane from y to y + width.
    - Its base, leg and lip are measured to the path's side: the outside of the first bend and of a hat's crown; a Z's second bend and a hat's brims to their inside.
- **The rules' fields** show "K-factor (0.5: estimate)".
- **The prefill** (T 1.5, R = T, K 0.5) is D115's reversible default, on the owner's confirm list.
- **The body's panel:**
  - the rules;
  - a warning when K is 0.5: an estimate, the sheet's middle, so the flat runs long; use the shop's value;
  - one line a bend (θ, BA, OSSB, BD).
- **The feature editor:** thickness, bend radius, K, width.
- **The agent:**
  - both commands (documented) and both raw nodes in `add_features` (`points2`: 2 to 64 points);
  - the K advice in its docs: ask for the shop's value, or say it is an estimate.
- **Icons** `cad-sheet-plate` and `cad-sheet-profile` (an L of sheet with its bend in the accent colour), also in the history.

**Tests:**
- Kernel `test/r12-1.test.mjs` (5) and studio `test/sheet.test.ts` (3). Both fail on HEAD f14204d7c, where the kinds are unknown.
- Conformance `r12/`:
  - `contour-l-bracket`: volume and area in closed form;
  - `contour-hat-channel`, on XZ;
  - `base-plate-with-hole`;
  - `refuse-bend-does-not-fit`, `refuse-sheet-crosses-itself`, `refuse-bend-angle`.
- The conformance runner gains an optional `sheet` expectation (rules, each bend's name, angle and BA).
- A flow step: the hat from the palette (5406.17 mm³ by the middle line; its notes and the estimate warning; `Sheet profile T1.5 · 4 bends`).

**Judgement calls:**
1. **The contour's path is inline points**, not a sketch. The kernel's sketches are closed loops, and an open sketch would change the sketch format; the sketcher drawing an open path for it is a later UI step.
2. **The skins are named `a` (the path's) and `b`**: legs have no inside or outside, bends do.
3. **The studio's profile measures to the path's side**, so a Z and a hat mix outside and inside dimensions; the docs say which.

**Not done:** a radius per bend; a 180° fold (a hem); the sheet report through later features (R12.2).

**Shared file:** the studio's tool contract `src/chat/tools-v1.json` (A5.1, the outer lane's) takes the two new commands in `run_command`'s enum. This is a compatible change recorded with `UPDATE_TOOL_CONTRACT=1` (its own procedure); no tool's shape changed otherwise.

**Checks** on 60ac5bd00 plus this change:

| Check | Result |
|---|---|
| Lint and type-check | Clean (kernel and studio; the studio's ESLint shows warnings only, in files not touched) |
| Kernel | 1197/1202 (4 skipped; only the env-only Split test fails) |
| Conformance | 135/135, with the 6 new cases |
| Studio | 539/539 |
| Full flow | 168/168, run on its own; the new step included, every outer-lane step passing |

RB rows are in the next commit.

**RB at R12.1** (a follow-up commit):
- **The runner took every JSON file under `conformance/` as a part document.** These were the other steps' fixtures: DXF cases and their oracle readings, drawing, robot, DSL and brief cases, 86 files. They were counted as refused part documents, and the outer lane's A6 brief cases (merged at 60ac5bd00) showed as 3 NEW WRONG.
  - It now takes only part documents and conformance cases holding one (`scripts/rb/run.mjs`).
  - The trend's case count drops from 359 to 273 on this basis. Its REFUSED count falls with it, from 87 to 4.
- **The two r12 contour cases' volume tolerance is now 1e-9**, as the other exact cases have.
  - RB measures by the B-rep quadrature: 1.4e-12 on the L-bracket, past the 1e-12 first written.
  - The kernel's prismatic integration, which the unit tests keep at 1e-12, is not the only route an implementation may take.

## D117 — R12.2: the flat pattern and its DXF (2026-10-20)

R12's second stage as D115 froze it. The probe's unfolder (D115) is now product code, `sheet-flat.ts`, working on the B-rep with only T and K. Its refusals are typed, and the sheet's report reaches it through holes and cuts.

**The flat** (`flatPattern(brep, { thicknessMM, kFactor, fixedFace?, bendNames? })`; an output's `flatPattern({ fixedFace?, kFactor? })` uses the sheet's own rules):
- **The fixed face.**
  - The named face; a name split by Booleans (`#k`) takes its largest piece.
  - Otherwise the sheet's own: a plate's `top`, a profile's `leg0.a`. Each sheet report now names it (`fixedFace`).
  - Otherwise, for a body without the rules, the largest planar face; a tie goes to the first by id.
  - The flat lies in that face's plane, seen from its outside: its x is world X in the plane (else Y), its y = n × x.
- **The skin**: the faces joined to it across smooth edges (normals agreeing to 1e-9 at three points).
  - Planes move rigidly.
  - A cylinder unrolls at its neutral radius: ρ − T + K·T where the skin is its outside, else ρ + K·T.
  - Each new face's frame is made across a straight tangent line, from the face before. The image of the direction into the face before, turned round, is the direction into the next face. This is one rule for plane→cylinder, cylinder→plane and cylinder→cylinder.
  - Coplanar pieces, and pieces of one cylinder, share a development.
  - A smooth neighbour that is neither a plane nor a cylinder is refused: `BEND_NOT_CYLINDRICAL`.
- **The outline** is walked through the B-rep's own loops: from a boundary coedge, its loop's next, crossing an edge between two skin faces to the coedge on the other side. Tabs that touch at a corner (D115's no-gap tray) therefore make one outline through that point.
  - Each piece is an exact image: a line; a circular arc (from a plane's circles); a spline (any other planar curve, its control points moved by the plane's affine map).
  - On a bend only lines (its straight edges, and its arcs square to the axis).
  - Consecutive collinear lines and arcs of one circle are joined; two half circles become a CIRCLE.
  - The flat is moved so its box starts at 0, 0.
- **Bends**: the skin's pieces of one cylinder, however reached.
  - Each bend gives: its angle (its developed width over rn); its inner radius; its K; its BA (its developed width); its two tangent lines; its centre line; its faces; and its name, the sheet report's where a face matches, else `bend<k>`.
  - `up` where the fixed skin is the bend's inside (towards the viewer), `down` where it is the outside.
- **The sheet's report carries through** `difference` and `hole` features on a sheet (holes, cuts). The flat is worked out again from the B-rep, which decides whether it still is a sheet.

**Refusals** (`FlatPatternError`, an output's as GEOMETRY with the code in its message; `CUT_ACROSS_BEND` as CAPABILITY):
- `NOT_A_SHEET`:
  - mesh faces, a body in pieces, or no planar face;
  - a face facing a skin plane at another distance than T (`qe.top lies 5 mm from the skin face b.bottom, not the sheet's 2 mm`: a boss; a T given wrong);
  - a face neither on the skins nor a cut through them;
  - **the volume identity:** the body's volume against T × its skin at the middle — planes' area, bends' developed area × (R + T/2)/(R + K·T) — to 1e-7.
  - The opposite skin is matched face by face: a plane at −T, or a coaxial cylinder at radius ρ ∓ T.
- `NON_NORMAL_CUT`: a face of neither skin meeting a skin face off square at its edges' quarter points (`he.side0 meets the sheet's face b.bottom 13.82° off square`: a hole drilled 16.7° off).
- `BEND_NOT_CYLINDRICAL`: a smooth continuation that is not a cylinder. The case is a thin parallelogram swept round a bend, its skin a cone.
- `FLAT_OVERLAPS`, two tests:
  - no two pieces of the outline cross, or overlap along a line. A touch at a point is allowed. The arcs are sampled at π/64, with a uniform grid so it is not all pairs.
  - a point inside every skin face, developed, lies inside the outline once (a winding of 2 is two faces on one place).
  - The case: a window 20 mm wide with a 30 mm flange on its edge (refused); at 10 mm the flange fits and unfolds.
- `CUT_ACROSS_BEND`: an edge on a bend that does not develop straight.
  - Square cuts across a bend develop straight: walls square to the axis or containing it, as a notch through a corner does (tested). No cut today's features make square to the sheet reaches this refusal, so it is a guard, untested by a case. A cut made in the flat and refolded is later work (D115).

**DXF** (`flatPatternDxf(flat)`, through the R11b writer, unchanged):
- Layers:
  - OUTLINE (7): LINE, ARC, CIRCLE, SPLINE.
  - BEND_UP (3) and BEND_DOWN (1): each bend's centre line, on the line type DASHED (5, −2.5).
  - BEND_NOTES (2): a TEXT at the line's middle, along it and upright: `DOWN 90° R2`.
- mm units.
- Conformance `r12/flat-dxf/{channel-hole, tray-holes}/`:
  - `case.json` holds the part document and the flat's options;
  - `expected.AC1015.dxf` / `.AC1009.dxf` are reproduced byte for byte;
  - `oracle.*.json` is ezdxf 1.4.5's reading (run outside the product, `scripts/flat-dxf-fixtures.mjs`; the `~/.cache/barocss-ezdxf` venv R11b set up, nothing downloaded). It audits clean (no errors, no fixes), and every entity is on its layer at its coordinates to 1e-9, with the notes' text.

**Oracles**, none computed by the unfolder:
- **The textbook flat length**, the outside dimensions to the virtual sharps less BD = 2(R + T)·tan(θ/2) − θ(R + K·T):
  - a channel 30 + 40 + 30 with a hole: length and width to 1e-12, area L·W − π r² to 1e-12;
  - an L at 30°–150°: length and area to 1e-12;
  - another K (0.33) moves the flat by exactly its BD.
- **The K-factor's area identity**, V/T + (K − ½)·T·Σθw: to 1e-11 on the channel, the tray with holes and with no gap, and the window flange that fits.
- **Bend data:** each bend's centre line where the leg's flat length less the setback plus BA/2 puts it, to 1e-11; its strip BA wide.
- **Closed forms of cut-outs:** a notch through an L's corner across its bend, 30·L − 6·(2(10 − R − T) + (π/2)(R + K·T)), to 1e-12.
- **Either skin:** the same flat from the other skin to 1e-12, its bends `up`.
- **Through STEP** (no names, no history): the same flat to 1e-9.
- **Time:** the channel 15 ms; the tray with a hole 25–30 ms.

**Studio:**
- A sheet body's flat is worked out with its evaluation (once a B-rep; refusals kept). The body's panel shows `Flat pattern 94.357 × 25 mm, 2 bends`, or `No flat pattern: [CODE] …` as a warning.
- A **Flat** button opens the flat pattern: drawn to scale, bends dashed (up green, down red) with their notes, and "DXF" (2000 or R12) to download it.
- The R12.1 profile's body notes gain the flat line.

**Tests:**
- Kernel `test/r12-2.test.mjs` (6) and studio `test/sheet.test.ts` (+1). Both fail on HEAD b33f8da75, where there is no flat.
- Conformance:
  - `r12/flat-channel-hole`, `flat-l-bracket-120`;
  - `refuse-flat-non-normal-cut`, `refuse-flat-overlaps`;
  - the DXF cases above.
- The conformance runner gains an optional `flat` expectation: area, box, loops, bends by name and direction, or the flat's error.
- A flow step: a channel with a hole opened from a file. It checks the panel's line, the dialog's two `down` bends and its summary, and the DXF downloaded (four layers, one CIRCLE, two TEXTs).

**Judgement calls:**
1. **The flat's x axis** is world X projected into the fixed plane, else Y. A profile standing on XZ, unfolded from a vertical leg, therefore runs along Y. Its outline is the same either way.
2. **A tie for the largest planar face** (a plate's top and bottom) goes to the first by id. Only bodies without the sheet's rules meet it; the tests name the face.
3. **The sheet's report is carried through `difference` and `hole` only.**
   - Moves, patterns and mirrors leave it behind: their bends' reported axes would be stale.
   - A union makes something else, so it takes the kernel's `flatPattern` with T and K.
   - Carrying it further is a later step if wanted.

**Not done:** a cut across a bend made in the flat; bend reliefs and edge flanges (R12.3); a drawing sheet of the flat and a bend table on it (the outer lane's R14, from this data).

**The flat's window:** it opens in the middle, above toasts.
- The first full flow had it in the toast corner, where a toast left over from an earlier step (an STL opened) covered its DXF button.
- The flow step also handles its download's promise at once. A failed click had left that promise waiting, and when it timed out it ended the whole flow, not just the step.

**Checks** on b33f8da75 plus this change:

| Check | Result |
|---|---|
| Lint and type-check | Clean (kernel and studio) |
| Kernel | 1207/1212 (4 skipped; only the env-only Split test fails) |
| Conformance | 139/139, with the 4 new cases; the 2 DXF cases in `r12-2.test.mjs` |
| Studio | 545/545 |
| Full flow | 170/170, run on its own; the new step included, every outer-lane step passing |

RB rows are in the next commit.

## D118 — R12.3a: edge flanges and their reliefs; FLANGES_COLLIDE; the sheet's report dropped past moves (2026-10-20)

R12.3's first half, as D115 froze it. Corners of neighbouring flanges (corner reliefs) are R12.3b, next.

**Kernel** (`sheet-flange`, `part-model.ts` `sheetFlange`; `flangeSection` in `sheet-metal.ts`):
- **What it takes.** A sheet (its rules from its report; else `[NOT_A_SHEET]` CAPABILITY) and a straight `edge` between a planar skin face S and a planar thickness face E.
  - S and E are square to each other and to the edge, and E has an edge along this one T below S over some of its length. E may run on beyond, merged with a flange's end beside it, as after a full-length flange on the next edge.
  - The plate lies behind E.
  - Else `[EDGE_NOT_SHEET]`.
  - The edge is found by its name, else by its faces' names without piece numbers (one such edge; several → SELECTION, listed).
- **The flange's frame:** x out across the edge (E's normal), y up from S, z along the edge. It bends `angleDegrees` (default 90, in (0, 180); else `[BEND_ANGLE]`, 180° is a hem) towards S's outside, inner radius `bendRadius` (default the sheet's).
- **Where it sits** (`position`), by its virtual sharps:
  - `material-inside` (default): the outer sharp on the edge, the plate trimmed (R + T)·tan(θ/2).
  - `material-outside`: the inner sharp on the edge, trimmed R·tan(θ/2).
  - `bend-outside`: the bend from the edge, no trim.
- **Its length** (`measure`): to the outer sharp (default), the inner one, or from the bend's tangent. A length inside its setback is `[BEND_DOES_NOT_FIT]`, and so is a trim deeper than the plate behind the edge.
- **Part width:** `offsets` [from the edge's start, from its end].
  - At each end inside the edge, a relief: `rectangular` (default), `obround` (its deep end a half circle; depth ≥ half its width), or `none`.
  - Its `width` and `depth` past the bend's start default to T each: estimates, flagged so in the studio.
  - A relief wider than its offset is `[BEND_DOES_NOT_FIT]`.
- **The cut into the plate is one tool:** the trim and both reliefs as one loop, taken down through the plate.
  - Two cuts sharing a face's plane (a trim, then an obround relief beside it) failed the analytic Boolean as "not a manifold".
  - Bend outside, each relief is its own loop.
- **The flange's section** (`root`, bend, leg, `tip`) is extruded along the edge on the upright route and united on at its root.
- **Faces:** `<id>.bend.inner/outer`, `.leg.inner/outer`, `.tip`, `.start`, `.end`, the cut's `<id>.trim.*`, `<id>.relief<k>.*`. Coplanar faces merge as Booleans do.
- **The sheet's report gains the bend** (`<id>.bend`: faces, R, θ, axis along the edge, BA, OSSB, BD), so the flat names it.
- **`FLANGES_COLLIDE`** (GEOMETRY):
  - the union's volume short of the trimmed plate's plus the flange's. Volumes by the exact surfaces (quadrature), to 1e-8. This is D115's silent overlap: two neighbouring flanges leaning in at 135°.
  - also the Boolean meeting another bend along an edge, as when a second flange's trim 2 mm from a corner reaches the first one's bend (its setback 3 mm). The message gives the setback to keep.
- **`SHEET_IN_PIECES`** (GEOMETRY): reliefs of neighbouring flanges that meet and cut a corner's square off. It was found by the tray at 5 mm from the corners, where the result had been 5 bodies.

**The sheet's report past other features** (the coordinator's check on D117's call 3):
- Moves, turns, mirrors, patterns and unions drop it; nothing carries it stale.
- After them, `output.sheet` is undefined, the output's `flatPattern()` is refused (CAPABILITY, "not made as sheet metal"), and a flange on it is refused `[NOT_A_SHEET]`.
- The kernel's `flatPattern(brep, { T, K })` unfolds a moved or turned body again from its own B-rep, to the same area (1e-11). No old axis is used: the flat reads only the B-rep.

**Oracles:** definitions written in the tests, not the construction.
- Each position sits its outer sharp on the edge, T·tan(θ/2) past it, or (R + T)·tan(θ/2) past it. The outer length is L, L + T·tan(θ/2) (`inner`) or L + (R + T)·tan(θ/2) (`tangent`).
- **The flat:** the outside less BD.
  - Results: 3 positions × 30°, 90°, 120°, 150° × 3 measures, each to 1e-12; an own radius (4) too.
- **The volume:** the plate less its trim, plus θ·T(R + T/2) + T × the leg, × the width.
  - Results: the same 36 cases to 1e-11.
- **Part width** with rectangular, obround (T·(w(t + d − w/2) + πw²/8) each) or no reliefs: the volume to 1e-11, the flat by the area identity to 1e-11.
- **A tray of four flanges in turn,** 10 mm from the corners: the flat's area identity to 1e-11, four bends up, the volume to 1e-11.

**Studio:**
- **The Flange command** (modify): one straight edge of a sheet body (one with a flat or a flat's refusal).
  - Fields: length, angle, position, measure, radius (0: the sheet's), offsets, relief, its width and depth (0: T, estimate).
- **The node** `sheet-flange` keeps its edge as `edges: [name]`, so the fillet's machinery serves it unchanged: references, signatures, re-matching on edit, renaming in assemblies and on delete.
- **Edit fields** (length, angle, offsets); a label (`Flange 20 · 90°`); an icon; the history icon.
- **The agent:** the command (documented) and the raw node.
- **The tool contract records the command** (`tools-v1.json`, a compatible change, A5.1's procedure).
- **The Sheet profile command no longer has "flange" among its keywords.** The palette's search for "flange" found it before Flange.

**Also:** the PERF3 C16 cage-edit test (`cageEdit.test.ts`, the coordinator's note from the outer lane). The warm step is now the median of the four warm samples, not their maximum: one sub-millisecond sample caught by a stall failed it about once a full suite. The 0.5 limit stays.

**Tests:**
- Kernel `test/r12-3.test.mjs` (5) and studio `sheet.test.ts` (+1); both fail on HEAD 1d83930f5. `chat.test.ts`'s docs check gains a sheet edge for the command.
- Conformance `r12/`: `flange-material-inside-120` (volume, the report's bend, the flat, a STEP round trip), `flange-part-width-obround`, `refuse-flanges-collide`, `refuse-flange-edge-not-sheet`.
- A flow step: a plate opened from a file, its edge picked by name, Flange from the palette. Volume 7315.07 mm³; flat 97.393 × 50 mm, 1 bend.

**Not done:**
- Corner reliefs where two flanges meet, and closed corners (R12.3b next; the closed corner stays out of R12, D115).
- Flanges on curved edges.
- Several edges in one flange feature.
- A flange's own reliefs at the edge's ends beside another flange (offsets keep them apart today).

**Checks** on 1d83930f5 plus this change:

| Check | Result |
|---|---|
| Lint and type-check | Clean (kernel and studio) |
| Kernel | 1216/1221 (4 skipped; only the env-only Split test fails) |
| Conformance | 143/143, with the 4 new cases |
| Studio | 551/551 |
| Full flow | 172/172, run on its own; the new step included, every outer-lane step passing |

RB rows are in the next commit.

## D119 — R12.3b: no relief defaults in the kernel (RELIEF_REQUIRED); corner reliefs (2026-10-20)

R12.3's second half. First the coordinator's check on D118: the flange's relief took hidden kernel defaults, against D115 call 3. Then corner reliefs. **R12.3 done.**

**No relief defaults** (the coordinator's check, agreed before this step):
- **What D118 did:** a part-width flange left without a `relief` got 'rectangular', and a relief without `width` or `depth` got T for each, silently (`part-model.ts`, the case's parse).
- The `?? 0` the check named could make no zero-size relief: it was reached only with the relief 'none', where nothing is cut. It is now an explicit branch.
- **Now:**
  - A relief, when given, is `{ kind: 'rectangular' | 'obround', width, depth }` or `{ kind: 'none' }`. A cut without its width or its depth is `[RELIEF_REQUIRED]` (PARAMETER), naming the field.
  - A flange with an end inside its edge and no relief is `[RELIEF_REQUIRED]`, saying what to give.
  - A flange the whole edge long needs none.
- **The studio's Flange** writes the relief whole: its width and depth where given, else the sheet's T, still labelled an estimate. Bodies carry their sheet's rules for it (`BodyResult.sheet`).
- **The contract changed in place:** `sheet-flange` is new and unreleased, so it is not versioned. The conformance case `flange-part-width-obround` now spells out its relief (1.5 × 1.5), and the tests theirs.
- **Tests:** a part-width flange with no relief, a rectangular relief without its width, and an obround one without its depth are each refused.

**Corner reliefs** (`sheet-corner-relief`; `part-model.ts` `sheetCornerRelief`):
- **What it takes.** A sheet, and its plate's corner named by the corner's edge: the straight edge, T long, between two planar thickness faces.
  - Else `[EDGE_NOT_SHEET]`.
  - The corner must be square and convex; else `[CORNER_NOT_SQUARE]` (CAPABILITY), giving its angle, e.g. a triangle's 56.31°.
- **What it cuts,** through the sheet: a `square` of side `size` along both edges, or a `round` quarter of radius `size` about the corner. The corner's frame is x and y into the plate along its edges, z along the thickness.
- **It must take exactly the plate's corner** (s²T or πs²T/4, to 1e-8) and leave one piece; else `[CORNER_NOT_CLEAR]`. That covers a hole already there, or a size past the plate.
  - A flange on one of the corner's edges trims the corner away, so its edge is gone: refused as SELECTION, no such edge.
- **The sheet's report carries through**, so flanges follow it.
- **The intended order:** reliefs on the plate's corners, then flanges on both edges, full length. Each stops `size` from the corner.
  - With `size` at least the setback (R + T for a square bend), the bends meet nowhere: an open-corner box.
  - A round quarter must cover both bends' corner square, √2 that. At the setback's radius it leaves a sliver of plate held at a point.
- **The flat now names a sliver** cut off in the skin's plane: `[NOT_A_SHEET] … lies in the skin's plane but is cut off from it (held only at a point)`. It had said only "neither on the sheet's skins nor a cut".

**Oracles** (closed forms, as at D118):
- The reliefs alone: plate − 4s²T (square, s 3 and 4.5) and plate − 4·(π/4)s²T (round, s 4.5 and 6), each to 1e-12.
- **The open-corner box:**
  - flat (80 + 2(20 − BD)) × (50 + 2(20 − BD)) to 1e-12;
  - volume (each flange on its edge less 2s, less its trim, plus its section) to 1e-11;
  - the flat's area identity to 1e-11;
  - four bends up, one outline.
- **Refused:**
  - at s 2 (short of the 3 mm setback): `FLANGES_COLLIDE`;
  - round at 3: the sliver's `NOT_A_SHEET`.

**Studio:**
- **Corner relief** (modify): one edge of a sheet body; shape and size, defaulting to the sheet's R + T (the setback of a square bend, derived, not material data).
- **The node** keeps its corner as `edges: [name]`, so the flange's and the fillet's reference machinery serves it.
- Label `Corner relief square 3`, edit field (size), icon, history icon, the agent's command and raw node.
- **The tool contract records it** (`tools-v1.json`, compatible).

**Tests:**
- Kernel `test/r12-3.test.mjs` (+2, and the R12.3a tests with explicit reliefs) and studio `sheet.test.ts` (+1). Both fail on HEAD 8ef9efdf4.
- Conformance `r12/corner-relief-box-square` (volume, flat box and area, four bends, a STEP round trip) and `refuse-corner-not-square`.
- A flow step: a plate from a file, its corner picked by name, Corner relief from the palette (5986.5 mm³), then Flange on each of the corner's edges. Both build; the flat has two bends.

**Not done:**
- Closed corners: the flanges' ends meeting, overlapped or butted (out of R12, D115).
- Reliefs at corners that are not square.
- A flange's own corner treatment: the order today is reliefs first.

**Checks** on 8ef9efdf4 plus this change:

| Check | Result |
|---|---|
| Lint and type-check | Clean (kernel and studio) |
| Kernel | 1220/1225 (4 skipped; only the env-only Split test fails) |
| Conformance | 145/145, with the 2 new cases and the obround one updated |
| Studio | 563/563 |
| Full flow | 175/175, run on its own; the new step included, every outer-lane step passing |

RB rows are in the next commit.

## D120 — R12.4: bend tables in the part (2026-10-20)

R12.4 as D115 froze it: a sheet's K from a table of the shop's rows, each row cited, with typed refusals; plus the sourcing pass D115 deferred here.

**Kernel** (`sheet-metal.ts`, `part-model.ts`, `sheet-flat.ts`):
- **A sheet's K.** Every sheet feature (`sheet-base`, `sheet-contour`) takes **either** `kFactor` **or** `bendTable`: one of them, no default. Neither, or both, is PARAMETER.
- **A bend table:** `{ id, sources?: [{ id, label, url?, read?, note? }], rows }`.
  - A row is: `thicknessMM`, `radiusMM` (inner), `angleDegrees?`, and exactly one of `kFactor`, `allowanceMM` or `deductionMM`. An allowance or a deduction needs its angle; a K row without an angle holds at any angle.
  - Each row cites a `source` id from the table, or says `estimate: true`; never neither.
  - `bendTableProblem` checks all this, plus no (T, R, angle) given twice and each row's K inside the sheet (0–1). Its failure is `[BEND_TABLE]` (PARAMETER).
- **A row's K** (`rowKFactor`): given; from BA, K = (BA/θ − R)/T; from BD, BA = 2·OSSB − BD first.
- **Lookup** (`lookupBend`, a bend's T, inner R and angle):
  - the exact row (one with its angle before one for any angle);
  - else bilinear in R and the angle inside a grid of four rows of its T (two where one value matches);
  - else linear in R between rows for any angle;
  - else `[BEND_TABLE_MISS]` (PARAMETER), saying what is missing. A missing T is said as such.
  - It returns the rows used, `exact` or `interpolated`, and whether any is an estimate.
- **The report:**
  - Each bend now carries its `kFactor` and, from a table, `table` (the rows).
  - Its BA, OSSB and BD use that K.
  - The sheet's report holds `kFactor` or `bendTable`; its `kFactor` is now optional (R12.1's type changed in place, unreleased).
  - A flange looks up its own radius and angle; a bend the table lacks is refused there.
- **The flat:** `flatPattern(brep, { thicknessMM, kFactor | bendTable })`.
  - With a table, it develops twice. First it finds each bend's angle (its pieces' widest turn) and inner radius, which do not depend on K. Then it looks each bend's K up, and develops with them.
  - Each flat bend names its rows. A miss is `BEND_TABLE_MISS`.
  - An output's `flatPattern()` uses the sheet's table, or a `kFactor` given to it.

**Oracles** (each row's value is what the flat must honour):
- An L whose 90° bend takes a row's BD 4.2: flat 50 + 35 − 4.2 to 1e-12, the report's BD 4.2.
- Its 120° bend on a row's BA 7.5: 85 − (2·OSSB − 7.5).
- A K row for any angle at 60° and 150°: outside less BD(K).
- K from BA and from BD by hand to 1e-15.
- **Bilinear at the grid's middle:** the four rows' mean K. **On an exact R:** along the angle only, (¾, ¼). **Linear in R:** 0.33 + ¾·0.09.
- **A flat on the grid** by that K's BD to 1e-12.
- **A plate on a table with two flanges** (R 1.5 at K 0.4; its own R 4 at K 0.46): flat 80 + 20 − BD₁ + 20 − BD₂ to 1e-12. Through STEP with the table given: the same to 1e-9.

**Studio:**
- Sheet nodes take `kFactor` or `bendTable`.
- **"Bend table…"** in a sheet body's panel loads a JSON file, checks it with the kernel's `bendTableProblem`, and sets it on the sheet feature the body starts from (its K removed).
- **The body's notes:**
  - "K from bend table shop-2mm (n rows)";
  - each bend's rows: "K 0.3462 from row 0", or "from rows 0, 1 (interpolated)";
  - "an estimate among them" as a warning.
- No K field in the feature editor then.
- The agent: `bendTable` in its raw sheet nodes (documented).

**Sourcing** (the coordinator's terms: public HTML only, read only, no sign-in, nothing downloaded; URL, date and label per value; values only; no PDF):
- A pass found two sources with per-thickness values; `handover/notes/research-r12-bend-data-2026-10-20.md` has their values, labels and URLs:
  - SendCutSend's bending-calculator page: air bending, 90° rows of K and BD for 5052, mild steel and 304;
  - vedge.org's K table, a copy of Machinery's Handbook.
- Radius guidance came from Fictiv and Protolabs, as ranges only.
- **Neither source's reuse is cleared:** © on SendCutSend, no licence found; vedge copies a copyrighted handbook. The standing rules exclude unclear-licence datasets, so **no table is built in**. The note gives the values for the owner to decide.
- The check of SendCutSend's own rows: BD from its K and R agrees with its BD to about 0.002 in, except 5052 at 0.063 in (0.0995 against 0.096). A table should take one of the two.

**Pending decision (closed in D121: not bundled, the owner, 2026-10-20):** whether SendCutSend's 90° rows may be bundled as a built-in, cited table. Taken: not bundled; the user loads the shop's table. To change: the owner clears the source's terms, and the rows go in as data with their citations.

**Tests:**
- Kernel `test/r12-4.test.mjs` (4) and studio `sheet.test.ts` (+1). Both fail on HEAD f4a7851f6, where there is no `bendTable`.
- Conformance `r12/table-l-bracket-deduction` (the flat 50 + 35 − 4.2) and `refuse-bend-table-miss`.
- A flow step: an L opened from a file, the shop's table loaded from its panel. The notes name the table and row; the flat is 80.8 × 20.

**Not done:**
- A table editor in the studio (the file is edited outside).
- Tables per material from a library.
- A drawing's bend table (the outer lane's R14, from this data).

**Checks** on f4a7851f6 plus this change:

| Check | Result |
|---|---|
| Lint and type-check | Clean (kernel and studio) |
| Kernel | 1226/1259 (4 skipped). The 29 failures are the env-only Split test and the 28 known `a7/` and `a8/` conformance files from the outer lane's merge. Those sit at the runner's top level and are being moved by the outer lane; every one of the 28 is in `a7/` or `a8/`. |
| Conformance | 147 pass, 28 known a7/a8 failures; the 2 new r12 cases pass |
| Studio | 576/576 |
| Full flow | 176/176, run on its own; the new step included, every outer-lane step passing |

RB rows are in the next commit.

## D121 — R12.5: acceptance, RB9 rungs 5 and 10 by the agent (2026-10-20)

**What:** the RB9 ladder's two sheet-metal rungs, each built by the agent's tools in one chat turn on a new part, accepted by closed forms that are not read from the build.
- **Rung 5, an L-bracket** (`test/fixtures/sheet-l-bracket.calls.json`): `run_command sheet-profile` (an L, outside legs 40 and 30, 30 wide, T 1.5, R 1.5, K 0.44), then `add_features` with a Ø5.5 hole through each leg (a circle sketch on the leg's plane, an extrude, a difference).
- **Rung 10, a PCB enclosure** (`test/fixtures/sheet-pcb-enclosure.calls.json`): one `add_features` call:
  - a 100 × 70 sketch and its `sheet-base` (T 1.5, R 1.5, K 0.44);
  - four square corner reliefs of 3 (R + T) on the plate's corner edges, named `n1.side0|n1.side1` …;
  - four 25 mm flanges on the plate's top edges, named `n1.sideK|n1.top`;
  - four Ø3.2 `hole` nodes for standoffs;
  - a 20 × 8 connector slot through the front flange.
- The agent uses only tools that existed before this step; no product code changed in R12.5.

**Oracles** (`apps/cad-studio/test/sheet-acceptance.test.ts`):
- The L-bracket's volume: the middle line 70 − 2(R + T) + (π/2)(R + T/2), times 30 × T, less two holes. Its flat: (70 − BD) × 30, BD = 2(R + T) − (π/2)(R + K·T), to 1e-12; three loops, the two holes as arcs of 2.75; one bend down; the DXF has 2 circles and 1 note.
- The enclosure's volume: the plate less the reliefs; each flange its edge less 2 × 3 long, its trim (R + T) off and its section on; less the holes and the slot. Its flat: (100 + 2(25 − BD)) × (70 + 2(25 − BD)) to 1e-12; six loops; four bends up; the flat's area by the K-factor's identity V/T + (K − ½)·T·Σθw on that volume, to 1e-11; the DXF's layer counts.
- Kernel conformance `r12/accept-l-bracket` and `r12/accept-pcb-enclosure` hold the part documents the agent built, with volume, bodies, topology (genus 2 and 5), the flat (area, loops, bends; the enclosure's box) and a STEP round trip. The studio test checks that the files hold exactly the part the tools build (`WRITE_ACCEPTANCE=1` rewrites them).
- `r12/flat-dxf/pcb-enclosure/`: the enclosure's flat as DXF 2000 and R12. ezdxf 1.4.5 (outside the product) audits both clean and reads 16 outline lines, 4 circles, 4 lines on BEND_UP and 4 notes; `test/r12-2.test.mjs` compares that reading with the flat.
- **A flow step** sends both fixtures' calls through the real chat server with the scripted agent, one turn each on a new part. It then checks the volume against the conformance case (the panel rounds to 1 mm³) and the flat note (30 × 67.393 mm, 1 bend; 144.786 × 114.786 mm, 4 bends). It opens the flat view (1 bend down; 4 up) and exports the DXF (layers, circles, notes).

**Judgement calls:**
- **Evidence level:** the agent here is the scripted one, so this is L2. It shows that the tools build both rungs in one turn, and that what they build is right. It does not show that a live model chooses these calls; that needs a live run, which needs the owner's OK.
- **K 0.44 is the brief's value, not a sourced one.** Both parts run on a K given in the part (the owner's decision below). The flats are right for that K; whether 0.44 suits a material is the shop's.
- **The enclosure is built from raw nodes, not the flange command.** The command takes a picked edge; the agent names edges in `add_features`, which is how it reaches all four at once.
- **Full-length flanges with corner reliefs.** No flange is shortened; each corner relief of R + T clears both bend zones (D119), so the four flanges build without FLANGES_COLLIDE.
- **The vedge.org correction** (the coordinator, after D120) is in this commit: the research note keeps one line that the page was found and rejected, and no numbers from it.

**The owner's decision on bend tables** (D120's pending item, closed; relayed by the coordinator, 2026-10-20): "SendCutSend 굽힘표는 내장하지 말고, 사용자가 자기 공장 표를 불러오게 해." (Don't bundle the SendCutSend bend table; users load their own shop's table.)
- No table is built in. The SendCutSend values stay in `notes/research-r12-bend-data-2026-10-20.md` as a reference only.
- README §0's pending item is closed and the decision is listed under "Owner decisions so far".

**Seen, not fixed (open items):**
- The body's notes list a flange's bend as "bend:": the report names it `n6.bend`, and the notes keep only the last part of the name (`evaluate.ts` `sheetNotes`, right for a contour's `bend1` …). Four flanges show four "bend:" lines that can't be told apart. A one-line studio fix, left for the next step so that R12.5 changes no product code.
- The flat dialog's title lists the box's axes in its own order (30 × 67.393 for the L).

**Tests:** studio `test/sheet-acceptance.test.ts` (2), kernel conformance `r12/accept-l-bracket`, `r12/accept-pcb-enclosure` and the `pcb-enclosure` flat-DXF case in `test/r12-2.test.mjs`; a flow step. They are acceptance tests, not defect fixes: no code changed, so none fails on HEAD e18ecb86a beyond the files being absent. Test names compared with a run at e18ecb86a: none missing, the four new ones added.

**Checks** on e18ecb86a plus this change:

| Check | Result |
|---|---|
| Lint and type-check | Clean (kernel; the studio's type-check and its changed files. `eslint src test` in the studio also reports two older unused variables, in `test/library-tools.test.ts` and `test/tools/cdp-drag.mjs`, untouched here) |
| Kernel | 1228/1233 (4 skipped); only the env-only Split test fails |
| Conformance | 149/149 (the 2 new accept cases included) |
| Studio | 586/586 |
| Full flow | 177/177, run on its own; the new step included |

RB rows are in the next commit.

## D122 — FR S0: feasibility of frames and weldments; two fixes before it (2026-10-20)

**Before S0, two small fixes** (commit `7e3c1dc9e`, the coordinator's list):
- A sheet's notes named each bend by its name's last part, so a PCB enclosure's four flanges all read "bend:". Now a bend reads by its last part when one feature makes all the sheet's bends (a contour's `bend1`, `bend2`; one flange's `bend`), and by its whole name otherwise (`n3.bend`, `n4.bend`: the feature its faces carry when picked). A studio test (fails on `ef2d68963`) and the R12.5 flow step (the enclosure's four bends read apart).
- `eslint src test` in the studio: the two older unused variables fixed (`test/library-tools.test.ts`, `test/tools/cdp-drag.mjs`); 0 errors (119 warnings, as before).

**FR S0.** The roadmap's feasibility checkpoint before FR1–FR4 (§4 "FR — weldments and frames"). There is no research note; this record is the design input. The questions:
- Does today's kernel build a structural member exactly — a profile's section placed square to any 3D segment, with roll?
- Can its ends be mitred, butted, coped and trimmed in order at a joint of three, and against which oracles?
- What can a cut list read from the result: axis length, long-point length, end angles, mass?
- What is kernel work, what is app work, and what belongs to the outer lane?

Evidence: `packages/barocss-cad/test/fr-s0.test.mjs` (kept, 7 tests), against closed forms and quadratures written in the test. No product code changed. The section sizes in it are test values, not catalogue data.

**The model** (definitions only, no data values):
- A *section* is a closed 2D profile with holes; its area A and centroid in closed form. Its *envelope* is the outer loop filled (the tube with its bore closed).
- A *member* is a section placed square to a skeleton segment p0 → p1 (the section's anchor on the segment; the section's x and y by an up reference and a roll about the axis) and extruded. A prism cut by planes holds A × (its centroidal axis between the planes), whatever the planes' tilt, so a member with planar end cuts has V = A·L_c exactly when the section's centroid lies on the segment.
- A *mitre* at a joint p between u1 (into the joint) and u2 (out of it) is the plane through p square to u1 + u2. The end angle from square is θ = acos(u1·m). The cut face's area is A / cos θ; the long point lies (c)·tan θ past the joint, c the section's reach towards the corner's outside (b/2 for a box section in the corner's plane).
- A *butt* ends one member on the other's face; a *cope* subtracts the other member's envelope (a fish mouth for round tubes); an *ordered trim* at a joint of 3+ takes the members in a list, each trimmed to the envelopes of those before it.

**Today, as it stands:**
- **Sections and members are exact, by extrusion** (a sketch on any plane takes `holes`; lines and arcs):
  - a rectangular tube (corners sharp, ro 5, ro 6 with the bore concentric), an angle with root and toe radii, a channel with root radii, along an oblique 3D segment: V = A·L to 1e-12, valid, one body, mass ρ·A·L to 1e-12;
  - roll: the same tube turned 0°, 30°, 90°, 137° about its axis: A·L each; its wide sides square to u × x exactly.
  - `sweep` is not the route (no holes: "one loop … yet"); `sweep-curve` is faceted. Members are extrusions.
- **Mitres by today's `split`** (any normal, both pieces kept):
  - square, open (120°) and 3D joints of round-cornered tubes: θ to 1e-12 from the cut face's plane, the long point L + (b/2)·tan θ to 1e-12 from the B-rep's vertices; the pair's volume to the quadrature's accuracy (below). A pair's split takes 100–140 ms; the analytic union of a round-cornered pair 0.75–0.95 s.
  - The two cut faces coincide: the analytic Boolean unites a pair into one body of exactly the sum (sharp tubes 1e-12, round-cornered at the quadrature's 1e-9).
  - The off-cuts stay outputs: nothing trims and keeps one side.
- **A defect in the planar route** (FR3 fixes it):
  - Two bodies whose faces are all planes go to the exact rational polyhedral Boolean. It needs each face's vertices exactly coplanar, and a member off the axes, or a split's oblique cut, has float vertices only to ~1e-15 off its plane. It refuses: `polyhedral Boolean: face … is not planar`.
  - So today a sharp-cornered tube on a 120° or 3D corner cannot be split, and two mitred sharp tubes on a square corner cannot be united by the part's `union`.
  - The analytic Boolean unites that same pair exactly (155 400 mm³, 1e-15). Round-cornered tubes never meet this (their cylinders send them analytic).
- **Mass on cut round corners is quadrature:** a cylinder face cut obliquely is integrated, not closed form: 1.5–1.6e-9 relative on mitred 40 × 40 × 3 tubes (3e-9 on a frame member cut at both ends). Planar members are exact. So the cut list takes ρ·A·L_c for planar end cuts (exact) and checks the kernel's mass against it; copes have no closed form and take the kernel's quadrature, stated.
- **Trims must be against the envelope:**
  - trimmed to the tube itself, a member keeps stubs inside the other's bore (3 bodies for sharp 40 × 40 × 3);
  - to the envelope, one body: an ordered trim of three sharp tubes at a corner (X through, Y to X, Z to X then Y) gives A(L + b/2), A(L − b/2), A(L − b/2) to 1e-12, and the three united weigh their sum (no overlap);
  - a butt to a plane (`split` on the side face) gives the same A(L − b/2).
- **Round corners make a body trim differ from a plane's butt:** trimmed to a round-cornered envelope, the member reaches into its rounds: 2·∫[w_o(s) − w_i(s)](6 − √(36 − s²)) ds more (486.004 mm³ on a 40 × 40 × 3 tube with ro 6) by a Gauss–Legendre quadrature; the kernel agrees to 1.1e-10. FR3 offers both, named; the cut list reports the length each gives.
- **A fish-mouth cope works:** a Ø25 × 2 tube onto a Ø50 × 2 one, square: the removed volume by a 1D quadrature of the two cylinders' overlap (∫ 2r²cos²t √(R² − r²sin²t) dt; 3411.69 mm³) and the kernel's volume agree to 8.7e-11; valid, one body, 80 ms; welded on, the pair weighs its sum. At 60° it also closes (the pair weighs its sum; no closed form).
- **A rectangular frame of four mitred round-cornered tubes** (600 × 400, 40 × 40 × 3): long points L + b to 1e-12, masses to the quadrature (3e-9), grouped two and two, the frame's mass the sum; 0.7 s.
- **Missing:**
  - a 3D skeleton: the studio's sketches are 2D; the nearest is `doc.direct`'s free NURBS curves ("Edge as a curve"); the kernel has no 3D sketch;
  - a section type in the kernel (sections are plain sketches) and in the library (LIB parts are 3D recipes only; the tslot-20 part is a box with slots subtracted in 3D, its slot sizes estimates, no URL record);
  - any structural profile data: none in the repo;
  - a member/weldment feature, its report, corner treatments, a trim keeping one side, a cut list;
  - a drawing table: drawings have dimensions, datums, frames and notes, no table (the outer lane's branch has none either). The studio's BOM (`src/team/assembly.ts` `deriveBom`) groups identical parts, close to the cut list's grouping;
  - material densities: every one is an estimate (`S-DENS`), so a cut list's mass is flagged an estimate unless the user's material says otherwise.

**Kernel versus app:**
- **Kernel:** section kinds (closed-form A and centroid, envelope, side names, anchors); the frame feature (members from a skeleton, one output per member); corner treatments and trims; the planar-route fix; the frame report; the cut list (data); typed refusals.
- **App (studio):** a 3D skeleton node (points and segments in space), commands and HUDs for frames and corners, a cut-list panel and CSV, the agent's tools, flow steps.
- **The outer lane:** a table entity on drawing sheets (FR4b needs one; R14's bend table would use the same). Asked of the coordinator at FR4b, before touching drawing files.

**Verdict — FR in six stages, this order:**
- **FR1 — sections and a straight member.**
  - **Section kinds** in the part model: `rect-tube` (b, h, t, outer corner ro; inner ri = ro − t by default, or given), `round-tube` (d, t), `angle` (a, b, t, root r1, toe r2), `channel` (h, b, tw, tf, root r; parallel flanges), `tslot` (the tslot-20 part's parameters, its section as one loop with the slots and the bore a hole), and `sketch` (any closed sketch, holes allowed). Each with A and centroid in closed form, the envelope, side names (`outer.top`, `bore.left`, `slot1.*` …) and anchors (centroid and the box's nine points).
  - **A straight member** (`frame-member`: one segment, the section, anchor, roll, up reference), so FR1 is visible and testable in the studio.
  - **Oracles:** V = A·L to 1e-12 for each kind on oblique segments; the centroid against the kernel's mass centroid; the T-slot section's A·L against the library part's own 3D volume at the same L (two independent constructions).
  - **Refusals:** `SECTION_DIMENSIONS` (t ≥ b/2, a radius that does not fit, ro in (0, t) with a concentric bore, a toe past the thickness …), `SEGMENT_ZERO_LENGTH`.
  - **Studio:** the member command and node, the section's fields; the agent's raw node; a flow step.
- **FR2 — members along a 3D skeleton, alignment and roll.**
  - **The skeleton:** a studio node of points and segments in space (typed points, snaps to existing points and vertices), passed to the kernel as data.
  - **The `frame` feature:** one member per segment, one output each (`<id>/<k>`, never united); per member section (default the frame's), anchor, offsets, roll, mirror. The up rule: the section's y along the up reference (default world Z) projected square to the member; a member within 1e-9 of parallel to it takes world X instead, and the report says so.
  - **The frame report:** each member's segment, axis, section frame, anchor, section and length.
  - **Oracles:** A·L each; section frames by dot products to 1e-12; roll by the angle between x axes; members of a closed skeleton meeting at their joints' points.
  - **Refusals:** `SEGMENT_ZERO_LENGTH`, `SKELETON_OVERLAP` (collinear segments sharing length), `MEMBER_DUPLICATE`.
  - **Studio:** the skeleton editor (points, segments), the Frame command, the agent's tools; a flow step.
- **FR3a — two-member corners, and the planar-route fix.**
  - **First, the defect:** planar bodies whose faces are coplanar only to float precision go to the analytic Boolean when the polyhedral one finds a face "not planar" (or its vertices are snapped onto their face's plane first; the step decides by test). A test failing on HEAD: the sharp tube's split on the 120° and 3D corners and the square pair's union (the probe's assertions flip).
  - **Corners** at a skeleton point with two members: `mitre` (the default when both have the same section, mirrored in the mitre plane), `butt` (`through`: which member runs on; the other ends on its face plane or its envelope, named), `none`; a per-corner override list keyed by the skeleton point; each member's ends trimmed keeping the piece on its own segment.
  - **Oracles:** V = A·L_c (planar 1e-12; round corners at the kernel's quadrature, about 1e-9, stated); θ = acos(u1·m) to 1e-12; long point L + c·tan θ to 1e-12; the pair united weighs its sum (no overlap).
  - **Refusals:** `MITRE_SECTIONS_DIFFER` (offer a butt), `CORNER_ANGLE` (members in line or folded back), `CORNER_NOT_A_JOINT`.
  - **Studio:** corner HUD and override; a flow step.
- **FR3b — joints of three or more, copes, trims to a plane or a body.**
  - **An ordered trim:** the members at a joint in a list; the first runs through, each next trimmed to the envelopes of all before it.
  - **A cope:** the member less the other's envelope (round tubes: a fish mouth).
  - **A trim to a plane or a body:** a member's end to a named plane or another body.
  - Always against the envelope (the probe's bore stubs); the piece kept is the one holding the member's segment; anything else refused.
  - **Oracles:** sharp sections by closed forms A(L ± b/2); round-cornered envelopes by the corner quadrature (1e-9); a round cope by the two-cylinder quadrature; all members united weigh their sum.
  - **Refusals:** `TRIM_EMPTY`, `TRIM_LEAVES_PIECES`, `MEMBERS_CLASH` (after treatment two members still overlap; the pair named).
  - **Studio:** joint order editor, cope and trim commands; a flow step.
- **FR4a — the cut list.**
  - **Kernel `cutList()`** on the frame's outputs: per member the section label, material, length on the axis (L_c), long-point length (the B-rep's extent along the axis), end cuts (kind square / mitre / butt / cope / trim; for planar ends the mitre angle about the section's y and the bevel about its x), mass (ρ·A·L_c for planar ends; the kernel's quadrature for copes, stated), quantity.
  - **Grouping:** identical members on one row — the same section, material, lengths to 1e-6 mm and end cuts as an unordered pair (a handed section's mirror kept apart). Totals: count, length, mass.
  - **Oracles:** the closed forms above; Σ quantity = members; Σ mass = ρ·A·ΣL_c; grouping by hand.
  - **Studio:** a cut-list panel, CSV export, the agent's `cut_list` tool; a flow step.
- **FR4b — the drawing table and acceptance.**
  - The cut list on a drawing sheet as a table, and in its DXF through `writeDxf`. It needs a table entity in drawings (the outer lane's area): the coordinator decides who adds it.
  - **Decided at review (the coordinator):** the outer lane adds a generic drawing table (O49: `doc.drawing.tables`, sources in `src/drawing/tables.ts`), shared with R14's bend table. FR4b writes a pure function from `cutList()`'s data to its `TableContent`, registered as `cut-list` by the outer lane through the coordinator. If the table is not there when FR4b starts, stop and tell the coordinator.
  - **Acceptance:** two frames built by the agent's tools in one chat turn each: a welded table frame (top rectangle mitred, four legs butted or ordered-trimmed, a lower rail), and a 2020-class T-slot frame (members cut square, no welds). Their cut lists against closed forms; conformance `fr/accept-*`; RB rows; the FR → R12b hand-over.

**Every stage:** a D-record, tests failing on the previous HEAD where a defect is fixed, `conformance/fr/` fixtures (subfolders for non-kernel fixtures), a flow step, RB rows, a checkpoint.

**Data and defaults:**
- **No section sizes are built in.** Sections are parametric; their dimensions are the user's. A catalogue of sizes is data the user loads (rows of named sizes, each citing a source or flagged `estimate`), as with bend tables (D121).
  - **Decided (the owner, 2026-10-20, relayed by the coordinator):** "프레임 단면 치수도 굽힘표처럼 내장하지 말고 사용자가 불러오게 해." (Like the bend tables, don't build in frame section sizes; users load them.) No catalogue is built in, and no supplier-page research for one. The studio's prefills stay estimate-flagged; the tslot-20 slot sizes stay estimates.
- **No hidden kernel defaults:** corner radii, root and toe radii are given. The studio's prefill (rectangular tube ro = 2t, angle r1 = t, r2 = t/2, channel r = tf) is a reversible default, flagged an estimate wherever shown.
- **T-slot:** the tslot-20 part's slot sizes are already estimates without a URL record; its section inherits the flags.
- **Mass:** densities are the materials library's (all estimates, `S-DENS`); a cut list says so unless the material is the user's.

**Not in FR1–FR4** (FR5–FR6 and beyond, listed for the owner to place):
- T-slot hardware (FR5); gussets, end caps, weld beads, weld metadata and symbols, stock nesting (FR6);
- tapered-flange channels and beams (I/H), bent or curved members (members along arcs);
- end gaps for welds, notches for tube-to-tube saddles other than a full cope;
- a 3D sketch with constraints (the skeleton is points and segments, typed or snapped).

**Checks:** S0 changed no product code. The two fixes before it: studio 603/603 (+1, the new test; names compared with the test files at `ef2d68963`: none missing), studio lint 0 errors and type-check clean, the full flow 177/177 run on its own. Kernel 1234/1240 (4 skipped; +7, the fr-s0 tests; 1240 = 1233 + 7, so none missing): the env-only "actual native Split source…" fails, and `B9 performance` (mass-polyhedral's wall-clock budget, a known load-sensitive item in the open TODOs) failed once in the full parallel run at 170 ms and passes 3/3 alone — a known flake under parallel load (the coordinator, at review); its budget is left as it is. fr-s0 7/7, 12.5 s alone (most of it the four round-cornered welds through the feature, about 1 s each). Lint clean on the new file. Conformance, RB: not rerun, as at D115 (no kernel source change).

## D123 — FR1: structural sections and a straight member (2026-10-20)

The first FR stage frozen in D122: section kinds in the kernel, and one straight member so the stage is visible and testable in the studio.

**Kernel** (`frame-section.ts`, the `frame-member` feature in `part-model.ts`):
- **Section kinds**, every dimension given — no size, radius or slot value is defaulted (D122):
  - `rect-tube`: width, height, wall, `outerRadius` (0: sharp), `innerRadius` (by default concentric, ro − t; a ro in (0, t) has no concentric bore, so its ri must be given). **The ro − t default is a derived geometric rule** — the bore's corners concentric with the outer ones, the wall t all round — not a material or catalogue value, so it belongs in the kernel (the coordinator, at FR1's review). It is never hidden: the report's `derived` says `{ innerRadius: 'concentric: ro − t' }` (`'sharp: 0, as the outer corners'` for ro 0), and the label reads `ro 6, ri 3 (concentric)`. A given ri derives nothing (commit after `2f066cb5e`, a test failing on it, the conformance case's `derived`);
  - `round-tube`: diameter, wall;
  - `angle`: `legX`, `legY`, thickness, `rootRadius`, `toeRadius`; the heel at the origin;
  - `channel` (parallel flanges): height, width, web, flange, `rootRadius`; its back on x 0, its bottom on y 0;
  - `tslot`: the tslot-20 library part's shape as one loop — `size`, `cells` 1 or 2, `openSlots` (one cell: 0–4 clockwise from the top, as the library opens them; given, not defaulted), `opening`, `lip`, `undercut` (45° back to the opening), `depth`, a core `bore` per cell;
  - `sketch`: a closed sketch's loops in its own XY (holes allowed; its area and centroid by the prism's exact mass).
- **Each kind's closed forms**: area; centroid by moments (legs and webs as rectangles, the root's quarter-disk spandrel added and the toes' taken off, a spandrel's centroid r(10 − 3π)/(3(4 − π)) from its corner; a slot's opening and two 45° wings); box.
- **Faces by role**: `top`, `round.tr`, `bore.left` (tubes); `outside`, `bore` (round); `back.x`, `face.y`, `root`, `toe.x`, `end.y` (angle); `web`, `inside.top`, `root.bottom`, `tip.top` (channel); `top.0`, `t1.floor`, `r.taper0`, `core0` (T-slot); a sketch's by its sides. The ends are `<id>.start` and `<id>.end`. `prismaticFromProfile` takes whole names for holes now (its `names.outer` optional).
- **Placement**: the `anchor` (default `centroid`; also `origin` and the box's nine points) lies on the line `start` → `end`; the section then moves by `offset` in its own XY. Its y runs along `up` (default +Z) made square to the line, x = y × u, both turned `roll` degrees (quarter turns exact). A line along `up` takes +X (or +Y), and the report says so (`upFallback`).
- **The output's `member` report**: kind and description, area, centroid, anchor, offset, roll, the line, its length, the section's x, y and the axis, and the centroidal line (where A·L is measured; FR4's cut list reads it).
- **Mass is closed form**: the member is a prism moved by an affine map, so even an oblique member's mass is the prism's exact one (`method: 'closed-form'`).
- **Refused by name**: `[SECTION_DIMENSIONS]` (a wall leaving no bore, a radius leaving no flat side or past the thickness, legs too short for root and toe, a slot reaching the bore or its neighbours, an undercut no wider than the opening, a slot with no straight part), `[SEGMENT_ZERO_LENGTH]`. An unknown kind, a bad anchor, a T-slot of one cell without `openSlots`: INPUT.

**Oracles** (`test/fr-1.test.mjs`, 5 tests; none of them the module's):
- Each kind on an oblique 3D line: V = A·L to 1e-12 against the textbook area written in the test; the report's area to 1e-12.
- The centroid by Green's theorem over the section's loop, lines and arcs integrated in closed form in the test (one 1-form per moment for every segment), to 1e-12; anchored at the centroid, the body's centre of mass is the line's midpoint to 1e-12.
- **The T-slot section against the tslot-20 library part**, built by its own 3D Booleans (a box less slot prisms and bores): the same volume to 1e-12 at 250 mm, for 20 × 20 with 1–4 slots and for 20 × 40. Two independent constructions agree.
- Placement by the B-rep's box: top-right on the line, bottom-left moved (5, −2), roll 90° (exact), roll 30° (the wide sides' normals ±y to 1e-15), a vertical line's fallback; the angle's centroidal line by Green's centroid.
- Faces by role; a sketch section with a hole; dimensions by parameter and `withParameters`.
- Refusals: 15 cases.

**Conformance** `conformance/fr/` (8 cases; expectations by closed form in the generator `scripts/fr1-conformance.mjs`, not by the kernel): a round-cornered rectangular tube on an oblique line (area (Po + Pi)·L + 2A), an angle anchored at its heel, a channel rolled 90°, a vertical round tube (the fallback), a 20 × 40 T-slot (genus 2), a sketch section; two refusals. Each with a STEP round trip at 1e-9. The runner checks a new `member` expectation (area, length, centroid, axes, fallback).
- Their volumes are held to 1e-9, as the other exact cases (D116). RB's B-rep quadrature (an implementation's other route) measures 1.7e-12 on the angle and 1.2e-12 on the tube. The first RB run flagged both at the generator's first 1e-12 (fixed in the commit after FR1's). The unit tests keep 1e-12 on the prismatic route.

**Studio**:
- The node `frame-member` (section kinds, or a sketch by its node; `estimates`: the section's fields still at a first-try value). Saved and read back; the agent's `add_features` spec checks each kind's fields (every dimension required, no unknown field).
- **"Structural member"** in the palette: a section kind and its sizes, start and end points, the anchor, the roll. Its prefills are a first try: the radii (rect-tube ro 6, angle r1 6 and r2 3, channel r 6) and the T-slot's slot sizes (the tslot-20 library's, themselves estimates) are labelled estimates and written to `estimates`. The body's panel flags them ("Estimates, not your stock's: …"), and editing one in the feature editor drops its flag.
- The body's panel: the section, its area and length, the line's anchor and the section's x and y (and the fallback).
- The feature editor: the section's dimensions, the length along the line, the roll.
- Labels `Member RHS 40×40×3 · 300 mm`, `Member T-slot 20×40 · 300 mm`; an icon.
- The tool contract records the new command (`UPDATE_TOOL_CONTRACT=1`, a compatible change).
- Studio tests `test/frame.test.ts` (2).
- A flow step: the palette's tube and a 20 × 40 T-slot, A·L each, the panel's notes and estimates (`fr1-members`).

**Judgement calls**:
- `offset` moves the section, so with bottom-left and (5, −2) the box's corner is at (5, −2) from the line. The first build had it the other way round; the placement test caught it before commit.
- The vertical fallback takes +X as the section's y, so x = y × u = −Y. It is stated in the record and the report.
- `estimates` lives on the node (the studio's, not the kernel's). It is the K 0.5 pattern of D116, made explicit, so an edited value never stays flagged.
- A member is never united with another. Each is its own output, as FR2's frame will make them.

**Not in FR1** (as D122): the skeleton and many members (FR2), corners and trims (FR3), the cut list (FR4).

**Checks** on 89346cd24 plus this change:

| Check | Result |
|---|---|
| Lint and type-check | Clean (kernel; studio type-check; `eslint src test` 0 errors, 119 warnings as before) |
| Kernel | 1248/1253 (4 skipped; +13: 5 fr-1 tests and 8 conformance cases); only the env-only "actual native Split source…" fails |
| Conformance | 157/157 |
| Studio | 609/609 (+2 of FR1, +4 from the merged RM8 step; test names compared, none missing) |
| Full flow | 178/178, run on its own; the new step included |
| RB | 299 cases (+8: the fr cases), 0 new, the 8 known TODOs (after the fix commit `ed76a9921`) |
| Properties | 11/11, no failures |

RB rows are in the commit after the fix.

## D124 — FR2: frames on a skeleton, alignment and roll (2026-10-20)

The second FR stage frozen in D122: many members along a skeleton's segments, each its own body, sharing a section and its placement unless set apart.

**Kernel** (the `frame` feature in `part-model.ts`):
- **The skeleton is data on the feature**: `points` (2–1024 [x, y, z], parameters allowed) and `segments` (1–256 pairs of point indices, from → to). A member runs along each segment, each as FR1's `frame-member` (D123), and is its own body (`<id>/<k>` for segment k, a plain `<id>` for one), never united.
- **Shared placement**: the frame's `section`, `anchor`, `offset`, `roll` and `mirror` hold for every member; `up` for all.
- **`overrides`** sets one member apart (its own section, anchor, offset, roll or mirror; what it leaves out stays the frame's). A member named twice, or past the segments, is INPUT.
- **`mirror`** turns the section over across its own y axis (x ↦ −x: lines' starts, arcs' centres and their direction). The face names keep their roles, the area stays, and the centroid and the box turn with it. The report says `mirrored` and the label `…, mirrored`.
- **Faces**: `<id>.m<k>.<role>` and `<id>.m<k>.start` / `.end`. Each member's faces are its own, so FR3's trims can name another member's face.
- **The member report** gains `frame: { member, from, to }`. The frame's report is its members' reports.
- **Refused by name**:
  - `[SEGMENT_ZERO_LENGTH]`: a point used twice, or two points together within 1e-6 mm;
  - `[MEMBER_DUPLICATE]`: two segments on the same two points, either way round (by position, not index);
  - `[SKELETON_OVERLAP]`: two segments on one line sharing more than 1e-6 mm, where a member would run through another;
  - the sections' `[SECTION_DIMENSIONS]`.
  - Two collinear segments that only touch end to end are allowed (a straight run of two members).
- The section and placement code of FR1 is shared, not copied: `memberShape`, `memberLook`, `memberUp` and `buildMember` serve both features, and the skeleton's pair test is hoisted (no closures in its loop).

**Oracles** (`test/fr-2.test.mjs`, 5 tests, closed forms written there):
- **A 600 × 400 × 700 box frame of 12 round-cornered tubes**:
  - one body each, `f/0 … f/11`;
  - A·L each to 1e-12, and the frame's total;
  - each centroidal line on its segment's points to 1e-12 (anchored at the centroid);
  - the frames orthonormal, right-handed and square to their lines to 1e-15;
  - the legs' y from the fallback (+X), the rails' along +Z;
  - 12 members in well under 3 s.
- **Overrides**: legs as a sharp 50 × 50 × 4 tube rolled 45° (their A·L, x turned 45° exactly), and a rail anchored on its top face (its centroid 20 below the line); the rest keep the frame's.
- **Mirror**: two angle stiles, the second mirrored. The same A·L, the centroid's x̄ negated in its frame (1e-15), the B-rep's box on the other side, the role names kept.
- **An oblique tetrahedron of round tubes**: A·L each, y square to each line; a point by parameter moves with `withParameters`.
- **Refusals**: 10 cases.
- **Conformance** `conformance/fr/` (+4; generator `scripts/fr2-conformance.mjs`, closed forms only):
  - the 12-member box (each member's volume, centroid at its edge's midpoint, axes by the up rule, the derived bore radius);
  - the two mirrored angle stiles (centroids by moments, x̄ negated);
  - `refuse-skeleton-overlap` and `refuse-member-duplicate`.

**Studio**:
- **The node** `frame`: points, segments, section, placement, overrides, `estimates` as a member's.
  - Its bodies are its members: side `part<k>` (one segment: `solid`), named `Frame RHS 40×40×3 · 8 members · member 3`.
  - Saved and read back. (A sketch section's index is shifted when a part is flattened into an assembly, as `frame-member`'s; not exercised by a test yet.)
- **"Frame" in the palette**: a preset skeleton sized by width, depth and height from a corner, or the straight edges picked on bodies.
  - The presets: a table (top and legs, 8 members), a box (12), a rectangle (4).
  - The picked edges: a layout box or sketch's edges, their ends shared within 1e-6 mm, so a layout box's 12 edges give 8 points.
  - This is the stage's skeleton editor: typed points (the presets, the editor's point fields) and points snapped to vertices (the picked edges). A free 3D point-and-segment drawing tool in the viewport is not in FR2 (below).
- **The body's panel**: "Frame member 6 of 8: point 6 → point 7" above the member's section and frame notes. A member with its own section (an override) shows no prefill estimates.
- **The feature editor**: the frame's section dimensions (an edited one drops its estimate flag), the roll, and every point's X, Y and Z (moving the top's points lengthens the legs).
- **The agent**:
  - `add_features` checks the points (2–1024), the segments (1–256 index pairs) and each override's fields;
  - the kernel's refusals come back by name;
  - `run_command frame` documents every HUD key.
  - The tool contract records the command (`UPDATE_TOOL_CONTRACT=1`).
- An icon.
- **Studio tests** `test/frame.test.ts` (+3): the table preset (8 bodies, A·L, names, notes, the editor's points), a frame on a box's 12 picked edges (8 shared points, 12 members, saved), and the agent's frame with a mirrored override and its refusals.
- **A flow step** (`fr2-table-frame`): the palette's table frame, 8 bodies, the leg's volume, its notes and its name. The corners overlap there: FR3 trims them.

**Judgement calls**:
- **The skeleton lives on the frame** (kernel and studio), not in a separate skeleton feature. One frame has one skeleton, and overrides give its members different sections. FR3's corners are the frame's own points.
  - A skeleton shared by several frames would need a skeleton node that is not a body. The studio treats every non-sketch node as a body, so that change reaches further than FR2 needs.
- **The skeleton editor** is the presets, the picked edges (snapped to vertices) and typed point coordinates.
  - Drawing new points and segments in the viewport, as a 3D sketch with snapping, is not in FR2. The agent and the file can write any skeleton.
  - Listed below for the owner.
- **Duplicate and overlap are tested by position**, so two points at one place are the same point for these refusals.

**Not in FR2** (the owner may place them):
- a 3D-sketch tool in the viewport (draw points and segments with snapping; constraints);
- skeletons shared by several frames;
- members along arcs.
- Corners and trims are FR3; the cut list is FR4.

**Checks** on b19ad3445 + 2f066cb5e + 8688b7111 (the innerRadius commit) plus this change:

| Check | Result |
|---|---|
| Lint and type-check | Clean (kernel; studio `eslint src test` 0 errors, 119 warnings as before; studio type-check) |
| Kernel | 1258/1263 (4 skipped; +10: the derived-bore test, 5 fr-2 tests, 4 conformance cases; names compared, none missing); only the env-only "actual native Split source…" fails |
| Conformance | 161/161 |
| Studio | 623/623 (+3 of FR2, +11 from the merged RD9/RD10/O49–O50; names compared, none missing) |
| Full flow | 180/180, run on its own; the new step included |
| RB | 303 cases (+4: the fr frame cases), 0 new, the 8 known TODOs |
| Properties | 11/11, no failures |

RB rows are in the next commit.

## D125 — FR3a: two-member corners, and the planar Boolean's fix (2026-10-20)

The third FR stage frozen in D122: first the defect S0 found, then the corners where two members of a frame end at one point.

**The planar route's fix** (`part-model.ts` `planarBoolean`):
- Two bodies of planes only went to the exact rational polyhedral Boolean. It needs each face's vertices exactly coplanar; a member off the axes, or a split's slanted cut, has them so to binary64 (~1e-15), and it refused the face ("not planar", D122).
- Now that refusal, and only that one, hands the pair to the analytic Boolean, which works on the planes in binary64. Both callers take it: the general `boolean()` dispatch and the planar chamfer's wedge.
- A test failing on the previous HEAD (`e85509dbf`, with the kernel rebuilt from its sources): a sharp tube on a 120° corner split and two mitred sharp tubes united by the part's own features (it failed with "face … is not planar"); now one body, 1e-12.
- The S0 probe's two assertions of the refusal are turned to its fixed behaviour (the sharp cases at 120° and 3D split and weld exactly).
- **The outer lane's report** (a facet mesh subtracted from a curved B-rep: slow, "not a manifold", F3): not touched. That pair has a curved body, so it never reaches the planar branch; the fallback runs only where the polyhedral route refused a face as not planar.

**Corners** (the `frame` feature's `corners`):
- `corners: { default?, at? }`:
  - `default` (mitre when left out) finishes every place where exactly two members end;
  - `at: [{ point, kind, through? }]` sets a point apart;
  - `corners` left out finishes nothing, so a saved FR2 frame builds as it did.
- **Joints are places**: points within 1e-6 mm are one point.
- **A place where three or more members end** (a table's top corners) is left square and reported so; the ordered trim is FR3b. A point set apart there is refused.
- **Mitre**: both members are cut on the plane through the point square to u1 + u2 (u1 into the point, u2 out). Each is run on past the point far enough to fill it (its section's reach × (tan θ + 1) + 1) before the cut.
  - The cut faces are `<id>.m<k>.start.mitre` / `.end.mitre`.
  - It is refused unless the second section is the first reflected in that plane (their vertices, lines' starts and arcs' centres, compared to 1e-9 of the size): `MITRE_SECTIONS_DIFFER`. That covers different sections and the same section turned differently. A 60 × 30 tube up a leg and along a rail meets face to face (the box is symmetric); rolled a quarter turn, it does not.
- **Butt**: one member runs through: the `through` given, else the larger section, else the lower index.
  - It runs on, square, far enough to cover the other's section there: the farthest of the other's box corners along it, (b/2)·sin φ for square tubes at an angle φ.
  - The other is run on into it and cut on the plane of the through member's section box facing it (`.end.butt`). That side must be a face of the box (the approach square to a section axis): else `BUTT_NOT_ON_A_FACE` (a member rolled 30° offers an edge).
  - Trimming to the through member's envelope, and to any plane or body, is FR3b.
- **Members in line** (in-line ends at a point) or **folded back**: `CORNER_ANGLE`.
- A cut leaving a member in pieces: `TRIM_LEAVES_PIECES` (a guard; none of the tests reaches it).
- **The member report's `ends`**: each end's kind (square, mitre, butt, through), its point, the other member, the cut's angle from square, the cut plane, or how far a through member runs on. The cut list (FR4) reads them.
- **Placement and building are split** (`placeMember`, `buildMember` with its runs-on and cuts), so corners plan from every member's frame before any is built. The tool ids for the half-spaces take no dots (the analytic Boolean refuses them).

**Oracles** (`test/fr-3a.test.mjs`, 6 tests; closed forms written there):
- **The planar route** (above).
- **A mitred 600 × 400 rectangle of sharp tubes**:
  - each A·L to 1e-12 (a prism cut by planes through the centroidal line's ends);
  - the long points L + b from the B-rep;
  - both ends' angles 45°, the cut faces by name at 45° to the line;
  - the four welded (the analytic Boolean): one body, their sum to 1e-12, so they meet face to face with no overlap or gap.
- **Round-cornered tubes at 120° and at a 3D corner** (up = the corner plane's normal):
  - A·L to 1e-8 (the kernel's quadrature on cut cylinders, as S0 measured);
  - θ = acos(u1·m) to 1e-12, the long point L + (b/2)·tan θ to 1e-12;
  - the pair welded: one body, their sum.
- **Butts square and at 60°**: the through member A(L + (b/2)·sin φ), the other A(L − (b/2)/sin φ), each to 1e-12; the butt's angle 90° − φ; welded, one body and their sum. By default a 50 × 50 leg runs through under a 40 × 40 rail (A(700 + 20), A(600 − 25)).
- **Corners left alone**:
  - no `corners` gives A·L and no ends;
  - a table mitred by default leaves its three-member corners square and says so;
  - a rectangle with one butt (member 1 through), one `none`, the rest mitred: each end's kind as set, A(600 − 20) and A(400 + 20).
- **Refusals** by name (8 cases), and a two-section corner that is refused as a mitre but builds as a butt.
- **Conformance** `conformance/fr/` (+4; generator `scripts/fr3a-conformance.mjs`, closed forms only):
  - the mitred rectangle: each member's volume, and its centroid moved outwards by 2I/(L·A), since the section at y runs from y to L − y;
  - the 60° butt: the cut prism's centroid s̄ = (A c0² + cot²φ·I)/(2V), ξ̄ = cot φ·I/V;
  - `refuse-mitre-sections-differ`;
  - `refuse-corner-not-a-joint`.
  - The runner checks a member's `ends` (end, kind, point, angle).

**Studio**:
- **The frame node** gains `corners`. "Frame" in the palette has **Corners (two members)**: Mitre (the default for a new frame), Butt or None (overlap).
- **The feature editor**:
  - the frame's corners;
  - a **Corner at point k** for each point where two members end: as the frame, mitre, butt with either member through, none (`corners.at`; "as the frame" removes the entry).
- **The body's panel**:
  - "Ends: start mitre 45° with member 4; end mitre 45° with member 2";
  - a through member's run-on;
  - a butt's angle;
  - a warning on an end left square where three or more members meet ("an ordered trim comes with FR3b").
- **The agent**: `corners` in `add_features` is checked (kinds, the at-list's fields); the kernel's refusals come back by name; `run_command frame` documents `corners`.
- **The flatten test the coordinator asked for**: a frame on a sketch section (a plate with a hole), butted, as an assembly instance. Flattened, its section is the sketch's new index (2, after the base part's two nodes). Its members' volumes are by closed form, A(300 + x̄) and A(170 + x̄), with x̄ the section's centroid. Their faces are the frame's (`.m0.start`, `.m1.start.butt`, `.m1.hole0.side0`).
- Studio tests `test/frame.test.ts` (+2): the palette's mitred rectangle, a table's warnings, the editor's corner fields, and the flatten and agent test.
- A flow step (`fr3a-mitred-rectangle`): the palette's rectangle of sharp tubes, mitred, A·L and the ends in the notes.

**Judgement calls**:
- **The fallback is narrow**: only the polyhedral route's "not planar" refusal goes to the analytic Boolean. Exact rational planar Booleans keep their route where they work.
- **A mitre needs the sections to meet face to face, checked by geometry**, so a symmetric section turned by its symmetry is accepted, and anything else is refused rather than left with a gap.
- **A butt ends on the through member's section box**, so for an open section (an angle) that is the box's side, not necessarily material. Trimming to the member's actual envelope or any body is FR3b.
- **Corners are off unless asked**: `corners` absent keeps FR2 frames as they were (no silent change to saved documents). The studio writes `{ default: 'mitre' }` for new frames.

**Not in FR3a** (FR3b next): ordered trims at joints of three or more, copes, trims to the envelope, to a plane or to a body, and T-joints (a member ending on another's middle).

**Checks** on e85509dbf plus this change:

| Check | Result |
|---|---|
| Lint and type-check | Clean (kernel; studio `eslint src test` 0 errors, 119 warnings as before; studio type-check) |
| Kernel | 1268/1273 (4 skipped; +10: 6 fr-3a tests, 4 conformance cases; names compared, none missing); only the env-only "actual native Split source…" fails |
| Conformance | 165/165 |
| Studio | 628/628 (+2 of FR3a; names compared, none missing) |
| Full flow | 182/182, run on its own; the new step included |
| RB | 307 cases (+4: the fr corner cases), 0 new, the 8 known TODOs (totals as before: 4 refused, 3 invalid, 5 wrong) |
| Properties | 11/11, no failures |

RB rows are in the next commit.
