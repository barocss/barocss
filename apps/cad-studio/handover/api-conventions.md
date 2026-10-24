# API conventions for cad, cad-model and gpu (R7.2, 2026-10-24)

**Status: owner-approved, 2026-10-24** ("로드맵 제대로 정해서 진행해줘", after the R7 proposal, the §10 common data
formats and the facade structure in §11). R7.3 onwards implements these rules.

On 2026-10-24 the owner decided the API is two layers: the core stays data and functions, and the public facade is
object-style ("겉 api 는 객체 형태로"). These rules apply to new code now. R7.3 brings the existing public surface
in line with them.

The evidence is the R7.1 inventory, regenerated with `node apps/library-docs/scripts/api-inventory.mjs <out>`.

## 1. Two layers

| Layer | Where | Who uses it | Shape |
|---|---|---|---|
| Core | `@barocss/cad` (the kernel), `@barocss/cad-model/*` (the studio's model) and `@barocss/gpu` | the studio, the worker, the agent's tools, cad-mcp and cad-cli, tests | JSON data and free functions (§2–§6) |
| Facade | `@barocss/cad-model/api` (the API lane) | people writing code, and the docs' samples | immutable objects whose methods add document nodes and call the core (§7) |

The JSON documents, `CadPartDocument` and `StudioDoc`, are the source of truth. The facade never holds state that
isn't in `.doc`. The agent stays on the JSON v2 tools.

## 2. Data

- **What may cross a boundary** is plain, JSON-serialisable data: a document, an option set or a result, crossing a
  file, the worker, the agent or the network. That means no class instances, methods, Maps, Sets or functions, and no
  `undefined` used to carry meaning.
- **Typed arrays** are allowed only in mesh payloads, such as positions, indices and normals. They travel over the
  worker wire as transferables.
- **Units** follow MMGS: mm, g, s.
  - Lengths are in mm. Angles in documents and options are in degrees.
  - Mass is in g. Density is in g/cm³, the way materials are quoted.
  - Volume is in mm³, area in mm², and inertia in g·mm².
  - A field name carries its unit, as cad already does (`volumeMM3`, `massG`, `areaMM2`, `inertiaGMM2`,
    `angleDeg`).
  - Today cad's mass properties are in kg and kg/m³ (`massKG`, `inertiaCentroidKgM2`, density in kg/m³), while
    cad-model's are in g and g/cm³. R7.3 moves cad's public results to MMGS.
- **Ids and names** follow the document's existing rules. A face or edge reference that the core resolves stays
  valid across re-evaluation, or is refused, typed. It is never silently remapped.

## 3. Functions

- **Operations** are `verb(subject, options?) → result`. The subject comes first: a document, a body or a part
  output. Options are one object, never positional flags.
- **Verbs** are evaluate, export, check, find, measure, solve, make, apply and read. `…Of(x)` is allowed for a
  pure derived value: `revisionOf`, `variantOf`, `boundsOf`.
- **No duplicate concepts.** There is one function per concept per level:
  - the kernel level takes a part document or B-reps (`exportStep(breps, options)`);
  - the model level takes a StudioDoc (`exportStudioStep(doc, options)`).

  Today there are three ways to get a STEP (cad's `exportStep`, `CadPartOutput.exportStep`, cad-model's `stepFor`).
  There are three mass shapes, and `boxOf` is declared twice with different vector types. R7.3 settles each concept
  on one function per level.
- **Renames:** new code follows these rules now. Existing names are renamed in R7.3 only where the facade or the docs
  call them, so that churn stays proportional. The 860 noun-named cad-model functions aren't renamed wholesale.

## 4. Results

- **A result is data,** with no methods. Today `CadPartOutput`'s `massProperties`, `exportStl`, `exportStep`,
  `validate`, `surfaceArea` and `flatPattern`, and `CadPartSnapshot`'s `withParameters`, `withDocument` and `save`,
  become functions that take the output or snapshot as their first argument:
  - `massPropertiesOf(output, densityGCM3)`;
  - `exportStep(output, options)`;
  - `reevaluate(snapshot, { parameters })`.
- **Lazy, expensive values** stay lazy as functions over the result, never as getters. O18 showed why: a spread such as
  the worker's `{ mesh, ...rest }` runs every getter.

## 5. Classes

A class is only for something that owns a resource or a session:
- gpu: `Viewer`, `Camera`, `OrbitControls`, `Mesh`, `Geometry`, `ImageTexture`;
- cad-model: the wire senders and receivers, `SegmentGrid`, `SketchHistory`, `CandidateBoard`;
- cad: `BrepEditor`.

A class's state never goes into a document. Only plain data does.

## 6. Errors and refusals: one shape

- **Every package refuses** with one error type of the same shape:
  `class BarocssError extends Error { code: string; where?: string; details?: Record<string, unknown> }`.
  - `code` is a stable, upper-snake identifier, as the bracketed codes are now.
  - `message` is the person-readable sentence, written today as `"[CODE] …"` text. The bracketed prefix is kept, so the
    agent and the docs' refusal table read the same text.
  - Each package declares its codes as one union type, so the docs table is generated from types, not by scraping
    strings.
- **Operations throw** a BarocssError when they refuse. They never return an error string mixed into their result.
- **Validators** (`check…`) return `Problem[]`, where `Problem` is `{ code, message, where? }`, and never throw.
  Today's `…Problem(x): string | null` functions become `check…`.
- **The agent's tool layer** catches BarocssError and returns it as the tool's error (O14's run_command change). Its
  text is unchanged.
- **Migration (R7.3):**
  - cad's 152 per-module Error classes fold into BarocssError codes. `CadPartError.code` already points that way.
  - cad-model's 19 classes, 35 bracketed-string returns and 81 throws follow.
  - gpu's 36 classes and its `{ ok }` returns follow.
  - The fingerprint must stay byte-identical, because it records refusal messages: a code move must not change a
    message.

## 7. The facade (`@barocss/cad-model/api`)

- **Objects are immutable.** Every method returns a new object.
- **Every method adds document nodes** and calls the core. It never computes geometry itself.
- **`.doc`** returns the JSON document, the same thing a person or the agent could have written by hand.
- **Results** such as `mass()`, `bounds()` and `step()` return plain data from the core functions.
- **Selectors are typed,** with filters, sorts and groups over edges and faces. There are no string selectors.
- **Errors** are the core's BarocssError, passed through unchanged.
- **References:**
  - replicad: TS ergonomics, the sketcher, finders;
  - build123d: the result as data, selectors, Plane and Location;
  - Manifold: immutability;
  - Onshape FeatureScript: stable queries.
- **The oracle for every facade method:** its `.doc` equals the hand-written document, and its results equal the
  core's on that document, byte for byte.
- **The kernel's old object API** is `createCadModel()`, with `CadShape`, `CadSketch` and `CadModel` in
  `packages/barocss-cad/src/modeling.ts`. It is a bounded, recipe-limited API from before `evaluateCadPart`: integer
  rectangular plates, quarter-turn patterns, "terminal" copies. Nothing in cad-model, the studio or the docs calls it.
  Under the latest-schema rule there's no migration, so R7.3 retires it once the facade covers what its tests show.

## 8. Legacy surfaces

The documents are unreleased and track the latest schema. So cad's roughly 30 `evaluate…Document` and
`…FeatureGraph` functions for older document versions retire in R7.3, after a check that nothing calls them. Their
tests either move to `evaluateCadPart` fixtures or go with them.

## 9. How R7.3 runs

- **Owners:** each lane changes its own package. Kernel: cad. Outer: cad-model's core. GPU: gpu. The studio's call
  sites move with the change that breaks them.
- **The order:**
  1. errors;
  2. cad's result methods to functions, with units to MMGS;
  3. one function per duplicated concept;
  4. legacy retirement.
- **Verification:**
  - Refactors leave the fingerprints byte-identical (R4's and R5's).
  - The unit change (step 2) is the one intended value change. It's recorded per field, and the studio's display stays
    the same.
- **Generated docs:** the refusal table switches from scraping strings to reading the code unions. The API inventory
  joins check:docs once R7.3 is done, as a drift check on these rules.

## 10. Common data formats across the three packages

1. **Coordinate frame:** right-handed, **Z up**, millimetres, everywhere. The gpu Viewer is already Z-up: Camera.up
   is [0, 0, 1], and the studio feeds CAD XYZ unconverted. No conversion exists or is added. gpu's packet tag
   `right-handed-y-up` is a misleading label that nothing acts on; R7.3d renames it, in gpu and in the kernel's
   core/packet.ts together, with no alias.
2. **Geometry primitives** have one shape, by structure rather than through a shared package:
   - `Vec3 = readonly [x, y, z]`;
   - `Mat3`: 9 numbers, row-major, whose columns are the frame's axes, so Z = [R[2], R[5], R[8]];
   - `Mat4`: a column-major `Float64Array(16)`, used only inside computation;
   - `Pose` in documents: `{ positionMM: Vec3, rotationDeg: Vec3 }`, rotated about X, then Y, then Z, as instances
     and frames already are.

   New code uses these. The 13 `Vec3`/`V3`/`Vector3` declarations converge in R7.3c, where they cross a package.
3. **Mesh data:** `{ key, positions: Float32Array, normals?: Float32Array, indices: Uint32Array }` in mm and Z up. It
   optionally adds `faceIds` and `lines`, the display lines (the selectable edges as segment pairs), which gpu draws as
   line geometry (`topology: 'lines'`). The field is `lines`, not `edges`: gpu's `GeometryInput.edges` already means
   per-segment ids (R7.5b, finding 9). This is the facades' `.meshes()` shape, and gpu's `GeometryInput` takes it as it
   is.
4. **References to topology** across a package boundary are `{ body, face?, edge? }`, carrying the persistent names
   (`n1.side0|n1.side1`). Indices stay inside one package.
5. **Stored and transmitted formats** carry the header `{ format, schema }`. The documents are unreleased and track the
   latest schema, so there are no version branches.
6. **Materials** have one id, such as `al6061`. It finds the density in cad-model's library and the look in gpu's
   materials. The kernel takes a density, never an id.
7. **Requests and cancellation:** worker requests carry a request id and the document revision. A newer request
   cancels older ones on its lane (O9), and results are matched by ref, never by order (O18). New async APIs follow
   this.

## 11. The facades' structure

- **One part implementation.** `@barocss/cad/api`'s `part()` is the part. `@barocss/cad-model/api`'s `part()` wraps it
  and adds only the studio layer: materials by id, rows, the studio document, assemblies and variants. A part feature
  is added once, in cad, and cad-model inherits it.
- **Shared code lives in cad/src/api:** the selectors and BarocssError. cad-model imports them. gpu imports neither and
  matches by structure.
- **Which to use:**
  - `@barocss/cad/api` for a kernel-only part, with `.doc` a CadPartDocument;
  - `@barocss/cad-model/api` for anything the studio opens, with `.doc` a StudioDoc;
  - `@barocss/gpu/api` to show either.

## 12. One vocabulary with the agent

- The facade's modelling verbs carry the agent's v2 command names (COMMAND_DOCS in chat/part/features.ts), written in
  camelCase: extrude, revolve, pipe, `offsetFace`, hole, fillet, chamfer, shell and so on.
- Option names match the command's `values`, with units in the name (§2).
- A verb with no v2 command, such as `box`, is named for its studio palette entry.
- The docs, the facade and the agent's tool table then read as one vocabulary. Read-only results (mass, step, stl,
  meshes) aren't commands and keep their names.
