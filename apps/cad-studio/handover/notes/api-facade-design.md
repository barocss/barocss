# The object facade (R7): design note and first slice

Status, 2026-10-24: there's one working slice in each of the three packages, and the part facades have grown (R7.4b:
cylinder, sketches on planes, chamfer, shell, Booleans, patterns, the body chooser, Location). The owner approved the
growth with the conventions. The API lane wrote this note, and the coordinator reconciles it with R7.1 (the API inventory) and R7.2
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
  - **Built in both (R7.4b):** `cylinder`, `extrude` and `revolve` of a `sketch()` on a `Plane`, `chamfer`, `shell`,
    `union`, `subtract`, `intersect`, `linearPattern`, `circularPattern`, `moved(Location)`, and the body chooser
    `bodies()` / `body(name)`. See "R7.4b: part growth, as built".
  - **Planned:** `split`, `mirror`, parameters, assemblies (R7.5).
  - cad-model's part adds the studio layer: materials, rows, instances, assemblies.
  - `mass` reads the same in both: cad takes `mass({ densityGPerCm3 })`, because the kernel has no material library.
    cad-model takes `mass(material | { densityGPerCm3 })`.
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

const bracket = part('bracket').box({ wMM: 80, dMM: 40, hMM: 10 })
  .hole(b => b.faces().facing('+z'), { dMM: 8, xMM: 20, yMM: 20 })
  .fillet(b => b.edges().along('z'), { radiusMM: 2 });
bracket.mass({ densityGPerCm3: 2.7 });   // MMGS out
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

An 80 × 40 × 10 block, a Ø8 hole through its top at (20, 20), and its four vertical edges rounded R2. All three give the
same StudioDoc, byte for byte (test/api-part.test.ts).

**1. The raw document (JSON),** as the studio's commands write it:
- the box's `made` (its values remembered, so picking it edits them again);
- the hole's `face` (D148);
- the fillet's `sigs` (each edge's geometry where it was picked, engine/references.ts).

```json
{ "format": "barocss-cad-model", "schema": 3, "units": "mm", "parameters": {},
  "nodes": [
    { "kind": "sketch", "profile": "rectangle", "min": [0, 0], "max": [80, 40], "id": "n0" },
    { "kind": "extrude", "sketch": 0, "height": 10, "id": "n1", "made": { "command": "box", "values": { "w": 80, "d": 40, "h": 10, "x": 0, "y": 0, "z": 0 } } },
    { "kind": "hole", "parent": { "node": 1, "side": "solid" }, "radius": 4, "center": [20, 20], "face": "n1.top", "id": "n2" },
    { "kind": "fillet", "parent": { "node": 2, "side": "solid" },
      "edges": ["n1.side0|n1.side1", "n1.side0|n1.side3", "n1.side1|n1.side2", "n1.side2|n1.side3"], "radius": 2, "id": "n3",
      "sigs": { "n1.side0|n1.side1": { "k": "line", "p": [80, 0, 5], "d": [0, 0, 1], "s": 10 }, … } } ],
  "outputs": { "b3": { "node": 3, "side": "solid" } }, "nextId": 4 }
```

**2. The agent's v2 commands** (`features.command`, i.e. run_command):
```json
{ "command": "box",    "values": { "w": 80, "d": 40, "h": 10, "x": 0, "y": 0, "z": 0 } }
{ "command": "hole",   "faces": ["n1.top"], "values": { "type": "through", "d": 8, "x": 20, "y": 20 } }
{ "command": "fillet", "edges": ["n1.side0|n1.side1", "n1.side0|n1.side3", "n1.side1|n1.side2", "n1.side2|n1.side3"], "values": { "radius": 2 } }
```
To write it this way, you need the faces' and edges' persistent names, and you have to read each result to find them.

**3. The facade.** The same command names, and the same values with units in their names (§12):
```ts
import { part } from '@barocss/cad-model/api';

const bracket = part('bracket')
  .box({ wMM: 80, dMM: 40, hMM: 10 })
  .hole(body => body.faces().facing('+z'), { dMM: 8, xMM: 20, yMM: 20 })
  .fillet(body => body.edges().along('z'), { radiusMM: 2 });

bracket.doc;                              // the JSON above
bracket.mass('al6061');                   // or mass({ densityGPerCm3: 2.7 }): { volumeMM3, massG, centroidMM, inertiaGMM2 }
bracket.step();                           // the core's STEP text
```
For the kernel alone, `@barocss/cad/api`'s `part()` takes the same chain and writes a CadPartDocument instead:
- the features are `sketch1`, `extrude1`, `hole1` (with `face: 'extrude1.top'`) and `fillet1`;
- `mass()` takes `{ densityGPerCm3 }`.

## R7.4a: one part implementation, the agent's vocabulary

- **One part (`@barocss/cad/api` `Part<D>`, §11).**
  - Each verb validates its options once and becomes a document-neutral `FeatureSpec` (cad/src/api/spec.ts): the v2
    command name, its `values`, and the face or edges by persistent name.
  - A `PartBackend<D>` writes the spec into its document and gives that core's results.
  - **cad's backend** (cad/src/api/kernel.ts) writes CadPartDocument features. The hole carries its face and axis as
    the studio writes them.
  - **cad-model's backend** (cad-model/src/api/studio.ts) runs the studio's own command, as run_command does: names
    resolved (`resolveNames`), the command's defaults patched (`patchValues`), the values checked (`checkValues`),
    `build`, and the new references signed (`captureSignatures`, as every commit does).
  - `StudioPart extends Part<StudioDoc>` adds only the studio layer. Today that's `mass(material | { densityGPerCm3 })`.
- **No forked feature code.** A part verb is added once, in cad's `Part` plus a spec. The studio backend needs nothing
  new for a verb whose v2 command exists. The kernel backend writes that verb's kernel feature.
- **The oracle, per facade:** `.doc` equals its own hand-written document; for cad-model, it also equals what the
  agent's run_command writes for the same commands. Its results equal its core's, byte for byte.

## R7.4b: part growth, as built

Every verb below is written once, in cad's `Part` and a spec (cad/src/api/spec.ts). Its kernel features are in
cad/src/api/kernel.ts. The studio backend (cad-model/src/api/studio.ts) runs the studio's own command, so it needed only
the body chooser, the sketch node and the evaluation at each verb.

| Verb | v2 command, values | Kernel features | Studio nodes (through the command) |
|---|---|---|---|
| `cylinder({ rMM, hMM, xMM?, yMM?, zMM? })` | `cylinder` r, h, x, y, z | circle `sketch` + `extrude` | the same, `made` remembered |
| `extrude(sketch, { hMM, draftDeg? })` | `extrude` h, draft | the sketch + `extrude` (`draft` when not 0) | the sketch as add_features writes it, then `extrude` |
| `revolve(sketch, { axis?, angleDeg? })` | `revolve` axis, deg | the sketch + `revolve` (`axis: { origin: [0, 0], direction }`) | the sketch, then `revolve` |
| `chamfer(edges, { distanceMM })` | `chamfer` distance | `chamfer` | `chamfer`, signed |
| `shell(open?, { tMM })` | `shell` t; the faces to open, or the body for a closed hollow | `shell` (`open` when given) | `shell`, signed |
| `union` / `subtract` / `intersect(tool)` | `union` / `difference` / `intersect`, bodies [body, tool] | `{ target, tool }` | `{ left, right }`, or `{ parent, tool }` |
| `linearPattern({ axis, spacingMM, count })` | `linear-pattern` axis, spacing, count | `linear-pattern` | `linear-pattern` |
| `circularPattern({ axis?, count, spanDeg?, pxMM?, pyMM? })` | `circular-pattern` axis, count, span, px, py | `circular-pattern`, its step the studio's | `circular-pattern` |
| `moved(Location)` | `rotate` (each of X, Y, Z not 0, pivot the origin), then `move` | `rotate`, `translate` | `rotate` (pivot written), `translate` |

- **Sketches** (cad/src/api/sketch.ts) are replicad's chain in our data:
  - `sketch(plane?)` gives `.rectangle({ wMM, dMM, xMM?, yMM? })`, `.circle({ rMM, xMM?, yMM? })`, `.polygon(points)`, or
    `.moveTo(p).lineTo(p).arcTo(p, { center, direction? }).close()`, a `loop` of lines and arcs.
  - A `Sketch` is immutable. Its `.data` is the profile a sketch node carries, the same in both documents.
  - **Every side is tagged** `e1 …` (`sideTags`, D86), as the studio's sketcher tags the sketches it draws. The walls are
    named `side[e<k>]`, so a vertex inserted later in the sketcher keeps the other names. Commands' sketches (box,
    cylinder) stay positional, as D86 has them.
- **Plane** (build123d's): `Plane.XY`, `Plane.XZ` (normal −Y, so its Y is world Z), `Plane.YZ`, `.offset(dMM)` and
  `Plane.of({ origin, normal, xAxis })`, which refuses vectors that aren't unit and square. `.data` is the documents'
  plane shape. A sketch on XY through the origin stores no plane, as the studio writes it.
- **Location** (build123d's): `Location.of({ positionMM, rotationDeg })` and `Location.at(p)`. It's the documents' Pose
  (conventions §10.2), rotated about X, then Y, then Z, through the origin, then moved. R7.5 places parts with it.
- **The body chooser.**
  - `bodies()` lists the part's bodies in the core's order: the studio's keys (`b1`, `b3` …), the kernel's output ids
    (`extrude1`, `fillet1` …).
  - `body(name)` returns the same part with its verbs, `select()` and `mass()` acting on that body. `.doc` doesn't
    change: the choice is the facade's view, never written.
  - The choice follows its body through a verb that replaces it: after `body('b3').fillet(…)` it's the fillet's body.
  - With one body there's nothing to choose. With several and no choice, a verb refuses `BODY_AMBIGUOUS`.
  - `step()` writes every body; `meshes()` gives every body.
- **Booleans.** The tool is a body of the part by name (`.union('b4')`), or a callback that adds it
  (`.subtract(p => p.cylinder(…))`).
  - The callback builds in the part's own document, so the tool's nodes take the next ids. That's what the studio does
    when a person makes a second body and then combines the two.
  - It must add exactly one body and leave the chosen one; otherwise `SELECTION_ONE` or `VALUE`.
  - Two separate parts aren't combined: merging two documents would renumber one's ids, and so its names.
- **`subtract`, not `difference`.** It's §12's one exception besides `box`: the v2 command is `difference`, and the
  palette's label, the brief and the roadmap say Subtract.
- **Each verb evaluates its result,** in both backends, as run_command's accept does. A feature the core refuses is
  refused at its verb with the core's code (the kernel's `details.feature` names it), and the part is unchanged.
- **Continuing a document:** `part(name, doc)` takes a saved document, or another part's `.doc`. It's evaluated once,
  and the verbs add to it. The stability test uses it.
- **No `rotate` verb yet.** The studio's rotate command pivots on the body's centre by default; the kernel's, on the
  origin. A facade default would have to pick one. `moved()` always writes the origin.
- **Patterns join their copies** (`result: 'one'`, the studio's default). The kernel has no separate copies. About X or
  Y the copies are quarter turns, 2 to 4 of them; anything else is refused, where the studio would quietly use 90° and
  at most 4.

**The oracle:**
- **cad** (test/api-verbs.test.mjs, 13/13): five parts cover every verb.
  - Plate: a box, a cylinder subtracted, the top's edges chamfered.
  - Cup: a revolve on XZ, shelled with the top open.
  - Ring: a circular pattern, a linear pattern, `moved`.
  - Pegged: two bodies, the chooser, union by name, intersect by callback.
  - Tabs: a drafted loop on an offset plane, and a quarter revolve on YZ.
  - Each `.doc` equals the hand-written CadPartDocument byte for byte. Each body's mass and the STEP equal the kernel's
    on it.
  - Also tested: the chooser, the values' immutability, and 13 typed refusals, the kernel's own among them.
- **cad-model** (test/api-verbs.test.ts, 15/15, with api-part.test.ts 6/6): the same five parts.
  - Each `.doc` equals what the agent's run_command and add_features write for the same calls, byte for byte:
    signatures, `made` and all.
  - Ring and Tabs, which have no signed references, also equal a hand-written StudioDoc.
  - Each body's mass and the STEP equal the core functions' (`bodyMass`, `stepFor`).
- **Selector stability** (cad test/api-stability.test.mjs, 3/3; cad-model's three in api-verbs.test.ts):
  1. **A dimension edit upstream** (the box 80 → 60 wide): the stored names are exactly what the selector picks on the
     edited body. The far edges are at x = 60, and the part lost exactly the 20 × 40 × 10 slab, so every corner is
     still rounded.
  2. **A vertex inserted upstream,** as the studio's sketcher does it (a new tag, the others kept): the stored
     `side[e2]|side[e3]` is still the corner at (40, 40). The volume equals a fresh build of the new outline that picks
     (40, 40) again.
  3. **An edit that takes the edges away** (the rectangle made a circle): a typed refusal, `[SELECTION] … no edge named
     …`, from `part(name, doc)`, naming the feature in the kernel. Never another edge.

## R7.5: the assembly facade, as built

`@barocss/cad-model/api`'s `assembly(name, base?)` is an immutable assembly over the StudioDoc:
- **The base part** is fixed at the origin. It's the given studio part's document, or empty.
- **Placed parts** are instances, each with its own document. Mates relate their faces.
- **The verbs carry the v2 `assembly` actions' names** (§12). Each writes what the action's tool writes, and the
  assembly is solved again after it:
  - `addPart(name, part, { at?, grounded? })` is `add_part`. The part's document goes in as it is; the tool's is empty
    or a copy, and the agent then builds it with part-scoped tools.
  - `place(name, { at?, grounded? })` is `place_part`.
  - `addMate(kind, a, b, { distanceMM?, angleDeg?, flip? })` is `add_mate`. Each end is `{ part, face }`:
    - the part is `'base'` or a placed part by the name it was added with;
    - the face is a selector picking one face, or a face name.

    A fixed second part and a free first one swap, as in the studio. The solver's refusals pass through.
  - `inputs({ name: input | null })` and `variants({ name: values | null }, active?)` are O11's `set_inputs` and
    `set_variants`. They take the core's own input shape, with bindings by part and mate id (`parts()` lists the ids;
    mates are `m1` … in order).
  - `frames({ name: { link, at?, kind? } | null })` is O12's `set_frames`. The link is a part by name. `at` is a
    Location in that part's own coordinates.
- **Results are plain data:**
  - `parts()`;
  - `placements()`: each placed part's id, name, `positionMM`, `rotationDeg` and grounding;
  - `problems()`: the unmet mates;
  - `variant(values)`: an assembly over `variantOf`'s document, the master unchanged;
  - `framePoses()`: each frame's world pose from the joint tree;
  - `meshes()`: `base/<body>`, `<part>/<body>`, each part where it stands;
  - `part(name)`: a studio part in its own coordinates.
- **One adapter, src/api/assemblyCore.ts.** The tools are async (they take an evaluator), but none of their writes
  needs one. So the adapter does the same writes in sync, over the core's sync functions: `solveAssembly`, `tablesFor`,
  `mateRefusal`, `runVariabilityTool`, `variantOf`, `jointTreeOf`, `placedDoc`.
- **The oracle** (test/api-assembly.test.ts, 4/4):
  - A plate with a bore and a pin, mated concentric and flush, with an input driving the flush distance, a variant and
    a tool frame. Its `.doc` equals, byte for byte, what the agent's tools write for the same calls: `add_part`, the
    pin's own `run_command` with `part: p1`, two `add_mate`, `set_inputs`, `set_variants` and `set_frames`, through
    `dispatchTool`. That's the ungated dispatcher, because an agent proposes assembly changes (D41) and an accepted
    proposal replays this.
  - The placements equal `solveDoc`'s; the pin stands at (20, 20, 0). The variant equals `variantOf`'s, with the pin
    raised 5 mm. The frame poses equal `treeOfDoc`'s, the tip at (20, 20, 30). The meshes equal each placed document's
    evaluation.
  - Also tested: immutability, `part()` and `place()`, and typed refusals: the facade's own (`NAME_TAKEN`,
    `PART_UNKNOWN`, `SELECTION_ONE`, `VALUE`), and the core's (`FRAME_LINK_STALE`, `INPUT_DEFAULT`, the solver's
    refusal of a concentric mate between flat faces).
- **Not in R7.5:** editing a placed part in place (the agent's part-scoped path also resolves shop rows and refreshes
  followed frames); delete and edit of parts and mates; library parts and snaps; joints and kinematics; STEP and BOM of
  an assembly.

## Object types

| Type | What it is | Built on |
|---|---|---|
| `Part` | an immutable part: a name and its document | `StudioDoc`; `rectanglePart`, `withNode`, `leafBodies` |
| `BodyQuery` | one body's edges and faces, read once from the core's evaluation | `evaluateDoc` → `BodyResult.mesh` (`DisplayEdge`, `DisplayFace`) |
| `EdgeQuery`, `FaceQuery` | typed, immutable selections: filter, sort, take | the mesh's `straight`, `axis`, `faces`, `normal`, `centroid`, `names` |
| `BarocssError` | one typed error in the conventions' shape (§6): `code`, `message`, `where`, `details` (the core's own words under `details.friendly`) | the core's `FriendlyError` and `stepFor`'s `{ error }` |

Built in R7.4b (see its section): more part features (cylinder, sketches with extrude and revolve, chamfer, shell,
patterns, `.union()`, `.subtract()` and `.intersect()`, since TS has no operator overloading); the body chooser
`part.body(name)`; `Sketch`, the replicad-style chain on a `Plane`; `Plane` and `Location`.

These come later, each with the same oracle:
- **More of the assembly:** editing a placed part in place, deletes and edits, library parts, joints (R7.5 built the
  rest; see its section).
- **More part features:** split, mirror, parameters.
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
- **The mass argument (done in R7.4a):** cad takes `mass({ densityGPerCm3 })`, and cad-model takes
  `mass(material | { densityGPerCm3 })`, so a bare number can't be mistaken for a material id.

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

4. **Positional side names remap silently** (R7.4b, both cores). A sketch without `sideTags` names its walls by
   position (`side1`), D86's old form, which commands and add_features still write. Insert a polygon vertex upstream and
   a fillet's stored `side1|side2` rounds another corner, with no refusal. Measured: the square's (40, 40) fillet moved
   to (40, 0) after a point went into its first side, the same in the kernel and the studio.
   - The studio's fillet node carries `sigs`, each edge's geometry where it was picked, and evaluation doesn't compare
     them. The edit tool's rematch (engine/rematch.ts) does, but a document edited elsewhere skips it.
   - Proposed, for the outer lane: refuse, typed, when a stored edge's signature no longer matches the edge of that
     name.
   - The facade's sketches are tagged, so documents it builds aren't exposed.
5. **The studio's `rotate` pivots on the body's centre by default; the kernel's, on the origin.** One verb, two
   defaults. Noted for R7.3c, one function per concept.
6. **Closed curves are counted differently.** In the studio's display, a cylinder's rim is one edge with two names and
   its side is one face. In the kernel's B-rep they're two half-edges and two half-faces. So a count-based selector
   (`curved().last(1)`) picks the whole rim in cad-model but half of it in cad. Selecting by geometry (`where`,
   `sortBy`, `facing`) reads the same in both. Making cad's `brepSelection` merge them, as the display does, is open in
   this lane; it would change cad's R7.4a counts (the top face's edges 6 → 5).

7. **The assembly tools' writes aren't core functions** (R7.5, outer lane). add_part, place_part, add_mate and
   set_frames write their changes inline in async tool handlers (chat/assembly.ts, chat/robot.ts), though none of the
   writes awaits anything. The facade's adapter (src/api/assemblyCore.ts) mirrors them in sync, held to them byte for
   byte by its test.
   - Proposed for R7.3c: `addPart(doc, options)`, `placePart`, `addMate` and `setFrames` as `verb(doc, options) → doc`
     core functions (§3), with the tools and the adapter both calling them.

## The kernel's old object API (`createCadModel`) and what replaces it

`packages/barocss-cad/src/modeling.ts` has `createCadModel()` with `CadModel`, `CadShape` and `CadSketch`. It's a
bounded, recipe-limited object API from before `evaluateCadPart`, and it's prior art for naming only. The facade
doesn't build on it. Nothing outside cad calls it. R7.3 retires it once the facade covers what its tests show. Its 35
`test/modeling-*.test.mjs` files (counts are files using each method) use these methods, which the facade covers as follows:

| Old method (`CadShape` / `CadModel`) | Tests using it | Facade |
|---|---|---|
| `rectangle(...).extrude(h)` | 29 | **slice 1**: `part().box(w, d, h)` (a rectangle sketch extruded); a general `sketch().rectangle()` comes in step 2 |
| `hole({ center, radius })` | 17 | **slice 1**: `.hole(face selector, { dMM, xMM, yMM, type?, depthMM? })` |
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
  - refusal.ts (`BarocssError`, `FacadeCode`, `bracketedCode`);
  - sketch.ts (R7.4b: `Plane`, `Location`, `sketch()` and `Sketch`).
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

## Hand-over (2026-10-24, after R7.4b)

R7.4b and R7.5 are committed and their checks pass. The next work is R7.5b (gpu's growth), then R7.6 with the docs lane.

- **A new part verb:** add a `FeatureSpec` case and its option builder in cad/src/api/spec.ts, the verb on `Part` in
  cad/src/api/part.ts, and the kernel features in cad/src/api/kernel.ts.
  - cad-model's studio backend needs no change for a verb whose v2 command exists, as long as the spec's `values` keys
    are the command's. `namesOf` in studio.ts says which faces, edges and bodies the command is given.
  - Test both oracles per verb: the hand-written document, and, for cad-model, the agent's run_command and add_features
    output (test/api-verbs.test.ts's `agent` calls).
- **Keep core calls in the adapters:** cad/src/api/core.ts, cad-model/src/api/core.ts and studio.ts. R7.3a/b, which
  moves the cores to `BarocssError` and MMGS, then changes only those files:
  - cad-model's `massOf` then drops its ×1000;
  - cad's drops its kg conversions;
  - the facades' `BarocssError` becomes a re-export of the core's.
- **Tests:**
  - cad: `node --test test/api-*.test.mjs` after a build (`node scripts/tool.mjs build:fast`, or `pnpm build:library`,
    which cad-model's tsc needs for the `.d.ts`);
  - cad-model: `node scripts/test.mjs api-` (api-part, api-verbs, api-assembly);
  - gpu: `node --test tests/api-scene.test.mjs`, and, after both packages' build:library,
    `CHROME=… PW_DIR=… node --test tests/api-show-browser.test.mjs`.
- **Traps:**
  - a bare `npx tsc` in packages/barocss-gpu overwrites dist/index.js with an unbundled file, so run `build:library`
    before the browser test;
  - stepFor and exportStep stamp the time, so tests mask FILE_NAME's stamp;
  - the studio backend sets no autonomy; the run_command comparison test sets `CAD_AUTONOMY=3` and restores it.
