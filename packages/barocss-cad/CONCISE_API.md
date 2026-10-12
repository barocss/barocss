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
  exact representability and native work limits still apply. Repeated chamfers,
  curves, fillets and general edge chains are unsupported

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
one through-slab cut and one chamfer, with at most sixteen parameters. These are
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
node --test test/modeling.test.mjs test/public-api.test.mjs
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
