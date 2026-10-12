# CAD modeling API

Start with `cad.model()` from `@barocss/cad`. Sketch and shape handles describe
what to build; `build` evaluates the authored operations and returns an immutable
accepted snapshot. You do not supply source IDs, revisions, cap charts, topology
use references or document version choices.

## A parameterized plate

```ts
import { cad } from '@barocss/cad';

const model = cad.model();
const width = model.parameter('width', 80);
const plate = model.sketch.rectangle({ width, height: 60 }).extrude(10);
const result = model.build({ plate });
const wider = result.withParameters({ width: 100 });
const saved = wider.save();
const reopened = cad.load(saved);
const solid = reopened.bodies.plate;
```

`rectangle({width,height})` starts at XY `[0,0]`. Use
`rectangle({min:[x0,y0],max:[x1,y1]})` for explicit placement; do not mix the two
forms. Coordinates and dimensions accept numbers or same-model parameter handles.
`polygon(points)` closes the final point to the first; do not repeat the first
point. The current kernel admits one strictly convex, 3..8-edge XY line polygon.
Extrusion starts at Z=0, along +Z. All coordinates and dimensions are millimetres.
Heights and chamfer distances must be positive, and dimensions are bounded by
10000 mm in magnitude. Exact kernel representability restrictions still apply.

The builder owns copied input values and immutable handles. Adding an operation
to a builder cannot change an already built snapshot. Capability/ownership/input
checks that can be made during authoring reject before appending an operation.
Geometric checks occur at evaluation; correcting parameter values can repair a
failed candidate without modifying a previous accepted snapshot.

## Keep dimensions related during edits

Use `model.dimension.scale(width, 0.5)` for half of an owned width parameter,
then `model.dimension.add(halfWidth, offset)` to add another millimetre dimension.
Pass the returned owned handle directly to profile coordinates, extrusion,
split position, chamfer distance or edge-selector coordinates. For example,
`finished.split({axis:'x',at:model.dimension.add(model.dimension.scale(width,0.5),offset)})`
keeps the plane at width/2 + offset after edits. No native IDs or expression
strings are needed. Copying a handle or mixing model owners refuses.

`add` combines two millimetre lengths. `scale` multiplies a length by a finite
numeric, dimensionless factor. There is no division, expression parser, scalar
parameter or implicit unit conversion in this API. Negative and zero results
still face the consuming geometry's restrictions. Expressions are authored
immutable dimensions, not extra feature nodes or named derived parameters;
`snapshot.parameters` contains only numeric drivers.

Arithmetic resolves left-to-right/postorder with ordinary binary64 rounding.
Every length literal, parameter and intermediate must be finite within ±10000mm;
overflow or an out-of-range intermediate refuses before geometry, even if a
later operation would cancel it. A factor may be any finite number. No clamping
or algebraic reassociation is performed. Standard signed-zero arithmetic applies;
authored zero signs survive save/load, while an arithmetic result follows the
normal addition/multiplication sign rules.

Each dimension is limited to 32 tree-node occurrences and depth 6; reusing one
handle twice counts its subtree twice. Existing global input/file limits also
apply. Saved files contain only exact nested add/scale/parameter/literal intent,
not resolved caches. Older numeric/parameter documents remain readable.
The unchanged private dependency collector includes parameters nested inside
formulas. Changing offset re-evaluates its split suffix; changing a profile width
re-evaluates the profile and all downstream features. A referenced +0→-0 change
still invalidates that dependency, even if its formula evaluates to the same
coordinate. Cold `cad.load` rebuilds normally.

## Cut an actual part, then chamfer its edge

```ts
import { cad } from '@barocss/cad';

const model = cad.model();
const height = model.parameter('height', 8);
const setback = model.parameter('setback', 1);
const rearX = model.parameter('rearX', 16);
const upperX = model.parameter('upperX', 16);
const blank = model.sketch.polygon([
  [0, 0], [32, 0], [32, 16], [rearX, 32], [0, 32],
]).extrude(height);
const tool = model.sketch.rectangle({
  min: [8, -16], max: [upperX, 48],
}).extrude(8);
const cut = blank.cut(tool, { axis: 'x' });
const selected = cut.positive;
const edge = selected.edges({ parallelTo: 'x', at: { y: 0, z: 'max' } }).one();
const finished = selected.chamfer(edge, setback);
const result = model.build({ part: finished, other: cut.negative });
const edited = result.withParameters({ height: 6, rearX: 20 });
const reopened = cad.load(edited.save());
const reedited = reopened.withParameters({ setback: 2 });
const finalPart = reedited.bodies.part;
```

The initial part has exact native volume 3064 mm³; the separately retained
negative component is 2048 mm³. The batch height=6/rearX=20 gives 2488 mm³;
changing setback to 2 after reopening gives 2464 mm³. These are fixture-specific
native results, not universal CAD tolerance guarantees.

- `cut(tool,{axis:'x'|'y'})` accepts two distinct direct XY extrusions. The tool
  must have two opposed cardinal supports on that axis and its other halfspaces
  must cover the entire parent. This is the existing through-slab subtraction,
  not an unrestricted Boolean operation
- `negative` is outside the tool's lower support (`x <= tool.minX`, or the y
  equivalent); `positive` is outside its upper support. These names do not
  depend on polygon winding. Empty sides stay empty; selecting one as a Solid
  output or chamfer parent refuses rather than changing sides
- `edges(query).one()` authors a deferred exact selection. It performs no geometry
  work until build/edit/load. Every evaluation must match exactly one edge, or
  throws `CadModelError` with code `SELECTION`
- `parallelTo` accepts x/y/z; `at` accepts explicit coordinates, parameters,
  `min` or `max` for each axis. Extrema refer to the entire owning body's bounds.
  Both edge endpoints must match each requested coordinate exactly. No midpoint,
  nearest-edge tolerance, array ordinal or cached generated ID is used
- A selection belongs to one exact shape in one builder. It cannot be used with
  another body/model. It follows the saved geometric query on each rebuild;
  it is not a promise of persistent topology identity
- `chamfer(edge,distance)` applies the kernel's equal-distance cardinal-edge
  profile to the actual selected parent. Orthogonal end supports, local setback,
  exact representability and native work limits still apply. At most two serial
  chamfers are admitted within six nodes, each selecting its exact parent result;
  sibling branches, further steps, curves, fillets and general edge chains are unsupported

## Keep the overlapping part of two extrusions

Use `const overlap = blank.intersect(tool)` with two distinct direct extrusion
handles from the same model, then `model.build({ overlap })`. Both original
profiles remain editable through named parameters. The operation uses the
existing exact convex planar Solid intersection provider; original native
source/Face lineage is retained in the intersection evidence.

For a concrete example, extrude the pentagon
`[[0,0],[32,0],[32,16],[16,32],[0,32]]` by 8 mm, and the rectangle
`{min:[8,-8],max:[40,24]}` by 4 mm. Their overlap has 7 faces, 15 edges,
10 vertices and volume 2176 mm³. Moving the rectangle's X bounds together to
16 and 48 gives 1408 mm³. Save and `cad.load` retain the same editable operation.

Intersection requires positive volume. Disjoint parts or contact at only a face
or edge throw `CadModelError` with code `SELECTION`, operation `intersect`,
and the actual native contact dimension in the message and
`cause.contactDimension` (-1, 2 or 1 respectively). Direct positive-Z extrusions
do not produce a vertex-only contact; the native provider also defines dimension
0, which remains available in its diagnostics. A failed parameter edit
leaves the previous accepted bodies and saved bytes unchanged. Unsupported exact
XYZ/UV representation retains the original native error under `cause`; no
rounding, tolerance welding or alternate chart search occurs.

Only one intersection or through-slab cut is allowed in a model. Nested/repeated
intersection, intersecting a cut/chamfer result, and mixing cut with intersection
are unsupported. This is the bounded convex planar operation, not a general
curved/nonconvex Boolean system.
One supported cardinal chamfer may follow this overlap: select
`overlap.edges({parallelTo:'x',at:{y:0,z:'max'}}).one()` and chamfer by 1 mm.
For the initial example above the retained volume is 2164 mm³, with 12 mm³
removed. The existing exact selection, local setback and native restrictions
still apply.

## Divide an extruded part along an axis

`const halves = blank.split({axis:'z',at:splitHeight})` authors one horizontal
plane through a direct XY extrusion or its owned chamfer chain. `splitHeight`
can be a number or an owned
parameter. Use `model.build({lower:halves.negative,upper:halves.positive})` to
retain both parts. Negative is below the authored plane, positive is above it;
the choice is independent of polygon winding. Use `axis:'x'` for left/right
or `axis:'y'` for front/back pieces. Negative always means coordinate < at,
positive means coordinate > at on the selected world axis. Arbitrary or oblique
planes are not supported.

For the same pentagon used above, an 8 mm extrusion split at Z=2 has native
volumes 1792 and 5376 mm³. Editing the split height to 4 gives 3584 and 3584;
after save/cold load, editing to 6 gives 5376 and 1792. Each result retains the
native volume-conservation report and paired cap/source lineage. A supported
cardinal chamfer may follow a nonempty side; a 1 mm chamfer on the lower part's
front x-parallel top edge leaves 1776 mm³ in that part.

A tangent or outside plane has one genuine empty side. Asking for both outputs,
or using the empty side as a chamfer parent, throws `CadModelError` `SELECTION`
with operation `split`. Its cause carries `side`, native `status` and
`sectionDimension`. Selecting only the nonempty side succeeds with the actual
unchanged parent Solid. No zero-volume Solid or other side is substituted.
A failed edit leaves the previous accepted snapshot and saved bytes unchanged.

For the same pentagon, X=16 or Y=16 yields 4096 and 3072 mm³; moving either
plane to 24 yields 5888 and 1280. Both sides are independently qualified native
Solids. Vertical cuts still require exactly representable native crossings;
for example, moving the rear vertex to X=20 and cutting at X=24 meets the
sloped edge at Y=80/3 and is refused rather than rounded.

The builder generates the cutter with the native part's selected coordinate-span
chart, preserving signed zero and using the actual native source compiler.
This avoids introducing normalized-chart fractions for dimensions such as 3 or
5 mm. All native representation, binding and work limits still apply, with
original failures retained under `cause`. Provider work reports exclude the
wrapper's own compilation of the generated cutter; they are not total work counts.
One split replaces the optional cut/intersection. Its input may be a direct
extrusion or the result of one/two serial owned chamfers rooted in that extrusion.
Nested splits and cut/intersection-rooted chains are refused. The six-node limit
and native qualified-convex-parent requirements remain unchanged.

For a 32×24×8 mm rectangular rail with opposite front/back bevels of 1 and 2 mm,
`finished.split({axis:'x',at:splitAt})` at X=16 retains two 3032 mm³ bodies.
Moving the plane to X=8 gives 1516 and 4548. Editing the back bevel to 3 mm
then gives 1496 and 4488. A split-position edit reuses all four earlier model
features; a back-bevel edit rebuilds that bevel and the split. Create each bevel
selector from its exact parent; a selector from the other split side refuses.
No chamfer is silently moved across the split or remapped to another edge.

## Bevel two opposite edges in sequence

Call the second `chamfer` on the first result and create its selector from that
same result: `front.chamfer(front.edges(query).one(), backDistance)`. The model
admits at most one two-step chamfer chain within the existing six-node limit.
A selector from the original blank or another body refuses ownership; a second
sibling branch or third chamfer refuses capability. No edge is silently remapped.

For a 32×24×8 mm rectangular blank, first bevel the x-parallel edge at y=0,z=max
by 1 mm, then the first result's opposite edge at y=24,z=max by 2 mm. The first
removes 16 mm³ and the second 64, leaving 6064 mm³. Editing the second distance
to 3 leaves 5984; changing the first to 2 and the second to 3 leaves 5936.

Each operation keeps its actual native parent and source-qualified edge pair.
Moving a selector to the removed original edge refuses selection. Selecting a
new bevel edge whose adjacent faces are not cardinal planes preserves the native
metric refusal. Positive distance, exact representation and native geometry
limits still apply; failed edits preserve earlier accepted snapshots and files.
The two-step witness is a direct rectangular extrusion, not arbitrary edge
chains or every possible split/intersection/chamfer combination.

## Rebuild only the changed feature suffix

`withParameters` reuses the unchanged leading features from that exact accepted
snapshot. On the two-chamfer part, editing only the second distance reuses the
sketch, extrusion and first chamfer. Editing the first distance rebuilds both
chamfers; editing height starts at the extrusion; editing a profile coordinate
starts at the sketch. This is conservative prefix reuse, not arbitrary graph
scheduling or persistent topology naming.

`snapshot.recomputation.reusedFeatures` and `evaluatedFeatures` list the model
feature indices used for that accepted result. They do not count transitive
native work, measure savings or promise latency. New builds and `cad.load` are
always cold. A no-op or unused-parameter edit can reuse every feature; authored
values still use exact `Object.is` comparison, including signed zero.

Reuse is private to the accepted snapshot lineage and bound to its unchanged
source/options graph and provider implementation. No JSON field, public evidence
object or caller cache can supply it. Reused geometry is deeply frozen; each
snapshot keeps independent authored state. A failed edit leaves the original
snapshot and its future reuse available. Save files still contain authored
intent only, never cached geometry or recomputation reports.

## Accepted snapshots and failures

```ts
import { cad, CadModelError } from '@barocss/cad';

const model = cad.model();
const height = model.parameter('height', 8);
const plate = model.sketch.rectangle({ width: 32, height: 16 }).extrude(height);
const accepted = model.build({ plate });
try {
  const candidate = accepted.withParameters({ height: -1 });
  candidate.bodies.plate;
} catch (error) {
  if (!(error instanceof CadModelError)) throw error;
  // error.code / error.operation describe the refusal; error.cause preserves
  // the native kernel error when one exists. accepted remains unchanged.
}
const stillAccepted = accepted.save();
```

`withParameters` evaluates one complete candidate from a batch of named mm values.
Unknown names, invalid numbers, ambiguous selections and native refusals leave
the old parameters, native bodies, evidence and serialized bytes unchanged.
No caller-managed revision or binding array is needed. A same-value edit still
cold-evaluates the graph; no caching or partial-rebuild performance is promised.

`build({name:shape,...})` requires 1..8 explicitly named final outputs. Only those
outputs are returned as `snapshot.bodies`; consumed tools and intermediate bodies
are not silently added. Every authored node is evaluated, including unused
branches, so invalid unused geometry is also refused. Native evidence for all
operations is preserved under `snapshot.evidence`. `snapshot.features` provides
kind, diagnostic index and dependency indices; these are not authoring handles.
Bodies/evidence are deep-frozen native values usable by the existing tessellation
and display adapters. They allocate no renderer/GPU resources.

The current supported graph envelope is at most two sketches, two extrusions,
one through-slab cut, intersection or cardinal split and up to two sequential chamfers,
with at most six nodes and sixteen parameters. These are
upper bounds, not six required roles: an extrusion-only or cut-only model builds,
saves and reopens through the same API. No arbitrary Boolean graph is implied.
Names are ASCII identifiers of 1..48 characters; `__proto__`, `constructor` and
`prototype` are refused. Inputs must be ordinary dense arrays and plain own-data
records. Accessors, symbols, custom array prototypes and cyclic inputs refuse.

## Save and load

`save()` is available only on an accepted snapshot and stores the authored graph,
parameter values and output names. Native evidence, renderer state and meshes
are never serialized. `cad.load(text)` validates a bounded own-data file, then
cold-evaluates all operations before returning the same snapshot interface.
Files are capped at 64 KiB UTF-8/UTF-16, input depth 12 and the graph limits above.
Unknown or duplicate keys, future schema values, invalid references and malformed
numbers refuse. Signed zero is preserved. File-format metadata is internal to
this codec, not a user-facing API generation to choose.

Legacy feature/source files retain their explicit legacy readers; `cad.load`
does not reinterpret them or silently change their geometry. Existing named
provider exports and the compatibility aliases under `cad.sketch`, `cad.solid`
and `cad.document` remain unchanged. They are advanced kernel/file compatibility
interfaces, not the recommended authoring path.

## Verification

Run the ordinary boundary/type tests after building the package:

```sh
node scripts/tool.mjs type-check
node scripts/tool.mjs build
node --test test/modeling.test.mjs test/modeling-intersection.test.mjs test/modeling-split.test.mjs test/modeling-cardinal-split.test.mjs test/modeling-chamfer-chain.test.mjs test/modeling-regeneration.test.mjs test/modeling-regeneration-helpers.test.mjs test/modeling-chamfer-split.test.mjs test/modeling-dimensions.test.mjs test/modeling-dimensions-helpers.test.mjs test/public-api.test.mjs
node test/public-api-types.mjs
```

The separately selected instrumented native campaign is intentionally outside the
ordinary `*.test.mjs` glob:

```sh
node --no-opt --max-old-space-size=2048 --test test/modeling-native.mjs
```

It verifies actual native geometry, named outputs, batch edits, ambiguity and
native refusals with independently measured call counts. The focused
`scripts/modeling-consumer.mjs` source/emitted/cold modes verify final source,
compiled imports and cold authored-file reopening; see the #1611 receipt for
exact commands, source hashes and validation limits. CPU/native evidence does
not assert browser, OS-file, GPU or full-suite verification.

The separate overlap campaign uses real native outputs and an independent signed
volume sum, plus face/edge/disjoint and native-representability refusal controls:

```sh
node --no-opt --max-old-space-size=2048 test/modeling-intersection-native.mjs
node --no-opt --max-old-space-size=2048 scripts/modeling-intersection-consumer.mjs test/modeling-intersection-evidence
```

The first command may select a bundled source entry using `CAD_MODEL_TEST_MODULE`;
the second defaults to the emitted public entry and runs in a fresh process.
The #1614 receipt records seven source evaluations, two cold emitted evaluations
and one unchanged native tessellation. Provider direct work is recorded; full
transitive call coverage and actual GPU rendering are not measured by this flow.

The separately bounded horizontal-split flow runs through the same authored-file
boundary with twelve model evaluations and two baseline tessellations:

```sh
node --no-opt --max-old-space-size=2048 test/modeling-split-native.mjs
node --no-opt --max-old-space-size=2048 scripts/modeling-split-consumer.mjs test/modeling-split-evidence
```

See the #1619 receipt for source/emitted hashes, selected empty-side controls,
translated clockwise/non-power-of-two chart evidence and the actual execution
boundary. These CPU records do not establish browser/GPU acceptance.

The cardinal X/Y extension has a separate thirteen-evaluation, two-tessellation
flow, including translated clockwise profiles and exact crossing refusal:

```sh
node --no-opt --max-old-space-size=2048 test/modeling-cardinal-split-native.mjs
node --no-opt --max-old-space-size=2048 scripts/modeling-cardinal-split-consumer.mjs test/modeling-cardinal-split-evidence
```

The #1622 receipt records its direct-extrusion witness. Split after an owned
chamfer chain is separately covered by #1631; the one-split graph limit remains.

The separately bounded two-chamfer chain flow uses eight model evaluations and
one final-part tessellation, including cold reconstruction and atomic failures:

```sh
node --no-opt --max-old-space-size=2048 test/modeling-chamfer-chain-native.mjs
node --no-opt --max-old-space-size=2048 scripts/modeling-chamfer-chain-consumer.mjs test/modeling-chamfer-chain-evidence
```

See #1625 for the exact rectangular witness and measured source/emitted receipts.

The bounded regeneration flow uses ten model calls and one baseline tessellation:

```sh
node --no-opt --max-old-space-size=2048 test/modeling-regeneration-native.mjs
node --no-opt --max-old-space-size=2048 scripts/modeling-regeneration-consumer.mjs test/modeling-regeneration-evidence
```

The #1627 receipt distinguishes reused model features from actual provider work
and verifies cold parity, snapshot independence and reuse after refusal.

The split-after-chamfer flow uses eight model calls and two tessellations.
It checks both native bodies, cap/source lineage, selective prefix reuse,
empty-side refusal and cold reconstruction:

```sh
node --no-opt --max-old-space-size=2048 test/modeling-chamfer-split-native.mjs
node --no-opt --max-old-space-size=2048 scripts/modeling-chamfer-split-consumer.mjs test/modeling-chamfer-split-evidence
```

See #1631 for the bounded source/emitted receipts. Provider reports do not include
all wrapper work; full transitive native coverage and browser/GPU remain unclaimed.

The derived-dimension campaign uses eight model calls and one tessellation:

```sh
node --no-opt --max-old-space-size=2048 test/modeling-dimensions-native.mjs
node --no-opt --max-old-space-size=2048 scripts/modeling-dimensions-consumer.mjs test/modeling-dimensions-evidence
```

See #1634 for the width/offset rail fixture, exact prefix/volume assertions,
pre-native arithmetic controls, referenced signed-zero edit and cold receipts.
No new native geometric representation or transitive speed claim is implied.
