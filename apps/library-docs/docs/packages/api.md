<script setup>
import { defineAsyncComponent } from 'vue';
import apiResults from '../.vitepress/components/api-result-scenes.json';
const ApiResultGallery = defineAsyncComponent(() => import('../.vitepress/components/ApiResultGallery.vue'));
const resultNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 });
function resultSummary(id) {
  const item = apiResults.cases?.find(result => result.id === id);
  if (!Number.isFinite(item?.mass?.volume) || !Number.isFinite(item?.mass?.mass)) return 'API run: NOT_RUN. Saved result values are unavailable.';
  return `Returned volume: ${resultNumber.format(item.mass.volume)} mm³. Mass: ${resultNumber.format(item.mass.mass)} g at 2.7 g/cm³.`;
}
</script>

# Object API

Each of the three packages has an object facade over its own data-and-functions core:

| Package | Entry | Over | For |
|---|---|---|---|
| @barocss/cad | `@barocss/cad/api` | The kernel's `CadPartDocument` and `evaluateCadPart` | Using the kernel on its own. It replaces the older `createCadModel()` |
| @barocss/cad-model | `@barocss/cad-model/api` | The CAD model document, its evaluation, mass, STEP and assemblies | Materials by id, assemblies, variants and frames, in code or in Studio |
| @barocss/gpu | `@barocss/gpu/api` | The `Viewer` and its geometry and material data | Putting parts on screen |

Both Part APIs build and evaluate a model. Choose the document and workflow you need:

| | CAD kernel part | CAD model part |
|---|---|---|
| Import | `@barocss/cad/api` | `@barocss/cad-model/api` |
| Document returned by `.doc` | `CadPartDocument`, format `barocss-cad-part`, with `features` | `StudioDoc`, format `barocss-cad-model`, with `nodes` and `outputs` |
| Use it when | You need the CAD kernel and its feature document in code. | You need the CAD model document, materials, configurations or drawing and manufacturing outputs. |
| Shared modeling | Box, hole, fillet, Boolean operations, mass, meshes, STEP and STL | The same modeling interface and result methods, using the CAD model document |
| Additional model operations | Supply a density for mass. | Set a material id; save configurations; generate drawings and manufacturing outputs. The model part also provides gear, spring and fastener commands. |

The modeling calls can look the same, but the two `.doc` values have different formats:

```js
import { part as kernelPart } from '@barocss/cad/api';
import { part as modelPart } from '@barocss/cad-model/api';

const kernel = kernelPart('plate').box({ w: 80, d: 40, h: 10 });
const model = modelPart('plate').box({ w: 80, d: 40, h: 10 });
console.log(kernel.doc.format); // 'barocss-cad-part'
console.log(model.doc.format); // 'barocss-cad-model'
```

Each facade is an API for code. CAD Model's document type is named `StudioDoc` in the source. It is a data model that
code can use independently; Studio is an editor that also uses that model and its core. The CAD model part facade writes
commands into the document. Calling the facade does not control an open Studio screen. The agent works through its JSON tools.

## The shared rules

- **Immutable objects.** Every method returns a new object, and leaves the one it was called on as it was.
- **One plain-JSON accessor.**
  - The two parts and the assembly have `.doc`, the document a person or the agent could have written by hand.
  - gpu's scene has `.data`.
  - Typed arrays appear only in mesh data.
- **Each method adds to the document** and calls the core, and computes no geometry of its own. Each package's facade
  reaches its core through one adapter.
- **Modeling units.** Lengths are in millimetres, angles in degrees and density in g/cm³. Mass results use
  millimetres and grams. The confirmed R7 [robot contract](/studio/robots#robot-unit-boundaries) extends these units
  to public replies and stored joint settings. It uses N·mm for turning effort, mm/s² for gravity and seconds for
  time. Robot samples check angular metadata, B1 inertia/gravity and the CLI's shared B2 duty/report adapters.
  Further field changes and final combined checks are pending. Native robot files retain their format-specific SI units.
- **Results are plain data.** Mass results contain `volume` in mm³, `mass` in g, `centroid` in mm and
  `inertia` in g·mm² about the centre of mass. A numeric `density` is in g/cm³.
- **The agent's words.** The modelling verbs are the agent's v2 command names, and their options are that command's
  value names, with no unit in the name: `box({ w, d, h })`, `hole(face, { d, x, y })`, `fillet(edges, { radius })`.
  Where no command names a value, the option is named for it: `mass({ density })`. Two verbs are named for their
  studio palette entry instead: `box`, which has no v2 command, and `subtract`, whose command is `difference`.
- **One part, two documents.** Both packages' parts are one implementation (cad's `Part`). Each verb is checked once,
  and a backend writes it into its own document: cad's as kernel features, cad-model's through the studio's own command,
  as the agent's `run_command` does.
- **The same selectors.** `edges()` and `faces()`, with typed filters and no string selectors:
  - the kernel fills them from the B-rep, and cad-model from its display mesh;
  - both hand back the persistent names a feature stores.
- **One error shape.** `BarocssError { code, message, where, details }`, where the message starts with `[CODE]`:
  - the facade's own codes cover only how it was called, with `where: 'facade'`;
  - a core refusal is passed through with its code and words, with `where: 'evaluate'` or `'export'`.
- **Z-up, as given.** Meshes from either part go into a gpu scene unconverted: the Viewer is Z-up already.
- **The oracle.** Each package's tests check every method two ways: its `.doc` equals the hand-written document, and
  its results equal the core's on that document, byte for byte. cad-model's `.doc` also equals what the agent's tools
  write for the same calls.

## See actual API results

These three saved cases follow the public `@barocss/cad/api`: an 80 × 40 × 10 mm box, a through hole, then four
rounded vertical edges. Each operation returns a new part. The earlier parts stay unchanged.

The coordinates are Z-up, in mm. Mass uses a density of 2.7 g/cm³. The 3D view draws the actual Float32 tessellated
mesh returned by the public API; the JPEGs show those saved meshes. Display triangles approximate curved surfaces
and do not guarantee the kernel's geometric tolerance. This is a documentation view of fixed API results.

Choose a case to read its executed code, inputs and returned mass properties. **Source bundle provenance** records
the source and generation conditions. Missing result data is shown as `NOT_RUN`, not a successful API run.

<ApiResultGallery />

### 01 · Box

Create the box with `box({ w: 80, d: 40, h: 10 })`.

![Public API result: an 80 by 40 by 10 mm box, Z up](/shots/api-results/box.jpg)

<p>{{ resultSummary('box') }}</p>

### 02 · Through hole

From the box, select the +Z face and make a diameter 8 mm through hole at face coordinates `(20, 20)`.

![Public API result: the box after a diameter 8 mm through hole at 20, 20](/shots/api-results/holed.jpg)

<p>{{ resultSummary('holed') }}</p>

### 03 · Rounded vertical edges

From the holed part, select its four vertical edges and apply a 2 mm fillet radius.

![Public API result: the holed box after rounding four vertical edges with radius 2 mm](/shots/api-results/rounded.jpg)

<p>{{ resultSummary('rounded') }}</p>

## CAD kernel part {#parts}

<<< @/../samples/cad-api.test.mjs#import

A CAD kernel part is an immutable object over a `CadPartDocument`. Use it to work with the CAD kernel in code:

<<< @/../samples/cad-api.test.mjs#bracket

The document it builds is the one you would write by hand. Feature ids are assigned in order: `sketch1`, `extrude1`,
`hole1`… The hole keeps the face it went into by name, `face: 'extrude1.top'`, as the studio writes it.

<<< @/../samples/cad-api.test.mjs#doc

`part(name, doc)` continues a saved document, or another part's `.doc`: it is evaluated once, and the verbs add to it.

### Verbs

Each verb makes a body of its own, or acts on the part's body.

| Verb | v2 command | What it does |
|---|---|---|
| `box({ w, d, h, x?, y?, z? })` | (palette: Box) | A block, its least corner at (x, y, z) |
| `cylinder({ r, h, x?, y?, z? })` | `cylinder` | A round bar standing on z about (x, y) |
| `extrude(sketch, { h, draft? })` | `extrude` | A finished sketch pulled along its plane's normal |
| `revolve(sketch, { axis?, deg? })` | `revolve` | A finished sketch turned about its plane's Y axis (or X), a full turn by default |
| `hole(face, { d, x, y, type?, depth? })` | `hole` | A hole into the one flat face the selector picks, at (x, y) on that face's plane; through unless `'blind'` with a `depth` |
| `fillet(edges, { radius })` | `fillet` | Rounds the edges the selector picks |
| `chamfer(edges, { distance })` | `chamfer` | Cuts them back at 45° |
| `shell(open?, { t })` | `shell` | Hollows the body to walls t thick, leaving the faces the selector picks open; with no selector, a closed hollow |
| `union(tool)`, `subtract(tool)`, `intersect(tool)` | `union`, `difference`, `intersect` | Combines the body with a tool body |
| `linearPattern({ axis, spacing, count })` | `linear-pattern` | Copies in a row, joined into one body |
| `circularPattern({ axis?, count, span?, px?, py? })` | `circular-pattern` | Copies round an axis, joined into one body |
| `mirror({ plane, at? })` | `mirror` | Joins the body with its image across the plane `'yz'`, `'xz'` or `'xy'`, through `at` on its axis (0 unless given) |
| `scale({ factor, pivot? })` | `scale` | Scales the body by the factor, about the pivot (the origin unless given) |
| `split({ axis, at })`, `split({ normal, at })` | `split` | Cuts the body in two by a plane, each side a body of its own |
| `moved(location)` | `rotate`, then `move` | Turns the body about X, then Y, then Z through the origin, then moves it |

- **Each verb evaluates its result.** A feature the core refuses is refused at its verb, with the core's code, and the
  part is unchanged.
- **Patterns.** About X or Y the copies are quarter turns, 2 to 4 of them; anything else is refused, typed.
- **No `rotate` verb.** The studio's rotate command turns about the body's centre by default, and the kernel's about
  the origin. `moved()` always turns about the origin.
- **Mirror and scale** work about the origin unless given `at` or `pivot`. A mirror plane off the origin is written as
  the studio writes it: a move, the mirror, and a move back.

<<< @/../samples/cad-api.test.mjs#transforms

### Sketches, planes and locations

`sketch(plane?)` starts a sketch on a `Plane`, XY by default. It gives `.rectangle({ w, d, x?, y? })`,
`.circle({ r, x?, y? })`, `.polygon(points)`, or a chain `.moveTo(p).lineTo(p).arcTo(p, { center, direction? })`
ended by `.close()`.

- **Planes.** `Plane.XY`, `Plane.XZ` (its normal −Y, so its Y is world Z), `Plane.YZ`, `.offset(distance)`, and
  `Plane.of({ origin, normal, xAxis })`, which refuses vectors that aren't unit length and square to each other.
- **Locations.** `Location.of({ position, rotation })` and `Location.at(position)`: the documents' pose, turned about
  X, then Y, then Z, through the origin, then moved.
- **Plain data.** A sketch, a plane and a location are immutable, and each has `.data`, the shape the documents
  carry.
- **Stable side names.** Every side of a facade sketch is tagged (`e1`, `e2` …), as the studio's sketcher tags the
  sketches it draws. So its walls keep their names when a vertex is added to the sketch later.

<<< @/../samples/cad-api.test.mjs#sketch

### Several bodies

- **`bodies()`** lists the part's bodies in the core's order: the kernel's output ids (`extrude1`, `fillet1` …), or the
  studio's keys (`b1`, `b3` …).
- **`body(name)`** returns the same part with its verbs, `select()` and `mass()` acting on that body. `.doc` doesn't
  change: the choice is the facade's view, never written. It follows its body through a verb that replaces it.
- **With several bodies and none chosen,** a verb refuses with `BODY_AMBIGUOUS`. `step()` writes every body, and
  `meshes()` gives every body.
- **A Boolean's tool** is a body of the part by name, or a callback that adds it. The callback builds in the part's own
  document, so the tool's features take the next ids. It must add exactly one body. Its verbs after the first act on
  the body it made, so a callback can pattern or round its tool before the Boolean.

<<< @/../samples/cad-api.test.mjs#bodies

#### Split a body and inspect each result

Start with a 10 × 20 × 5 mm box at the origin. The plane `x = 4` cuts it into two bodies:

```text
        x = 0       x = 4               x = 10
           |-----------|--------------------|
             4 mm             6 mm
               split1/0         split1/1
```

```js
import { part } from '@barocss/cad/api';

const divided = part('block')
  .box({ w: 10, d: 20, h: 5 })
  .split({ axis: 'x', at: 4 });

const names = divided.bodies();
// For this document: ['split1/0', 'split1/1']
const results = names.map(name => ({
  name,
  mass: divided.body(name).mass({ density: 1 }),
}));
```

For this box, the expected volumes from its dimensions are 400 mm³ and 600 mm³. At 1 g/cm³, the expected masses
are 0.4 g and 0.6 g. These are calculated expectations, not a new captured API run. The sample test above checks
the two volumes. Names use the split feature id and a side index; call `bodies()` to get the names for your own
part. `body(name)` selects one result without changing the document. With two bodies and no selection, `mass()`
and other single-body operations refuse with `BODY_AMBIGUOUS`. `meshes()` still returns all bodies, each with a
`key`, so use the key to associate a display mesh with a body.

You can also set an oblique plane with `split({ normal: [1, 1, 0], at: 10 })`: it is the plane `x + y = 10`.
In general, the plane is `normal · [x, y, z] = at`; changing the scale of the normal changes that equation unless
`at` is scaled by the same factor. The normal must be finite and have length greater than `1e-9`. A split plane
that does not cross the target body is refused.

<<< @/../samples/cad-api.test.mjs#finned

Two separate parts aren't combined: merging two documents would renumber one's ids, and so its names.

<<< @/../samples/cad-api.test.mjs#patterns

### Results

- `.mass({ density })` gives the chosen body's mass properties. The kernel keeps no material library, so it
  takes a density; cad-model's part also takes a material id.
- `.step(name?)` writes every body as one STEP AP214 file.
- `.stl()` writes the body as binary STL. It's on the kernel part only.
- `.meshes()` gives each body's display mesh as `{ key, positions, normals, indices, lines }`. `lines` are the display
  edges as segment pairs: the edges a selector offers, with seams and smooth joins left out.

<<< @/../samples/cad-api.test.mjs#lines

### Selectors

- **Edges:** `along(axis)`, `straight()`, `curved()`, `on(face)`, `where(test)`, `sortBy(axis)`, `first(n)`,
  `last(n)`, `count`, `list()` and `names()`.
- **Faces:** `facing('+z')`, `planar()` and `curved()`, the same filters and sorts, and `edges()`.
- **What they offer:** the edges a person could pick in the studio, and nothing else. A cylinder's seam and the joint
  between a hole's two half-cylinders are left out, since there is no corner there to round.
- **Names, not indices.** A selector resolves to the edges' persistent names, such as `n1.side0|n1.side1`, when the
  verb runs. Editing an earlier feature keeps the names, so the feature follows the same edges, or is refused, typed,
  when they are gone. It is never given other edges.

<<< @/../samples/cad-model-api.test.mjs#select

## CAD model part {#studio-parts}

<<< @/../samples/cad-model-api.test.mjs#import

`@barocss/cad-model/api`'s `part()` builds a CAD model part over a `StudioDoc`. It shares the modeling interface with the
CAD kernel part and adds document, material, drawing and manufacturing features. The same bracket can be written three ways as a CAD model document. The sample
checks that all three ways give the same document, byte for byte.

1. **The document**, as the studio's commands write it. Besides the shape, it keeps:
   - the box's values (`made`), so picking it in the studio edits them again;
   - the face the hole went into (`face`);
   - each filleted edge's geometry where it was picked (`sigs`), so the fillet can find its edges again after an edit.

<<< @/../samples/cad-model-api.test.mjs#raw

2. **The agent's commands.** `run_command`, the features tool's `command`, with the faces and edges by persistent
   name. Written this way, each name has to be read from the result before it.

<<< @/../samples/cad-model-api.test.mjs#commands

3. **The facade.** The same command names, the same value names, and selectors in place of the names. It runs the
   studio's own command, as `run_command` does.

<<< @/../samples/cad-model-api.test.mjs#bracket

- **Immutability.**

<<< @/../samples/cad-model-api.test.mjs#immutable

- **Materials.** `.mass()` takes a material id from the library, such as `al6061`, or `{ density }`.
  `.material(id)` sets the chosen body's material, or every body's, as the agent's `set_material` writes it. `.mass()`
  with no argument then weighs the body in it, and `.meshes()` carries the id for a scene to look up.

<<< @/../samples/cad-model-api.test.mjs#material

### The studio's own commands

The CAD model part also runs commands the kernel has no feature for. Each writes what the agent's `run_command`
writes, and the kernel part refuses them with `UNAVAILABLE`.

| Verb | v2 command | What it does |
|---|---|---|
| `gear({ m, teeth, b, shift?, helix?, hand?, bore?, x?, y?, z? })` | `gear` | An involute spur or helical gear, a body of its own |
| `gearMesh({ teeth, dir, bore?, shift? })` | `gear-mesh` | A gear meshing with the chosen one, `dir` degrees from +X |
| `spring({ type, d, D, n, p, ends, hand, … })` | `spring` | A coil spring of round wire, by the command's values |
| `fastener({ kind, size, length?, joint?, grip?, x?, y?, z?, model? })` | `fastener` | A bolt, screw, nut or washer, from the document's fastener-size rows |

<<< @/../samples/cad-model-api.test.mjs#gears

- **Rows come from a person's file.** `loadRows(kind, { name, text })` loads a rows file as the studio's Library does,
  with a receipt naming the file. The facade never writes rows itself, and nothing is built in, so `fastener` is refused
  until fastener sizes are loaded. The same file always loads the same bytes. The sample uses the rows cad-model ships
  under `samples/rows/`.

<<< @/../samples/cad-model-api.test.mjs#fastener

## Parameters, configurations and suppression

A parameter is a named value in the document's `parameters`, and a dimension follows it as the documents' own
reference, `{ parameter: 'W' }`. `param('W')` writes one. Both parts write the document a person would make: the kernel
part writes the reference into its feature, and the CAD model part binds it as the studio's feature editor does.

<<< @/../samples/cad-api.test.mjs#kernel-parameters

- **`parameter(name, value)`** adds or sets a parameter. A name is a letter, then letters, digits and `_`, up to 32.
  `parameters()` lists them.
- **`withParameters({ name: value })`** returns a new part at the new values. It's re-evaluated at its next result,
  and its features keep the faces and edges they stored. `withParameters(doc, edits)` does the same to a plain document.
- **Which options can follow a parameter.** Only one that lands as it is in one place in the document, the same rule
  as the studio's feature editor:
  - `box`: `w` and `d` while `x` and `y` are 0, and `h`;
  - `cylinder`: `x`, `y` and `h` (not `r`: the studio's editor edits the diameter);
  - `extrude`: `h`; `hole`: `x` and `y` (not `d`: the hole is stored by its radius);
  - `fillet`: `radius`; `chamfer`: `distance`; `shell`: `t`; `linearPattern`: `spacing`; `split`: `at`;
  - in the CAD model part also `revolve`'s `deg`, `linearPattern`'s `count` and `scale`'s `factor`, which a kernel
    document holds as plain numbers.

  Any other option given a parameter is refused with `PARAMETER_UNBINDABLE`, naming the ones that bind. A number is
  never written in its place. Sketch sizes and a `Location` take numbers only.

<<< @/../samples/cad-model-api.test.mjs#parameters

- **Configurations** are the CAD model part's saved sets of parameter values. `configuration(name)` saves the current
  values, as the Parameters panel's Save; `withConfiguration(name)` applies them, as its Apply; `configurations()` lists
  them.

<<< @/../samples/cad-model-api.test.mjs#configurations

- **Features and suppression.** `features()` lists each feature's `{ id, kind, label }`, the last one being the feature
  the last verb added. `suppressed(id)` switches a feature off and `suppressed(id, false)` back on, as the History
  panel's toggle does. A sketch, a split or a separate can't be switched off. It's the CAD model part's: the kernel
  document has no suppression yet, so the kernel part refuses it with `UNAVAILABLE`.

<<< @/../samples/cad-model-api.test.mjs#suppression

- **No expressions.** Neither document can store one, such as `W / 2`, so a dimension follows one parameter as it is.

## Assemblies

`assembly(name, base?)` is an immutable assembly over the CAD model document. The base part is fixed at the origin.
Placed parts are instances, each with its own document, and mates relate their faces.

<<< @/../samples/cad-model-api.test.mjs#assembly

- **The verbs carry the agent's assembly action names.** Each writes what that action writes, and the assembly is
  solved again after it:
  - `addPart(name, part, { at?, grounded? })` is `add_part`, with the part's document as it is;
  - `place(name, { at?, grounded? })` is `place_part`;
  - `addMate(kind, a, b, { distance?, angle?, flip? })` is `add_mate`. Each end is `{ part, face, body? }`: the part is
    `'base'` or a placed part by its name, and the face is a selector picking one face, or a face name;
  - `inputs({ name: input | null })` and `variants({ name: values | null }, active?)` are `set_inputs` and
    `set_variants`. Bindings name parts and mates by id: `parts()` lists the parts' ids, and mates are `m1`, `m2` … in
    order;
  - `frames({ name: { link, at?, kind? } | null })` is `set_frames`. The link is a part by name, and `at` is a Location
    in that part's own coordinates.
  - `lock(name, to?)` fixes a placed part to another part, the base by default, at its current placement.

For a face-selector callback, supply `body` with that part's body key when it has several bodies. With no `body`,
only a single-body part is selected automatically. An unavailable or ambiguous body gives `NO_BODY` or
`BODY_AMBIGUOUS`; a callback selecting zero or several faces gives `SELECTION_ONE`. A string face name does not
use this callback body-selection step.

Distance mates require a finite distance in mm. Angle mates require a finite angle from 0° to 180°, inclusive.
Missing or non-finite facade values give `VALUE`; an out-of-range angle is refused with `MATE_FACES`.
`addMate` normally moves the second end's part. If it is fixed and the first is free, the ends swap. Two fixed
ends give `MATE_BOTH_FIXED`; ends on the same part give `MATE_SAME_PART`. `place` re-solves the mates, and
`grounded: true` on a part already moved by a mate gives `PART_MATED`.

- **Its results are plain data:**
  - `parts()`;
  - `placements()`: each placed part's id, name, `position` (mm), `rotation` (degrees) and grounding;
  - `problems()`: the mates left unmet;
  - `variant(values)`: an assembly with those input values, the master unchanged;
  - `framePoses()`: each frame's world pose, as `position` and `rotation`;
  - `meshes()`: `base/<body>` and `<part>/<body>`, each part where it stands;
  - `part(name)`: a placed part as a CAD model part, in its own coordinates.
- **`robot()`** gives the assembly's joints, kinematics, motion checks and robot exports. See [Robots](/studio/robots)
  for the supported joints and motion limits.
- **Not yet in the facade:** editing a placed part in place; deleting or editing parts and mates; library parts;
  an assembly's STEP.

## Manufacturing inputs and outputs

The CAD model part can set its manufacturing inputs and produce the same outputs as the agent's tools. These methods
call the studio core. They keep its typed refusals.

| Method | What it writes or returns |
|---|---|
| `process(id, { pull? })` | The part's process and, for a casting, its pull direction |
| `casting(options)` | The pattern inputs, including machined faces, gate and shrinkage |
| `drawingSettings(options)` | The drawing settings |
| `autoDimension()` | Dimensions added by the drawing core |
| `bought()` | The part's bodies marked as bought |
| `named(name)` | The chosen body's display name |
| `drawing()` | The sheet, its issues, and SVG, DXF and PDF files |
| `await manufacturability(options?)` | The process report, as `check_printability` returns it |
| `await camPackage(options?)` | The 2.5D CAM preview reply from `output_cam_package`, not for production |

An assembly also has `drawingSettings(options)` and `drawing()`. Its `await bom()` returns the `output_bom` reply;
`await purchaseCsv(withMade?)` returns the `output_purchase_csv` reply. The purchase list leaves out made parts
unless `withMade` is true.

A report can contain failed rules. Receiving it does not mean the part passed its checks. A CAM package needs stock
rows from a person's file; without them it refuses with `STOCK_NONE_LOADED`. No stock table is built in.

### Product example: single-cylinder engine

The repository's `examples/products/engine-1cyl/` uses the studio facade to build a single-cylinder four-stroke engine.
Its merged milestone 3 includes manufacturing inputs, dimensioned drawings, reports, the BOM and the purchase list.
The saved assembly is `engine.bcad`. `build.ts` constructs it; `check.ts` checks a saved document, regardless of how
it was built. `engine.test.mjs` checks the saved build and includes a negative case with the piston's bore mate removed.

The example's checks cover parts, assembly constraints, the slider-crank cycle, timing, sweep, masses, balance and
outputs. Its unit tests omit the sweep; the full runner includes it. These are scripted checks. They do not establish
live-agent or manufacturing acceptance.

The example still has limits:

- **Missing rows (PG-2).** The spark-plug thread and main bearings need rows from a source the owner supplies.
  The plain plug hole and bearing stand-ins do not establish a catalogue fit.
- **Evaluation cost (PG-3).** The engine head and valve spring still need profiling.
- **Example workarounds.** Although the core now supports cam mates, locked-gear coupling, running-fit contact and
  closed-loop motions, this saved example still builds gears into their shafts, parks its followers and uses its own
  cycle and sweep checks. Those newer core features do not by themselves verify a rebuilt engine.
- **CAM waits (PG-9).** No stock list ships with the example. The output check accepts `STOCK_NONE_LOADED` as a
  named wait, so a passing check can still have no CAM package.
- **Base-body names (PG-10).** The BOM still lists the base part's bodies by key, even when their display names are set.

See [Shop rows](/studio/rows), [Manufacturing](/studio/manufacturing) and [BOM and quotes](/studio/bom) for the inputs
these outputs need.

## Errors

<<< @/../samples/cad-api.test.mjs#refusals

- **The facade's own codes,** checked before the core:
  - the part: `NO_BODY`, `BODY_AMBIGUOUS`, `BODY_UNKNOWN`, `SELECTION_EMPTY`, `SELECTION_ONE` (a hole's selector picked
    more than one face, or a tool callback added more than one body), `FACE_NOT_FLAT`, `VALUE` (a value out of its
    range or type), `DENSITY`, `PARAMETER_NAME`, `PARAMETER_UNKNOWN`, `PARAMETER_UNBINDABLE` and `FEATURE_UNKNOWN`;
  - the CAD model part: `SELECTION_UNKNOWN` (a name not on the part), `UNAVAILABLE` (the studio's command can't run here),
    `MATERIAL_UNKNOWN`, `MASS_UNKNOWN` and `CONFIGURATION_UNKNOWN`;
  - the assembly: `NAME_TAKEN` and `PART_UNKNOWN`.
- **The core's refusals pass through** with their own code and words. A kernel refusal keeps the feature it came from
  in `details.feature`; a studio one keeps the core's own words in `details.friendly`. A fillet too large for its walls
  is refused as `RADIUS_EXCEEDS_FACE` by both parts.

<<< @/../samples/cad-model-api.test.mjs#refusals

## Scenes

<<< @/../samples/gpu-api.test.mjs#import

A scene is an immutable description of meshes, each with its material, lights, a background and a camera view:

<<< @/../samples/gpu-api.test.mjs#scene

- **Building it.**
  - `scene()` makes an empty scene.
  - `.add(meshes, material?, { lines? })` takes one mesh, or a part's `.meshes()`. The material is a Material, or the
    id of one the scene registered; without one, each mesh takes the scene material its body names.
    `lines: true` (or a Material) also adds each mesh's display lines as line geometry, keyed `<key>/lines`, thin and
    dark by default (`LINE_MATERIAL`).
  - `.material(id, look)` registers a Material under an id: a part's material id, such as `al6061`, or one of your own.
    No look is built in for a material id.
  - `.light(light)` takes a directional, point or spot light, in the Viewer's own terms.
  - `.background(value)` takes a colour, a gradient or `'transparent'`.
  - `.camera(view, { projection?, fovY? })` takes `'iso'`, `'front'`, `'back'`, `'right'`, `'left'`, `'top'`,
    `'bottom'`, or `{ direction, up? }`: the direction from the scene to the eye. The top and bottom views keep +Y up,
    the others +Z.
- **`.data`** is the plain description, with `frame: 'z-up'`. Material ids stay ids in it, and the looks are under
  `materials`.
- **`show(viewer, scene)`** presents it through the Viewer's public methods only. It:
  - clears the viewer;
  - sets the lights and background, when the scene has them;
  - adds each mesh under its key, with its material resolved;
  - when the scene has a camera view, sets the camera's projection, field of view and up, and puts the eye along the
    view's direction;
  - fits the view.

  The Viewer stays the one stateful object.

<<< @/../samples/gpu-api.test.mjs#looks

- **Its errors.** `MESH_INVALID`, `LIGHT_INVALID`, `MATERIAL_UNKNOWN`, `MATERIAL_INVALID` and `CAMERA_INVALID`, in
  gpu's own `BarocssError` of the same shape: gpu imports neither cad package.

<<< @/../samples/gpu-api.test.mjs#refusals

`show()` needs a browser with WebGPU, so this site's samples stop at `.data`. gpu's own tests check `show()` two ways:

- against a stand-in viewer, for the calls it makes, in order;
- in Chrome's WebGPU, on a hardware adapter and on SwiftShader. A plate with a bore is drawn from the top,
  orthographic: its top in al6061's registered look, the background through the bore, and a display line on the bore's
  rim.

## Not in the facades yet

- **Expressions** in dimensions, and feature names of your own: the stable ids (`n3`, `fillet1`) serve.
- **Suppression in the kernel part,** until the kernel document carries it.
- **More of the assembly,** as listed under [Assemblies](#assemblies).
