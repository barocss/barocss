---
work_id: physics-world-p5b-admission-review-2276
artifact_type: source-only-public-admission-review
status: READY_PUBLIC_ADMISSION_NOT_RUN
owner_role: independent-physics-geometry-review
source_request: preserve original cloth/fluid/static-CAD laws before public World allocation
last_updated: 2026-11-02
---

# Result and proof boundary

Public P5 admission is NOT_RUN. Current `model-admission.ts:47,55,103` still
admits rigid profiles only, refuses nonempty cloth/fluid arrays and requires a
dynamic rigid body. The new domain initializers are private trusted-input
stages; they are not a public validator. Inspecting them establishes required
checks, not a public defect in an already-admitted profile.

`evidence/kernel-source-01/summary.json` and `kernel-emitted-01/summary.json`
both report `PASS_P5A_CLOCK_FREE_CANDIDATE_EXTRACTION`:4 initializations,
32 prepare attempts,20 returns,12 injected throws,8 nominal and12 recovery
outputs per graph. Both have0 World/recording calls. Their comparison boundary
is captured two-step parity and candidate ownership. This does not qualify
public admission, a longer horizon, active shelf response, P2 or P6.
Captured diagnostic JSON can have erased historical -0; keep that diagnostic
sign authority UNKNOWN rather than inventing an old binary diagnostic proof.

Source review base:89d208b127c7c42a16b398c5641dcbf588d4a31b on
`codex/physics-world-p5-2276`. This review makes no code change or runtime call.
V1/v2/v3 cache numerical results and COST_NO_GO remain separate and unchanged.

# Required preflight order

Admission may allocate bounded inert validation scratch. Complete public
validation before `initializeCloth`, `initializeFluid`, owned position/velocity
buffers, rest-density/diagnostic work, solver/grid construction or accepted
World state. Do not use private initialization failure as public preflight.

1. Keep P0 `copyData` at the boundary (`identity.ts:5–35`): ordinary dense arrays,
   exact plain data records, finite numbers, no symbols/accessors/custom
   prototypes/typed-array input or sparse elements. Do not invoke getters.
   Preserve existing depth/count bounds and binary64 values. Unknown/missing
   fields must give the canonical INVALID_CONFIG error before dependent reads.
2. Keep exact model/header/options/frame/unit fields and P0 metadata semantics.
   Domain options require the selected visual profile, exact1/120 and
   `broadPhase:'domain-fixed'`. The generic rigid dt interval is insufficient.
   Select the domain path before rigid-only dynamic-body/CCD/pair requirements.
3. Register body, collider, cloth, fluid, joint and source-binding IDs in one
   global registry using the existing `limits.ts:1` ID rule. Resolve owners and
   all references explicitly. Register domain entities before validating source
   binding entity references. Preserve P0 frame/revision metadata rules; they
   are not new numerical entities or legacy scene revision converters.
4. Validate complete nested schemas, exact array lengths, profile roles and
   native numerical data below. Reject any cross-domain or unsupported member.
5. Only then run the trusted initializer once. Keep its existing arithmetic,
   copies, rest-density calculation and diagnostic order. A creation failure
   must publish no World, accepted buffers, clock or recorder ownership.

# Exact profile populations and static inputs

| Profile | Required population |
|---|---|
| cloth-pinned-sphere-visual-v1 | one cloth, no fluid, one static sphere owner/collider |
| fluid-basin-visual-v1 | one fluid, no cloth, one static basin owner/collider |
| fluid-basin-xsph-visual-v1 | same basin population, exact XSPH coefficient0.15 |
| fluid-static-box-visual-v1 | one fluid, no cloth, one basin plus one static box and their owners; no XSPH |

All require empty joints. Reject dynamic or kinematic bodies, added rigid
actors, extra/orphan colliders, shared collider owners, extra domains, mixed
cloth/fluid, emitters, moving obstacles and two-way coupling. Do not invent a
dynamic body to satisfy the rigid validator. No P6 interaction is admitted.

For each static body require exact `id/kind/initial`; initial has exact
positionM3 and orientationXYZW4. Collider records require the complete P0
fields, exact owner, exact geometry fields, local position3/quaternion4,
restitution/friction records, sensor/ccd booleans and filter fields. Domain
values are identity body/local rotation, zero local translation, restitution0,
static/dynamic friction0, sensor false, ccd false, categoryBits1/maskBits65535.
Reject another finite material/filter value rather than silently ignoring it.
Use raw identity checks before any rigid quaternion normalization.

Private `domain/types.ts:46–62` checks roles with `.every` but does not check
exact3/4 lengths, complete fields, global IDs, materials or filters. Empty or
short arrays can satisfy its `.every` predicates. Public validation must close
these holes before this helper runs.

Sphere geometry is exactly radius0.3 at `[0,0.1,0]` from `cloth/profile.ts:12`.
The0.002 cloth collision offset is internal original law, not a user radius
extension. Basin center and box-interior half extents are actual
`FLUID_BASIN_M[i]/2`: `[0.35,0.65,0.25]`, with identity transforms. A basin
interior is not an ordinary rigid box. Reject it under every rigid profile.

Every box extent must be finite and within the existing0.0001..1000m admitted
range. A CAD-derived box retains original minimum half extent rules
(`cad-proxy-admission.ts:32–34,69–79`), then original inflated containment and
initial-overlap checks (`fluid/cad-admission.ts:26–35`). Inverted/zero extents
must fail before inflation. Otherwise a negative extent can yield low>high,
pass both outer-bound comparisons and make overlap tests always false. Private
`domain/fluid.ts:38–43` alone does not establish positive geometry.

Find roles through collider geometry and owner IDs. Do not assume the first
body/collider is the basin or shelf, or hardcode fixture names. Either qualify
caller-order permutations with correct output associations or reject them by
an explicit frozen profile rule. Never silently reorder authored arrays.

# Cloth native-data checks

The old scene selects a fixed profile, not caller-defined mesh physics
(`cloth/admission.ts:8–29`). Public explicit model fields therefore need exact
native authority, not just positive/range/count checks.

| Field | Required native check |
|---|---|
| restPositionsM |289 exact triples in original17×17 row order from `cloth/topology.ts:10–13`; side1, height0.55 |
| initialPositionsM |289 triples, each component exactly matches native rest data, not merely caller-authored rest |
| initialVelocitiesMps |289 triples with the original implicit zero-velocity representation |
| vertexMassesKg |289 exact positive physical area weights from original triangle accumulation, including positive pinned masses |
| triangles |512 exact ordered triples, including winding, from `topology.ts:14–17`; no duplicate replacement/degenerate triangles |
| pinnedVertexIndices |exact `[0,16]` in original order |
| constraints |1566 exact ordered endpoint/kind/rest/compliance records from `topology.ts:25–38` |
| staticColliderIds |exact selected sphere collider reference, no duplicate/foreign reference |

The loop yields544 stretch,512 shear and510 bend-distance constraints. Order
matters to the original sequential projection. Require the original endpoint
direction and rest-length bits, including original Math.hypot results. Do not
replace diagonal rest lengths with a rounded decimal or a different sqrt
expression. Compliance is exactly the original profile0.001 for stretch/shear
and0.1 for bend-distance (`cloth/constraints.ts:13–15`). The solver reads those
fixed constants, so another authored compliance cannot be accepted and ignored.

Mass authority is original `densityKgM2 * spacing ** 2 / 6`, accumulated into
each vertex in the original triangle-index order (`topology.ts:19–24`). The
already qualified P5a fixture performs that same accumulation
(`kernel-fixture.mjs:4–9`). Do not obtain authored masses via reciprocal of
stored inverse masses, uniform mass assignment or a rounded total0.2. Preserve
positive pinned mass; only the simulation inverse mass becomes0 at pins.
Diagnostics use the original ordered sum, not a new mass tolerance.

Use original native builders or authenticated native expected operand data.
Freeze the ownership/call cost of any template generation before execution.
Do not import an example fixture into shipping production, trust an arbitrary
caller digest, or copy a second topology/area formula as a new authority. A
bounded validation template may precede World allocation; resource claims must
count any original topology/helper work. Plain shape rejection comes first.

Why exact admission is necessary: `domain/cloth.ts:31–41` accepts any positive
289 masses, in-range512 triangles/1566 constraints and initial==caller rest.
`withinClothBounds` bounds extension but not compression (`cloth/metrics.ts:26–32`).
By source inference, a collapsed caller rest sheet above the sphere, duplicate
triangles and long positive rest lengths can satisfy these private checks.
Likewise a valid-looking reordered constraint list changes the projection law.
No such input is qualified by the trusted P5a fixture PASS.

# Fluid original input domain and boundary arithmetic

Preserve the old admitted POSITION variation. The original API accepts any
256 dense triples that meet its initial basin and spacing rules, not just the
8×8×4 demonstration lattice (`fluid/validation.ts:59–88`). Do not compare these
positions with one fixture hash or replace them with a default lattice. Preserve
particle index order and exact input bits. Recompute restDensity from the
actual admitted positions through original `initialRestDensity`, once after
preflight; never reuse the fixture's rest density for a shifted layout.

Require exactly256 initial velocity triples with original zero velocities,
`massModel:{kind:'visual-unit-weights'}`, actual particle radius0.0125 and
actual smoothing radius exported by the unchanged source. That source is
`1.8 * 0.05`, whose binary64 value is0.09000000000000001,
F64LE `0bd7a3703d0ab73f`. Literal0.09 has different bits and must not pass an
exact profile check (`KERNEL-CLARIFICATION-01.json`). Smoothing records have
exact fields: none has only kind; xsph has kind and coefficient0.15. No other
viscosity, density/mass tuning, radius or smoothing degree is admitted.

The public INITIAL basin test is STRICT original inclusive bounds:
`radius <= position[axis] <= basin[axis]-radius`. It has no±1e-9 allowance
(`fluid/validation.ts:68–73`). Private initialization currently calls runtime
`insideBasin`, which allows±1e-9 (`boundary.ts:47–55`); it cannot replace this
public initial check. This is a real preflight requirement, not a new tolerance.

Retain the exact old spacing expression and order:
`dx*dx+dy*dy+dz*dz < FLUID_MIN_SPACING_M ** 2 - 1e-12` rejects a pair.
Do not change it to a distance/sqrt comparison, remove the old1e-12, add a new
tolerance or classify all points solely by finiteness. Original initial static
box overlap uses the existing strict interior test with its1e-9 inset
(`static-box.ts:57–63`), distinct from runtime projection's strict uninset
interior (`static-box.ts:16–37`). Preserve both at their respective sites.

# Signed zero, canonical model and CAD provenance

P0 copy/identity encoding preserves binary64 bits (`identity.ts:17,37–65`).
Never normalize -0 globally, serialize/parse a model to compare it, or repair
a quaternion before deciding whether the raw profile is supported.

Recommended bounded public rule: compare fixed native cloth data, static
identity transforms, indices and implicit zero velocities with exact native
bits, using Object.is or equivalent raw IEEE checks. This rejects authored -0
where the fixed native value is+0. Private `x===0` checks currently accept both;
they are not a frozen public signed-zero policy. Explicitly freeze this choice
in the public contract. If either sign is admitted for a new explicit field,
preserve it and qualify step0/read/record behavior instead of silently erasing it.
Keep authored fluid POSITION bits subject to the old strict admission domain.
Do not tighten unrelated P0 metadata or existing rigid-profile zero policies.

The shelf operands have actual original authority:
`evidence/static-input-01/summary.json` reports PASS_STATIC_INPUT_OPERANDS,
one native admission and0 World/candidate calls. Bounds are integer mm
`[200,200,100]..[500,200,400]`; original adapter computes span/2000, not a
subtraction after metre conversion. Center `[0.35,0.2,0.25]` and half extents
`[0.15,0.01,0.15]` match captured F64 bits. No geometry/tolerance change is needed.

A shelf-only numerical qualification is narrower than the OLD CAD adapter's
valid Surface/control-net-box input range. State that scope explicitly; do not
claim arbitrary CAD Surface inputs from the selected shelf receipt. The native
Surface remains source authority, while the contact shape remains the labelled
control-net proxy. This is not exact NURBS/B-rep collision or engineering CFD.

SourceBinding is inert P0 provenance (`model-admission.ts:115–122`); valid syntax
and a digest string do not prove fresh source. Original CAD World checks exact
sourceSnapshot and sourceRevision before step/reset (`fluid/cad-world.ts:24–28`,
`cad-proxy-admission.ts:134+`). A numeric static-box model with bindings[] has no
CAD-currentness claim. The CAD adapter path must separately prove source digest,
model/Surface selection, entity binding, immutable proxy operands and stale
source/revision refusal before state change. Do not add a second World or clock,
reinterpret metadata as runtime physics, or inject a legacy scene/dt API into
the canonical World to obtain this proof.

# Public gates to freeze before activation

These are required categories for the parent's finite recipe, not permission
for an unbounded test campaign. All were NOT_RUN in this review.

| Gate | Required decision/evidence |
|---|---|
| Inert schema | missing/unknown nested key; getter remains uncalled; custom/null prototype, sparse/typed array, symbol/hidden field; lengths0/2/4 for triples and0/3/5 for quaternions |
| IDs/roles | duplicate across body/collider/domain/binding; missing/duplicate owner; duplicate/foreign staticColliderIds; orphan actor; both domains; two domains of one kind; dynamic/kinematic actor or joint |
| Fixed cloth | one changed mass including a pin; perturbed rest/initial pair; duplicate/reversed triangle; reordered/reversed/missing constraint; changed kind/rest/compliance; bad pin; -0 in a fixed native zero/index |
| Fluid positives | canonical layout and at least one old-valid shifted layout; exact exported smoothing operand; exact basin endpoints; actual rest-density initialization from accepted positions |
| Fluid refusals | literal0.09; wrong radii/mass/smoothing; nonzero initial velocity; a point one representable value outside strict initial bounds; duplicate/too-close pair using old classification |
| Static geometry | empty/short vectors; nonidentity/nonunit raw quaternion; nonzero local translation; bad material/filter/sensor/ccd; zero/negative/inverted box extents; inflated box outside basin; initial particle in original overlap interior |
| Geometry associations | caller IDs renamed; either correctly supported body/collider-order permutations or explicit refusal under the frozen profile; no role inferred from a fixture ID |
| CAD | captured native shelf operands match the public model; whitespace/source-byte change, revision-only change and missing current source reject on the adapter path without a World/clock/state change |
| Creation atomicity | malformed inputs reject with canonical INVALID_CONFIG and accepted:null before private initializer/rest-density/solver allocation; caller model/options unchanged; no partially published World |
| Common World | public source and native emitted root/type-consumer creation; exact step0 model/state copies and identities; fixed profile dt/broadphase; generic guards before unsupported commands/queries; old rigid/P3 profiles unchanged |
| Lifecycle/P2 | retain cloth240 and fluid3600 source caps; no longer-horizon claim from two steps; implement the parent's explicit recording refusal/support decision and verify no partial recorder ownership/snapshot publication |

Use original admission helpers/native operand receipts to establish boundary
classifications. Do not invent an independent tolerance to make a boundary pass.
Count any helper/admission/allocation instrumentation honestly in the frozen
budget. Public numeric/state/atomic-commit, unsupported-operation, source/emit
and recording gates remain distinct from P5a's trusted private extraction PASS.
