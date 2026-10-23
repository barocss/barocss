# The object facade (R7): design note and first slice

Status, 2026-10-24: a design for the owner and one working slice. The facade grows only after the owner has seen this.
It's written by the API lane and reconciled by the coordinator with R7.1 (the API inventory) and R7.2 (the
conventions).

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
doc = withNode(doc, { kind: 'fillet', parent: { node: 2, side: 'solid' }, radius: 2,
  edges: ['n1.side0|n1.side1', 'n1.side0|n1.side3', 'n1.side1|n1.side2', 'n1.side2|n1.side3'] });
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
  - Its code is the bracketed code in the core's words, or `EVALUATION` when the words carry none.
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

1. **The kernel's code is lost at `evaluateDoc`.** This is in the outer lane's engine/evaluate.ts and engine/errors.ts,
   for R7.3. A fillet too large for its walls is `CadPartError` PARAMETER `[RADIUS_EXCEEDS_FACE]` in the kernel. By the
   time it reaches `evaluateDoc`'s `FriendlyError` the detail reads "edge n1.side0|n1.side3: fillet 8 mm is too large
   for walls of 10 and 2 mm", with no code, so the facade can only say `EVALUATION`. The fix: `FriendlyError` should
   carry the kernel's `code` and its bracketed detail code.
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
| `exportStl(output)` | 1 (modeling-stl) | step 1: `.stl()` through the adapter (`stlFor`) |
| `polygon(...)`, `constrainedPolygon(...)`, `extrude(h, { from })` | 15 / 12 | step 2: `sketch()` with `lineTo`/`close`, and constraints through the core's sketch solver |
| `union`, `cut`, `intersect` | 8 / 14 / 11 | step 1: `.union(other)`, `.subtract(other)`, `.intersect(other)` (difference, union and intersect nodes) |
| `split({ axis, at })` | 21 | step 1: `.split(plane)` (a split node, its two sides as bodies; needs the body chooser) |
| `translate`, `rotate` (quarter turns, pivot), `mirror`, `scale` (½, 2) | 11 / 10 / 8 / 15 | step 3: `Location` and `.moved(loc)`, `.mirrored(plane)`, `.scaled(k)` on the core's transform nodes, any angle or factor the core allows |
| `linearPattern`, `circularPattern` (counts 2–4, quarter turns) | 6 / 5 | step 1: `.pattern(...)` on the core's pattern nodes, any count the core allows |
| `parameter(name, mm)`, `withParameters(edits)` | 25 / 12 | step 2: `part().parameter(name, mm)` and dimensions given as `{ parameter }`; `.withParameters(edits)` returns a new part |
| `withSuppression(edits)` | 1 | step 2: `.suppressed(featureName, true)` (the node's `suppressed` flag) |
| `save()` | 15 | `.doc` (the studio document itself), with cad-model's container for the file |

So slice 1 covers `rectangle().extrude`, `hole`, the edge queries and `massProperties`. Steps 1–3 cover the rest
without a recipe limit: any count, angle or factor the core allows instead of the fixed sets.

## Out of scope

- Agent tools. They stay JSON.
- A second evaluation path or a geometry cache of the facade's own. The core's memo is the only one.
- String selectors.
- Operator overloading.
- Anything WASM.
- Writing rows. Under rows rule (b) the facade only reads a person's rows file.
- The studio. The facade is a library API, and the studio keeps using the core directly.
- gpu. Its classes (`Viewer`, `Camera` …) are already stateful objects. A gpu facade, if any, is a later question.

## The first slice, as built

- **The files:**
  - `src/api/part.ts`: `part()`, `Part.box/hole/fillet/select/mass/step`;
  - `src/api/select.ts`: `BodyQuery`, `EdgeQuery`, `FaceQuery`;
  - `src/api/core.ts`: the one adapter onto today's core;
  - `src/api/refusal.ts`: `BarocssError`, `FacadeCode`;
  - `src/api.ts`: the `@barocss/cad-model/api` entry;
  - `src/api/index.ts`.
- **The test**, test/api-part.test.ts, has five tests and all pass:
  - the document is byte-equal to the hand-written one;
  - mass and STEP are byte-equal to the core functions';
  - every method leaves the old part unchanged, and `.doc` is a copy;
  - the selectors return the core's names, and the top face's edges include the hole's rim under its two names;
  - the refusals are typed, the facade's own and the kernel's passed through.
- cad-model `tsc` and eslint are clean.
