# Object API (experimental)

::: warning Experimental: R7 in progress
The object API is the first slice of R7, and it changes as R7 goes on. The conventions it follows are the direction
for R7. They aren't settled rules yet.
:::

`@barocss/cad-model/api` is an object facade over the document model's data-and-functions core.

- **Immutable parts.** A part is an immutable object. Every method returns a new part, and leaves the one it was
  called on as it was.
- **It builds the document.** Each modelling method adds feature nodes to the studio document through the core, and
  computes no geometry of its own.
- **`.doc` is the document.** It is always the plain JSON document: the same one the studio, the agent's tools,
  saving and opening use.
- **Results come from the core.** Mass and STEP are the core's own, as plain data.
- **For code, not the agent.** It's a library API. The agent keeps working through its JSON tools, and the studio
  uses the core directly.

<<< @/../samples/api-part.test.mjs#import

## The same bracket, three ways

An 80 × 40 × 10 block, a Ø8 hole through it at (20, 20), and its four vertical edges rounded R2.

**Through the facade:**

<<< @/../samples/api-part.test.mjs#bracket

**Through the core functions**, which is the same document byte for byte. Here you write the node indices and the
persistent edge names yourself:

<<< @/../samples/api-part.test.mjs#core

**As the raw document**, the JSON either of them produces:

```json
{ "format": "barocss-cad-model", "schema": 3, "units": "mm", "parameters": {},
  "nodes": [
    { "kind": "sketch", "profile": "rectangle", "min": [0, 0], "max": [80, 40], "id": "n0" },
    { "kind": "extrude", "sketch": 0, "height": 10, "id": "n1" },
    { "kind": "hole", "parent": { "node": 1, "side": "solid" }, "center": [20, 20], "radius": 4, "id": "n2" },
    { "kind": "fillet", "parent": { "node": 2, "side": "solid" },
      "edges": ["n1.side0|n1.side1", "n1.side0|n1.side3", "n1.side1|n1.side2", "n1.side2|n1.side3"], "radius": 2, "id": "n3" } ],
  "outputs": { "b3": { "node": 3, "side": "solid" } }, "nextId": 4 }
```

The sample checks the facade against the core functions on the same document: its mass, and its STEP with the time
stamp set aside.

## What works now

### Parts

- `part(name?)` makes an empty part.
- `.box(widthMM, depthMM, heightMM)` makes a block with its corner at the origin. It must be the part's first body.
- `.hole({ at, diameterMM, depthMM? })` cuts a round hole into the body, through it unless a depth is given. `at` is
  the centre on the body's sketch plane.
- `.fillet(select, radiusMM)` rounds the edges a selector picks.
- **One body at a time.** The features act on the part's one body. A part of several bodies is refused until a body
  chooser comes.

<<< @/../samples/api-part.test.mjs#immutable

### Selectors

`.select()` gives the body's edges and faces, read from what the core's evaluation worked out. Each filter is a typed
method, never a string selector, and returns a new query.

- **Edges:**
  - `along(axis)`;
  - `straight()` and `curved()`;
  - `on(faceName)`;
  - `where(test)`;
  - `sortBy(axis)`;
  - `first(n)` and `last(n)`;
  - `count` and `list()`;
  - `names()`, the persistent names a feature stores.
- **Faces:**
  - `facing('+z')`, or another axis direction;
  - `planar()` and `curved()`;
  - `where(test)`, `sortBy(axis)`, `first(n)`, `last(n)`, `count`, `list()` and `names()`;
  - `edges()`, the edges that bound the faces.

<<< @/../samples/api-part.test.mjs#select

### Results

- **`.doc`** is a copy of the plain JSON document: changing it changes nothing in the part.
- **`.mass(material)`** takes a material id from the library, such as `al6061`. It returns
  `{ volumeMM3, massG, centroidMM, inertiaGMM2 }` in millimetres and grams; the inertia is about the centre of mass.
- **`.step(name?)`** returns the part as one STEP AP214 file of the core's exact solids.

### Errors

- **One error class.** Every refusal is a `BarocssError`, with:
  - `code`;
  - `message`, which starts with `[CODE]`;
  - `where`: `facade`, `evaluate` or `export`;
  - `details`.
- **The facade's own codes** cover only how it was called:
  - `NO_BODY`: a feature before `box()`;
  - `BODY_AMBIGUOUS`: a part of several bodies;
  - `BOX_NOT_FIRST`: a box on a part with features;
  - `SELECTION_EMPTY`: a selector that picks nothing;
  - `MATERIAL_UNKNOWN`: a material that isn't in the library;
  - `MASS_UNKNOWN`: a body with no volume.
- **Core refusals are passed through.** The facade makes up no geometry rules of its own: a refusal of the core is
  passed through with its words, and `details.friendly` keeps the core's title, hint and detail.
- **Refusals come when the part is evaluated.** The modelling methods only add nodes, so a feature the kernel refuses
  surfaces when the part is evaluated: by `.mass()`, `.step()` or `.select()`.
- **Limit: the kernel's own code doesn't come through yet.** A refusal such as a fillet too large for its walls arrives
  with the code `EVALUATION`, not the kernel's `RADIUS_EXCEEDS_FACE`. Its words are kept in `details`.

<<< @/../samples/api-part.test.mjs#refusals

## What's next

These aren't built yet:

- **More part features:** a cylinder, sketch and extrude, chamfer, shell, patterns and Booleans.
- **`Sketch`, `Plane` and `Location`.**
- **An `Assembly`.**

The kernel's older object API, `createCadModel()` in `@barocss/cad`, is to be retired in favour of this one once the
facade covers what its tests use.

## The direction

The R7 conventions, not yet settled, describe where the facade is going:

- **Objects and results.** Objects are immutable, every method adds document nodes and calls the core, and results
  are plain data.
- **Selectors** are typed, with no string selectors.
- **Units.** Public results use millimetres and grams.
- **The oracle.** A facade method's `.doc` equals the hand-written document, and its results equal the core's on
  that document, byte for byte.
