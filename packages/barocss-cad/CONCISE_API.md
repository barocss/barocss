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
const body = reopened.bodies.plate;
if (body.family !== 'convex-planar') throw new Error('Expected a convex plate');
const solid = body.native;
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

## Create an editable round post

```ts
import { cad } from '@barocss/cad';

const model = cad.model();
const diameter = model.parameter('diameter', 8);
const height = model.parameter('height', 6);
const post = model.sketch.circle({
  center: [2, -3], radius: model.dimension.scale(diameter, 0.5),
}).extrude(height);
const initial = model.build({ post });
const taller = initial.withParameters({ height: 9 });
const reopened = cad.load(taller.save());
const body = reopened.bodies.post;
if (body.family !== 'stored-rational-circle-prism') throw new Error('Expected a round post');
const qualified = body.native;
```

`circle({center:[x,y],radius})` accepts owned length parameters and add/scale
expressions, just like rectangle dimensions. Radius and height must be from
0.001 to 10000 mm, and all circle poles must lie within ±10000 mm. Extrusion
starts at Z=0 along +Z. Height-only edits reuse the sketch; diameter or center
edits rebuild it. No-op edits reuse both native bodies and their wrappers.
Authored Save/Open retains circle intent and signed zero; cold load rebuilds it.

The result is a qualified **stored-rational** boundary with two seam vertices,
three edges and three faces. Its original Shell parent and sampled preview keep
their own `solid:false` flags; the separate exact certificate establishes the
admitted solid. No certified ideal-cylinder volume, area or mass is supplied.
Circle sketch/extrusion evidence has `profile:'circle'`; affine evidence retains
its existing shape. The sketch's Source0 and coefficients match the extrusion's
original profile, and the complete qualified parent/source/proof stays available.

Exact trim correspondence can refuse decimal inputs: center `[.2,.2]`, radius
`.1`, height `.3` has a nonzero stored cap-composition residual. The public
`NATIVE` / `extrude` error retains the provider's `GEOMETRY` cause and residual;
there is no coefficient healing. Earlier accepted snapshots remain usable.
Circle cut, union, intersection, split, hole, chamfer and edge queries are not
admitted. This slice adds no arc sweep, constraint solver or ideal-circle claim.

The editor software adapter uses the original native face/UV/seam preview for
its round-post preset and diameter/height edits, with atomic refusal/history.
The legacy preview label does not perform a coordinate conversion: the adapter
sends unchanged authored XYZ to the existing face preparation exactly once.
Certified volume remains unavailable. Actual browser/GPU/physical-file acceptance
is the OPEN external gate in [consumer #1683](https://github.com/barocss/barocss/issues/1683).

## Add a qualified through-hole to a mounting plate

Author `const plate = blank.hole({center:[centerX,centerY],radius})` on an
origin-aligned rectangular XY extrusion, then `model.build({blank,plate})`.
For example, an 80 × 40 mm rectangle extruded 8 mm admits a centre `[40,20]`
and radius 5 mm. Coordinates and radius accept literals, owned parameters or
owned add/scale expressions. Editing radius to 2.5 mm reuses the unchanged
sketch/extrusion prefix; Save/Open preserves the hole intent and cold rebuilds it.

Every named output has one discriminated `CadBody` contract:
`{family:'convex-planar',native}`, `{family:'stored-rational-plate-hole',native}`
`{family:'orthogonal-cell',native}` or `{family:'stored-rational-circle-prism',native}`.
Narrow `body.family` before passing `body.native` to its matching native adapter.
Wrappers and their complete native values are deeply frozen; reused features
retain both wrapper and native identity. A mixed output map never drops a body
or pretends that a hole has a convex certificate.

The hole's native certificate qualifies the **stored rational geometry** as a
single genus-one Solid: seven faces, ten vertices, fifteen edges and annular
caps. Its stored binary64 middle weight is the geometric authority, not an
ideal circular cylinder. There is no certified analytic π-based volume.
The original `parentReport` remains explicitly uncertified beside this new
qualification; its reference formula must not be used as a certified volume.
The feature evidence also retains the actual convex blank parent. The hole
provider generates its own seven source-backed surfaces; it does not inherit
the blank's face/edge identities.

Only a direct authored rectangle with XY minimum `[0,0]` and integer X/Y/Z
sizes from 1 to 10000 mm is admitted. One hole is allowed within six nodes;
it cannot mix with cut, intersection, split, chamfer or union, or become a parent for
those operations or edge queries. Native radius, strict interior clearance,
exact stored-UV composition and work bounds still apply. Even an otherwise
ordinary integer width can be refused by exact native qualification. Errors
preserve the original provider cause and leave the prior snapshot reusable.
Signed-zero authored dimensions remain preserved by the existing codec.

`tessellateOwnPlateCircularHole` accepts the native bundle and explicit preview
context/options. `classifyStoredPlateHoleSolidPoints` accepts the qualified native
result, query records and explicit options to query stored material. Preview sampling is not a new topology or volume proof.
The editor has a qualified sampled-face adapter for this family, recorded in
[#1644](https://github.com/barocss/barocss/issues/1644); actual browser/GPU acceptance
is a separate gate. The bounded union software adapter and its open visual gate are described below.

## Fuse two rectangular extrusions

Use `a.union(b)` to build one connected L-bracket or stepped boss from two owned
direct rectangular XY extrusions. The result uses the same named body map:

```ts
import { cad } from '@barocss/cad';
const model = cad.model();
const legWidth = model.parameter('legWidth', 8);
const base = model.sketch.rectangle({ width: 32, height: 8 }).extrude(8);
const leg = model.sketch.rectangle({ width: legWidth, height: 24 }).extrude(8);
const bracket = base.union(leg);
const initial = model.build({ base, leg, bracket });
const wider = initial.withParameters({ legWidth: 12 });
const reopened = cad.load(wider.save());
const body = reopened.bodies.bracket;
if (body.family !== 'orthogonal-cell') throw new Error('Expected a union body');
const volumeMM3 = body.native.report.volumeMM3;
```

The expected exact volumes are 3072 and 3584 mm³. The unchanged base prefix is
reused when only the leg width changes. Save stores the authored union and driver
values; cold load rebuilds both rectangles and the complete union. The union
native report certifies its restricted integer-cell material and oriented-shell
volume conservation, not an arbitrary BRep or manufacturing tolerance.

Both operands must be distinct direct **authored rectangles**. Corners resolve
to integers within ±10000 mm; side lengths and positive extrusion heights are
integers from 1 to 10000 mm. Both extrusions start at Z=0. One union fits the
existing six-node envelope and cannot mix with cut, intersection, split, hole or
chamfer, feed another union, or expose convex edge queries. Parameters and owned
add/scale dimensions are supported only when the resulting dimensions satisfy
these rules. A polygon that looks rectangular is not this authored rectangle
contract.

Overlap and face-contact joins are admitted by the unchanged native provider.
Edge-only contact preserves its genuine `NATIVE` / `union` error and `CONTACT`
cause. Disjoint union completes the native two-body result, then refuses with
`SELECTION` / `union`; its cause retains that full native result. The single
shape API never picks one component or silently drops the other. Refused edits
leave the prior snapshot, saved bytes and future same-snapshot reuse intact.

The private bridge compiles whole signed Source0 intent, builds six real native
Faces and an AxisBoxShell per operand, and lets the Boolean qualify them. This
is a new source-qualified representation of the owned rectangular intent, not a
bounds cast. Feature evidence keeps both original convex parents and the complete
union, including its new operand sources and per-panel lineage. Old convex face
identities are not claimed to survive. Every evaluated union rebuilds these box
assets even if a convex parent feature was reused; recomputation indices do not
measure total native savings.

**The provider-only checkpoint refused editor preview for this family.** The
bounded editor software adapter in [#1647](https://github.com/barocss/barocss/issues/1647)
now preflights every output and admits one connected union with at most 64
complete generated panels before any output tessellation. It projects genuine
raw native panel packets with one existing `[x,z,-y]` display conversion and
retains generated source identity plus every contributing operand-face lineage.
The existing `prepareAxisBoxBooleanBuffers` still provides separate CPU data
after a full native revalidation and one tessellation per panel; retained helper
buffers are adapted replay evidence, not an unchanged renderer input.
The external browser/GPU/physical-file gate remains **OPEN**, and broader renderer
work remains [#1119](https://github.com/barocss/barocss/issues/1119). Never truncate
or merge the native 72-panel bound to evade the preview's 64-chunk limit.

## Cut an underside recess or through-window

Use `plate.cut(tool)` for one restricted rectangular difference. Omitting options
returns a `CadShape`; `plate.cut(tool,{axis:'x'|'y'})` still returns the existing
`CadCut` pair. Explicit `undefined`, `null`, `{}`, extra fields or arguments refuse.
There is no automatic choice between these two return contracts.

```ts
import { cad } from '@barocss/cad';
const model = cad.model();
const toolX = model.parameter('toolX', 8);
const toolY = model.parameter('toolY', 8);
const toolWidth = model.parameter('toolWidth', 16);
const toolSpanY = model.parameter('toolSpanY', 8);
const depth = model.parameter('depth', 4);
const plate = model.sketch.rectangle({ min: [-0, 0], max: [32, 24] }).extrude(8);
const tool = model.sketch.rectangle({
  min: [toolX, toolY],
  max: [model.dimension.add(toolX, toolWidth), model.dimension.add(toolY, toolSpanY)],
}).extrude(depth);
const part = plate.cut(tool);
const accepted = model.build({ plate, tool, part });
const window = accepted.withParameters({ depth: 8 });
const reopened = cad.load(window.save());
const body = reopened.bodies.part;
if (body.family !== 'orthogonal-cell') throw new Error('Expected rectangular difference');
const volumeMM3 = body.native.report.volumeMM3;
```

Both direct authored rectangle extrusions belong to this model and begin at Z=0.
Resolved corners must be integers within ±10000 mm, and each side/height an integer
from 1 to 10000 mm. A depth4 tool cuts an **underside** recess through Z=0..4;
it is not a top-entry pocket. The 32×24×8 plate retains5632 mm³, depth6 retains5376,
and depth8 opens a through-window retaining5120. A translated-Z tool, buried
cavity, rotated/cylindrical cutter or arbitrary BRep subtraction is not supported.

The new authored node kind is `difference`; public error operation is `cut`.
The same complete `{family:'orthogonal-cell',native}` body contract retains actual
integer-cell and oriented-shell volume, all generated panel sources, and full
operand lineage. Private whole-Source0 box construction qualifies six actual
faces per operand. Original convex parents remain in diagnostic evidence with
exact native identity; their face IDs are not silently reassigned to the boxes.
Both box assets rebuild whenever the difference feature evaluates.

Only exactly one positive-volume body can be a shape. Empty or disconnected
results complete natively, then refuse `SELECTION` / `cut` with the full frozen
native result as cause. Other native errors retain their cause. A disjoint tool
returns newly qualified orthogonal-cell material, not a substituted convex parent.
No nested/mixed Boolean, hole, chamfer or convex edge query is admitted for this
five-node graph. The six-node and one-Boolean limits remain unchanged.

Save contains only driver values and authored intent. Cold load rebuilds all five
features; a depth edit reuses indices0/1/2 and evaluates3/4, while moving the tool
reuses0/1 and evaluates2/3/4. These are model-feature indices, not total native work.
Refused candidates leave the same previous snapshot and future reuse intact.
The legacy axis-cut schema and saved fixtures are unchanged.

**A bounded difference software adapter is available in the editor.** The
underside-pocket preset reuses the orthogonal panel path with explicit authored
operation, cavity orientation, material occupancy and complete native UV/lineage
checks. All outputs, including hidden operands, pass admission before sampling;
the complete preview ceiling is64 panels while the native bound remains72.
Copied qualification and CPU picking do not prove visible rendering. Actual
browser/GPU/React and physical-file acceptance remains OPEN in
[#1653](https://github.com/barocss/barocss/issues/1653); the broader dependency is
[#1119](https://github.com/barocss/barocss/issues/1119).

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
const output = reedited.bodies.part;
if (output.family !== 'convex-planar') throw new Error('Expected a convex part');
const finalPart = output.native;
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

#### Named validated finishes

Name an optional finish with
`blank.chamfer(edge,distance,{name:'frontFinish'})`. It starts active and remains
a normal owned shape for later features. An accepted snapshot can use
`withSuppression({frontFinish:true,backFinish:false})` to update one or both
named finishes atomically. Names are unique, stable safe ASCII identifiers;
`snapshot.suppression` and named `snapshot.features` metadata expose their
readonly boolean state separately from millimeter parameters. Existing unnamed
two-argument chamfers and their saved fields stay unchanged.

This is **validated finishing configuration**: disabled chamfers still require
a genuine valid native candidate, either rebuilt or privately reused. Disabling
an invalid edge or distance cannot recover the model. It is not a geometry
validation bypass or a native-work optimization. The selected output of a
disabled finish is its exact qualified parent, with source identity unchanged.
Named diagnostic evidence carries `configuration.output` as `parent` or
`chamfer-result`; its `native` value remains the genuine validated candidate,
which must not be confused with the selected output.

For a 32×24×8 rail with front/back setbacks1/2 and X16 split, both active gives
3032/3032 mm³, front disabled gives3040/3040, both disabled gives3072/3072, and
back disabled gives3064/3064. Descendants consume the actual selected parent;
discarded bevel caps do not become part of their source lineage. Edge queries
still belong to their exact owned feature result, and invalid bindings refuse.

Changed configuration conservatively rebuilds the graph. A same-value update
reuses all unchanged model features. These indices are not total native-work
measurements. Unknown names or non-boolean values reject the entire update;
failed native validation leaves the earlier snapshot usable. Named intent is
saved as paired `name`/`suppressed` fields on each configured chamfer node,
with no new file version or native cache. Cold load validates/rebuilds normally.
Only the existing two chamfers are configurable; this adds no reorder/delete,
arbitrary feature suppression, curved/holed body or Boolean-union capability.

## 45-degree XY miter split

`blank.split({plane:'x+y',at:cutPosition})` cuts along the fixed plane
**x+y=at**. The threshold is a coordinate sum in millimeters, not perpendicular
distance. Negative is below that sum; positive is above it. Exactly one of
`axis` or `plane` is required. This enum is not an expression parser and accepts
no arbitrary normal or other diagonal equation. `at` also accepts an owned
add/scale dimension. The native source-backed cutter uses +Z and (+X,-Y) axes
with actual parent coordinate-span knot domains.

A 32×24×8 rectangle at sum24 has volumes 2304/3840 mm³. At sum32 it has
3840/2304; at sum28 it has 3072/3072. A cut-position edit reuses the sketch and
extrusion and rebuilds only the split. A parent with two opposite top-edge
chamfers of distance2 has volume6016 and at sum28 splits into 3008/3008.
The same direct-extrusion or owned one/two-chamfer ancestry and single-Boolean
limits apply. No oblique post-split chamfer combination is certified here.

Requesting an empty side refuses atomically with the genuine native status and
contact dimension. At sum0, choosing only the positive side retains the full
parent. Exact native affine/chart/crossing/pcurve and topology requirements
remain authoritative; there is no automatic chart search, snapping or tolerance
fallback. Failed edits leave the earlier accepted snapshot available for a
valid subsequent edit. Save/load retains authored plane intent; cold load
rebuilds rather than importing native caches.

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
No caller-managed revision or binding array is needed. Same-value edits can reuse all model features; the recomputation report does not
claim total native work or a performance improvement.

`build({name:shape,...})` requires 1..8 explicitly named final outputs. Only those
outputs are returned as `snapshot.bodies`; consumed tools and intermediate bodies
are not silently added. Every authored node is evaluated, including unused
branches, so invalid unused geometry is also refused. Native evidence for all
operations is preserved under `snapshot.evidence`. `snapshot.features` provides
kind, diagnostic index and dependency indices; these are not authoring handles.
Bodies are deep-frozen family-tagged wrappers around original native values;
evidence retains the original provider results. Pass the narrowed native value
to its matching adapter. They allocate no renderer/GPU resources.

The current supported graph envelope is at most two sketches, two extrusions,
one through-slab cut, intersection or supported split and up to two sequential chamfers,
or one separate rectangular through-hole, integer-box union or rectangular difference graph, with at most six nodes and
sixteen parameters. These are
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
node --test test/modeling.test.mjs test/modeling-intersection.test.mjs test/modeling-split.test.mjs test/modeling-cardinal-split.test.mjs test/modeling-chamfer-chain.test.mjs test/modeling-regeneration.test.mjs test/modeling-regeneration-helpers.test.mjs test/modeling-chamfer-split.test.mjs test/modeling-dimensions.test.mjs test/modeling-dimensions-helpers.test.mjs test/modeling-miter.test.mjs test/modeling-suppression.test.mjs test/modeling-hole.test.mjs test/modeling-union.test.mjs test/modeling-box-cut.test.mjs test/public-api.test.mjs
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

The separately bounded miter flow uses eight model calls and two baseline
tessellations: six source calls and two fresh emitted cold/re-edit calls. It
covers sum-threshold edits, outside refusal/recovery, signed-zero lower tangent,
the symmetric two-chamfer parent, cap/source lineage and exact cold body parity.
Upper tangent is inherited and is not another measured case in this flow.

```sh
node --no-opt --max-old-space-size=2048 test/modeling-miter-native.mjs
node --no-opt --max-old-space-size=2048 scripts/modeling-miter-consumer.mjs test/modeling-miter-evidence
```

These are bounded CPU native receipts, not browser/GPU or performance claims.

The validated-finishing flow uses eight model evaluations and one negative-body
tessellation. Six source evaluations cover active, explicit no-op, atomic both-off,
front-only, suppressed invalid-edge refusal and restoration. Two fresh emitted
evaluations cover cold named-state rebuild and front-off re-edit. Descriptor/name
controls reject before evaluation and are accounted separately. Both disabled
native candidates remain validated diagnostic results.

```sh
node --no-opt --max-old-space-size=2048 test/modeling-suppression-native.mjs
node --no-opt --max-old-space-size=2048 scripts/modeling-suppression-consumer.mjs test/modeling-suppression-evidence
```

The bounded hole flow uses nine model calls, two baseline tessellations and one
six-query stored-material classification call. Seven source calls cover radius
edit, genuine width/clearance refusals, same-snapshot recovery/no-op and the old
minimal authored file. Two fresh emitted calls cover cold parity and radius
re-edit. Classification revalidation is accounted separately from model calls.
General Boolean composition, arbitrary curved Booleans and actual editor/GPU
acceptance remain separate roadmap dependencies.

The bounded union flow uses eight model calls, plus one CPU-buffer preparation
that rebuilds the native Boolean once and tessellates fourteen baseline panels.
Six source calls cover overlap, width edit, face contact, native edge-contact
refusal, complete disconnected-result refusal and same-snapshot recovery. Two
fresh emitted calls cover cold parity and a taller stepped boss. No extra
classification, no-op model evaluation or visible renderer run is included.

```sh
CAD_MODEL_GPU_MODULE=/path/to/source-bundled-axis-box-boolean-buffers.mjs node --no-opt --max-old-space-size=1536 test/modeling-union-native.mjs
node --no-opt --max-old-space-size=1536 scripts/modeling-union-consumer.mjs test/modeling-union-evidence
```

Provider direct-count reports are asserted separately from model reuse and
inherited work. CONTACT returns no completed native report. Conservative
source-derived ceilings are not measured transitive totals. See #1645 for the
frozen budget, failure preservation and final receipts.

The bounded rectangular-cut flow freezes eight model calls and one CPU preparation,
which rebuilds the native Boolean once and tessellates46 panels. It checks an
underside recess, deeper seat, through-window, complete two-body/empty refusals,
same-snapshot recovery, cold reopen and a disjoint cutter. The actual reports and
source-derived work bounds are recorded separately; full transitive work is not
measured. Run only under a reserved native budget:

```sh
CAD_MODEL_GPU_MODULE=/path/to/source-bundled-axis-box-boolean-buffers.mjs node --no-opt --max-old-space-size=1536 test/modeling-box-cut-native.mjs
node --no-opt --max-old-space-size=1536 scripts/modeling-box-cut-consumer.mjs test/modeling-box-cut-evidence
```

## Cut a through-slot in a union bracket

```ts
import { cad } from '@barocss/cad';

const m = cad.model();
const width = m.parameter('slotWidth', 8);
const base = m.sketch.rectangle({ width: 32, height: 8 }).extrude(8);
const leg = m.sketch.rectangle({ width: 8, height: 24 }).extrude(8);
const bracket = base.union(leg);
const tool = m.sketch.rectangle({
  min: [16, 2], max: [m.dimension.add(16, width), 6],
}).extrude(8);
const slotted = bracket.cut(tool);
const initial = m.build({ bracket, slotted });
const wider = initial.withParameters({ slotWidth: 12 });
const reopened = cad.load(wider.save());
const body = reopened.bodies.slotted;
if (body.family !== 'orthogonal-cell') throw new Error('Expected orthogonal cells');
const volumeMM3 = body.native.report.volumeMM3;
void volumeMM3;
```

The bracket has exact volume 3072 mm³. The slotted part has 2816 mm³ initially
and 2688 mm³ after the edit. This chain alone admits eight nodes and three direct
integer rectangles/extrusions. The third rectangle follows the accepted authored
union prefix; the final cut must consume that union and the distinct third tool.
All boxes start at Z=0. The normal six-node limit remains for other recipes.

The final native schema is `barocss-orthogonal-solid-boolean`, distinct from the
two-box result. Its complete parents and exact original/immediate-parent UV
lineage are preserved. A diagnostic feature with `composition: 'union-slot'`
exposes that real union parent and direct convex tool. Empty or disconnected
results cannot become a `CadShape`; the error retains their complete native data.
Unchanged model features can be reused, but composed native evaluation still
reconstructs its retained union. Save/load never imports a geometry cache.

Composed bracket-slot preview is unavailable in the current editor boundary;
the accepted scene/history remains intact on refusal. A later complete receiver
must validate three-operand occupancy and parent-panel lineage, without treating
this result as the old two-box transport. General nested Booleans, round-post
operations and arbitrary transformed solids remain outside this slice.
