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
import { part } from '@barocss/cad-model/api/index';   // `@barocss/cad-model/api` once src/api.ts exists, see below

const bracket = part('bracket')
  .box(80, 40, 10)
  .hole({ at: [20, 20], diameter: 8 })
  .fillet(body => body.edges().along('z'), 2);

bracket.doc;               // the JSON above
bracket.mass('al6061');    // { volumeMM3, massG, centroid, inertia }, the core's numbers
bracket.step();            // the core's STEP text
```

## Object types

| Type | What it is | Built on |
|---|---|---|
| `Part` | an immutable part: a name and its document | `StudioDoc`; `rectanglePart`, `withNode`, `leafBodies` |
| `BodyQuery` | one body's edges and faces, read once from the core's evaluation | `evaluateDoc` → `BodyResult.mesh` (`DisplayEdge`, `DisplayFace`) |
| `EdgeQuery`, `FaceQuery` | typed, immutable selections: filter, sort, take | the mesh's `straight`, `axis`, `faces`, `normal`, `centroid`, `names` |
| `ApiRefusal` | one typed error: `code`, `message`, `where`, plus `friendly` for the core's own words | the core's `FriendlyError` and `stepFor`'s `{ error }` |

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
  - `mass(material)` is `bodyMass(body, material.gPerCm3)` on `evaluateDoc`'s body, plus its `volumeMM3`.
  - `step(name)` is `stepFor(doc, name).text`.
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
  - `evaluateDoc`'s `{ ok: false, error }` becomes an `ApiRefusal` with `where: 'evaluate'`.
  - Its code is the bracketed code in the core's words, or `EVALUATION` when the words carry none.
  - The core's `FriendlyError` (its title, hint and detail) stays on `.friendly`.
  - `stepFor`'s `{ error }` becomes `where: 'export'`.
- **The facade's own codes** cover only how it was called:
  - `NO_BODY`, `BODY_AMBIGUOUS`;
  - `BOX_NOT_FIRST`;
  - `SELECTION_EMPTY`;
  - `MATERIAL_UNKNOWN`, which lists the ids. The core's `materialOf` falls back to the first material, and the facade
    never does.
  - `MASS_UNKNOWN`.
- **Its shape** is `{ code, message, where }`, the shape R7.3 gives the core. The message is `[CODE] words`, as the core
  writes its refusals. When R7.3 lands, `ApiRefusal` becomes the core's type, or a re-export of it.

## Findings for other lanes (through the coordinator)

1. **The kernel's code is lost at `evaluateDoc`.** This is in the outer lane's engine/evaluate.ts and engine/errors.ts,
   for R7.3. A fillet too large for its walls is `CadPartError` PARAMETER `[RADIUS_EXCEEDS_FACE]` in the kernel. By the
   time it reaches `evaluateDoc`'s `FriendlyError` the detail reads "edge n1.side0|n1.side3: fillet 8 mm is too large
   for walls of 10 and 2 mm", with no code, so the facade can only say `EVALUATION`. The fix: `FriendlyError` should
   carry the kernel's `code` and its bracketed detail code.
2. **`@barocss/cad-model/api` doesn't resolve yet.** cad-model's exports map `./*` to `./src/*.ts`, so `/api` looks for
   `src/api.ts`, and the facade lives in `src/api/index.ts`. One of these is needed:
   - a one-line `src/api.ts` (`export * from './api/index'`), which is outside this lane's paths, so it needs the outer
     lane or the coordinator's go-ahead;
   - an exports entry `"./api": "./src/api/index.ts"` in package.json, which is a shared file.

   Until then the import is `@barocss/cad-model/api/index`.
3. **STEP isn't deterministic.** `stepFor` (engine/evaluate.ts, outer lane) passes no `timestamp` to the kernel's
   `exportStep`, which supports one (io/step.ts). A pass-through option would let the facade and the docs' samples
   give byte-stable STEP.

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
  - `src/api/refusal.ts`: `ApiRefusal`;
  - `src/api/index.ts`.
- **The test**, test/api-part.test.ts, has five tests and all pass:
  - the document is byte-equal to the hand-written one;
  - mass and STEP are byte-equal to the core functions';
  - every method leaves the old part unchanged, and `.doc` is a copy;
  - the selectors return the core's names, and the top face's edges include the hole's rim under its two names;
  - the refusals are typed, the facade's own and the kernel's passed through.
- cad-model `tsc` and eslint are clean.
