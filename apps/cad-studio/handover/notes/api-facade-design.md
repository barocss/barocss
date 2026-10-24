# The object facade (R7): design note and first slice

Status, 2026-10-24: there's one working slice in each of the three packages. The facades grow only after the owner
has seen them. The API lane wrote this note, and the coordinator reconciles it with R7.1 (the API inventory) and R7.2
(the conventions).

- **`@barocss/cad/api`:** `part().box().hole().fillet(selector)` over `CadPartDocument`, with `.doc`, `.mass(g/cm³)`,
  `.step()`, `.stl()` and `.meshes()`. The shared selectors and `BarocssError` live here.
- **`@barocss/cad-model/api`:** the same chain over `StudioDoc`, with `.mass(material)`, `.step()` and `.meshes()`. It
  uses cad's selectors and error.
- **`@barocss/gpu/api`:** an immutable `scene()` and `show(viewer, scene)`. The coordinate frame is settled: Z-up, as
  given. The browser check runs through the gpu lane's harness.

## What it is

`packages/barocss-cad-model/src/api/` is an object API for people and for the docs' samples. It sits over cad-model's
core, which stays as it is:
- **The core** is data and functions. The studio document (`StudioDoc`, engine/doc.ts) is the source of truth.
  Operations are `verb(doc, options) → result`: `withNode`, `evaluateDoc`, `stepFor`, `bodyMass` and so on.
- **The facade** is immutable objects. Each modelling method appends feature nodes through the core's own functions.
  Each result comes from a core function. It computes no geometry of its own.
- **The agent stays on the JSON v2 tools.** The facade is not a second path for it.

The facade earns its place in three ways:
- a chain reads in the order a person thinks;
- edges and faces are picked by typed selectors instead of copied names;
- refusals arrive as one typed error.

## Three packages, one set of rules (owner, 2026-10-24)

The owner asked for this: "cad-model 만 api 가 있는거야? 다른건 어떻게 되는거야? 제대로 해줘". So each of the three
packages gets an object API, and all three follow the same rules. The first slice above is cad-model's. The kernel's
and gpu's come next, and they wait for the coordinator to confirm the paths.

| Package | Entry | Over its core | For |
|---|---|---|---|
| cad (the kernel) | `@barocss/cad/api` | `CadPartDocument` (`format: 'barocss-cad-part'`, string feature ids, `target`) and `evaluateCadPart` → `CadPartSnapshot` / `CadPartOutput` | people using the kernel alone; it replaces `createCadModel` |
| cad-model | `@barocss/cad-model/api` | `StudioDoc` (numeric node indices, `parent` body refs) and `evaluateDoc`, `bodyMass`, `stepFor` | studio-level design in code: materials, rows, assemblies, variants, BOM, drawings |
| gpu | `@barocss/gpu/api` | `Viewer` (`add`, `clear`, `fit`, `setBackground` …, viewer/viewer.ts) and its `GeometryInput` and `Material` data | putting parts on screen |

**The rules, the same in all three:**
- **Immutable objects.** Every method returns a new object.
- **One plain-JSON accessor.** cad's and cad-model's parts have `.doc`, the document a person or the agent could have
  written by hand. gpu's scene has `.data`. Typed arrays appear only in mesh payloads (conventions §2).
- **Results are plain data from the core, in MMGS,** with the unit in the name: `volumeMM3`, `massG`, `centroidMM`,
  `inertiaGMM2`. The kernel's mass is in kg and kg/m³ today, so cad's adapter converts until R7.3 moves the core.
- **Errors:** one `BarocssError { code, message, where?, details? }`, with core refusals passed through with their codes.
- **The same verbs.** cad's part and cad-model's part use the same words.
  - **Built in both (slice 1):** `box`, `hole`, `fillet`, `select` (the selectors), `mass`, `step` and `meshes`.
    cad also has `stl`.
  - **Planned (growth):** `cylinder`, `chamfer`, `union`, `subtract`, `intersect`, `split`, patterns, sketches, a body
    chooser, and placements.
  - cad-model's part adds the studio layer: materials, rows, instances, assemblies.
  - `mass` differs in its argument today:
    - cad takes `mass(densityGPerCm3)`, a number, because the kernel has no material library;
    - cad-model takes `mass(material)`, a library id;
    - the next growth step makes them `mass({ densityGPerCm3 })` and `mass(material | { densityGPerCm3 })`.
- **The same selectors.** `edges().along('z')`, `faces().facing('+z')`, `on`, `sortBy`, `first`/`last` and `names()` are
  one shared selector module over a common edge/face record.
  - cad fills that record from the B-rep (each `BrepEdge.name`, and its curve as a line or not).
  - cad-model fills it from the display mesh, as it does now.
  - Both hand back persistent names.
- **Each package has one adapter** (`src/api/core.ts`), the only place its facade calls the core. R7.3 switches each
  package there.
- **Only gpu's `Viewer` holds state,** because it owns a canvas and GPU resources (conventions §3). gpu's facade
  describes a scene immutably and presents it through a Viewer. It doesn't move or change any Viewer method.

**How the three fit together:**
```ts
import { part } from '@barocss/cad/api';
import { scene, show } from '@barocss/gpu/api';

const bracket = part('bracket').box(80, 40, 10).hole({ at: [20, 20], diameterMM: 8 })
  .fillet(b => b.edges().along('z'), 2);
bracket.mass(2.7);                       // g/cm³ in, MMGS out
bracket.step();

const view = scene()
  .add(bracket.meshes(), { color: '#c8ccd2' })
  .light({ kind: 'directional', direction: [-0.4, -0.6, -1] });   // a Light, in the Viewer's own terms (Z-up)
view.data;                               // { frame: 'z-up', meshes, lights } — the plain description
show(viewer, view);                      // viewer.clear(), lights, add(...) per mesh, fit()
```
- `part().meshes()`, in cad and in cad-model, returns `{ key, positions, normals, indices }` per body. That structurally
  matches gpu's `GeometryInput`, so neither package imports the other.
- In cad, the meshes come from the kernel's tessellation of each output. In cad-model, they come from `BodyResult.mesh`.
- **The coordinate frame is settled: Z-up, as given** (the GPU lane checked, 2026-10-24).
  - The Viewer is already Z-up: Camera's `up` defaults to [0, 0, 1], `fit` uses the same, and the grid is the XY plane.
  - The studio feeds CAD XYZ in mm to it with no conversion.
  - The packets' `right-handed-y-up` tag is a label only: no code reorients on it. The GPU lane renames it in R7.3.
  - So `.meshes()` and `scene()` take CAD coordinates directly. There's no conversion and no axis option.
  - `SceneData` carries `frame: 'z-up'`. It records what's true, and it never uses the packets' old tag.

**The kernel facade's mapping** (to be checked with the kernel lane through the coordinator):
- `box(w, d, h)` is a rectangle `sketch` feature plus an `extrude` feature, with ids the facade assigns in feature
  order (`sketch1`, `extrude1` …).
- `hole` is a `hole` feature with `target` set to the current output.
- `fillet` is a `fillet` feature with `target` and `edges` set to the B-rep's persistent names.
- Results come from `evaluateCadPart(doc).outputs[0]`, through the adapter:
  - `massProperties(density)`, converted to MMGS;
  - `exportStep`;
  - `exportStl`.
- The oracle is the same as cad-model's: `.doc` equals a hand-written CadPartDocument byte for byte, and the results
  equal the kernel's on it.

**gpu's facade** is one immutable `Scene`:
- the methods are `add(meshes, material?)`, `light(light)` (a Light object in the Viewer's own terms: directional,
  point or spot) and `background(value)`. There's no `camera()` yet. The Viewer's own camera frames the scene through
  `fit()`;
- `.data` is the plain description;
- `show(viewer, scene)`, a function rather than a Viewer method, presents it through today's Viewer methods only.
- **The oracle:** `.data` round-trips through JSON, apart from the mesh arrays. A browser check through the gpu lane's
  harness shows the bracket drawn, with the viewer's `sceneBounds()` equal to the part's bounds.

**Order:**
1. cad's slice (the same bracket);
2. gpu's slice (the scene and `show`);
3. the shared selector module;
4. growth in both part facades;
5. assemblies (cad-model);
6. the docs samples.

## The same bracket, three ways

An 80 × 40 × 10 block, a Ø8 hole through it at (20, 20), and its four vertical edges rounded R2. All three give the
same document, byte for byte (test/api-part.test.ts).

**1. The raw document (JSON):**
```json
{ "format": "barocss-cad-model", "schema": 3, "units": "mm", "parameters": {}, "outputs": {…},
  "nodes": [
    { "kind": "sketch", "profile": "rectangle", "min": [0, 0], "max": [80, 40], "id": "n0" },
    { "kind": "extrude", "sketch": 0, "height": 10, "id": "n1" },
    { "kind": "hole", "parent": { "node": 1, "side": "solid" }, "center": [20, 20], "radius": 4, "id": "n2" },
    { "kind": "fillet", "parent": { "node": 2, "side": "solid" },
      "edges": ["n1.side0|n1.side1", "n1.side0|n1.side3", "n1.side1|n1.side2", "n1.side2|n1.side3"], "radius": 2, "id": "n3" } ] }
```

**2. The core functions:**
```ts
import { rectanglePart, withNode } from '@barocss/cad-model/engine/doc';
import { evaluateDoc, stepFor } from '@barocss/cad-model/engine/evaluate';
import { bodyMass } from '@barocss/cad-model/app/mass';

let doc = rectanglePart(80, 40, 10);
doc = withNode(doc, { kind: 'hole', parent: { node: 1, side: 'solid' }, center: [20, 20], radius: 4 });
doc = withNode(doc, { kind: 'fillet', parent: { node: 2, side: 'solid' },
  edges: ['n1.side0|n1.side1', 'n1.side0|n1.side3', 'n1.side1|n1.side2', 'n1.side2|n1.side3'], radius: 2 });
const r = evaluateDoc(doc, 1);                     // { ok, bodies } or { ok: false, error }
const mass = r.ok ? bodyMass(r.bodies[0], 2.7) : null;
const step = stepFor(doc, 'bracket');              // { text, source } or { error }
```
To write it this way you have to know the node indices (`node: 2`), the persistent edge names, the density of the
material, and two different ways of failing.

**3. The facade:**
```ts
import { part } from '@barocss/cad-model/api';

const bracket = part('bracket')
  .box(80, 40, 10)
  .hole({ at: [20, 20], diameterMM: 8 })
  .fillet(body => body.edges().along('z'), 2);

bracket.doc;               // the JSON above
bracket.mass('al6061');    // { volumeMM3, massG, centroidMM, inertiaGMM2 }: the core's numbers, in MMGS
bracket.step();            // the core's STEP text
```

## Object types

| Type | What it is | Built on |
|---|---|---|
| `Part` | an immutable part: a name and its document | `StudioDoc`; `rectanglePart`, `withNode`, `leafBodies` |
| `BodyQuery` | one body's edges and faces, read once from the core's evaluation | `evaluateDoc` → `BodyResult.mesh` (`DisplayEdge`, `DisplayFace`) |
| `EdgeQuery`, `FaceQuery` | typed, immutable selections: filter, sort, take | the mesh's `straight`, `axis`, `faces`, `normal`, `centroid`, `names` |
| `BarocssError` | one typed error in the conventions' shape (§6): `code`, `message`, `where`, `details` (the core's own words under `details.friendly`) | the core's `FriendlyError` and `stepFor`'s `{ error }` |

These come later, in this order, each with the same oracle:
- **More part features:** cylinder; sketches and extrude; chamfer; shell; patterns; mirror; Booleans between parts with
  `.union()` and `.subtract()`, since TS has no operator overloading.
- **A body chooser:** `part.body(name)` for parts of several bodies.
- **`Sketch`:** the replicad-style chain `sketch().lineTo().arc().close()` on a `Plane`.
- **`Plane` and `Location`:** objects of their own, as in build123d. They map to `DocPlane` and to an instance's
  placement.
- **`Assembly`:** `assembly().place(part, location).mate(…)`. Variants come through O11's `variability`.
- **Rows:** reading a person's rows file. Under rows rule (b) the facade never writes rows.

## How it maps onto the core

- **Modelling.** `box(w, d, h)` is `rectanglePart(w, d, h)`. `hole(...)` and `fillet(...)` are `withNode(doc, node)`
  with the node the studio itself writes. The parent body is the part's one leaf body (`leafBodies`).
- **Results.**
  - `mass(material)` is `bodyMass(body, material.gPerCm3)` on `evaluateDoc`'s body, plus its `volumeMM3`. It's returned
    in MMGS (conventions §2): `volumeMM3`, `massG`, `centroidMM` and `inertiaGMM2`. Today's core gives inertia in
    kg·mm², so the adapter multiplies it by 1000 until R7.3 moves the core to MMGS.
  - `step(name)` is `stepFor(doc, name).text`.
  - **One adapter, `src/api/core.ts`,** is the only place the facade calls the core's evaluation, mass and export
    functions (`bodiesOf`, `massOf`, `stepOf`). R7.3's switch to one error type, result functions and MMGS happens
    there alone.
- **The oracle for every method:**
  - the facade's `.doc` equals the hand-built document, compared as JSON text;
  - each result equals the core function's on that document, compared as JSON text.
  - STEP is compared with its time stamp masked, because `stepFor` stamps the export time.

## Naming

- **Entry points** are lower-case functions: `part()`, and later `sketch()` and `assembly()`. **Types** are nouns:
  `Part`, `EdgeQuery`.
- **Modelling methods** are the feature's own word, the same one the palette and the agent's tools use: `box`, `hole`,
  `fillet`. Options are objects with named units: `{ at, diameter, depth }` takes a diameter, not the node's radius.
- **Results** are nouns, and calling one is a question: `mass()`, `step()`. Neither changes the part.
- **Selectors:**
  - filters are verbs or prepositions (`along('z')`, `facing('+z')`, `on(face)`, `straight()`, `curved()`,
    `where(test)`);
  - orderings are `sortBy(axis)`, plus `first(n)` and `last(n)`;
  - read-outs are `names()`, `list()` and `count`.
  - `groupBy` (build123d's `group_by`) comes when a sample needs it.
- **What a selector offers, deliberately:** the corners a person could pick in the studio, and nothing else.
  - Seams are left out: an edge both of whose uses are on one face, such as a cylinder's seam line.
  - Tangent joints are left out: two faces meeting smoothly, with their normals at the edge's middle within 20°, such as
    a hole's two half-cylinders.
  - It's the studio display's own rule (cad-model engine/mesh.ts), applied by cad's `brepSelection` and inherited by
    cad-model from its display mesh.
  - Without it, `edges().along('z')` on a holed plate also picks the hole's half-cylinder joints, and the kernel refuses
    the fillet with TANGENT_FACES, since there's no corner to round.
- **Pending argument shape (next growth step):** cad's `mass(densityGPerCm3)` becomes `mass({ densityGPerCm3 })`, and
  cad-model's accepts `mass(material | { densityGPerCm3 })`. The verb then reads the same in both, and a bare number
  can't be mistaken for a material id.

## Stable ids and names (the FeatureScript point)

- **The facade stores names, never indices.**
  - A selector resolves to the edges' persistent names, such as `n1.side0|n1.side1`. Those are what the kernel's naming
    keeps through re-evaluation (engine/ids.ts, D16, D86).
  - A fillet node stores those names, exactly as a click in the studio would.
- **Node ids** (`n0`, `n1` …) come from `withNode`, the same as in the studio. So a facade-built document and a
  studio-built one are the same kind of thing.
- **The selection is resolved once, when the method runs.** Editing the box later keeps the names, so the fillet
  follows the same edges. That's the core's rematching, not the facade's.

## Refusals

- **A core refusal is passed through.**
  - `evaluateDoc`'s `{ ok: false, error }` becomes a `BarocssError` with `where: 'evaluate'`.
  - Its code is the core's own `FriendlyError.code` (the kernel's bracketed code, or its error's kind), else a
    bracketed code in the core's words, else `EVALUATION`.
  - The core's `FriendlyError` (its title, hint and detail) stays on `.details.friendly`.
  - `stepFor`'s `{ error }` becomes `where: 'export'`.
- **The facade's own codes** cover only how it was called:
  - `NO_BODY`, `BODY_AMBIGUOUS`;
  - `BOX_NOT_FIRST`;
  - `SELECTION_EMPTY`;
  - `MATERIAL_UNKNOWN`, which lists the ids. The core's `materialOf` falls back to the first material, and the facade
    never does.
  - `MASS_UNKNOWN`.
- **Its shape** is conventions §6's `BarocssError { code, message, where?, details? }`, the type R7.3 gives the core.
  The message is `[CODE] words`, as the core writes its refusals. The facade's own codes are one union type,
  `FacadeCode`. When R7.3 lands, the facade's class becomes a re-export of the core's.

## Findings for other lanes (through the coordinator)

1. **The kernel's code at `evaluateDoc`: fixed.** The outer lane's 59bfaf342 gives `FriendlyError` a `code`, and the
   facade reads it first. A too-large fillet now comes through as the kernel's kind, `PARAMETER`. It becomes
   `RADIUS_EXCEEDS_FACE` once the kernel's part-model.ts adds that bracket, which is routed to the kernel lane.
2. **`@barocss/cad-model/api` resolves** through the one-line `src/api.ts` (`export * from './api/index'`), matching
   cad-model's `./*` → `./src/*.ts` export. That was finding 2, now done in this lane.
3. **STEP isn't deterministic.** `stepFor` (engine/evaluate.ts, outer lane) passes no `timestamp` to the kernel's
   `exportStep`, which supports one (io/step.ts). A pass-through option would let the facade and the docs' samples
   give byte-stable STEP.

## The kernel's old object API (`createCadModel`) and what replaces it

`packages/barocss-cad/src/modeling.ts` has `createCadModel()` with `CadModel`, `CadShape` and `CadSketch`. It's a
bounded, recipe-limited object API from before `evaluateCadPart`, and it's prior art for naming only. The facade
doesn't build on it. Nothing outside cad calls it. R7.3 retires it once the facade covers what its tests show. Its 35
`test/modeling-*.test.mjs` files (counts are files using each method) use these methods, which the facade covers as follows:

| Old method (`CadShape` / `CadModel`) | Tests using it | Facade |
|---|---|---|
| `rectangle(...).extrude(h)` | 29 | **slice 1**: `part().box(w, d, h)` (a rectangle sketch extruded); a general `sketch().rectangle()` comes in step 2 |
| `hole({ center, radius })` | 17 | **slice 1**: `.hole({ at, diameterMM, depthMM? })` |
| `edges({ parallelTo, at }).one()` + `chamfer(edge, d)` | 22 / 21 | **slice 1** has the selectors (`along`, `sortBy`, `first`/`last`, `on`). `.chamfer(select, d)` comes in step 1, beside `.fillet` |
| `massProperties(output, { densityKgPerM3 })` | 1 (modeling-mass) | **slice 1**: `.mass(material)`, by material id, in MMGS |
| `exportStl(output)` | 1 (modeling-stl) | **slice 1** (cad): `.stl()`, from the output's own `exportStl` |
| `polygon(...)`, `constrainedPolygon(...)`, `extrude(h, { from })` | 15 / 12 | step 2: `sketch()` with `lineTo`/`close`, and constraints through the core's sketch solver |
| `union`, `cut`, `intersect` | 8 / 14 / 11 | step 1: `.union(other)`, `.subtract(other)`, `.intersect(other)` (difference, union and intersect nodes) |
| `split({ axis, at })` | 21 | step 1: `.split(plane)` (a split node, its two sides as bodies; needs the body chooser) |
| `translate`, `rotate` (quarter turns, pivot), `mirror`, `scale` (½, 2) | 11 / 10 / 8 / 15 | step 3: `Location` and `.moved(loc)`, `.mirrored(plane)`, `.scaled(k)` on the core's transform nodes, any angle or factor the core allows |
| `linearPattern`, `circularPattern` (counts 2–4, quarter turns) | 6 / 5 | step 1: `.pattern(...)` on the core's pattern nodes, any count the core allows |
| `parameter(name, mm)`, `withParameters(edits)` | 25 / 12 | step 2: `part().parameter(name, mm)` and dimensions given as `{ parameter }`; `.withParameters(edits)` returns a new part |
| `withSuppression(edits)` | 1 | step 2: `.suppressed(featureName, true)` (the node's `suppressed` flag) |
| `save()` | 15 | `.doc` (the studio document itself), with cad-model's container for the file |

Slice 1 covers `rectangle().extrude`, `hole`, the edge queries, `massProperties` and `exportStl`, in **cad's facade**
(`@barocss/cad/api`, over the same kernel the old API sits on) as well as cad-model's. Steps 1–3 cover the rest, with
no recipe limit: they take any count, angle or factor the core allows instead of the fixed sets. cad's facade is the
one that replaces `createCadModel`. Its tests move onto `@barocss/cad/api` once each step lands, and then R7.3
retires modeling.ts.

## Out of scope

- Agent tools. They stay JSON.
- A second evaluation path or a geometry cache of the facade's own. The core's memo is the only one.
- String selectors.
- Operator overloading.
- Anything WASM.
- Writing rows. Under rows rule (b) the facade only reads a person's rows file.
- The studio. The facade is a library API, and the studio keeps using the core directly.
- Changing gpu's `Viewer`, `Camera` and other classes. gpu's facade presents a scene through them as they are.

## The slices, as built

### cad (`packages/barocss-cad/src/api/`)

- **Files:**
  - part.ts (`part()`, `Part.box/hole/fillet/select/mass/step/stl/meshes`; feature ids by kind: `sketch1`, `extrude1`,
    `hole1`, `fillet1` …);
  - select.ts (the shared `BodyQuery`, `EdgeQuery`, `FaceQuery`, and `brepSelection` from the B-rep: each edge's
    persistent name, line or not, its two faces through its coedges; seams and tangent joints left out, by cad-model's
    display rule);
  - core.ts (the adapter: `evaluateCadPart`, the output's `massProperties`, `exportStep`, `exportStl` and
    `tessellateBrep`; kg → g and kg·m² → g·mm²);
  - refusal.ts (`BarocssError`, `FacadeCode`, `bracketedCode`).
- **test/api-part.test.mjs, 5/5:**
  - the document equals the hand-written CadPartDocument;
  - mass, STEP (with the stamp masked), STL bytes and the meshes' arrays equal `evaluateCadPart`'s own outputs;
  - immutability;
  - the selectors return the kernel's names;
  - the refusals: the kernel's code is passed through once (`[TANGENT_FACES] fillet1: edge …`, not twice), with the
    feature in `details`.
- `dist/api/` is emitted by `build:library`.

### gpu (`packages/barocss-gpu/src/api/`)

- **Files:** scene.ts (`scene()`, `Scene.add/light/background`, `.data`, `show(viewer, scene)`) and refusal.ts.
- **Lights** are given in the Viewer's own terms (directional, point or spot), so the facade assumes no up axis.
- **tests/api-scene.test.mjs, 4/4,** on a Viewer stand-in:
  - immutability and plain `.data`;
  - `show()` calls clear, background, add and fit, using public methods only;
  - cad's `.meshes()` goes in as the same arrays, with no conversion;
  - the refusals.
- This test isn't yet in gpu's `test` script list, because package.json's scripts are the gpu lane's.
- The browser check (the bracket through `show()`, with `sceneBounds()` equal to its bounds) runs through the gpu
  lane's harness.

### cad-model (`packages/barocss-cad-model/src/api/`)

- **The files:**
  - `src/api/part.ts`: `part()`, `Part.box/hole/fillet/select/mass/step/meshes`;
  - `src/api/select.ts`: `meshSelection`, which fills cad's shared selector records from the display mesh;
  - `src/api/core.ts`: the one adapter onto today's core;
  - `src/api/refusal.ts`: cad's `BarocssError`, plus `fromEvaluation` and `fromExport`;
  - `src/api.ts`: the `@barocss/cad-model/api` entry;
  - `src/api/index.ts`.
- **The test**, test/api-part.test.ts, has five tests and all pass:
  - the document is byte-equal to the hand-written one;
  - mass and STEP are byte-equal to the core functions';
  - every method leaves the old part unchanged, and `.doc` is a copy;
  - the selectors return the core's names, and the top face's edges include the hole's rim under its two names;
  - the refusals are typed, the facade's own and the kernel's passed through.
- cad-model `tsc` and eslint are clean.
