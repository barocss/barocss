# Object API (experimental)

::: warning Experimental: R7 in progress
The object API is R7's first slice in each package, and it changes as R7 goes on. The conventions it follows are the
direction for R7. They aren't settled rules yet.
:::

Each of the three packages has an object facade over its own data-and-functions core:

| Package | Entry | Over | For |
|---|---|---|---|
| @barocss/cad | `@barocss/cad/api` | The kernel's `CadPartDocument` and `evaluateCadPart` | Using the kernel on its own. It replaces the older `createCadModel()` |
| @barocss/cad-model | `@barocss/cad-model/api` | The studio document and its evaluation, mass and STEP | Design in code at the studio's level: materials, and later rows and assemblies |
| @barocss/gpu | `@barocss/gpu/api` | The `Viewer` and its geometry and material data | Putting parts on screen |

The facades are for code. The agent keeps working through its JSON tools, and the studio uses the cores directly.

## The shared rules

- **Immutable objects.** Every method returns a new object, and leaves the one it was called on as it was.
- **One plain-JSON accessor.**
  - The two parts have `.doc`, the document a person or the agent could have written by hand.
  - gpu's scene has `.data`.
  - Typed arrays appear only in mesh data.
- **Each method adds to the document** and calls the core, and computes no geometry of its own. Each package's facade
  reaches its core through one adapter.
- **Results are the core's, as plain data, in millimetres and grams,** with the unit in the name: `volumeMM3`,
  `massG`, `centroidMM` and `inertiaGMM2`, the inertia about the centre of mass.
- **The agent's words.** The modelling verbs are the agent's v2 command names (`box`, `hole`, `fillet`), and their
  options are that command's values with the unit in the name: `{ wMM, dMM, hMM }`, `{ dMM, xMM, yMM }`,
  `{ radiusMM }`.
- **One part, two documents.** Both packages' parts are one implementation (cad's `Part`). Each verb is checked once,
  and a backend writes it into its own document: cad's as kernel features, cad-model's through the studio's own command,
  as the agent's `run_command` does.
- **The same verbs** on both parts: `box`, `hole`, `fillet`, `select`, `mass`, `step` and `meshes`.
- **The same selectors.** `edges()` and `faces()`, with typed filters and no string selectors:
  - the kernel fills them from the B-rep, and cad-model from its display mesh;
  - both hand back the persistent names a feature stores.
- **One error shape.** `BarocssError { code, message, where, details }`, where the message starts with `[CODE]`:
  - the facade's own codes cover only how it was called;
  - a core refusal is passed through with its words.
- **Z-up, as given.** Meshes from either part go into a gpu scene unconverted: the Viewer is Z-up already.
- **The oracle.** A method's `.doc` equals the hand-written document, and its results equal the core's on it.

## @barocss/cad/api

<<< @/../samples/cad-api.test.mjs#import

A kernel part is an immutable object over a `CadPartDocument`:

<<< @/../samples/cad-api.test.mjs#bracket

- **Its document.**
  - `.box({ wMM, dMM, hMM, xMM?, yMM?, zMM? })` adds a rectangle sketch and its extrude, its least corner at
    (x, y, z).
  - `.hole(face, { dMM, xMM, yMM, type?, depthMM? })` adds a hole into the one flat face the selector picks, at (x, y)
    on that face's plane. It goes through unless it is `'blind'` with a `depthMM`. The feature keeps the face by name,
    `face: 'extrude1.top'`, as the studio writes it.
  - `.fillet(edges, { radiusMM })` rounds the edges the selector picks.
  - Feature ids are assigned in order: `sketch1`, `extrude1`, `hole1`…

<<< @/../samples/cad-api.test.mjs#doc

- **Its results.**
  - `.mass({ densityGPerCm3 })` takes a density, since the kernel keeps no material library.
  - `.step(name?)` writes STEP AP214.
  - `.stl()` writes binary STL.
  - `.meshes()` gives each body's display triangles as `{ key, positions, normals, indices }`.
  - The sample checks each against the kernel's own result on the same document.
- **Its errors.**
  - The facade's codes, checked before the kernel: `NO_BODY`, `BODY_AMBIGUOUS`, `SELECTION_EMPTY`, `SELECTION_ONE`
    (a hole's selector picked more than one face), `FACE_NOT_FLAT`, `VALUE` (a value that is no length) and `DENSITY`.
  - A kernel refusal keeps the feature it came from in `details.feature`, and the kernel's error kind in
    `details.kernelCode`.

<<< @/../samples/cad-api.test.mjs#refusals

The kernel's older object API, `createCadModel()`, is to be retired in favour of this one once the facade covers what
its tests use.

## @barocss/cad-model/api

<<< @/../samples/cad-model-api.test.mjs#import

A part over the studio document. The same bracket can be written three ways, and all three give one document, byte for
byte. The sample checks each against the others.

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

- **Its results.** `.mass()` takes a material id from the library, such as `al6061`, or `{ densityGPerCm3 }`. The
  sample checks the mass and `.step()` against the core's. `.meshes()` gives each body's display mesh.
- **Immutability.**

<<< @/../samples/cad-model-api.test.mjs#immutable

- **Selectors.**
  - **Edges:** `along(axis)`, `straight()`, `curved()`, `on(face)`, `where(test)`, `sortBy(axis)`, `first(n)`,
    `last(n)`, `count`, `list()` and `names()`.
  - **Faces:** `facing('+z')`, `planar()` and `curved()`, the same filters and sorts, and `edges()`.

<<< @/../samples/cad-model-api.test.mjs#select

- **Its errors.**
  - The shared part's codes: `NO_BODY`, `BODY_AMBIGUOUS`, `SELECTION_EMPTY`, `SELECTION_ONE`, `FACE_NOT_FLAT` and
    `VALUE`.
  - The studio backend's: `SELECTION_UNKNOWN` (a name not on the part), `UNAVAILABLE` (the studio's command can't run
    here), `MATERIAL_UNKNOWN` and `MASS_UNKNOWN`.
  - A core refusal keeps the core's own words in `details.friendly`.

<<< @/../samples/cad-model-api.test.mjs#refusals

- **Refusals come when the part is evaluated.** On both parts the modelling methods only add features, so a feature
  the kernel refuses surfaces when the part is evaluated: by `.mass()`, `.step()`, `.meshes()` or `.select()`.
- **The kernel's own code comes through.** A fillet too large for its walls is refused as `RADIUS_EXCEEDS_FACE` by
  both parts, with the kernel's words in its message.

## @barocss/gpu/api

<<< @/../samples/gpu-api.test.mjs#import

A scene is an immutable description of meshes, each with its material, lights and a background:

<<< @/../samples/gpu-api.test.mjs#scene

- **Building it.**
  - `scene()` makes an empty scene.
  - `.add(meshes, material?)` takes one mesh, or a part's `.meshes()`.
  - `.light(light)` takes a directional, point or spot light, in the Viewer's own terms.
  - `.background(value)` takes a colour, a gradient or `'transparent'`.
- **`.data`** is the plain description, with `frame: 'z-up'`.
- **`show(viewer, scene)`** presents it through the Viewer's public methods only. It clears the viewer, sets the lights
  and background, adds each mesh under its key, and fits the view. The Viewer stays the one stateful object.
- **Its errors.** `MESH_INVALID` and `LIGHT_INVALID`, in gpu's own `BarocssError` of the same shape: gpu imports
  neither cad package.

<<< @/../samples/gpu-api.test.mjs#refusals

`show()` needs a browser with WebGPU, so this site's sample stops at `.data`. gpu's own tests check `show()` two ways:

- against a stand-in viewer, for the calls it makes, in order;
- in Chrome's WebGPU, with the bracket from `@barocss/cad/api` shown in a real Viewer. The scene's bounds are the part's
  80 × 40 × 10 mm, and the camera's up is +Z.

## What's next

These aren't built yet:

- **More part features:** a cylinder, sketch and extrude, chamfer, shell, patterns and Booleans.
- **`Sketch`, `Plane` and `Location`.**
- **An `Assembly`**, in cad-model.
