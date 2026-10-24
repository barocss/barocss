# Object API

Each of the three packages has an object facade over its own data-and-functions core:

| Package | Entry | Over | For |
|---|---|---|---|
| @barocss/cad | `@barocss/cad/api` | The kernel's `CadPartDocument` and `evaluateCadPart` | Using the kernel on its own. It replaces the older `createCadModel()` |
| @barocss/cad-model | `@barocss/cad-model/api` | The studio document, its evaluation, mass, STEP and assemblies | Anything the studio opens: materials by id, assemblies, variants and frames |
| @barocss/gpu | `@barocss/gpu/api` | The `Viewer` and its geometry and material data | Putting parts on screen |

The facades are for code. The agent keeps working through its JSON tools, and the studio uses the cores directly.

## The shared rules

- **Immutable objects.** Every method returns a new object, and leaves the one it was called on as it was.
- **One plain-JSON accessor.**
  - The two parts and the assembly have `.doc`, the document a person or the agent could have written by hand.
  - gpu's scene has `.data`.
  - Typed arrays appear only in mesh data.
- **Each method adds to the document** and calls the core, and computes no geometry of its own. Each package's facade
  reaches its core through one adapter.
- **Results are the core's, as plain data, in millimetres and grams,** with the unit in the name: `volumeMM3`,
  `massG`, `centroidMM` and `inertiaGMM2`, the inertia about the centre of mass.
- **The agent's words.** The modelling verbs are the agent's v2 command names, and their options are that command's
  values with the unit in the name: `box({ wMM, dMM, hMM })`, `hole(face, { dMM, xMM, yMM })`,
  `fillet(edges, { radiusMM })`. Two verbs are named for their studio palette entry instead: `box`, which has no v2
  command, and `subtract`, whose command is `difference`.
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

## Parts

<<< @/../samples/cad-api.test.mjs#import

A kernel part is an immutable object over a `CadPartDocument`:

<<< @/../samples/cad-api.test.mjs#bracket

The document it builds is the one you would write by hand. Feature ids are assigned in order: `sketch1`, `extrude1`,
`hole1`… The hole keeps the face it went into by name, `face: 'extrude1.top'`, as the studio writes it.

<<< @/../samples/cad-api.test.mjs#doc

`part(name, doc)` continues a saved document, or another part's `.doc`: it is evaluated once, and the verbs add to it.

### Verbs

Each verb makes a body of its own, or acts on the part's body.

| Verb | v2 command | What it does |
|---|---|---|
| `box({ wMM, dMM, hMM, xMM?, yMM?, zMM? })` | (palette: Box) | A block, its least corner at (x, y, z) |
| `cylinder({ rMM, hMM, xMM?, yMM?, zMM? })` | `cylinder` | A round bar standing on z about (x, y) |
| `extrude(sketch, { hMM, draftDeg? })` | `extrude` | A finished sketch pulled along its plane's normal |
| `revolve(sketch, { axis?, angleDeg? })` | `revolve` | A finished sketch turned about its plane's Y axis (or X), a full turn by default |
| `hole(face, { dMM, xMM, yMM, type?, depthMM? })` | `hole` | A hole into the one flat face the selector picks, at (x, y) on that face's plane; through unless `'blind'` with a `depthMM` |
| `fillet(edges, { radiusMM })` | `fillet` | Rounds the edges the selector picks |
| `chamfer(edges, { distanceMM })` | `chamfer` | Cuts them back at 45° |
| `shell(open?, { tMM })` | `shell` | Hollows the body to walls t thick, leaving the faces the selector picks open; with no selector, a closed hollow |
| `union(tool)`, `subtract(tool)`, `intersect(tool)` | `union`, `difference`, `intersect` | Combines the body with a tool body |
| `linearPattern({ axis, spacingMM, count })` | `linear-pattern` | Copies in a row, joined into one body |
| `circularPattern({ axis?, count, spanDeg?, pxMM?, pyMM? })` | `circular-pattern` | Copies round an axis, joined into one body |
| `moved(location)` | `rotate`, then `move` | Turns the body about X, then Y, then Z through the origin, then moves it |

- **Each verb evaluates its result.** A feature the core refuses is refused at its verb, with the core's code, and the
  part is unchanged.
- **Patterns.** About X or Y the copies are quarter turns, 2 to 4 of them; anything else is refused, typed.
- **No `rotate` verb.** The studio's rotate command turns about the body's centre by default, and the kernel's about
  the origin. `moved()` always turns about the origin.

### Sketches, planes and locations

`sketch(plane?)` starts a sketch on a `Plane`, XY by default. It gives `.rectangle({ wMM, dMM, xMM?, yMM? })`,
`.circle({ rMM, xMM?, yMM? })`, `.polygon(points)`, or a chain `.moveTo(p).lineTo(p).arcTo(p, { center, direction? })`
ended by `.close()`.

- **Planes.** `Plane.XY`, `Plane.XZ` (its normal −Y, so its Y is world Z), `Plane.YZ`, `.offset(dMM)`, and
  `Plane.of({ origin, normal, xAxis })`, which refuses vectors that aren't unit length and square to each other.
- **Locations.** `Location.of({ positionMM, rotationDeg })` and `Location.at(p)`: the documents' pose, turned about X,
  then Y, then Z, through the origin, then moved.
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
  document, so the tool's features take the next ids. It must add exactly one body.

<<< @/../samples/cad-api.test.mjs#bodies

Two separate parts aren't combined: merging two documents would renumber one's ids, and so its names.

<<< @/../samples/cad-api.test.mjs#patterns

### Results

- `.mass({ densityGPerCm3 })` gives the chosen body's mass properties. The kernel keeps no material library, so it
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

## Studio parts

<<< @/../samples/cad-model-api.test.mjs#import

`@barocss/cad-model/api`'s `part()` is the same part, over the studio document. The same bracket can be written three
ways, and all three give one document, byte for byte. The sample checks each against the others.

1. **The document**, as the studio's commands write it. Besides the shape, it keeps:
   - the box's values (`made`), so picking it in the studio edits them again;
   - the face the hole went into (`face`);
   - each filleted edge's geometry where it was picked (`sigs`), so the fillet can find its edges again after an edit.

<<< @/../samples/cad-model-api.test.mjs#raw

2. **The agent's commands.** `run_command`, the features tool's `command`, with the faces and edges by persistent
   name. Written this way, each name has to be read from the result before it.

<<< @/../samples/cad-model-api.test.mjs#commands

3. **The facade.** The same command names, the same values with their units in the names, and selectors in place of
   the names. It runs the studio's own command, as `run_command` does.

<<< @/../samples/cad-model-api.test.mjs#bracket

- **Immutability.**

<<< @/../samples/cad-model-api.test.mjs#immutable

- **Materials.** `.mass()` takes a material id from the library, such as `al6061`, or `{ densityGPerCm3 }`.
  `.material(id)` sets the chosen body's material, or every body's, as the agent's `set_material` writes it. `.mass()`
  with no argument then weighs the body in it, and `.meshes()` carries the id for a scene to look up.

<<< @/../samples/cad-model-api.test.mjs#material

## Assemblies

`assembly(name, base?)` is an immutable assembly over the studio document. The base part is fixed at the origin.
Placed parts are instances, each with its own document, and mates relate their faces.

<<< @/../samples/cad-model-api.test.mjs#assembly

- **The verbs carry the agent's assembly action names.** Each writes what that action writes, and the assembly is
  solved again after it:
  - `addPart(name, part, { at?, grounded? })` is `add_part`, with the part's document as it is;
  - `place(name, { at?, grounded? })` is `place_part`;
  - `addMate(kind, a, b, { distanceMM?, angleDeg?, flip? })` is `add_mate`. Each end is `{ part, face }`: the part is
    `'base'` or a placed part by its name, and the face is a selector picking one face, or a face name;
  - `inputs({ name: input | null })` and `variants({ name: values | null }, active?)` are `set_inputs` and
    `set_variants`. Bindings name parts and mates by id: `parts()` lists the parts' ids, and mates are `m1`, `m2` … in
    order;
  - `frames({ name: { link, at?, kind? } | null })` is `set_frames`. The link is a part by name, and `at` is a Location
    in that part's own coordinates.
- **Its results are plain data:**
  - `parts()`;
  - `placements()`: each placed part's id, name, `positionMM`, `rotationDeg` and grounding;
  - `problems()`: the mates left unmet;
  - `variant(values)`: an assembly with those input values, the master unchanged;
  - `framePoses()`: each frame's world pose;
  - `meshes()`: `base/<body>` and `<part>/<body>`, each part where it stands;
  - `part(name)`: a placed part as a studio part, in its own coordinates.
- **Not yet in the facade:** editing a placed part in place; deleting or editing parts and mates; library parts;
  joints and kinematics; an assembly's STEP and BOM.

## Errors

<<< @/../samples/cad-api.test.mjs#refusals

- **The facade's own codes,** checked before the core:
  - the part: `NO_BODY`, `BODY_AMBIGUOUS`, `BODY_UNKNOWN`, `SELECTION_EMPTY`, `SELECTION_ONE` (a hole's selector picked
    more than one face, or a tool callback added more than one body), `FACE_NOT_FLAT`, `VALUE` (a value out of its
    range or type) and `DENSITY`;
  - the studio part: `SELECTION_UNKNOWN` (a name not on the part), `UNAVAILABLE` (the studio's command can't run here),
    `MATERIAL_UNKNOWN` and `MASS_UNKNOWN`;
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
  - `.camera(view, { projection?, fovYDeg? })` takes `'iso'`, `'front'`, `'back'`, `'right'`, `'left'`, `'top'`,
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

- **Part features:** split, mirror and parameters.
- **Rows:** reading a person's rows file. Under the rows rule the facade never writes rows.
- **More of the assembly,** as listed under [Assemblies](#assemblies).
